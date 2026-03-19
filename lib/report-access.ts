type StoredReportLike = {
  extractedData?: unknown;
  derivedMetrics?: unknown;
  coverage?: unknown;
  priceCompetitiveness?: string | null;
  accessState?: unknown;
  suggestions?: unknown;
  priorityActions?: unknown;
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

  return nextReport;
}
