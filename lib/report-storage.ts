import type {
  BuildAnalysisResult,
  MarketComparisonInsights,
  NormalizedFieldMetadata,
  SimilarProductCandidate,
} from "@/types/analysis";

const MAX_STORED_IMAGES = 6;
const MAX_STORED_BULLETS = 12;
const MAX_STORED_REVIEW_SNIPPETS = 5;
const MAX_STORED_QA_SNIPPETS = 5;
const MAX_STORED_OTHER_SELLERS = 10;
const MAX_STORED_SIMILAR_PRODUCTS = 8;
const MAX_STORED_LABELS = 6;
const MAX_STORED_REASONS = 4;

const SNAPSHOT_METADATA_FIELDS = [
  "title",
  "brand",
  "product_name",
  "normalized_price",
  "original_price",
  "rating_value",
  "review_count",
  "favorite_count",
  "seller_name",
  "seller_score",
  "official_seller",
  "shipping_days",
  "delivery_type",
  "question_count",
  "other_sellers_count",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function trimArray<T>(items: T[] | null | undefined, limit: number): T[] | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items.slice(0, limit);
}

function pickStringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return null;
  const normalized = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return normalized.length > 0 ? normalized.slice(0, limit) : null;
}

function compactReviewSnippets(value: unknown) {
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .slice(0, MAX_STORED_REVIEW_SNIPPETS)
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : null,
      text: typeof item.text === "string" ? item.text : null,
      score: typeof item.score === "number" ? item.score : null,
      source: typeof item.source === "string" ? item.source : null,
    }));
  return items.length > 0 ? items : null;
}

function compactQaSnippets(value: unknown) {
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .slice(0, MAX_STORED_QA_SNIPPETS)
    .map((item) => ({
      question: typeof item.question === "string" ? item.question : null,
      answer: typeof item.answer === "string" ? item.answer : null,
    }));
  return items.length > 0 ? items : null;
}

function compactOtherSellerOffers(value: unknown) {
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .slice(0, MAX_STORED_OTHER_SELLERS)
    .map((item) => ({
      seller_name: typeof item.seller_name === "string" ? item.seller_name : null,
      merchant_id: typeof item.merchant_id === "number" ? item.merchant_id : null,
      listing_id: typeof item.listing_id === "string" ? item.listing_id : null,
      price: typeof item.price === "number" ? item.price : null,
      original_price: typeof item.original_price === "number" ? item.original_price : null,
      seller_score: typeof item.seller_score === "number" ? item.seller_score : null,
      shipping_days: typeof item.shipping_days === "number" ? item.shipping_days : null,
      delivery_type: typeof item.delivery_type === "string" ? item.delivery_type : null,
      delivery_text: typeof item.delivery_text === "string" ? item.delivery_text : null,
      is_official: item.is_official === true,
      has_free_shipping: item.has_free_shipping === true,
      has_fast_delivery: item.has_fast_delivery === true,
      seller_badges: pickStringArray(item.seller_badges, 3),
      promotion_labels: pickStringArray(item.promotion_labels, 3),
      listing_url: typeof item.listing_url === "string" ? item.listing_url : null,
      confidence: typeof item.confidence === "string" ? item.confidence : null,
    }));
  return items.length > 0 ? items : null;
}

function compactSimilarProducts(value: unknown) {
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((item): item is SimilarProductCandidate => isRecord(item))
    .slice(0, MAX_STORED_SIMILAR_PRODUCTS)
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : null,
      price: typeof item.price === "number" ? item.price : null,
      currency: typeof item.currency === "string" ? item.currency : null,
      rating_value: typeof item.rating_value === "number" ? item.rating_value : null,
      review_count: typeof item.review_count === "number" ? item.review_count : null,
      question_count: typeof item.question_count === "number" ? item.question_count : null,
      brand: typeof item.brand === "string" ? item.brand : null,
      sku: typeof item.sku === "string" ? item.sku : null,
      url: typeof item.url === "string" ? item.url : null,
      short_url: typeof item.short_url === "string" ? item.short_url : null,
      thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : null,
    }));
  return items.length > 0 ? items : null;
}

function buildNormalizedProductSnapshot(extractedData: Record<string, unknown>) {
  return {
    title: typeof extractedData.title === "string" ? extractedData.title : null,
    brand: typeof extractedData.brand === "string" ? extractedData.brand : null,
    product_name:
      typeof extractedData.product_name === "string" ? extractedData.product_name : null,
    sku: typeof extractedData.sku === "string" ? extractedData.sku : null,
    category: typeof extractedData.category === "string" ? extractedData.category : null,
    normalized_price:
      typeof extractedData.normalized_price === "number" ? extractedData.normalized_price : null,
    original_price:
      typeof extractedData.original_price === "number" ? extractedData.original_price : null,
    currency: typeof extractedData.currency === "string" ? extractedData.currency : null,
    image_count: typeof extractedData.image_count === "number" ? extractedData.image_count : null,
    primary_image:
      typeof extractedData.primary_image === "string" ? extractedData.primary_image : null,
    rating_value:
      typeof extractedData.rating_value === "number" ? extractedData.rating_value : null,
    review_count:
      typeof extractedData.review_count === "number" ? extractedData.review_count : null,
    favorite_count:
      typeof extractedData.favorite_count === "number" ? extractedData.favorite_count : null,
    question_count:
      typeof extractedData.question_count === "number" ? extractedData.question_count : null,
    seller_name:
      typeof extractedData.seller_name === "string" ? extractedData.seller_name : null,
    seller_score:
      typeof extractedData.seller_score === "number" ? extractedData.seller_score : null,
    official_seller: extractedData.official_seller === true,
    shipping_days:
      typeof extractedData.shipping_days === "number" ? extractedData.shipping_days : null,
    delivery_type:
      typeof extractedData.delivery_type === "string" ? extractedData.delivery_type : null,
    has_campaign: extractedData.has_campaign === true,
    campaign_label:
      typeof extractedData.campaign_label === "string" ? extractedData.campaign_label : null,
    other_sellers_count:
      typeof extractedData.other_sellers_count === "number" ? extractedData.other_sellers_count : null,
    extractor_status:
      typeof extractedData.extractor_status === "string" ? extractedData.extractor_status : null,
    platform: typeof extractedData.platform === "string" ? extractedData.platform : null,
  };
}

function buildStoredFieldMetadata(
  metadata: Record<string, NormalizedFieldMetadata> | undefined
) {
  if (!metadata) return null;
  const compactEntries = SNAPSHOT_METADATA_FIELDS.flatMap((fieldName) => {
    const fieldMeta = metadata[fieldName];
    if (!fieldMeta) return [];
    return [[fieldName, { source: fieldMeta.source, confidence: fieldMeta.confidence }]] as const;
  });
  return compactEntries.length > 0 ? Object.fromEntries(compactEntries) : null;
}

function buildCompactComparisonSnapshot(marketComparison: MarketComparisonInsights | null | undefined) {
  if (!marketComparison) return null;
  return {
    comparisonMode: marketComparison.comparisonMode,
    comparisonConfidence: marketComparison.comparisonConfidence,
    pricePosition: marketComparison.pricePosition,
    shippingPosition: marketComparison.shippingPosition,
    sellerReputationPosition: marketComparison.sellerReputationPosition,
    promotionPosition: marketComparison.promotionPosition,
    overallOfferCompetitiveness: marketComparison.overallOfferCompetitiveness,
    dominantGapReason: marketComparison.dominantGapReason,
    strongestAdvantageReason: marketComparison.strongestAdvantageReason,
    comparisonReasons: marketComparison.comparisonReasons.slice(0, MAX_STORED_REASONS),
    competitorSummary: {
      competitorCount: marketComparison.competitorSummary.competitorCount,
      lowestCompetitorPrice: marketComparison.competitorSummary.lowestCompetitorPrice,
      highestCompetitorPrice: marketComparison.competitorSummary.highestCompetitorPrice,
      averageCompetitorPrice: marketComparison.competitorSummary.averageCompetitorPrice,
      medianCompetitorPrice: marketComparison.competitorSummary.medianCompetitorPrice,
      userPricePosition: marketComparison.competitorSummary.userPricePosition,
      priceCompetitiveness: marketComparison.competitorSummary.priceCompetitiveness,
    },
  };
}

function buildCompactDiagnosisSnapshot(marketComparison: MarketComparisonInsights | null | undefined) {
  if (!marketComparison) return null;
  return {
    demandStatus: marketComparison.demandStatus,
    captureStatus: marketComparison.captureStatus,
    diagnosisConfidence: marketComparison.diagnosisConfidence,
    demandVerdict: marketComparison.demandVerdict,
    evidenceSummary: marketComparison.evidenceSummary.slice(0, MAX_STORED_REASONS),
    uncertaintyNotes: marketComparison.uncertaintyNotes.slice(0, 3),
  };
}

export function buildStoredExtractedData(params: {
  extractedData: unknown;
  normalizedFieldMetadata?: Record<string, NormalizedFieldMetadata>;
}) {
  if (!isRecord(params.extractedData)) {
    return params.extractedData ?? null;
  }

  const next: Record<string, unknown> = {
    ...params.extractedData,
  };

  next.images = trimArray(Array.isArray(next.images) ? next.images : null, MAX_STORED_IMAGES);
  next.bullet_points = pickStringArray(next.bullet_points, MAX_STORED_BULLETS);
  if (typeof next.description_text === "string") {
    next.description_text = next.description_text.trim().slice(0, 4000);
  }
  next.seller_badges = pickStringArray(next.seller_badges, MAX_STORED_LABELS);
  next.promotion_labels = pickStringArray(next.promotion_labels, MAX_STORED_LABELS);
  next.review_snippets = compactReviewSnippets(next.review_snippets);
  next.qa_snippets = compactQaSnippets(next.qa_snippets);
  next.other_seller_offers = compactOtherSellerOffers(next.other_seller_offers);
  next.similar_product_candidates = compactSimilarProducts(next.similar_product_candidates);
  next.coupon_offers = trimArray(
    Array.isArray(next.coupon_offers) ? next.coupon_offers : null,
    3
  );
  next.cross_promotions = trimArray(
    Array.isArray(next.cross_promotions) ? next.cross_promotions : null,
    3
  );

  delete next.html;
  delete next.raw_html;
  delete next.rawJson;
  delete next.raw_json;
  delete next.runtime_logs;
  delete next.network_logs;
  delete next.debugTrace;
  delete next.debug_trace;
  delete next._fieldMetadata;
  delete next._normalizedFieldMetadata;

  next._normalizedSnapshot = buildNormalizedProductSnapshot(next);
  const storedFieldMetadata = buildStoredFieldMetadata(params.normalizedFieldMetadata);
  if (storedFieldMetadata) {
    next._fieldMetadata = storedFieldMetadata;
  }

  return next;
}

export function buildStoredDerivedMetrics(params: {
  derivedMetrics: unknown;
  marketComparison?: MarketComparisonInsights | null;
}) {
  const base = isRecord(params.derivedMetrics) ? { ...params.derivedMetrics } : {};
  const comparisonSnapshot = buildCompactComparisonSnapshot(params.marketComparison);
  const diagnosisSnapshot = buildCompactDiagnosisSnapshot(params.marketComparison);

  if (comparisonSnapshot) {
    base.comparisonSnapshot = comparisonSnapshot;
  }
  if (diagnosisSnapshot) {
    base.diagnosisSnapshot = diagnosisSnapshot;
  }

  return Object.keys(base).length > 0 ? base : null;
}

export function buildStoredAnalysisPayload(analysis: BuildAnalysisResult) {
  return {
    extractedData: buildStoredExtractedData({
      extractedData: analysis.extractedData,
      normalizedFieldMetadata: analysis._normalizedFieldMetadata,
    }),
    categoryAverages: analysis.categoryAverages ?? null,
    derivedMetrics: buildStoredDerivedMetrics({
      derivedMetrics: analysis.derivedMetrics,
      marketComparison: analysis.marketComparison ?? null,
    }),
  };
}
