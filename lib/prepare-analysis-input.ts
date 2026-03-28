import {
  CanonicalFieldConfidence,
  CanonicalFieldSource,
  ConsolidatedAnalysisInput,
  ConsolidatedDataSource,
  ConsolidatedMarketInsights,
  DataField,
  ExtractedFieldMetadata,
  ExtractedFieldSource,
  ExtractedProductFields,
  NormalizedFieldMetadata,
} from "../types/analysis";
import { buildMarketComparisonInsights } from "./competitor-summary";
import type { DebugTraceHandle } from "@/lib/debug-observability";
import { traceEvent } from "@/lib/debug-observability";

const SOURCE_CONFIDENCE_MAP: Record<
  CanonicalFieldSource,
  { source: ConsolidatedDataSource; confidence: number }
> = {
  runtime_xhr: { source: "api", confidence: 0.94 },
  embedded_json: { source: "json-ld", confidence: 0.9 },
  html: { source: "html-scrape", confidence: 0.78 },
  parser_inference: { source: "derived", confidence: 0.56 },
  derived_from_similar_products: { source: "derived", confidence: 0.48 },
  keyword_search: { source: "derived", confidence: 0.5 },
  not_found: { source: "unknown", confidence: 0.0 },
};

const METADATA_CONFIDENCE_MAP: Record<CanonicalFieldConfidence, number> = {
  high: 0.95,
  medium: 0.75,
  low: 0.5,
  none: 0.0,
};

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

const FIELD_BASELINE_CONFIDENCE_FACTOR: Partial<
  Record<keyof ExtractedProductFields, number>
> = {
  title: 1,
  brand: 1,
  product_name: 1,
  normalized_price: 1,
  image_count: 1,
  rating_value: 0.98,
  review_count: 0.98,
  description_length: 0.95,
  seller_name: 0.95,
  seller_score: 0.95,
  has_free_shipping: 0.9,
  official_seller: 0.9,
  model_code: 0.82,
  stock_quantity: 0.8,
};

function getFieldConfidenceFactor(fieldName: keyof ExtractedProductFields) {
  return FIELD_BASELINE_CONFIDENCE_FACTOR[fieldName] ?? 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hasPresentFieldValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

function normalizeFieldSource(metadata: ExtractedFieldMetadata): CanonicalFieldSource {
  const reason = (
    metadata.extractionReason ||
    metadata.reason ||
    metadata.notes?.join(" ") ||
    ""
  ).toLocaleLowerCase("tr-TR");
  const source = metadata.source as ExtractedFieldSource;

  if (
    source === "runtime_xhr" ||
    source === "embedded_json" ||
    source === "html" ||
    source === "parser_inference" ||
    source === "derived_from_similar_products" ||
    source === "keyword_search" ||
    source === "not_found"
  ) {
    return source;
  }

  if (source === "xhr" || source === "api" || source === "api_fallback") {
    return "runtime_xhr";
  }

  if (source === "generic") {
    return "html";
  }

  if (source === "derived" || source === "synthetic" || source === "heuristic") {
    if (reason.includes("similar")) return "derived_from_similar_products";
    if (reason.includes("keyword") || reason.includes("search")) return "keyword_search";
    return "parser_inference";
  }

  if (source === "platform") {
    if (reason.includes("meta")) return "html";
    return "embedded_json";
  }

  return "not_found";
}

function normalizeFieldConfidence(
  source: CanonicalFieldSource,
  metadata: ExtractedFieldMetadata
): CanonicalFieldConfidence {
  const raw = metadata.confidence;

  if (source === "not_found" || raw === "none") {
    return "none";
  }

  if (raw === "high" || raw === "medium" || raw === "low") {
    if (
      raw === "high" &&
      (source === "parser_inference" ||
        source === "derived_from_similar_products" ||
        source === "keyword_search")
    ) {
      return "medium";
    }

    return raw;
  }

  return "low";
}

function normalizeFieldMetadata(
  metadataMap: Record<string, ExtractedFieldMetadata> | undefined
): Record<string, NormalizedFieldMetadata> {
  const normalized: Record<string, NormalizedFieldMetadata> = {};

  for (const [fieldName, metadata] of Object.entries(metadataMap || {})) {
    const source = normalizeFieldSource(metadata);
    const confidence = normalizeFieldConfidence(source, metadata);

    normalized[fieldName] = {
      source,
      confidence,
      notes: metadata.notes,
      extractionReason: metadata.extractionReason || metadata.reason,
      fallbackChain: metadata.fallbackChain,
      derivedFrom: metadata.derivedFrom,
    };
  }

  return normalized;
}

function inferConsolidatedSource(
  metadata: NormalizedFieldMetadata
): ConsolidatedDataSource {
  const reason = (metadata.extractionReason || "").toLocaleLowerCase("tr-TR");

  if (metadata.source === "runtime_xhr") {
    return "api";
  }

  if (metadata.source === "embedded_json") {
    return "json-ld";
  }

  if (metadata.source === "html") {
    if (reason.includes("meta")) return "meta-tags";
    return "html-scrape";
  }

  if (
    metadata.source === "parser_inference" ||
    metadata.source === "derived_from_similar_products" ||
    metadata.source === "keyword_search"
  ) {
    return "derived";
  }

  return "unknown";
}

function createDataFieldFromMetadata<T>(
  value: T | null,
  fieldName: keyof ExtractedProductFields,
  metadata: Record<string, NormalizedFieldMetadata> | undefined
): DataField<T> {
  if (!hasPresentFieldValue(value)) {
    return {
      value: null,
      source: "unknown",
      confidence: 0.0,
      reason: `${fieldName} is missing.`,
      metadata: {
        source: "not_found",
        confidence: "none",
        extractionReason: `${fieldName} is missing.`,
      },
    };
  }

  const fieldMeta = metadata?.[fieldName];

  if (!fieldMeta) {
    return {
      value,
      source: "html-scrape",
      confidence: 0.4,
      reason: `Metadata not found for ${fieldName}. Using raw value with low confidence.`,
      metadata: {
        source: "parser_inference",
        confidence: "low",
        extractionReason: `Metadata not found for ${fieldName}.`,
      },
    };
  }

  const baseMapping =
    SOURCE_CONFIDENCE_MAP[fieldMeta.source] || SOURCE_CONFIDENCE_MAP.not_found;
  const resolvedSource = inferConsolidatedSource(fieldMeta);
  const metadataConfidence =
    METADATA_CONFIDENCE_MAP[fieldMeta.confidence] ?? baseMapping.confidence;

  let confidence = Math.min(baseMapping.confidence, metadataConfidence);
  if (fieldMeta.source === "html" && fieldMeta.extractionReason?.includes("meta")) {
    confidence = Math.max(confidence, 0.7);
  }
  const fallbackDepth = fieldMeta.fallbackChain?.length ?? 0;
  const fallbackPenalty =
    fallbackDepth <= 2 ? 0 : Math.max(0, (fallbackDepth - 2) * 0.06);
  const derivationPenalty = fieldMeta.derivedFrom?.length ? 0.04 : 0;
  const fieldFactor = getFieldConfidenceFactor(fieldName);
  const conservativePenalty =
    fieldName === "model_code" &&
    (resolvedSource === "html-scrape" || resolvedSource === "unknown")
      ? 0.12
      : 0;
  const questionCountCap =
    fieldName === "question_count" &&
    (resolvedSource === "derived" ||
      resolvedSource === "html-scrape" ||
      resolvedSource === "unknown")
      ? 0.45
      : 1;

  return {
    value,
    source: resolvedSource,
    confidence: clampConfidence(
      Math.min(
        confidence * fieldFactor -
          fallbackPenalty -
          derivationPenalty -
          conservativePenalty,
        questionCountCap
      )
    ),
    reason:
      fieldMeta.extractionReason ||
      `Using value from source: ${fieldMeta.source}.`,
    metadata: fieldMeta,
  };
}

export function prepareAnalysisInput(
  rawData: ExtractedProductFields,
  fieldMetadata: Record<string, ExtractedFieldMetadata> | undefined,
  trace?: DebugTraceHandle
): ConsolidatedAnalysisInput {
  const normalizedMetadata = normalizeFieldMetadata(fieldMetadata);
  const createField = <T>(
    value: T | null,
    fieldName: keyof ExtractedProductFields
  ) => createDataFieldFromMetadata(value, fieldName, normalizedMetadata);

  const input: ConsolidatedAnalysisInput = {
    title: createField(rawData.title, "title"),
    brand: createField(rawData.brand, "brand"),
    productName: createField(rawData.product_name, "product_name"),
    modelCode: createField(rawData.model_code, "model_code"),
    category: createField(rawData.category, "category"),

    price: createField(rawData.normalized_price, "normalized_price"),
    originalPrice: createField(rawData.original_price, "original_price"),
    currency: createField(rawData.currency, "currency"),

    imageCount: createField(rawData.image_count, "image_count"),
    hasVideo: createField(rawData.has_video, "has_video"),

    ratingValue: createField(rawData.rating_value, "rating_value"),
    reviewCount: createField(rawData.review_count, "review_count"),

    descriptionLength: createField(
      rawData.description_length,
      "description_length"
    ),
    bulletPointCount: createField(
      rawData.bullet_point_count,
      "bullet_point_count"
    ),

    stockQuantity: createField(rawData.stock_quantity, "stock_quantity"),
    hasFreeShipping: createField(
      rawData.has_free_shipping,
      "has_free_shipping"
    ),

    sellerName: createField(rawData.seller_name, "seller_name"),
    sellerScore: createField(rawData.seller_score, "seller_score"),
    isOfficialSeller: createField(
      rawData.official_seller,
      "official_seller"
    ),

    _fieldMetadata: normalizedMetadata,
    _raw: rawData,
  };

  const marketComparison = buildMarketComparisonInsights(rawData, trace);
  if (marketComparison) {
    const baseConfidence = clamp(
      marketComparison.competitorSummary.competitorCount != null
        ? 0.45 +
            Math.min(marketComparison.competitorSummary.competitorCount, 10) * 0.04
        : 0.38,
      0.35,
      0.85
    );
    const asMarketField = <T>(
      value: T | null,
      reason: string,
      confidence = baseConfidence
    ): DataField<T> => ({
      value,
      source: "derived",
      confidence: clampConfidence(confidence),
      reason,
      metadata: {
        source: "parser_inference",
        confidence:
          confidence >= 0.7 ? "medium" : confidence >= 0.45 ? "low" : "none",
        extractionReason: reason,
      },
    });

    const marketInsights: ConsolidatedMarketInsights = {
      competitorCount: asMarketField(
        marketComparison.competitorSummary.competitorCount,
        "Rakip satıcı sayısı ve fiyat listesine göre hesaplandı."
      ),
      lowestCompetitorPrice: asMarketField(
        marketComparison.competitorSummary.lowestCompetitorPrice,
        "Rakip fiyat listesindeki minimum değer."
      ),
      highestCompetitorPrice: asMarketField(
        marketComparison.competitorSummary.highestCompetitorPrice,
        "Rakip fiyat listesindeki maksimum değer."
      ),
      averageCompetitorPrice: asMarketField(
        marketComparison.competitorSummary.averageCompetitorPrice,
        "Rakip fiyat listesinin ortalaması."
      ),
      medianCompetitorPrice: asMarketField(
        marketComparison.competitorSummary.medianCompetitorPrice,
        "Rakip fiyat dağılımına göre medyan değer."
      ),
      userPriceRank: asMarketField(
        marketComparison.competitorSummary.userPriceRank,
        "Kullanıcı fiyatının rakip fiyatlar arasındaki sıralaması."
      ),
      userPriceDeltaFromMedian: asMarketField(
        marketComparison.competitorSummary.userPriceDeltaFromMedian,
        "Kullanıcı fiyatının medyana göre farkı."
      ),
      userPricePosition: asMarketField(
        marketComparison.competitorSummary.userPricePosition,
        "Kullanıcı fiyatı medyan fiyatla karşılaştırılarak sınıflandırıldı."
      ),
      priceCompetitiveness: asMarketField(
        marketComparison.competitorSummary.priceCompetitiveness,
        "Fiyat konumundan türetilen rekabetçilik seviyesi."
      ),
      salesLevel: asMarketField(
        marketComparison.userEstimatedSalesLevel,
        "Kullanıcı mağazası için tahmini satış seviyesi."
      ),
      marketPosition: asMarketField(
        marketComparison.marketPosition,
        "Fiyat, satış tahmini ve talep sinyallerinin birleşimi."
      ),
      growthOpportunityLevel: asMarketField(
        marketComparison.growthOpportunityLevel,
        "Talep, rekabet ve mevcut seviye farkına göre fırsat seviyesi."
      ),
      outcomeType: asMarketField(
        marketComparison.outcomeType,
        "Pazar ve performans sinyallerinden çıkan üst seviye sonuç tipi."
      ),
      primaryIssue: asMarketField(
        marketComparison.primaryIssue,
        "Belirlenen ana sorun alanı."
      ),
      secondaryIssues: asMarketField(
        marketComparison.secondaryIssues,
        "İkincil sorun alanları."
      ),
      mainIssues: asMarketField(
        marketComparison.mainIssues,
        "Öne çıkan sorun alanlarının listesi."
      ),
      competitorSalesEstimates: asMarketField(
        marketComparison.competitorSalesEstimates,
        "Rakip mağazalar için açıklanabilir heuristics ile tahmin edildi.",
        clamp(baseConfidence - 0.05, 0.3, 0.8)
      ),
      strongestCompetitorSalesLevel: asMarketField(
        marketComparison.strongestCompetitorSalesLevel,
        "Rakip tahminleri içinde en güçlü satış seviyesi."
      ),
      strongestCompetitorSalesRange: asMarketField(
        marketComparison.strongestCompetitorSalesRange,
        "En güçlü rakip için tahmini satış aralığı.",
        clamp(baseConfidence - 0.05, 0.3, 0.8)
      ),
      userEstimatedSalesLevel: asMarketField(
        marketComparison.userEstimatedSalesLevel,
        "Kullanıcı mağazası için tahmini satış seviyesi."
      ),
      userEstimatedSalesRange: asMarketField(
        marketComparison.userEstimatedSalesRange,
        "Kullanıcı mağazası için tahmini satış aralığı.",
        clamp(baseConfidence - 0.05, 0.3, 0.8)
      ),
      marketDemandSignal: asMarketField(
        marketComparison.marketDemandSignal,
        "Yorum, favori, soru ve puan sinyallerinin birleşik talep görünümü."
      ),
    };

    input.marketComparison = marketComparison;
    input.marketInsights = marketInsights;

    traceEvent(trace ?? null, {
      stage: "analysis",
      code: "analysis_input_market_summary",
      message: "Market comparison ve consolidated market insight olusturuldu.",
      meta: {
        comparisonMode: marketComparison.comparisonMode,
        comparisonConfidence: marketComparison.comparisonConfidence,
        demandStatus: marketComparison.demandStatus,
        captureStatus: marketComparison.captureStatus,
        diagnosisConfidence: marketComparison.diagnosisConfidence,
      },
    });
  } else {
    input.marketComparison = null;
    input.marketInsights = null;
  }

  const criticalFieldSummary = {
    title: input.title.confidence,
    price: input.price.confidence,
    reviewCount: input.reviewCount.confidence,
    sellerName: input.sellerName.confidence,
    sellerScore: input.sellerScore.confidence,
  };

  traceEvent(trace ?? null, {
    stage: "analysis",
    code: "consolidated_input_summary",
    message: "Consolidated analysis input olusturuldu.",
    meta: {
      extractorStatus: rawData.extractor_status ?? "unknown",
      criticalFieldSummary,
      normalizedMetadataCount: Object.keys(normalizedMetadata).length,
    },
  });

  return input;
}
