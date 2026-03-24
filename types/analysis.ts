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
export type CanonicalFieldSource =
  | "html"
  | "embedded_json"
  | "runtime_xhr"
  | "parser_inference"
  | "derived_from_similar_products"
  | "keyword_search"
  | "not_found";

export type CanonicalFieldConfidence = "high" | "medium" | "low" | "none";

export type LegacyExtractedFieldSource =
  | "platform"
  | "generic"
  | "api"
  | "api_fallback"
  | "derived"
  | "synthetic"
  | "null"
  | "xhr"
  | "embedded_json"
  | "html"
  | "heuristic"
  | "not_found";

export type LegacyExtractedFieldConfidence =
  | "high"
  | "medium"
  | "low"
  | "unknown"
  | "none";

export type ExtractedFieldSource =
  | CanonicalFieldSource
  | LegacyExtractedFieldSource;

export type ExtractedFieldConfidence =
  | CanonicalFieldConfidence
  | LegacyExtractedFieldConfidence;

export type NormalizedFieldMetadata = {
  source: CanonicalFieldSource;
  confidence: CanonicalFieldConfidence;
  notes?: string[];
  extractionReason?: string;
  fallbackChain?: string[];
  derivedFrom?: string[];
};

export type ExtractedFieldMetadata = {
  source: ExtractedFieldSource;
  confidence: ExtractedFieldConfidence;
  timestamp?: number; // unix ms (when extracted)
  derivedFrom?: string[]; // field names used in derivation
  fallbackChain?: string[]; // sources attempted in order
  apiAge?: number; // hours old (if source=api)
  reason?: string; // human readable explanation
  notes?: string[];
  extractionReason?: string;
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

export type SimilarProductCandidate = {
  title?: string | null;
  url?: string | null;
  short_url?: string | null;
  price?: number | null;
  currency?: string | null;
  brand?: string | null;
  sku?: string | null;
  rating_value?: number | null;
  review_count?: number | null;
  question_count?: number | null;
  seller_score?: number | null;
  thumbnail?: string | null;
};

export type UserPricePosition =
  | "affordable"
  | "average"
  | "expensive"
  | "unclear";

export type PriceCompetitivenessLevel =
  | "strong_advantage"
  | "neutral"
  | "disadvantage"
  | "unclear";

export type SalesLevel =
  | "very_low"
  | "low"
  | "medium"
  | "good"
  | "high"
  | "unclear";

export type MarketPositionLevel =
  | "leading"
  | "strong"
  | "average"
  | "lagging"
  | "unclear";

export type GrowthOpportunityLevel =
  | "low"
  | "medium"
  | "high"
  | "very_high"
  | "unclear";

export type AnalysisOutcomeType =
  | "working_good"
  | "working_underperforming"
  | "working_risky"
  | "conversion_problem"
  | "low_demand"
  | "unclear";

export type MarketIssueType =
  | "price"
  | "trust"
  | "listing"
  | "visibility"
  | "demand"
  | "mixed"
  | "unclear";

export type EstimationConfidence = "low" | "medium" | "high" | "unclear";

export type EstimatedSalesRange = {
  min: number;
  max: number;
  windowDays: number;
};

export type CompetitorSalesEstimate = {
  sellerName: string | null;
  estimatedSalesLevel: SalesLevel;
  estimatedSalesRange: EstimatedSalesRange | null;
  estimationConfidence: EstimationConfidence;
  relativeAdvantageSignals: string[];
};

export type MarketDemandSignal = "low" | "medium" | "high" | "unclear";

export type MarketDemandVerdict = {
  result: string;
  confidence: EstimationConfidence;
  referenceSellerCount: number;
};

export type DemandStatus = "high" | "medium" | "low" | "unclear";

export type CaptureStatus = "strong" | "average" | "weak" | "unclear";

export type DiagnosisConfidence = "high" | "medium" | "low";

export type ComparisonMode =
  | "same_product"
  | "similar_products_fallback"
  | "insufficient_data";

export type ComparisonConfidence = "high" | "medium" | "low";

export type ComparisonPosition =
  | "better"
  | "competitive"
  | "weaker"
  | "unknown";

export type OverallOfferCompetitiveness =
  | "strong"
  | "balanced"
  | "weak"
  | "unknown";

export type CompetitorPriceSummary = {
  competitorCount: number | null;
  lowestCompetitorPrice: number | null;
  highestCompetitorPrice: number | null;
  averageCompetitorPrice: number | null;
  medianCompetitorPrice: number | null;
  userPriceRank: number | null;
  userPriceDeltaFromMedian: number | null;
  userPricePosition: UserPricePosition | null;
  priceCompetitiveness: PriceCompetitivenessLevel | null;
};

export type MarketInsights = {
  competitorCount: number | null;
  lowestCompetitorPrice: number | null;
  highestCompetitorPrice: number | null;
  averageCompetitorPrice: number | null;
  medianCompetitorPrice: number | null;
  userPriceRank: number | null;
  userPriceDeltaFromMedian: number | null;
  userPricePosition: UserPricePosition | null;
  priceCompetitiveness: PriceCompetitivenessLevel | null;
  salesLevel: SalesLevel | null;
  marketPosition: MarketPositionLevel | null;
  growthOpportunityLevel: GrowthOpportunityLevel | null;
  outcomeType: AnalysisOutcomeType | null;
  primaryIssue: MarketIssueType | null;
  secondaryIssues: MarketIssueType[] | null;
  mainIssues: MarketIssueType[] | null;
  competitorSalesEstimates: CompetitorSalesEstimate[] | null;
  strongestCompetitorSalesLevel: SalesLevel | null;
  strongestCompetitorSalesRange: EstimatedSalesRange | null;
  userEstimatedSalesLevel: SalesLevel | null;
  userEstimatedSalesRange: EstimatedSalesRange | null;
  marketDemandSignal: MarketDemandSignal | null;
};

export type MarketComparisonInsights = {
  comparisonMode: ComparisonMode;
  comparisonConfidence: ComparisonConfidence;
  comparisonReasons: string[];
  demandStatus: DemandStatus;
  captureStatus: CaptureStatus;
  diagnosisConfidence: DiagnosisConfidence;
  diagnosisReasons: string[];
  evidenceSummary: string[];
  uncertaintyNotes: string[];
  pricePosition: ComparisonPosition;
  shippingPosition: ComparisonPosition;
  sellerReputationPosition: ComparisonPosition;
  promotionPosition: ComparisonPosition;
  overallOfferCompetitiveness: OverallOfferCompetitiveness;
  dominantGapReason: string | null;
  strongestAdvantageReason: string | null;
  competitorSummary: CompetitorPriceSummary;
  competitorSalesEstimates: CompetitorSalesEstimate[];
  strongestCompetitorSalesLevel: SalesLevel;
  strongestCompetitorSalesRange: EstimatedSalesRange | null;
  userEstimatedSalesLevel: SalesLevel;
  userEstimatedSalesRange: EstimatedSalesRange | null;
  marketDemandSignal: MarketDemandSignal;
  marketPosition: MarketPositionLevel;
  growthOpportunityLevel: GrowthOpportunityLevel;
  outcomeType: AnalysisOutcomeType;
  primaryIssue: MarketIssueType;
  secondaryIssues: MarketIssueType[];
  mainIssues: MarketIssueType[];
  demandVerdict: MarketDemandVerdict;
};

export type AnalysisVisualBlockKey =
  | "price_position"
  | "sales_status"
  | "growth_opportunity"
  | "market_position"
  | "market_interest"
  | "interest_to_sales_funnel"
  | "customer_trust"
  | "page_strength"
  | "main_challenges"
  | "competitor_strength";

export type AnalysisVisualChartType =
  | "range_distribution"
  | "segmented_meter"
  | "gauge"
  | "position_ladder"
  | "score_bar"
  | "funnel"
  | "stacked_meter"
  | "quality_indicator"
  | "ranked_bars"
  | "grouped_buckets";

export type AnalysisVisualAvailability = "ready" | "limited" | "hidden";

export type AnalysisVisualPricePositionData = {
  min: number | null;
  median: number | null;
  max: number | null;
  userValue: number | null;
  userLabel: string;
};

export type AnalysisVisualLevelData = {
  level: string;
  normalizedScore: number | null;
  label: string;
};

export type AnalysisVisualMarketPositionData = {
  position: MarketPositionLevel | "unclear";
  label: string;
  rankHint?: string | null;
};

export type AnalysisVisualInterestData = {
  level: MarketDemandSignal | "unclear";
  normalizedScore: number | null;
  supportingSignals: string[];
};

export type AnalysisVisualFunnelStage = {
  label: string;
  value: number | null;
  normalizedValue: number | null;
};

export type AnalysisVisualTrustData = {
  overallLevel: "low" | "medium" | "high" | "unclear";
  subScores: Array<{
    key: "rating" | "reviews" | "questions" | "seller";
    label: string;
    value: number | null;
    normalizedScore: number | null;
  }>;
};

export type AnalysisVisualPageStrengthData = {
  overallLevel: "low" | "medium" | "high" | "unclear";
  parts: Array<{
    key: "title" | "description" | "images";
    label: string;
    normalizedScore: number | null;
    level: "low" | "medium" | "high" | "unclear";
  }>;
};

export type AnalysisVisualIssueBarsData = {
  issueBars: Array<{
    key: MarketIssueType;
    label: string;
    value: number;
    normalizedValue: number;
  }>;
};

export type AnalysisVisualCompetitorStrengthData = {
  buckets: Array<{
    key: "strong" | "medium" | "weak" | "unclear";
    label: string;
    count: number;
    normalizedValue: number;
  }>;
};

export type AnalysisVisualBlockMeta = {
  shortLabel?: string;
  statusLabel?: string;
  visible?: boolean;
};

export type AnalysisVisualBlock =
  AnalysisVisualBlockMeta &
  (| {
      key: "price_position";
      title: "Fiyatın Nerede?";
      chartType: "range_distribution";
      availability: AnalysisVisualAvailability;
      description: string;
      data: AnalysisVisualPricePositionData;
      reasonIfLimited?: string;
    }
  | {
      key: "sales_status";
      title: "Satış Durumu";
      chartType: "segmented_meter";
      availability: AnalysisVisualAvailability;
      description: string;
      data: AnalysisVisualLevelData;
      reasonIfLimited?: string;
    }
  | {
      key: "growth_opportunity";
      title: "Büyüme Fırsatı";
      chartType: "gauge";
      availability: AnalysisVisualAvailability;
      description: string;
      data: AnalysisVisualLevelData;
      reasonIfLimited?: string;
    }
  | {
      key: "market_position";
      title: "Diğer Mağazalara Göre Durumun";
      chartType: "position_ladder";
      availability: AnalysisVisualAvailability;
      description: string;
      data: AnalysisVisualMarketPositionData;
      reasonIfLimited?: string;
    }
  | {
      key: "market_interest";
      title: "Ürüne İlgi";
      chartType: "score_bar";
      availability: AnalysisVisualAvailability;
      description: string;
      data: AnalysisVisualInterestData;
      reasonIfLimited?: string;
    }
  | {
      key: "interest_to_sales_funnel";
      title: "İlgi Satışa Dönüyor mu?";
      chartType: "funnel";
      availability: AnalysisVisualAvailability;
      description: string;
      data: { stages: AnalysisVisualFunnelStage[] };
      reasonIfLimited?: string;
    }
  | {
      key: "customer_trust";
      title: "Müşteri Güveni";
      chartType: "stacked_meter";
      availability: AnalysisVisualAvailability;
      description: string;
      data: AnalysisVisualTrustData;
      reasonIfLimited?: string;
    }
  | {
      key: "page_strength";
      title: "Sayfa Gücü";
      chartType: "quality_indicator";
      availability: AnalysisVisualAvailability;
      description: string;
      data: AnalysisVisualPageStrengthData;
      reasonIfLimited?: string;
    }
  | {
      key: "main_challenges";
      title: "Seni En Çok Ne Zorluyor?";
      chartType: "ranked_bars";
      availability: AnalysisVisualAvailability;
      description: string;
      data: AnalysisVisualIssueBarsData;
      reasonIfLimited?: string;
    }
  | {
      key: "competitor_strength";
      title: "Rakipler Ne Kadar Güçlü?";
      chartType: "grouped_buckets";
      availability: AnalysisVisualAvailability;
      description: string;
      data: AnalysisVisualCompetitorStrengthData;
      reasonIfLimited?: string;
    });

export type AnalysisVisualsPack = {
  version: 1;
  blocks: AnalysisVisualBlock[];
};

export type MarketOverviewSummary = {
  salesStatus: {
    level: SalesLevel | "unclear";
    label: string;
  };
  marketPosition: {
    level: MarketPositionLevel | "unclear";
    label: string;
  };
  growthOpportunity: {
    level: GrowthOpportunityLevel | "unclear";
    label: string;
  };
  priceAdvantage: {
    level: PriceCompetitivenessLevel | "unclear";
    label: string;
  };
  relativeMarketStatus: string;
  demandConfidence: EstimationConfidence;
  mainPressureAreas: string[];
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
  similar_product_candidates?: SimilarProductCandidate[] | null;
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
  aiDecision?: {
    eligible: boolean;
    executed: boolean;
    mode: "skip" | "cautious" | "full";
    reason: string;
    blockingFields: string[];
    coverageTier: "strong" | "medium" | "weak";
  } | null;
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

export type InternalDebugStage =
  | "fetch"
  | "parse"
  | "merge"
  | "override"
  | "analysis"
  | "confidence";

export type InternalDebugLevel = "info" | "warn";

export type InternalDebugEvent = {
  stage: InternalDebugStage;
  level: InternalDebugLevel;
  code: string;
  message: string;
  field?: string;
  meta?: Record<string, unknown>;
  timestamp: string;
};

export type InternalDebugTraceSummary = {
  totalEvents: number;
  warnings: number;
  fetchEvents: number;
  parseEvents: number;
  mergeEvents: number;
  overrideEvents: number;
  analysisEvents: number;
  confidenceEvents: number;
  missingCriticalCount: number;
  overrideConflictCount: number;
  confidenceDowngradeCount: number;
};

export type InternalDebugTraceReport = {
  enabled: boolean;
  pipeline: string;
  urlHost?: string | null;
  platform?: string | null;
  events: InternalDebugEvent[];
  summary: InternalDebugTraceSummary;
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
  analysisVisuals?: AnalysisVisualsPack;
  marketOverview?: MarketOverviewSummary;
  marketComparison?: MarketComparisonInsights | null;
  aiCommentary?: {
    mode: "deterministic" | "ai_enriched";
    summary: string;
  } | null;
  analysisTrace: AnalysisTrace | null;

  priceCompetitiveness: string | null;
  dataSource: string;

  // Phase 1: Extraction reliability metadata (memory only)
  _fieldMetadata?: Record<string, ExtractedFieldMetadata>;
  _normalizedFieldMetadata?: Record<string, NormalizedFieldMetadata>;
  extractorHealth?: ExtractorHealthReport;
  debugTrace?: InternalDebugTraceReport | null;
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
  metadata?: NormalizedFieldMetadata;
};

export type ConsolidatedMarketInsights = {
  competitorCount: DataField<number>;
  lowestCompetitorPrice: DataField<number>;
  highestCompetitorPrice: DataField<number>;
  averageCompetitorPrice: DataField<number>;
  medianCompetitorPrice: DataField<number>;
  userPriceRank: DataField<number>;
  userPriceDeltaFromMedian: DataField<number>;
  userPricePosition: DataField<UserPricePosition>;
  priceCompetitiveness: DataField<PriceCompetitivenessLevel>;
  salesLevel: DataField<SalesLevel>;
  marketPosition: DataField<MarketPositionLevel>;
  growthOpportunityLevel: DataField<GrowthOpportunityLevel>;
  outcomeType: DataField<AnalysisOutcomeType>;
  primaryIssue: DataField<MarketIssueType>;
  secondaryIssues: DataField<MarketIssueType[]>;
  mainIssues: DataField<MarketIssueType[]>;
  competitorSalesEstimates: DataField<CompetitorSalesEstimate[]>;
  strongestCompetitorSalesLevel: DataField<SalesLevel>;
  strongestCompetitorSalesRange: DataField<EstimatedSalesRange>;
  userEstimatedSalesLevel: DataField<SalesLevel>;
  userEstimatedSalesRange: DataField<EstimatedSalesRange>;
  marketDemandSignal: DataField<MarketDemandSignal>;
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

  // Market comparison / positioning block
  marketInsights?: ConsolidatedMarketInsights | null;
  marketComparison?: MarketComparisonInsights | null;

  // Canonical field-level metadata for confidence-aware analysis
  _fieldMetadata?: Record<string, NormalizedFieldMetadata>;

  // Raw extracted data for reference
  _raw: ExtractedProductFields;
};
