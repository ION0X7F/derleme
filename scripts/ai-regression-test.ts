import {
  TEST_PLATFORM,
  TEST_URL,
} from "./analysis-fixtures";
import { getOfflineAnalysisScenarios } from "./analysis-scenarios";
import { evaluateAnalysisQuality } from "./analysis-quality-shared";

type RunMode = "fallback" | "auto";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertExists<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }

  return value;
}

function getArgValue(name: string) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function resolveMode(): RunMode {
  const raw = getArgValue("--mode");
  return raw === "auto" ? "auto" : "fallback";
}

async function main() {
  const requestedMode = resolveMode();

  if (requestedMode === "fallback") {
    process.env.GEMINI_API_KEY = "";
  }

  const effectiveMode =
    requestedMode === "auto" && process.env.GEMINI_API_KEY ? "auto" : "fallback";

  const { buildAnalysis } = await import("../lib/build-analysis");
  const { analyzeWithAi } = await import("../lib/ai-analysis");
  const { buildAnalysisTrace } = await import("../lib/analysis-trace");

  for (const scenario of getOfflineAnalysisScenarios()) {
    const analysis = buildAnalysis({
      platform: scenario.extracted.platform ?? TEST_PLATFORM,
      url: TEST_URL,
      extracted: scenario.extracted,
      planContext: "pro",
    });

    const result = await analyzeWithAi({
      packet: analysis.decisionSupportPacket,
      extracted: analysis.extractedData,
      url: TEST_URL,
      learningContext: scenario.learningContext,
      baseline: {
        summary: analysis.summary,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        suggestions: analysis.suggestions,
        seo_score: analysis.seoScore,
        conversion_score: analysis.conversionScore,
        overall_score: analysis.overallScore,
      },
    });

    const safeResult = assertExists(result, `${scenario.name}: sonuc donmeli.`);

    const trace = buildAnalysisTrace({
      mode: effectiveMode === "auto" ? "ai_enriched" : "deterministic",
      summary: safeResult.summary,
      suggestions: safeResult.suggestions,
      packet: analysis.decisionSupportPacket,
      extracted: analysis.extractedData,
      derivedMetrics: analysis.derivedMetrics,
      seoScore: safeResult.seo_score,
      conversionScore: safeResult.conversion_score,
      overallScore: safeResult.overall_score,
      learningContext: scenario.learningContext,
    });

    const quality = evaluateAnalysisQuality({
      name: scenario.name,
      summary: safeResult.summary,
      suggestions: safeResult.suggestions,
      expected: scenario.expected,
      topSignalLabels: trace.topSignals.map((item) => item.label),
    });

    for (const check of quality.checks) {
      assert(check.passed, `${scenario.name}: ${check.detail}`);
    }

    assert(
      !!trace.primaryDiagnosis,
      `${scenario.name}: trace primary diagnosis uretmeli.`
    );
    assert(
      trace.topSignals.length >= 1,
      `${scenario.name}: trace en az bir tetikleyici sinyal uretmeli.`
    );
  }

  console.log(
    JSON.stringify(
      {
        requestedMode,
        effectiveMode,
        scenarios: getOfflineAnalysisScenarios().length,
        status: "passed",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
