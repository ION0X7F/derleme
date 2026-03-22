import {
  ConsolidatedAnalysisInput,
  ConsolidatedDataSource,
  DataField,
  ExtractedFieldMetadata,
  ExtractedFieldSource,
  ExtractedProductFields,
} from "../types/analysis";

const SOURCE_CONFIDENCE_MAP: Record<ExtractedFieldSource, { source: ConsolidatedDataSource, confidence: number }> = {
  api: { source: "api", confidence: 0.95 },
  platform: { source: "json-ld", confidence: 0.9 }, // e.g. json-ld
  generic: { source: "html-scrape", confidence: 0.5 }, // assume generic is html scrape for now
  api_fallback: { source: "api", confidence: 0.7 },
  derived: { source: "derived", confidence: 0.6 }, // Base confidence for derived fields
  synthetic: { source: "unknown", confidence: 0.2 },
  null: { source: "unknown", confidence: 0.0 },
};

/**
 * Creates a DataField by looking up the field's metadata.
 * It assigns a confidence score and source based on the extraction metadata.
 */
function createDataFieldFromMetadata<T>(
  value: T | null,
  fieldName: keyof ExtractedProductFields,
  metadata: Record<string, ExtractedFieldMetadata> | undefined
): DataField<T> {
  if (value === undefined || value === "" || value === null) {
    return {
      value: null,
      source: "unknown",
      confidence: 0.0,
      reason: `${fieldName} is missing.`,
    };
  }

  const fieldMeta = metadata?.[fieldName];

  if (!fieldMeta) {
    // Fallback if metadata is missing for some reason
    return {
      value,
      source: "html-scrape",
      confidence: 0.4, // Lower confidence as the source is uncertain
      reason: `Metadata not found for ${fieldName}. Using raw value with low confidence.`,
    };
  }
  
  const mapping = SOURCE_CONFIDENCE_MAP[fieldMeta.source] || SOURCE_CONFIDENCE_MAP.null;
  
  // A simple refinement for 'generic' source
  let confidence = mapping.confidence;
  if(fieldMeta.source === 'generic' && fieldMeta.reason?.includes('meta')){
      confidence = 0.7;
  }

  return {
    value,
    source: mapping.source,
    confidence: confidence,
    reason: fieldMeta.reason || `Using value from source: ${fieldMeta.source}.`,
  };
}

/**
 * Takes raw extracted product data and transforms it into a unified,
 * reliable format (ConsolidatedAnalysisInput) for downstream analysis.
 *
 * This function acts as the "Analysis Pre-processing Layer". It's responsible for:
 * 1. Choosing the best value for a field if multiple sources are available.
 * 2. Assigning a confidence score to each piece of data based on its source metadata.
 * 3. Normalizing data into consistent types.
 *
 * @param rawData The raw data from the extraction phase.
 * @param fieldMetadata The metadata associated with each extracted field.
 * @returns A ConsolidatedAnalysisInput object, ready for analysis.
 */
export function prepareAnalysisInput(
  rawData: ExtractedProductFields,
  fieldMetadata: Record<string, ExtractedFieldMetadata> | undefined
): ConsolidatedAnalysisInput {
  
  const createField = <T>(value: T | null, fieldName: keyof ExtractedProductFields) => createDataFieldFromMetadata(value, fieldName, fieldMetadata);

  const input: ConsolidatedAnalysisInput = {
    // Core Product Info
    title: createField(rawData.title, "title"),
    brand: createField(rawData.brand, "brand"),
    productName: createField(rawData.product_name, "product_name"),
    modelCode: createField(rawData.model_code, "model_code"),
    category: createField(rawData.category, "category"),

    // Pricing
    price: createField(rawData.normalized_price, "normalized_price"),
    originalPrice: createField(rawData.original_price, "original_price"),
    currency: createField(rawData.currency, "currency"),

    // Media
    imageCount: createField(rawData.image_count, "image_count"),
    hasVideo: createField(rawData.has_video, "has_video"),

    // Ratings & Reviews
    ratingValue: createField(rawData.rating_value, "rating_value"),
    reviewCount: createField(rawData.review_count, "review_count"),

    // Description & Content
    descriptionLength: createField(
      rawData.description_length,
      "description_length"
    ),
    bulletPointCount: createField(
      rawData.bullet_point_count,
      "bullet_point_count"
    ),

    // Logistics & Fulfillment
    stockQuantity: createField(rawData.stock_quantity, "stock_quantity"),
    hasFreeShipping: createField(
      rawData.has_free_shipping,
      "has_free_shipping"
    ),

    // Seller Info
    sellerName: createField(rawData.seller_name, "seller_name"),
    sellerScore: createField(rawData.seller_score, "seller_score"),
    isOfficialSeller: createField(
      rawData.official_seller,
      "official_seller"
    ),

    // Raw extracted data for reference
    _raw: rawData,
  };

  return input;
}
