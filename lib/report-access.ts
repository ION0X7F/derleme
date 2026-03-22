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
      maxSuggestions: 3,
      maxPriorityActions: 3,
    };
  }

  return {
    maxSuggestions: 5,
    maxPriorityActions: 5,
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
      contentQuality: report.derivedMetrics.contentQuality,
      trustStrength: report.derivedMetrics.trustStrength,
      decisionClarity: report.derivedMetrics.decisionClarity,
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
