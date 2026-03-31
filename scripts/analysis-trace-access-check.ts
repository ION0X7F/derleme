import { sanitizeAnalysisTraceForAccess } from "../lib/analysis-trace";
import type { AnalysisTrace } from "../types/analysis";

function createTrace() {
  return {
    version: 2,
    mode: "ai_enriched",
    aiDecision: {
      eligible: true,
      executed: true,
      mode: "full",
      reason: "high confidence",
      blockingFields: ["f1", "f2", "f3", "f4", "f5"],
      coverageTier: "strong",
    },
    primaryDiagnosis: "Teslimat ve fiyat baskisi",
    primaryTheme: "delivery",
    confidence: "high",
    scoreSummary: {
      seo: 70,
      conversion: 68,
      overall: 69,
    },
    metricSnapshot: [
      { key: "productQuality", label: "PQ", score: 60, status: "weak", evidence: ["e1"] },
      { key: "sellerTrust", label: "ST", score: 62, status: "weak", evidence: ["e2"] },
      { key: "marketPosition", label: "MP", score: 58, status: "weak", evidence: ["e3"] },
      { key: "marketPosition", label: "MP2", score: 57, status: "weak", evidence: ["e4"] },
    ],
    topSignals: [
      { key: "s1", label: "s1", detail: "d1", tone: "warning", source: "metric", weight: 90, relatedFields: [] },
      { key: "s2", label: "s2", detail: "d2", tone: "warning", source: "metric", weight: 80, relatedFields: [] },
      { key: "s3", label: "s3", detail: "d3", tone: "warning", source: "metric", weight: 70, relatedFields: [] },
      { key: "s4", label: "s4", detail: "d4", tone: "warning", source: "metric", weight: 60, relatedFields: [] },
    ],
    benchmarkSignals: [
      { key: "b1", label: "b1", detail: "d1", tone: "warning", source: "benchmark", weight: 75, relatedFields: [] },
      { key: "b2", label: "b2", detail: "d2", tone: "warning", source: "benchmark", weight: 65, relatedFields: [] },
    ],
    learningSignals: ["l1", "l2", "l3"],
    recommendedFocus: ["f1", "f2", "f3"],
    blockedByData: ["m1", "m2", "m3", "m4"],
    decisionFlow: [
      { key: "k1", title: "t1", detail: "d1", status: "selected" },
      { key: "k2", title: "t2", detail: "d2", status: "selected" },
      { key: "k3", title: "t3", detail: "d3", status: "selected" },
      { key: "k4", title: "t4", detail: "d4", status: "selected" },
    ],
  } as const;
}

type Check = { label: string; passed: boolean; detail?: unknown };

function run() {
  const checks: Check[] = [];
  const trace = createTrace();

  const guest = sanitizeAnalysisTraceForAccess(trace as unknown as AnalysisTrace, "guest");
  checks.push({
    label: "guest trace clips deeply",
    passed:
      Boolean(guest) &&
      guest!.metricSnapshot.length === 2 &&
      guest!.topSignals.length === 2 &&
      guest!.benchmarkSignals.length === 0 &&
      guest!.learningSignals.length === 0 &&
      guest!.recommendedFocus.length === 1 &&
      guest!.decisionFlow.length === 2 &&
      (guest!.aiDecision?.blockingFields.length ?? 0) === 2,
    detail: guest,
  });

  const free = sanitizeAnalysisTraceForAccess(trace as unknown as AnalysisTrace, "free");
  checks.push({
    label: "free trace clips moderately",
    passed:
      Boolean(free) &&
      free!.metricSnapshot.length === 3 &&
      free!.topSignals.length === 3 &&
      free!.benchmarkSignals.length === 1 &&
      free!.learningSignals.length === 1 &&
      free!.recommendedFocus.length === 2 &&
      free!.decisionFlow.length === 3 &&
      (free!.aiDecision?.blockingFields.length ?? 0) === 4,
    detail: free,
  });

  const pro = sanitizeAnalysisTraceForAccess(trace as unknown as AnalysisTrace, "pro");
  checks.push({
    label: "pro trace keeps full payload",
    passed:
      Boolean(pro) &&
      pro!.metricSnapshot.length === 4 &&
      pro!.topSignals.length === 4 &&
      pro!.benchmarkSignals.length === 2 &&
      pro!.learningSignals.length === 3 &&
      pro!.recommendedFocus.length === 3 &&
      pro!.decisionFlow.length === 4 &&
      (pro!.aiDecision?.blockingFields.length ?? 0) === 5,
    detail: pro,
  });

  const nil = sanitizeAnalysisTraceForAccess(null, "guest");
  checks.push({
    label: "null trace stays null",
    passed: nil === null,
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
