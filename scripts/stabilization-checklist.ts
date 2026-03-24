import { isAiAnalysisEligible } from "../lib/ai-eligibility";
import { evaluateAnalysisContract } from "../lib/analysis-contract";
import { buildAnalysis } from "../lib/build-analysis";
import { prepareAnalysisInput } from "../lib/prepare-analysis-input";
import type {
  ExtractedFieldMetadata,
  ExtractedProductFields,
} from "../types/analysis";
import {
  createExtracted,
  TEST_PLATFORM,
  TEST_URL,
} from "./analysis-fixtures";

type CheckResult = {
  name: string;
  passed: boolean;
  detail: string;
};

function assertCheck(results: CheckResult[], check: CheckResult) {
  results.push(check);
}

function makeMetadata(
  extracted: ExtractedProductFields,
  overrides?: Partial<Record<keyof ExtractedProductFields, ExtractedFieldMetadata>>
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

    const source = key === "question_count" ? "derived" : "platform";
    const confidence = source === "platform" ? "high" : "low";

    metadata[String(key)] = {
      source,
      confidence,
      reason: source === "platform" ? "platform extractor" : "derived field",
      timestamp: Date.now(),
      fallbackChain: source === "platform" ? ["platform"] : ["platform", "generic"],
    };
  }

  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (!value) continue;
    metadata[key] = value;
  }

  return metadata;
}

async function runCase(params: {
  extracted: ExtractedProductFields;
  metadata?: Record<string, ExtractedFieldMetadata>;
}) {
  const consolidatedInput = prepareAnalysisInput(
    params.extracted,
    params.metadata ?? makeMetadata(params.extracted)
  );
  const deterministic = buildAnalysis({
    platform: TEST_PLATFORM,
    url: TEST_URL,
    consolidatedInput,
    extracted: params.extracted,
    planContext: "pro",
  });
  const eligibility = isAiAnalysisEligible(consolidatedInput);
  const contract = evaluateAnalysisContract({
    input: consolidatedInput,
    aiEligibility: eligibility,
  });

  return {
    consolidatedInput,
    deterministic,
    eligibility,
    contract,
  };
}

async function run() {
  const checks: CheckResult[] = [];

  const strong = await runCase({ extracted: createExtracted({ extractor_status: "ok" }) });
  assertCheck(checks, {
    name: "veri-guclu",
    passed:
      strong.eligibility.mode !== "skip" &&
      strong.contract.coverageTier !== "weak",
    detail: `Guclu veri setinde AI='${strong.eligibility.mode}', contract='${strong.contract.coverageTier}'`,
  });

  const medium = await runCase({
    extracted: createExtracted({
      review_count: 20,
      rating_value: 4.1,
      image_count: 4,
      description_length: 130,
      seller_score: 8.2,
      extractor_status: "partial",
    }),
  });
  assertCheck(checks, {
    name: "veri-orta",
    passed:
      (medium.eligibility.mode === "cautious" || medium.eligibility.mode === "full") &&
      medium.contract.coverageTier !== "weak",
    detail: `Orta veri setinde AI='${medium.eligibility.mode}', contract='${medium.contract.coverageTier}'`,
  });

  const weak = await runCase({
    extracted: createExtracted({
      title: "Test urun",
      normalized_price: 999,
      image_count: 1,
      review_count: null,
      rating_value: null,
      description_length: null,
      seller_score: null,
      extractor_status: "fallback",
    }),
  });
  assertCheck(checks, {
    name: "veri-zayif",
    passed:
      (weak.eligibility.mode === "skip" || weak.eligibility.mode === "cautious") &&
      weak.contract.coverageTier !== "strong",
    detail: `Zayif veri setinde AI='${weak.eligibility.mode}', contract='${weak.contract.coverageTier}'`,
  });

  const missing = await runCase({
    extracted: createExtracted({
      title: null,
      normalized_price: null,
      image_count: 0,
      review_count: null,
      rating_value: null,
      description_length: null,
      seller_score: null,
      extractor_status: "blocked",
    }),
  });
  assertCheck(checks, {
    name: "eksik-veri",
    passed:
      missing.eligibility.mode === "skip" &&
      missing.contract.coverageTier === "weak" &&
      missing.contract.aiDecision.executed === false,
    detail: `Eksik veride AI='${missing.eligibility.mode}', contract='${missing.contract.coverageTier}'`,
  });

  const questionCountUnreliableMetadata = makeMetadata(
    createExtracted({
      question_count: 2,
      qa_snippets: null,
      has_faq: false,
    }),
    {
      question_count: {
        source: "derived",
        confidence: "low",
        reason: "derived from qa snippets",
        timestamp: Date.now(),
      },
    }
  );
  const questionCountUnreliable = await runCase({
    extracted: createExtracted({
      question_count: 2,
      qa_snippets: null,
      has_faq: false,
    }),
    metadata: questionCountUnreliableMetadata,
  });
  assertCheck(checks, {
    name: "question-count-guvenilmez",
    passed:
      questionCountUnreliable.deterministic.decisionSupportPacket.raw.question_count === 2 &&
      !questionCountUnreliable.deterministic.derivedMetrics.sellerTrust.evidence.some((item) =>
        item.toLocaleLowerCase("tr-TR").includes("soru-cevap hacmi")
      ),
    detail: "Guvenilmez question_count seller trust tarafinda agresif sinyal uretmiyor",
  });

  const modelCodeLowConfidence = await runCase({
    extracted: createExtracted({
      model_code: "Xiaomi Redmi Buds 6 Play Siyah",
    }),
    metadata: makeMetadata(createExtracted({}), {
      model_code: {
        source: "generic",
        confidence: "low",
        reason: "generic html extractor",
        fallbackChain: ["platform", "generic"],
        timestamp: Date.now(),
      },
    }),
  });
  assertCheck(checks, {
    name: "model-code-dusuk-guven",
    passed: modelCodeLowConfidence.consolidatedInput.modelCode.confidence < 0.45,
    detail: `model_code confidence ${modelCodeLowConfidence.consolidatedInput.modelCode.confidence}`,
  });

  const qualityVsSuggestions = await runCase({
    extracted: createExtracted({
      description_length: 70,
      has_specs: false,
      image_count: 2,
      review_count: 8,
      rating_value: 3.9,
      seller_score: 7.2,
    }),
  });
  const weakQuality =
    qualityVsSuggestions.deterministic.derivedMetrics.productQuality.label === "weak";
  const hasQualitySuggestion = qualityVsSuggestions.deterministic.suggestions.some((item) =>
    ["expand-description", "add-specs", "increase-images"].includes(item.key)
  );
  assertCheck(checks, {
    name: "quality-suggestion-uyumu",
    passed: !weakQuality || hasQualitySuggestion,
    detail: "Zayif kalite sinyali varsa ilgili suggestion uretiliyor",
  });

  const aiShouldStayQuiet = await runCase({
    extracted: createExtracted({
      extractor_status: "blocked",
      title: null,
      normalized_price: null,
      review_count: null,
      rating_value: null,
      description_length: null,
    }),
  });
  assertCheck(checks, {
    name: "ai-susmasi-gereken-durum",
    passed:
      aiShouldStayQuiet.eligibility.mode === "skip" &&
      aiShouldStayQuiet.contract.aiDecision.executed === false &&
      aiShouldStayQuiet.contract.coverageTier === "weak",
    detail: "Kritik kapsami olmayan veride AI skip ve kontrat weak modda",
  });

  const ruleFallbackCase = await runCase({
    extracted: createExtracted({
      extractor_status: "blocked",
      title: null,
      normalized_price: null,
      review_count: null,
      rating_value: null,
    }),
  });
  assertCheck(checks, {
    name: "rule-based-fallback",
    passed:
      ruleFallbackCase.eligibility.mode === "skip" &&
      ruleFallbackCase.contract.aiDecision.executed === false &&
      Boolean(ruleFallbackCase.deterministic.summary),
    detail: "AI skip kosulunda deterministic fallback raporu hazir",
  });

  const passedCount = checks.filter((item) => item.passed).length;
  const failed = checks.filter((item) => !item.passed);

  console.log(
    JSON.stringify(
      {
        total: checks.length,
        passed: passedCount,
        failed: failed.length,
        checks,
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
