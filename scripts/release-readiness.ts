import { isAiAnalysisEligible } from "../lib/ai-eligibility";
import { evaluateAnalysisContract } from "../lib/analysis-contract";
import { buildAnalysis } from "../lib/build-analysis";
import { prepareAnalysisInput } from "../lib/prepare-analysis-input";
import { getLearningEngineState } from "../lib/learning-engine";
import type {
  ExtractedFieldMetadata,
  ExtractedProductFields,
} from "../types/analysis";
import { createExtracted, TEST_PLATFORM, TEST_URL } from "./analysis-fixtures";

type Scenario = {
  key: string;
  extracted: ExtractedProductFields;
  expectedAi: "skip" | "cautious" | "full";
  maxVerbosityRisk: "low" | "medium" | "high";
};

function makeMetadata(
  extracted: ExtractedProductFields
): Record<string, ExtractedFieldMetadata> {
  const metadata: Record<string, ExtractedFieldMetadata> = {};

  for (const key of Object.keys(extracted) as Array<keyof ExtractedProductFields>) {
    const value = extracted[key];
    if (value == null || value === "") {
      metadata[String(key)] = {
        source: "null",
        confidence: "low",
        reason: "missing value",
        timestamp: Date.now(),
      };
      continue;
    }

    metadata[String(key)] = {
      source: key === "question_count" ? "derived" : "platform",
      confidence: key === "question_count" ? "low" : "high",
      reason: key === "question_count" ? "derived fallback" : "platform extractor",
      timestamp: Date.now(),
    };
  }

  return metadata;
}

function buildScenarioResult(scenario: Scenario) {
  const input = prepareAnalysisInput(scenario.extracted, makeMetadata(scenario.extracted));
  const deterministic = buildAnalysis({
    platform: TEST_PLATFORM,
    url: TEST_URL,
    consolidatedInput: input,
    extracted: scenario.extracted,
    planContext: "pro",
  });
  const ai = isAiAnalysisEligible(input);
  const contract = evaluateAnalysisContract({
    input,
    aiEligibility: ai,
  });

  const aiMatches =
    (scenario.expectedAi === "skip" && contract.aiDecision.mode === "skip") ||
    (scenario.expectedAi === "cautious" && contract.aiDecision.mode === "cautious") ||
    (scenario.expectedAi === "full" && contract.aiDecision.mode === "full");

  const hasSuggestion = deterministic.suggestions.length > 0;
  const hasPriority = deterministic.priorityActions.length > 0;

  const verbosityRisk =
    contract.aiDecision.mode === "skip"
      ? "low"
      : contract.aiDecision.mode === "cautious"
        ? "medium"
        : contract.coverageTier === "weak"
          ? "medium"
          : "high";

  const verbosityOk =
    scenario.maxVerbosityRisk === "high"
      ? true
      : scenario.maxVerbosityRisk === "medium"
        ? verbosityRisk !== "high"
        : verbosityRisk === "low";

  return {
    key: scenario.key,
    aiMode: contract.aiDecision.mode,
    coverageTier: contract.coverageTier,
    overallScore: deterministic.overallScore,
    checks: {
      aiMatches,
      hasSuggestion,
      hasPriority,
      verbosityOk,
    },
  };
}

async function run() {
  const learningEngine = getLearningEngineState();

  const scenarios: Scenario[] = [
    {
      key: "strong",
      extracted: createExtracted({ extractor_status: "ok" }),
      expectedAi: "full",
      maxVerbosityRisk: "high",
    },
    {
      key: "medium",
      extracted: createExtracted({
        extractor_status: "partial",
        description_length: 140,
        review_count: 45,
        seller_score: 8.1,
      }),
      expectedAi: "cautious",
      maxVerbosityRisk: "medium",
    },
    {
      key: "weak",
      extracted: createExtracted({
        extractor_status: "fallback",
        title: "Test urun",
        normalized_price: 999,
        description_length: null,
        review_count: null,
        rating_value: null,
      }),
      expectedAi: "skip",
      maxVerbosityRisk: "medium",
    },
    {
      key: "missing",
      extracted: createExtracted({
        extractor_status: "blocked",
        title: null,
        normalized_price: null,
        description_length: null,
        review_count: null,
        rating_value: null,
      }),
      expectedAi: "skip",
      maxVerbosityRisk: "low",
    },
  ];

  const results = scenarios.map(buildScenarioResult);
  const failures = results.filter((item) =>
    Object.values(item.checks).some((passed) => passed === false)
  );

  const learningChecks = {
    stateExplicit:
      typeof learningEngine.enabled === "boolean" &&
      (learningEngine.mode === "active" || learningEngine.mode === "safe_noop"),
    coreSafeByDefault: learningEngine.mode === "safe_noop",
  };

  const readiness =
    failures.length === 0 && learningChecks.stateExplicit
      ? "go_productization"
      : "continue_quality_loop";

  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        readiness,
        learningEngine,
        learningChecks,
        scenarios: results,
        failedCount: failures.length + (learningChecks.stateExplicit ? 0 : 1),
      },
      null,
      2
    )
  );

  if (failures.length > 0 || !learningChecks.stateExplicit) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
