export type AnalysisSuggestion = {
  key: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
};

export type PriorityAction = {
  priority: number;
  title: string;
  detail: string;
};

export type AccessPlan = "guest" | "free" | "pro" | "enterprise";

/**
 * Extraction-level metadata tracking for each field.
 * Captures source, confidence, derivation, and fallback chain.
 * @phase Phase 1: Memory only (not persisted to DB)
 */
export type ExtractedFieldSource = "platform" | "generic" | "api" | "api_fallback" | "derived" | "synthetic" | "null";

export type ExtractedFieldMetadata = {
  source: ExtractedFieldSource;
  confidence: "high" | "medium" | "low" | "unknown";
  timestamp?: number; // unix ms (when extracted)
  derivedFrom?: string[]; // field names used in derivation
  fallbackChain?: string[]; // sources attempted in order
  apiAge?: number; // hours old (if source=api)
  reason?: string; // human readable explanation
};

export type ExtractorHealthReport = {
  platformDetected: string;
  primarySourceUsed: "platform" | "generic" | "api";
  criticalFieldsFound: number; // x / 8
  allFieldsAvailable: number; // x / total
  sourceBreakdown: {
    platform: number;
    generic: number;
    api: number;
    derived: number;
    synthetic: number;
  };
  fallbacksUsed: string[]; // descriptive list
  blockedFields: string[]; // extraction failed
  apiCallAttempted: boolean;
  apiCallSucceeded: boolean;
  errors: Array<{ field: string; error: string }>;
};

export type DerivedMetricLabel =
  | "strong"
  | "medium"
  | "weak"
  | "not_enough_data";

export type DerivedMetric = {
  score: number | null;
  label: DerivedMetricLabel;
  evidence: string[];
};

export type DerivedMetrics = {
  productQuality: DerivedMetric;
  sellerTrust: DerivedMetric;
  marketPosition: DerivedMetric;
};

export type ReviewRatingBreakdown = {
  one_star: number | null;
  two_star: number | null;
  three_star: number | null;
  four_star: number | null;
  five_star: number | null;
  total: number | null;
};

export type ReviewSnippet = {
  rating: number | null;
  text: string | null;
};

export type ReviewSummary = {
  sampled_count: number;
  low_rated_count: number;
  positive_count: number;
  negative_count: number;
};

export type ReviewThemes = {
  positive: string[];
  negative: string[];
};

export type ReviewThemeHit = {
  label: string;
  count: number;
};

export type QuestionAnswerSnippet = {
  question: string | null;
  answer: string | null;
};

export type OtherSellerOffer = {
  merchant_id: number | null;
  listing_id: string | null;
  seller_name: string | null;
  seller_badges: string[] | null;
  seller_score: number | null;
  is_official: boolean;
  has_fast_delivery: boolean;
  has_free_shipping: boolean;
  follower_count: number | null;
  stock_quantity: number | null;
  price: number | null;
  original_price: number | null;
  discount_rate: number | null;
  promotion_labels: string[] | null;
  listing_url: string | null;
};

export type OtherSellersSummary = {
  count: number;
  scored_count: number;
  avg_score: number | null;
  top_score: number | null;
  official_count: number;
  fast_delivery_count: number;
  high_follower_count: number;
  seller_names: string[];
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
  cheapest_seller_name: string | null;
  same_price_count: number;
  cheaper_count: number;
  more_expensive_count: number;
};

export type MissingDataPriority = "critical" | "important" | "optional";

export type MissingFieldReason = {
  field: string;
  priority: MissingDataPriority;
  reason: string;
};

export type MissingFieldSnapshot = {
  availableFields: string[];
  missingFields: string[];
  criticalMissingFields: string[];
  importantMissingFields: string[];
  optionalMissingFields: string[];
};

export type MissingDataReport = {
  before: MissingFieldSnapshot;
  after: MissingFieldSnapshot;
  filledFields: string[];
  strengthenedFields: string[];
  appliedRules: string[];
  unresolvedCriticalFields: string[];
  unresolvedReasons: MissingFieldReason[];
};

export type LearningStatus = {
  sourceType: "real" | "synthetic";
  eligible: boolean;
  reason: string;
};

export type DecisionSupportPacket = {
  platform: "trendyol";
  planContext: AccessPlan;
  category: string | null;
  raw: {
    title: string | null;
    meta_description: string | null;
    h1: string | null;
    brand: string | null;
    product_name: string | null;
    model_code: string | null;
    price: string | null;
    normalized_price: number | null;
    original_price: number | null;
    discount_rate: number | null;
    currency: string | null;
    image_count: number;
    has_video: boolean;
    rating_value: number | null;
    rating_breakdown: ReviewRatingBreakdown | null;
    review_count: number | null;
    review_snippets: ReviewSnippet[] | null;
    qa_snippets: QuestionAnswerSnippet[] | null;
    review_summary: ReviewSummary | null;
    review_themes: ReviewThemes | null;
    top_positive_review_hits: ReviewThemeHit[] | null;
    top_negative_review_hits: ReviewThemeHit[] | null;
    question_count: number | null;
    description_length: number | null;
    bullet_point_count: number | null;
    has_add_to_cart: boolean;
    has_shipping_info: boolean;
    has_free_shipping: boolean;
    shipping_days: number | null;
    has_return_info: boolean;
    has_specs: boolean;
    has_faq: boolean;
    variant_count: number | null;
    stock_quantity: number | null;
    stock_status: string | null;
    seller_name: string | null;
    merchant_id: number | null;
    listing_id: string | null;
    seller_badges: string[] | null;
    seller_score: number | null;
    follower_count: number | null;
    favorite_count: number | null;
    other_sellers_count: number | null;
    other_seller_offers: OtherSellerOffer[] | null;
    other_sellers_summary: OtherSellersSummary | null;
    has_brand_page: boolean;
    official_seller: boolean;
    has_campaign: boolean;
    campaign_label: string | null;
    promotion_labels: string[] | null;
    delivery_type: string | null;
    is_best_seller: boolean;
    best_seller_rank: number | null;
    best_seller_badge: string | null;
  };
  metrics: DerivedMetrics;
  coverage: {
    availableFields: string[];
    missingFields: string[];
    confidence: "high" | "medium" | "low";
  };
};

export type ExtractedProductFields = {
  title: string | null;
  meta_description: string | null;
  h1: string | null;

  brand: string | null;
  product_name: string | null;
  model_code: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;

  price: string | null;
  normalized_price: number | null;
  original_price: number | null;
  discount_rate: number | null;
  currency: string | null;

  image_count: number;
  has_video: boolean;

  rating_value: number | null;
  rating_breakdown: ReviewRatingBreakdown | null;
  review_count: number | null;
  review_snippets: ReviewSnippet[] | null;
  qa_snippets: QuestionAnswerSnippet[] | null;
  review_summary: ReviewSummary | null;
  review_themes: ReviewThemes | null;
  top_positive_review_hits: ReviewThemeHit[] | null;
  top_negative_review_hits: ReviewThemeHit[] | null;
  question_count: number | null;

  description_length: number | null;
  bullet_point_count: number | null;

  has_add_to_cart: boolean;
  has_shipping_info: boolean;
  has_free_shipping: boolean;
  shipping_days: number | null;
  has_return_info: boolean;
  has_specs: boolean;
  has_faq: boolean;

  variant_count: number | null;
  stock_quantity: number | null;

  stock_status: string | null;
  seller_name: string | null;
  merchant_id: number | null;
  listing_id: string | null;
  seller_badges: string[] | null;
  seller_score: number | null;
  follower_count: number | null;
  favorite_count: number | null;
  other_sellers_count: number | null;
  other_seller_offers: OtherSellerOffer[] | null;
  other_sellers_summary: OtherSellersSummary | null;
  has_brand_page: boolean;
  official_seller: boolean;
  has_campaign: boolean;
  campaign_label: string | null;
  promotion_labels: string[] | null;
  delivery_type: string | null;
  is_best_seller: boolean;
  best_seller_rank: number | null;
  best_seller_badge: string | null;

  category: string | null;
  extractor_status?: "ok" | "partial" | "fallback" | "blocked";
  platform?: string | null;
};

export type CategoryBenchmarkSnapshot = {
  platform: string;
  category: string;
  sampleSize: number;
  successfulSampleSize: number;
  avgShippingDays: number | null;
  avgImageCount: number | null;
  avgDescriptionLength: number | null;
  avgRatingValue: number | null;
  avgSellerScore: number | null;
  avgPrice: number | null;
  avgReviewCount: number | null;
  avgFavoriteCount: number | null;
  avgOtherSellersCount: number | null;
  fastDeliveryRate: number | null;
  freeShippingRate: number | null;
  hasVideoRate: number | null;
  officialSellerRate: number | null;
  campaignRate: number | null;
  bestSellerRate: number | null;
  successfulAvgShippingDays: number | null;
  successfulAvgImageCount: number | null;
  successfulAvgRatingValue: number | null;
  successfulAvgSellerScore: number | null;
  successfulAvgPrice: number | null;
  successfulFastDeliveryRate: number | null;
  successfulVideoRate: number | null;
  successfulOfficialSellerRate: number | null;
};

export type LearnedRuleSnapshot = {
  ruleKey: string;
  title: string;
  insight: string;
  confidence: number;
  supportCount: number;
};

export type LearningContext = {
  benchmark: CategoryBenchmarkSnapshot | null;
  rules: LearnedRuleSnapshot[];
  memorySnippets: string[];
  systemLearning: string | null;
};

export type AnalysisTraceTheme =
  | "stock"
  | "price"
  | "delivery"
  | "content"
  | "visual"
  | "trust"
  | "reviews"
  | "faq"
  | "campaign"
  | "mixed";

export type AnalysisTraceSignalTone = "positive" | "warning" | "neutral";

export type AnalysisTraceSignalSource =
  | "metric"
  | "market"
  | "benchmark"
  | "learning"
  | "coverage";

export type AnalysisTraceSignal = {
  key: string;
  label: string;
  detail: string;
  tone: AnalysisTraceSignalTone;
  source: AnalysisTraceSignalSource;
  weight: number;
  relatedFields: string[];
};

export type AnalysisTraceStep = {
  key: string;
  title: string;
  detail: string;
  status: "selected" | "considered" | "limited";
};

export type AnalysisTraceMetricSnapshot = {
  key: keyof DerivedMetrics;
  label: string;
  score: number | null;
  status: DerivedMetricLabel;
  evidence: string[];
};

export type AnalysisTrace = {
  version: number;
  mode: "deterministic" | "ai_enriched";
  primaryDiagnosis: string | null;
  primaryTheme: AnalysisTraceTheme | null;
  confidence: "high" | "medium" | "low";
  scoreSummary: {
    seo: number;
    conversion: number;
    overall: number;
  };
  metricSnapshot: AnalysisTraceMetricSnapshot[];
  topSignals: AnalysisTraceSignal[];
  benchmarkSignals: AnalysisTraceSignal[];
  learningSignals: string[];
  recommendedFocus: string[];
  blockedByData: string[];
  decisionFlow: AnalysisTraceStep[];
};

export type AnalysisSectionLock =
  | "advancedOfferAnalysis"
  | "competitorAnalysis"
  | "premiumActionPlan"
  | "export"
  | "history"
  | "reanalysis";

export type AnalysisAccessState = {
  plan: AccessPlan;
  lockedSections: AnalysisSectionLock[];
  teaserSections: AnalysisSectionLock[];
  maxFindings: number;
  maxSuggestions: number;
  maxPriorityActions: number;
};

export type BuildAnalysisResult = {
  summary: string;
  seoScore: number;
  dataCompletenessScore: number;
  conversionScore: number;
  overallScore: number;

  extractedData: ExtractedProductFields;
  derivedMetrics: DerivedMetrics;
  decisionSupportPacket: DecisionSupportPacket;

  strengths: string[];
  weaknesses: string[];
  suggestions: AnalysisSuggestion[];
  priorityActions: PriorityAction[];
  analysisTrace: AnalysisTrace | null;

  priceCompetitiveness: string | null;
  dataSource: string;

  // Phase 1: Extraction reliability metadata (memory only)
  _fieldMetadata?: Record<string, ExtractedFieldMetadata>;
  extractorHealth?: ExtractorHealthReport;
};

// =================================================================
// Consolidated Analysis Input (New Layer)
// =================================================================

/**
 * The source from which a piece of data was extracted.
 * Stricter subset for the consolidated input.
 */
export type ConsolidatedDataSource =
  | "json-ld"
  | "meta-tags"
  | "html-scrape"
  | "api"
  | "derived"
  | "unknown";

/**
 * A container for a piece of data that includes metadata about its
 * origin, reliability, and the logic used to produce it.
 */
export type DataField<T> = {
  value: T | null;
  source: ConsolidatedDataSource;
  /** A score from 0.0 (unreliable) to 1.0 (ground truth) */
  confidence: number;
  /** A human-readable explanation of how this value was determined. */
  reason: string;
};

/**
 * A unified and reliable data object created by the "Analysis Pre-processing Layer".
 * This object is the single source of truth for all downstream analysis,
 * including the AI analysis and deterministic rule engines.
 */
export type ConsolidatedAnalysisInput = {
  // Core Product Info
  title: DataField<string>;
  brand: DataField<string>;
  productName: DataField<string>;
  modelCode: DataField<string>;
  category: DataField<string>;

  // Pricing
  price: DataField<number>;
  originalPrice: DataField<number>;
  currency: DataField<string>;

  // Media
  imageCount: DataField<number>;
  hasVideo: DataField<boolean>;

  // Ratings & Reviews
  ratingValue: DataField<number>;
  reviewCount: DataField<number>;

  // Description & Content
  descriptionLength: DataField<number>;
  bulletPointCount: DataField<number>;

  // Logistics & Fulfillment
  stockQuantity: DataField<number>;
  hasFreeShipping: DataField<boolean>;

  // Seller Info
  sellerName: DataField<string>;
  sellerScore: DataField<number>;
  isOfficialSeller: DataField<boolean>;

  // Raw extracted data for reference
  _raw: ExtractedProductFields;
};
