type DerivedMetricSummary = {
  score: number | null;
  label: string;
  evidence: string[];
};

type DerivedMetricsSummary = {
  contentQuality?: DerivedMetricSummary;
  trustStrength?: DerivedMetricSummary;
  offerStrength?: DerivedMetricSummary;
  visualStrength?: DerivedMetricSummary;
  decisionClarity?: DerivedMetricSummary;
  reviewRisk?: DerivedMetricSummary;
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

type ExtractedDataSummary = {
  title?: string;
  meta_description?: string;
  h1?: string;
  brand?: string | null;
  product_name?: string | null;
  model_code?: string | null;
  category?: string | null;
  price?: string;
  normalized_price?: number | null;
  original_price?: number | null;
  discount_rate?: number | null;
  image_count?: number;
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
  coverage?: AnalysisCoverageSummary;
  missingDataReport?: MissingDataReportSummary;
  learningStatus?: LearningStatusSummary;
  analysisTrace?: AnalysisTraceSummary;
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
  coverage?: AnalysisCoverageSummary;
  analysisTrace?: AnalysisTraceSummary;
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
