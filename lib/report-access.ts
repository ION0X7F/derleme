import { sanitizeAnalysisTraceForAccess } from "@/lib/analysis-trace";
import type { SavedReport } from "@/types";

type StoredReportLike = {
  id?: unknown;
  url?: unknown;
  platform?: unknown;
  category?: unknown;
  seoScore?: unknown;
  conversionScore?: unknown;
  overallScore?: unknown;
  dataCompletenessScore?: unknown;
  summary?: unknown;
  dataSource?: unknown;
  createdAt?: unknown;
  extractedData?: unknown;
  derivedMetrics?: unknown;
  coverage?: unknown;
  priceCompetitiveness?: string | null;
  accessState?: unknown;
  suggestions?: unknown;
  priorityActions?: unknown;
  analysisTrace?: unknown;
};

const REPORT_LIST_EXTRACTED_DATA_KEYS = [
  "title",
  "product_name",
  "h1",
  "product_title",
  "name",
  "primary_image",
  "images",
  "has_free_shipping",
  "has_return_info",
  "has_shipping_info",
  "official_seller",
  "seller_badges",
  "seller_score",
  "other_sellers_count",
  "other_sellers_summary",
  "campaign_label",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getPlan(accessState: unknown) {
  const plan =
    isObject(accessState) && typeof accessState.plan === "string"
      ? accessState.plan.toLowerCase()
      : null;

  if (plan === "guest" || plan === "free" || plan === "pro" || plan === "enterprise") {
    return plan;
  }

  return "free";
}

function getPlanLimits(plan: "guest" | "free" | "pro" | "enterprise") {
  if (plan === "guest") {
    return {
      maxSuggestions: 1,
      maxPriorityActions: 1,
    };
  }

  if (plan === "free") {
    return {
      maxSuggestions: 5,
      maxPriorityActions: 5,
    };
  }

  return {
    maxSuggestions: 24,
    maxPriorityActions: 24,
  };
}

function getNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getCreatedAtValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return new Date(0).toISOString();
}

export function sanitizeStoredReportForAccess<T extends StoredReportLike>(report: T): T {
  const plan = getPlan(report.accessState ?? null);
  const limits = getPlanLimits(plan);

  const nextReport: T = {
    ...report,
  };

  if (plan === "guest") {
    nextReport.priceCompetitiveness = null;

    if (isObject(report.derivedMetrics)) {
      nextReport.derivedMetrics = null;
    }

    if (isObject(report.coverage)) {
      nextReport.coverage = {
        availableFields: [],
        missingFields: [],
        confidence:
          typeof report.coverage.confidence === "string"
            ? report.coverage.confidence
            : "low",
      };
    }
  }

  if (isObject(report.extractedData)) {
    const extractedData = {
      ...report.extractedData,
    };

    if (plan === "guest") {
      extractedData.original_price = null;
      extractedData.discount_rate = null;
      extractedData.question_count = null;
      extractedData.shipping_days = null;
      extractedData.delivery_type = null;
      extractedData.seller_badges = null;
      extractedData.seller_score = null;
      extractedData.follower_count = null;
      extractedData.other_sellers_count = null;
      extractedData.other_sellers_summary = null;
      extractedData.official_seller = undefined;
      extractedData.has_campaign = undefined;
      extractedData.campaign_label = null;
    }

    if (plan === "free") {
      extractedData.delivery_type = null;
      extractedData.seller_badges = null;
      extractedData.seller_score = null;
      extractedData.follower_count = null;
      extractedData.other_sellers_count = null;
      extractedData.other_sellers_summary = null;
      extractedData.official_seller = undefined;
      extractedData.has_campaign = undefined;
      extractedData.campaign_label = null;
    }

    nextReport.extractedData = extractedData;
  }

  if (plan === "free" && isObject(report.derivedMetrics)) {
    nextReport.derivedMetrics = {
      productQuality: report.derivedMetrics.productQuality,
      sellerTrust: report.derivedMetrics.sellerTrust,
      marketPosition: report.derivedMetrics.marketPosition,
    };
  }

  if (plan === "free" && isObject(report.coverage)) {
    nextReport.coverage = {
      availableFields: Array.isArray(report.coverage.availableFields)
        ? report.coverage.availableFields.slice(0, 8)
        : [],
      missingFields: Array.isArray(report.coverage.missingFields)
        ? report.coverage.missingFields.slice(0, 6)
        : [],
      confidence:
        typeof report.coverage.confidence === "string"
          ? report.coverage.confidence
          : "medium",
    };
  }

  if (Array.isArray(report.suggestions)) {
    nextReport.suggestions = report.suggestions.slice(0, limits.maxSuggestions);
  }

  if (Array.isArray(report.priorityActions)) {
    nextReport.priorityActions = report.priorityActions.slice(
      0,
      limits.maxPriorityActions
    );
  }

  if (report.analysisTrace && typeof report.analysisTrace === "object") {
    nextReport.analysisTrace = sanitizeAnalysisTraceForAccess(
      report.analysisTrace as never,
      plan
    );
  }

  return nextReport;
}

function compactExtractedDataForList(extractedData: unknown) {
  if (!isObject(extractedData)) {
    return null;
  }

  const compact: Record<string, unknown> = {};
  for (const key of REPORT_LIST_EXTRACTED_DATA_KEYS) {
    if (key in extractedData) {
      compact[key] = extractedData[key];
    }
  }

  if (isObject(compact.other_sellers_summary)) {
    const summary = compact.other_sellers_summary;
    compact.other_sellers_summary = {
      count: typeof summary.count === "number" ? summary.count : null,
      avg_score: typeof summary.avg_score === "number" ? summary.avg_score : null,
      official_count:
        typeof summary.official_count === "number" ? summary.official_count : null,
      fast_delivery_count:
        typeof summary.fast_delivery_count === "number"
          ? summary.fast_delivery_count
          : null,
      scored_count:
        typeof summary.scored_count === "number" ? summary.scored_count : null,
    };
  }

  return compact;
}

function compactAnalysisTraceForList(analysisTrace: unknown) {
  if (!isObject(analysisTrace)) {
    return null;
  }

  const aiDecision = isObject(analysisTrace.aiDecision)
    ? {
        executed: analysisTrace.aiDecision.executed === true,
        mode:
          typeof analysisTrace.aiDecision.mode === "string"
            ? analysisTrace.aiDecision.mode
            : null,
        reason:
          typeof analysisTrace.aiDecision.reason === "string"
            ? analysisTrace.aiDecision.reason
            : null,
        coverageTier:
          typeof analysisTrace.aiDecision.coverageTier === "string"
            ? analysisTrace.aiDecision.coverageTier
            : null,
      }
    : null;

  return {
    mode: typeof analysisTrace.mode === "string" ? analysisTrace.mode : null,
    primaryDiagnosis:
      typeof analysisTrace.primaryDiagnosis === "string"
        ? analysisTrace.primaryDiagnosis
        : null,
    primaryTheme:
      typeof analysisTrace.primaryTheme === "string"
        ? analysisTrace.primaryTheme
        : null,
    confidence:
      typeof analysisTrace.confidence === "string" ? analysisTrace.confidence : null,
    scoreSummary: isObject(analysisTrace.scoreSummary)
      ? {
          seo:
            typeof analysisTrace.scoreSummary.seo === "number"
              ? analysisTrace.scoreSummary.seo
              : null,
          conversion:
            typeof analysisTrace.scoreSummary.conversion === "number"
              ? analysisTrace.scoreSummary.conversion
              : null,
          overall:
            typeof analysisTrace.scoreSummary.overall === "number"
              ? analysisTrace.scoreSummary.overall
              : null,
        }
      : null,
    aiDecision,
  };
}

export function sanitizeStoredReportListItemForAccess<T extends StoredReportLike>(report: T): T {
  const sanitized = sanitizeStoredReportForAccess(report);
  const compact = {
    ...sanitized,
  };

  compact.extractedData = compactExtractedDataForList(sanitized.extractedData);
  compact.analysisTrace = compactAnalysisTraceForList(sanitized.analysisTrace);

  return compact;
}

export function prepareStoredReportForClient<T extends StoredReportLike>(
  report: T
): T {
  return JSON.parse(
    JSON.stringify(sanitizeStoredReportForAccess(report))
  ) as T;
}

export function prepareSavedReportForClient<T extends StoredReportLike>(
  report: T
): SavedReport {
  try {
    return prepareStoredReportForClient(report) as unknown as SavedReport;
  } catch {
    return {
      id: getStringOrNull(report.id) || `report-${Date.now()}`,
      url: getStringOrNull(report.url) || "/reports",
      platform: getStringOrNull(report.platform),
      category: getStringOrNull(report.category),
      seoScore: getNumberOrNull(report.seoScore),
      conversionScore: getNumberOrNull(report.conversionScore),
      overallScore: getNumberOrNull(report.overallScore),
      dataCompletenessScore: getNumberOrNull(report.dataCompletenessScore),
      priceCompetitiveness: getStringOrNull(report.priceCompetitiveness),
      summary: getStringOrNull(report.summary),
      dataSource: getStringOrNull(report.dataSource),
      derivedMetrics: null,
      coverage: null,
      analysisTrace: null,
      accessState: null,
      extractedData: null,
      suggestions: [],
      priorityActions: [],
      createdAt: getCreatedAtValue(report.createdAt),
    };
  }
}

export function prepareSavedReportListItemForClient<T extends StoredReportLike>(
  report: T
): SavedReport {
  const sanitized = sanitizeStoredReportListItemForAccess(report);

  return {
    id: getStringOrNull(sanitized.id) || `report-${Date.now()}`,
    url: getStringOrNull(sanitized.url) || "/reports",
    platform: getStringOrNull(sanitized.platform),
    category: getStringOrNull(sanitized.category),
    seoScore: getNumberOrNull(sanitized.seoScore),
    conversionScore: getNumberOrNull(sanitized.conversionScore),
    overallScore: getNumberOrNull(sanitized.overallScore),
    dataCompletenessScore: getNumberOrNull(sanitized.dataCompletenessScore),
    priceCompetitiveness: getStringOrNull(sanitized.priceCompetitiveness),
    summary: getStringOrNull(sanitized.summary),
    dataSource: getStringOrNull(sanitized.dataSource),
    derivedMetrics: isObject(sanitized.derivedMetrics)
      ? (sanitized.derivedMetrics as SavedReport["derivedMetrics"])
      : null,
    coverage: isObject(sanitized.coverage)
      ? (sanitized.coverage as SavedReport["coverage"])
      : null,
    analysisTrace: isObject(sanitized.analysisTrace)
      ? (sanitized.analysisTrace as SavedReport["analysisTrace"])
      : null,
    accessState: isObject(sanitized.accessState)
      ? (sanitized.accessState as SavedReport["accessState"])
      : null,
    extractedData: isObject(sanitized.extractedData)
      ? (sanitized.extractedData as SavedReport["extractedData"])
      : null,
    suggestions: Array.isArray(sanitized.suggestions)
      ? (sanitized.suggestions as SavedReport["suggestions"])
      : [],
    priorityActions: Array.isArray(sanitized.priorityActions)
      ? (sanitized.priorityActions as SavedReport["priorityActions"])
      : [],
    createdAt: getCreatedAtValue(sanitized.createdAt),
  };
}
