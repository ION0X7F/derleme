import type { ExtractedProductFields } from "@/types/analysis";

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

function normalizeFields(
  fields: Partial<ExtractedProductFields> | null | undefined
): Partial<ExtractedProductFields> {
  if (!fields) return {};

  return {
    ...fields,
    title: cleanText(fields.title),
    meta_description: cleanText(fields.meta_description),
    h1: cleanText(fields.h1),

    brand: cleanText(fields.brand),
    product_name: cleanText(fields.product_name),
    model_code: cleanText(fields.model_code),

    sku: cleanText(fields.sku),
    mpn: cleanText(fields.mpn),
    gtin: cleanText(fields.gtin),

    price: cleanText(fields.price),
    currency: cleanText(fields.currency),

    stock_status: cleanText(fields.stock_status),
    seller_name: cleanText(fields.seller_name),

    category: cleanText(fields.category),
    platform: cleanText(fields.platform),
  };
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

  if (!merged.extractor_status) {
    merged.extractor_status = platform ? "ok" : "fallback";
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