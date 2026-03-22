import type { ExtractedFieldMetadata, ExtractorHealthReport } from "@/types/analysis";

/**
 * Builds extractor health report from field metadata.
 * Calculates overall extraction quality, source distribution, and issue tracking.
 * Phase 1: Memory only, used for debugging and logging.
 */

const CRITICAL_FIELDS = [
  "title",
  "h1",
  "brand",
  "product_name",
  "normalized_price",
  "image_count",
  "description_length",
  "seller_name",
  "rating_value",
  "review_count",
  "shipping_days",
  "stock_status",
];

export function buildExtractorHealthReport(params: {
  platformDetected: string;
  fieldMetadata: Record<string, ExtractedFieldMetadata>;
  apiCallAttempted: boolean;
  apiCallSucceeded: boolean;
  errors: Array<{ field: string; error: string }>;
}): ExtractorHealthReport {
  const { platformDetected, fieldMetadata, apiCallAttempted, apiCallSucceeded, errors } = params;

  // Count fields by source
  const sourceBreakdown = {
    platform: 0,
    generic: 0,
    api: 0,
    derived: 0,
    synthetic: 0,
  };

  const fallbacksUsed: Set<string> = new Set();
  const blockedFields: string[] = [];

  // Analyze metadata
  for (const [fieldName, metadata] of Object.entries(fieldMetadata)) {
    const sourceCategory =
      metadata.source === "api_fallback" ? "api" : metadata.source === "null" ? "synthetic" : metadata.source;

    if (sourceCategory === "platform" || sourceCategory === "generic" || sourceCategory === "api" || sourceCategory === "derived" || sourceCategory === "synthetic") {
      sourceBreakdown[sourceCategory]++;
    }

    // Track fallbacks
    if (metadata.fallbackChain && metadata.fallbackChain.length > 1) {
      fallbacksUsed.add(`${fieldName}: ${metadata.fallbackChain.join(" → ")}`);
    }

    // Track blocked fields
    if (metadata.source === "null" && CRITICAL_FIELDS.includes(fieldName)) {
      blockedFields.push(fieldName);
    }
  }

  // Count critical fields
  const criticalFieldsFound = CRITICAL_FIELDS.filter((field) => {
    const meta = fieldMetadata[field];
    return meta && meta.source !== "null";
  }).length;

  // Count total available fields
  const allFieldsAvailable = Object.values(fieldMetadata).filter((meta) => meta.source !== "null").length;

  // Determine primary source (most used)
  const primarySource = Object.entries(sourceBreakdown).reduce<"platform" | "generic" | "api">((prev, [source, count]) => {
    if (source === "platform" || source === "generic" || source === "api") {
      if (sourceBreakdown[prev] < count) {
        return source as "platform" | "generic" | "api";
      }
    }
    return prev;
  }, "generic");

  return {
    platformDetected,
    primarySourceUsed: primarySource,
    criticalFieldsFound,
    allFieldsAvailable,
    sourceBreakdown,
    fallbacksUsed: Array.from(fallbacksUsed),
    blockedFields,
    apiCallAttempted,
    apiCallSucceeded,
    errors,
  };
}

/**
 * Calculates extraction health score (0-100).
 * Based on: critical fields coverage + source quality + fallback usage.
 */
export function calculateHealthScore(health: ExtractorHealthReport): number {
  let score = 50; // base

  // Critical fields: +30 for full coverage
  const criticalCoverage = health.criticalFieldsFound / CRITICAL_FIELDS.length;
  score += criticalCoverage * 30;

  // Source quality: +15 bonus for high-quality sources
  if (health.sourceBreakdown.api > 0) {
    score += 5; // API gives good signals
  }
  if (health.sourceBreakdown.platform > Math.max(health.sourceBreakdown.generic, health.sourceBreakdown.api)) {
    score += 10; // Platform extractor worked well
  }

  // Fallbacks penalty: -5 per fallback chain
  score -= Math.min(health.fallbacksUsed.length * 3, 15);

  // Blocked fields penalty: -3 per critical blocked field
  score -= health.blockedFields.length * 3;

  // API success bonus: +5 if API succeeded (trusted data)
  if (health.apiCallSucceeded) {
    score += 5;
  } else if (health.apiCallAttempted) {
    score -= 5; // tried but failed
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Human-readable health status for logging/debugging.
 */
export function getHealthStatusLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}
