type DerivedMetricSummary = {
  score: number | null;
  label: string;
  evidence: string[];
};

type DerivedMetricsSummary = {
  productQuality?: DerivedMetricSummary;
  sellerTrust?: DerivedMetricSummary;
  marketPosition?: DerivedMetricSummary;
} | null;

type TrendyolKeywordInsightSummary = {
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  source: "deterministic" | "ai_enriched";
  confidence: "high" | "medium" | "low";
  entities: {
    productType: string | null;
    problemOrNeed: string | null;
    targetAudience: string | null;
    format: string | null;
    attributes: string[];
    useCases: string[];
  };
  suggestedTitle: string | null;
};

type TrendyolScoreDimensionSummary = {
  score: number;
  label: "strong" | "medium" | "weak" | "unclear";
  evidence: string[];
};

type TrendyolScorecardSummary = {
  keywordInsight: TrendyolKeywordInsightSummary;
  contentFit: TrendyolScoreDimensionSummary;
  listingQuality: TrendyolScoreDimensionSummary;
  commercialStrength: TrendyolScoreDimensionSummary;
  performanceSignal: TrendyolScoreDimensionSummary;
  operationalTrust: TrendyolScoreDimensionSummary;
  searchVisibility: TrendyolScoreDimensionSummary;
  conversionPotential: TrendyolScoreDimensionSummary;
  overall: TrendyolScoreDimensionSummary;
  issues: {
    key: string;
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
  }[];
  recommendations: {
    key: string;
    priority: "high" | "medium" | "low";
    title: string;
    detail: string;
  }[];
} | null;

type CategoryAveragesSummary = {
  source: "learning_benchmark";
  sampleSize: number;
  imageCount: number | null;
  descriptionLength: number | null;
  ratingValue: number | null;
  sellerScore: number | null;
  price: number | null;
  reviewCount: number | null;
  favoriteCount: number | null;
  shippingDays: number | null;
  otherSellersCount: number | null;
  freeShippingRate: number | null;
  fastDeliveryRate: number | null;
  hasVideoRate: number | null;
  officialSellerRate: number | null;
} | null;

type ReviewRecordDetailedSummary = {
  rating: number | null;
  text: string | null;
  created_at: string | null;
  seller_name: string | null;
};

type ReviewScopeAnalysisSummary = {
  scope: "product" | "seller";
  seller_name: string | null;
  average_rating: number | null;
  total_comment_count: number | null;
  total_rating_count: number | null;
  rating_breakdown: {
    one_star: number | null;
    two_star: number | null;
    three_star: number | null;
    four_star: number | null;
    five_star: number | null;
    total: number | null;
  } | null;
  review_summary: {
    sampled_count: number;
    low_rated_count: number;
    positive_count: number;
    negative_count: number;
  } | null;
  review_themes: {
    positive: string[];
    negative: string[];
  } | null;
  top_positive_review_hits: {
    label: string;
    count: number;
  }[] | null;
  top_negative_review_hits: {
    label: string;
    count: number;
  }[] | null;
  monthly_trend: {
    month: string;
    count: number;
    low_rated_count: number;
    average_rating: number | null;
  }[] | null;
  recent_reviews: ReviewRecordDetailedSummary[] | null;
} | null;

type ReviewAnalysisSummary = {
  is_single_seller: boolean;
  seller_filter_available: boolean;
  seller_id: number | null;
  seller_name: string | null;
  general: ReviewScopeAnalysisSummary;
  seller: ReviewScopeAnalysisSummary;
} | null;

type ReportAccessState = {
  plan: string;
  lockedSections: string[];
  teaserSections: string[];
  maxFindings: number;
  maxSuggestions: number;
  maxPriorityActions: number;
} | null;

type AnalysisCoverageSummary = {
  availableFields: string[];
  missingFields: string[];
  confidence: "high" | "medium" | "low";
} | null;

type MissingDataSnapshotSummary = {
  availableFields: string[];
  missingFields: string[];
  criticalMissingFields: string[];
  importantMissingFields: string[];
  optionalMissingFields: string[];
};

type MissingDataReportSummary = {
  before: MissingDataSnapshotSummary;
  after: MissingDataSnapshotSummary;
  filledFields: string[];
  strengthenedFields: string[];
  appliedRules: string[];
  unresolvedCriticalFields: string[];
  unresolvedReasons: {
    field: string;
    priority: "critical" | "important" | "optional";
    reason: string;
  }[];
} | null;

type LearningStatusSummary = {
  sourceType: "real" | "synthetic";
  eligible: boolean;
  reason: string;
} | null;

type AnalysisTraceSummary = {
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
  primaryTheme:
    | "stock"
    | "price"
    | "delivery"
    | "content"
    | "visual"
    | "trust"
    | "reviews"
    | "faq"
    | "campaign"
    | "mixed"
    | null;
  confidence: "high" | "medium" | "low";
  scoreSummary: {
    seo: number;
    conversion: number;
    overall: number;
  };
  metricSnapshot: {
    key: string;
    label: string;
    score: number | null;
    status: string;
    evidence: string[];
  }[];
  topSignals: {
    key: string;
    label: string;
    detail: string;
    tone: "positive" | "warning" | "neutral";
    source: "metric" | "market" | "benchmark" | "learning" | "coverage";
    weight: number;
    relatedFields: string[];
  }[];
  benchmarkSignals: {
    key: string;
    label: string;
    detail: string;
    tone: "positive" | "warning" | "neutral";
    source: "metric" | "market" | "benchmark" | "learning" | "coverage";
    weight: number;
    relatedFields: string[];
  }[];
  learningSignals: string[];
  recommendedFocus: string[];
  blockedByData: string[];
  decisionFlow: {
    key: string;
    title: string;
    detail: string;
    status: "selected" | "considered" | "limited";
  }[];
} | null;

type AnalysisVisualsSummary = {
  version: 1;
  blocks: Array<{
    key:
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
    title: string;
    chartType:
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
    availability: "ready" | "limited" | "hidden";
    shortLabel?: string;
    statusLabel?: string;
    visible?: boolean;
    description: string;
    data: Record<string, unknown>;
    reasonIfLimited?: string;
  }>;
} | null;

type MarketOverviewSummary = {
  salesStatus: {
    level: string;
    label: string;
  };
  marketPosition: {
    level: string;
    label: string;
  };
  growthOpportunity: {
    level: string;
    label: string;
  };
  priceAdvantage: {
    level: string;
    label: string;
  };
  relativeMarketStatus: string;
  demandConfidence: string;
  mainPressureAreas: string[];
} | null;

type ExtractedDataSummary = {
  title?: string;
  meta_description?: string;
  meta_description_source?: string | null;
  h1?: string;
  raw_h1?: string | null;
  resolved_primary_heading?: string | null;
  heading_source?: string | null;
  brand?: string | null;
  product_name?: string | null;
  sku_source?: string | null;
  category?: string | null;
  price?: string;
  normalized_price?: number | null;
  original_price?: number | null;
  discount_rate?: number | null;
  image_count?: number;
  description_text?: string | null;
  description_length?: number | null;
  rating_value?: number | null;
  rating_breakdown?: {
    one_star: number | null;
    two_star: number | null;
    three_star: number | null;
    four_star: number | null;
    five_star: number | null;
    total: number | null;
  } | null;
  review_count?: number | null;
  review_snippets?: {
    rating: number | null;
    text: string | null;
  }[] | null;
  review_records?: ReviewRecordDetailedSummary[] | null;
  qa_snippets?: {
    question: string | null;
    answer: string | null;
  }[] | null;
  review_summary?: {
    sampled_count: number;
    low_rated_count: number;
    positive_count: number;
    negative_count: number;
  } | null;
  review_themes?: {
    positive: string[];
    negative: string[];
  } | null;
  top_positive_review_hits?: {
    label: string;
    count: number;
  }[] | null;
  top_negative_review_hits?: {
    label: string;
    count: number;
  }[] | null;
  review_analysis?: ReviewAnalysisSummary;
  question_count?: number | null;
  bullet_point_count?: number | null;
  variant_count?: number | null;
  stock_quantity?: number | null;
  has_specs?: boolean;
  has_faq?: boolean;
  has_shipping_info?: boolean;
  has_return_info?: boolean;
  has_free_shipping?: boolean;
  shipping_days?: number | null;
  delivery_type?: string | null;
  has_video?: boolean;
  has_brand_page?: boolean;
  merchant_id?: number | null;
  listing_id?: string | null;
  seller_badges?: string[] | null;
  seller_score?: number | null;
  follower_count?: number | null;
  favorite_count?: number | null;
  other_sellers_count?: number | null;
  other_sellers_summary?: {
    count: number;
    scored_count: number;
    avg_score: number | null;
    top_score: number | null;
    official_count: number;
    fast_delivery_count: number;
    high_follower_count: number;
    seller_names: string[];
    min_price?: number | null;
    max_price?: number | null;
    avg_price?: number | null;
    cheapest_seller_name?: string | null;
    same_price_count?: number;
    cheaper_count?: number;
    more_expensive_count?: number;
  } | null;
  other_seller_offers?: {
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
  }[] | null;
  official_seller?: boolean;
  has_campaign?: boolean;
  campaign_label?: string | null;
  promotion_labels?: string[] | null;
  seller_name?: string | null;
  stock_status?: string | null;
  [key: string]: unknown;
} | null;

export type AnalysisResult = {
  url?: string;
  platform: string | null;
  category: string | null;
  seoScore: number | null;
  conversionScore?: number | null;
  overallScore?: number | null;
  dataCompletenessScore?: number | null;
  priceCompetitiveness: string | null;
  summary: string | null;
  dataSource: "real" | "fallback" | string | null;
  derivedMetrics?: DerivedMetricsSummary;
  trendyolScorecard?: TrendyolScorecardSummary;
  categoryAverages?: CategoryAveragesSummary;
  reviewAnalysis?: ReviewAnalysisSummary;
  coverage?: AnalysisCoverageSummary;
  missingDataReport?: MissingDataReportSummary;
  learningStatus?: LearningStatusSummary;
  diagnostics?: {
    totalMs: number;
    fetchHtmlMs: number;
    fetchApiMs: number;
    extractionMs: number;
    reviewAnalysisMs: number;
    deterministicMs: number;
    aiMs: number;
  } | null;
  analysisTrace?: AnalysisTraceSummary;
  analysisVisuals?: AnalysisVisualsSummary;
  marketOverview?: MarketOverviewSummary;
  aiCommentary?: {
    mode: "deterministic" | "ai_enriched";
    summary: string;
  } | null;
  access?: ReportAccessState;
  teaserSections?: {
    key: string;
    teaser: string;
  }[] | null;
  extractedData: ExtractedDataSummary;
  suggestions: {
    icon: string;
    title: string;
    detail: string;
  }[];
  priorityActions: {
    priority: number;
    title: string;
    detail: string;
  }[];
};

export type SavedReport = {
  id: string;
  url: string;
  platform: string | null;
  category: string | null;
  seoScore: number | null;
  conversionScore?: number | null;
  overallScore?: number | null;
  dataCompletenessScore?: number | null;
  priceCompetitiveness: string | null;
  summary: string | null;
  dataSource: string | null;
  derivedMetrics?: DerivedMetricsSummary;
  trendyolScorecard?: TrendyolScorecardSummary;
  categoryAverages?: CategoryAveragesSummary;
  reviewAnalysis?: ReviewAnalysisSummary;
  coverage?: AnalysisCoverageSummary;
  analysisTrace?: AnalysisTraceSummary;
  analysisVisuals?: AnalysisVisualsSummary;
  marketOverview?: MarketOverviewSummary;
  aiCommentary?: {
    mode: "deterministic" | "ai_enriched";
    summary: string;
  } | null;
  accessState?: Partial<NonNullable<ReportAccessState>> | null;
  extractedData: ExtractedDataSummary;
  suggestions: {
    icon: string;
    title: string;
    detail: string;
  }[];
  priorityActions: {
    priority: number;
    title: string;
    detail: string;
  }[];
  createdAt: string;
};

export type ApiError = {
  error: string;
  message?: string;
  detail?: string;
};
