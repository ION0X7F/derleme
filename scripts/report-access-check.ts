import {
  sanitizeStoredReportForAccess,
  sanitizeStoredReportListItemForAccess,
} from "../lib/report-access";

function buildTrace() {
  return {
    version: 2,
    mode: "deterministic",
    aiDecision: {
      eligible: true,
      executed: true,
      mode: "full",
      reason: "ok",
      blockingFields: ["a", "b", "c", "d", "e"],
      coverageTier: "strong",
    },
    primaryDiagnosis: "diag",
    primaryTheme: "content",
    confidence: "high",
    scoreSummary: { seo: 80, conversion: 70, overall: 75 },
    metricSnapshot: [
      { key: "productQuality", label: "pq", score: 70, status: "ok", evidence: [] },
      { key: "sellerTrust", label: "st", score: 65, status: "ok", evidence: [] },
      { key: "marketPosition", label: "mp", score: 60, status: "ok", evidence: [] },
      { key: "marketPosition", label: "mp2", score: 59, status: "ok", evidence: [] },
    ],
    topSignals: [
      { key: "s1", label: "s1", detail: "d", tone: "warning", source: "metric", weight: 80, relatedFields: [] },
      { key: "s2", label: "s2", detail: "d", tone: "warning", source: "metric", weight: 70, relatedFields: [] },
      { key: "s3", label: "s3", detail: "d", tone: "warning", source: "metric", weight: 60, relatedFields: [] },
      { key: "s4", label: "s4", detail: "d", tone: "warning", source: "metric", weight: 50, relatedFields: [] },
    ],
    benchmarkSignals: [
      { key: "b1", label: "b1", detail: "d", tone: "warning", source: "benchmark", weight: 80, relatedFields: [] },
      { key: "b2", label: "b2", detail: "d", tone: "warning", source: "benchmark", weight: 70, relatedFields: [] },
    ],
    learningSignals: ["l1", "l2"],
    recommendedFocus: ["f1", "f2", "f3"],
    blockedByData: ["m1", "m2", "m3", "m4"],
    decisionFlow: [
      { key: "k1", title: "t1", detail: "d", status: "selected" },
      { key: "k2", title: "t2", detail: "d", status: "selected" },
      { key: "k3", title: "t3", detail: "d", status: "selected" },
      { key: "k4", title: "t4", detail: "d", status: "selected" },
    ],
  };
}

function buildReport(plan: "guest" | "free" | "pro") {
  return {
    id: "r1",
    url: "https://www.trendyol.com/marka/urun-p-123",
    platform: "trendyol",
    category: "test",
    seoScore: 70,
    conversionScore: 65,
    overallScore: 68,
    dataCompletenessScore: 72,
    summary: "sum",
    dataSource: "real",
    createdAt: new Date().toISOString(),
    priceCompetitiveness: "neutral",
    accessState: { plan },
    extractedData: {
      original_price: 1000,
      discount_rate: 10,
      question_count: 12,
      shipping_days: 2,
      delivery_type: "hizli",
      seller_badges: ["x"],
      seller_score: 8.7,
      follower_count: 10000,
      other_sellers_count: 5,
      other_sellers_summary: { cheaper_count: 2 },
      official_seller: true,
      has_campaign: true,
      campaign_label: "kampanya",
    },
    derivedMetrics: {
      productQuality: { score: 60 },
      sellerTrust: { score: 61 },
      marketPosition: { score: 62 },
      extraField: { score: 10 },
    },
    coverage: {
      availableFields: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"],
      missingFields: ["m1", "m2", "m3", "m4", "m5", "m6", "m7"],
      confidence: "medium",
    },
    suggestions: ["s1", "s2", "s3", "s4", "s5"],
    priorityActions: ["p1", "p2", "p3", "p4", "p5"],
    analysisTrace: buildTrace(),
  };
}

type Check = { label: string; passed: boolean; detail?: unknown };

function run() {
  const checks: Check[] = [];

  const guest = sanitizeStoredReportForAccess(buildReport("guest"));
  checks.push({
    label: "guest masks pricing and seller-sensitive fields",
    passed:
      guest.priceCompetitiveness === null &&
      guest.extractedData?.original_price === null &&
      guest.extractedData?.discount_rate === null &&
      guest.extractedData?.seller_score === null,
    detail: guest.extractedData,
  });
  checks.push({
    label: "guest clips suggestions/actions to 1",
    passed:
      Array.isArray(guest.suggestions) &&
      guest.suggestions.length === 1 &&
      Array.isArray(guest.priorityActions) &&
      guest.priorityActions.length === 1,
    detail: {
      suggestions: guest.suggestions,
      priorityActions: guest.priorityActions,
    },
  });

  const free = sanitizeStoredReportForAccess(buildReport("free"));
  checks.push({
    label: "free clips suggestions/actions to 3",
    passed:
      Array.isArray(free.suggestions) &&
      free.suggestions.length === 3 &&
      Array.isArray(free.priorityActions) &&
      free.priorityActions.length === 3,
    detail: {
      suggestions: free.suggestions,
      priorityActions: free.priorityActions,
    },
  });
  checks.push({
    label: "free coverage and trace are clipped",
    passed:
      Array.isArray(free.coverage?.availableFields) &&
      free.coverage.availableFields.length === 8 &&
      Array.isArray(free.coverage?.missingFields) &&
      free.coverage.missingFields.length === 6 &&
      Array.isArray(free.analysisTrace?.topSignals) &&
      free.analysisTrace.topSignals.length === 3,
    detail: {
      coverage: free.coverage,
      topSignals: free.analysisTrace?.topSignals,
    },
  });

  const pro = sanitizeStoredReportForAccess(buildReport("pro"));
  checks.push({
    label: "pro keeps up to 5 suggestions/actions",
    passed:
      Array.isArray(pro.suggestions) &&
      pro.suggestions.length === 5 &&
      Array.isArray(pro.priorityActions) &&
      pro.priorityActions.length === 5,
    detail: {
      suggestions: pro.suggestions,
      priorityActions: pro.priorityActions,
    },
  });

  const compact = sanitizeStoredReportListItemForAccess(buildReport("pro"));
  checks.push({
    label: "list sanitizer keeps only compact extracted fields",
    passed:
      !!compact.extractedData &&
      typeof compact.extractedData === "object" &&
      !("review_snippets" in compact.extractedData) &&
      !("other_seller_offers" in compact.extractedData) &&
      "seller_score" in compact.extractedData &&
      (compact.extractedData as { other_sellers_summary?: { count?: unknown } })
        .other_sellers_summary?.count === null,
    detail: compact.extractedData,
  });
  checks.push({
    label: "list sanitizer compacts analysis trace to diagnosis-focused shape",
    passed:
      !!compact.analysisTrace &&
      typeof compact.analysisTrace === "object" &&
      "primaryDiagnosis" in compact.analysisTrace &&
      !("topSignals" in compact.analysisTrace),
    detail: compact.analysisTrace,
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
