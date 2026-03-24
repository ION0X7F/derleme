import { buildAnalysisDecisionSummary } from "../lib/analysis-decision-summary";
import type { AnalysisTrace } from "../types/analysis";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

const baseTrace: AnalysisTrace = {
  version: 2,
  mode: "ai_enriched",
  aiDecision: {
    eligible: true,
    executed: true,
    mode: "full",
    reason: "high confidence",
    blockingFields: [],
    coverageTier: "strong",
  },
  primaryDiagnosis: "x",
  primaryTheme: "delivery",
  confidence: "high",
  scoreSummary: { seo: 80, conversion: 78, overall: 79 },
  metricSnapshot: [],
  topSignals: [],
  benchmarkSignals: [],
  learningSignals: [],
  recommendedFocus: [],
  blockedByData: [],
  decisionFlow: [],
};

function run() {
  const checks: Check[] = [];

  const enriched = buildAnalysisDecisionSummary({
    analysisTrace: baseTrace,
    dataSource: "platform",
  });
  checks.push({
    label: "ai enriched summary exposes executed full mode",
    passed:
      enriched.mode === "ai_enriched" &&
      enriched.aiExecuted === true &&
      enriched.aiMode === "full" &&
      enriched.aiReason === "high confidence" &&
      enriched.coverageTier === "strong" &&
      enriched.fallbackUsed === false &&
      enriched.dataSource === "platform",
    detail: enriched,
  });

  const deterministic: AnalysisTrace = {
    ...baseTrace,
    mode: "deterministic",
    aiDecision: {
      eligible: false,
      executed: false,
      mode: "skip",
      reason: "coverage weak",
      blockingFields: ["image_count"],
      coverageTier: "weak",
    },
  };
  const skipped = buildAnalysisDecisionSummary({
    analysisTrace: deterministic,
    dataSource: "fallback",
  });
  checks.push({
    label: "deterministic skip summary marks fallback used",
    passed:
      skipped.mode === "deterministic" &&
      skipped.aiExecuted === false &&
      skipped.aiMode === "skip" &&
      skipped.aiReason === "coverage weak" &&
      skipped.coverageTier === "weak" &&
      skipped.fallbackUsed === true &&
      skipped.dataSource === "fallback",
    detail: skipped,
  });

  const nullTrace = buildAnalysisDecisionSummary({
    analysisTrace: null,
    dataSource: null,
  });
  checks.push({
    label: "null trace yields safe deterministic defaults",
    passed:
      nullTrace.mode === "deterministic" &&
      nullTrace.aiExecuted === false &&
      nullTrace.aiMode === null &&
      nullTrace.aiReason === null &&
      nullTrace.coverageTier === null &&
      nullTrace.fallbackUsed === true &&
      nullTrace.dataSource === null,
    detail: nullTrace,
  });

  const failed = checks.filter((item) => !item.passed);
  console.log(
    JSON.stringify(
      {
        total: checks.length,
        passed: checks.length - failed.length,
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

run();
