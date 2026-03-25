import type {
  ExtractedProductFields,
  ExtractedFieldMetadata,
} from "@/types/analysis";
import type { DebugTraceHandle } from "@/lib/debug-observability";
import { traceConflict, traceEvent, traceMissingField } from "@/lib/debug-observability";

function cleanText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function isMeaningfulValue(value: unknown) {
  if (value == null) return false;

  if (typeof value === "string") {
    return cleanText(value) !== null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "boolean") {
    return true;
  }

  return false;
}

function areComparableValuesDifferent(left: unknown, right: unknown) {
  if (!isMeaningfulValue(left) || !isMeaningfulValue(right)) {
    return false;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left !== right;
  }

  if (typeof left === "string" && typeof right === "string") {
    return cleanText(left) !== cleanText(right);
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return left !== right;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return true;
    return left.some((item, index) => String(item) !== String(right[index]));
  }

  try {
    return JSON.stringify(left) !== JSON.stringify(right);
  } catch {
    return true;
  }
}

function normalizeFields(
  fields: Partial<ExtractedProductFields> | null | undefined
): Partial<ExtractedProductFields> {
  if (!fields) return {};

  return {
    ...fields,
    title: cleanText(fields.title),
    meta_description: cleanText(fields.meta_description),
    meta_description_source: cleanText(fields.meta_description_source),
    search_snippet_fallback: cleanText(fields.search_snippet_fallback),
    h1: cleanText(fields.h1),
    raw_h1: cleanText(fields.raw_h1),
    resolved_primary_heading: cleanText(fields.resolved_primary_heading),
    heading_source: cleanText(fields.heading_source),

    brand: cleanText(fields.brand),
    product_name: cleanText(fields.product_name),
    model_code: cleanText(fields.model_code),

    sku: cleanText(fields.sku),
    sku_source: cleanText(fields.sku_source),
    mpn: cleanText(fields.mpn),
    mpn_source: cleanText(fields.mpn_source),
    gtin: cleanText(fields.gtin),
    gtin_source: cleanText(fields.gtin_source),

    price: cleanText(fields.price),
    currency: cleanText(fields.currency),

    stock_status: cleanText(fields.stock_status),
    seller_name: cleanText(fields.seller_name),

    category: cleanText(fields.category),
    platform: cleanText(fields.platform),
  };
}

function hasStrongPlatformSignal(fields: Partial<ExtractedProductFields>) {
  const signalFields: Array<keyof ExtractedProductFields> = [
    "brand",
    "seller_name",
    "price",
    "normalized_price",
    "image_count",
    "rating_value",
    "review_count",
    "description_length",
    "stock_status",
  ];

  const matchedSignals = signalFields.filter((key) =>
    isMeaningfulValue(fields[key])
  ).length;

  return matchedSignals >= 2;
}

export function mergeExtractedFields(params: {
  genericFields: ExtractedProductFields;
  platformFields: Partial<ExtractedProductFields>;
  platform: string | null;
}): ExtractedProductFields {
  const { genericFields, platformFields, platform } = params;

  const base: ExtractedProductFields = {
    ...genericFields,
    extractor_status: genericFields.extractor_status ?? "fallback",
    platform: platform ?? genericFields.platform ?? null,
  };

  const normalizedPlatformFields = normalizeFields(platformFields);

  const mergedRecord: Record<string, unknown> = {
    ...base,
  };

  for (const [key, value] of Object.entries(normalizedPlatformFields)) {
    if (isMeaningfulValue(value)) {
      mergedRecord[key] = value;
    }
  }

  const merged = mergedRecord as ExtractedProductFields;

  if (merged.image_count == null || !Number.isFinite(merged.image_count)) {
    merged.image_count = 0;
  }

  if (platform) {
    merged.extractor_status = hasStrongPlatformSignal(normalizedPlatformFields)
      ? "ok"
      : "partial";
  } else if (!merged.extractor_status) {
    merged.extractor_status = "fallback";
  }

  if (
    merged.extractor_status === "ok" &&
    !normalizedPlatformFields.brand &&
    !normalizedPlatformFields.seller_name &&
    !normalizedPlatformFields.model_code &&
    (normalizedPlatformFields.image_count == null ||
      normalizedPlatformFields.image_count === 0)
  ) {
    merged.extractor_status = "partial";
  }

  merged.platform = platform ?? merged.platform ?? null;

  return merged;
}

/**
 * Extended merge with field-level metadata tracking.
 * Phase 1: Tracks source, confidence, and fallback chain for each field.
 */
export function mergeExtractedFieldsWithMetadata(params: {
  genericFields: ExtractedProductFields;
  platformFields: Partial<ExtractedProductFields>;
  platform: string | null;
  trace?: DebugTraceHandle;
}): {
  merged: ExtractedProductFields;
  fieldMetadata: Record<string, ExtractedFieldMetadata>;
} {
  const { genericFields, platformFields, platform, trace } = params;

  const merged = mergeExtractedFields(params);
  const fieldMetadata: Record<string, ExtractedFieldMetadata> = {};
  const watchedFields = new Set([
    "normalized_price",
    "original_price",
    "review_count",
    "rating_value",
    "question_count",
    "other_seller_offers",
    "seller_name",
    "seller_score",
  ]);
  let platformWins = 0;
  let genericWins = 0;
  let missingCount = 0;

  // Determine source for each field
  for (const [key, value] of Object.entries(merged)) {
    if (key === "extractor_status" || key === "platform") {
      // Skip metadata fields
      continue;
    }

    const genericValue = genericFields[key as keyof ExtractedProductFields];
    const platformValue = platformFields[key as keyof ExtractedProductFields];

    // Fallback chain for tracking
    const fallbackChain: string[] = [];
    let source: "platform" | "generic" | "api" | "api_fallback" | "derived" | "synthetic" | "null" = "null";

    if (platformValue != null && isMeaningfulValue(platformValue)) {
      source = "platform";
      fallbackChain.push("platform");
      platformWins += 1;
    } else if (genericValue != null && isMeaningfulValue(genericValue)) {
      source = "generic";
      fallbackChain.push("platform", "generic");
      genericWins += 1;
    } else {
      // Field is null/missing
      source = "null";
      fallbackChain.push("platform", "generic");
      missingCount += 1;
    }

    // Determine confidence
    let confidence: "high" | "medium" | "low" | "unknown" = "unknown";
    if (source === "platform") {
      confidence = "high"; // Platform extraction is trusted
    } else if (source === "generic") {
      confidence = "medium"; // HTML parsing less precise
    } else {
      confidence = "low"; // Field missing
    }

    if (key === "model_code" && confidence === "high") {
      confidence = "medium";
    }

    if (key === "question_count" && source !== "null") {
      confidence = confidence === "high" ? "medium" : "low";
    }

    fieldMetadata[key] = {
      source,
      confidence,
      timestamp: Date.now(),
      fallbackChain: fallbackChain.length > 1 ? fallbackChain : undefined,
      reason:
        source === "platform"
          ? "platform extractor"
          : source === "generic"
            ? "generic html extractor"
            : source === "null"
              ? "field not found in platform/generic extraction"
              : `${source} source`,
    };

    if (
      watchedFields.has(key) &&
      platformValue != null &&
      genericValue != null &&
      isMeaningfulValue(platformValue) &&
      isMeaningfulValue(genericValue) &&
      areComparableValuesDifferent(platformValue, genericValue)
    ) {
      traceConflict(trace ?? null, {
        field: key,
        winner: "platform",
        loser: "generic",
        winnerValue: platformValue,
        loserValue: genericValue,
        reason: "platform extractor has precedence over generic extractor",
      });
    }

    if (watchedFields.has(key) && source === "null") {
      traceMissingField(trace ?? null, key, "field not found in platform/generic extraction", [
        "normalized_price",
        "review_count",
        "rating_value",
        "seller_name",
      ].includes(key));
    }
  }

  traceEvent(trace ?? null, {
    stage: "merge",
    code: "merge_summary",
    message: "Platform ve generic alanlar metadata ile birlestirildi.",
    meta: {
      platform,
      platformWins,
      genericWins,
      missingCount,
      extractorStatus: merged.extractor_status,
    },
  });

  return {
    merged,
    fieldMetadata,
  };
}
