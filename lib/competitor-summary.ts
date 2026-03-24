import type {
  AnalysisOutcomeType,
  CaptureStatus,
  ComparisonConfidence,
  ComparisonMode,
  ComparisonPosition,
  CompetitorPriceSummary,
  CompetitorSalesEstimate,
  DemandStatus,
  DiagnosisConfidence,
  EstimatedSalesRange,
  EstimationConfidence,
  ExtractedProductFields,
  MarketComparisonInsights,
  MarketDemandSignal,
  MarketIssueType,
  MarketPositionLevel,
  PriceCompetitivenessLevel,
  SalesLevel,
  SimilarProductCandidate,
  UserPricePosition,
  GrowthOpportunityLevel,
  OverallOfferCompetitiveness,
} from "@/types/analysis";
import type { DebugTraceHandle } from "@/lib/debug-observability";
import { traceEvent } from "@/lib/debug-observability";

type OtherSellersSummaryLike = {
  count?: number | null;
  scored_count?: number | null;
  avg_score?: number | null;
  top_score?: number | null;
  official_count?: number | null;
  fast_delivery_count?: number | null;
  high_follower_count?: number | null;
  seller_names?: string[] | null;
  min_price?: number | null;
  max_price?: number | null;
  avg_price?: number | null;
  cheapest_seller_name?: string | null;
  same_price_count?: number | null;
  cheaper_count?: number | null;
  more_expensive_count?: number | null;
};

type OfferLike = {
  sellerName: string | null;
  sellerScore: number | null;
  followerCount: number | null;
  price: number | null;
  discountRate: number | null;
  hasFreeShipping: boolean;
  hasFastDelivery: boolean;
  isOfficial: boolean;
};

type SimilarCandidateLike = {
  title: string | null;
  price: number | null;
  ratingValue: number | null;
  reviewCount: number | null;
  questionCount: number | null;
  sellerScore: number | null;
};

type ComparisonSignalQuality = {
  priceCoverage: number;
  shippingCoverage: number;
  reputationCoverage: number;
  promotionCoverage: number;
  identifierCoverage: number;
};

const SALES_LEVEL_SCORE: Record<SalesLevel, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  good: 4,
  high: 5,
  unclear: 0,
};

const COMPARISON_THRESHOLDS = {
  sameProduct: {
    highConfidenceReferenceCount: 5,
    mediumConfidenceReferenceCount: 3,
    minimumUsableReferenceCount: 2,
    identifierCoverageHigh: 0.8,
    identifierCoverageMedium: 0.5,
  },
  similarFallback: {
    mediumConfidenceReferenceCount: 6,
    minimumUsableReferenceCount: 3,
  },
} as const;

const DIAGNOSIS_THRESHOLDS = {
  demand: {
    strongReviewCount: 120,
    strongFavoriteCount: 3000,
    strongQuestionCount: 40,
    minimumEvidenceCount: 2,
  },
  capture: {
    strongPositionSignals: 2,
    weakPositionSignals: 2,
    minimumKnownSameProductSignals: 2,
  },
} as const;

function toFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round2((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return round2(sorted[mid]);
}

function isOfferLike(
  offer: unknown
): offer is NonNullable<ExtractedProductFields["other_seller_offers"]>[number] {
  return Boolean(offer) && typeof offer === "object";
}

function average(values: number[]) {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, item) => acc + item, 0);
  return round2(sum / values.length);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function formatInt(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value).toLocaleString("tr-TR");
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function classifyUserPricePosition(
  userPrice: number | null,
  medianPrice: number | null
): UserPricePosition {
  if (!userPrice || !medianPrice || medianPrice <= 0) return "unclear";
  const deltaRatio = (userPrice - medianPrice) / medianPrice;
  if (deltaRatio <= -0.05) return "affordable";
  if (deltaRatio >= 0.05) return "expensive";
  return "average";
}

function toPriceCompetitiveness(
  position: UserPricePosition
): PriceCompetitivenessLevel {
  if (position === "affordable") return "strong_advantage";
  if (position === "average") return "neutral";
  if (position === "expensive") return "disadvantage";
  return "unclear";
}

function toDemandSignal(raw: ExtractedProductFields): MarketDemandSignal {
  const reviewCount = toFinite(raw.review_count) ?? 0;
  const favoriteCount = toFinite(raw.favorite_count) ?? 0;
  const questionCount = toFinite(raw.question_count) ?? 0;
  const rating = toFinite(raw.rating_value) ?? 0;

  const evidenceCount = [
    raw.review_count,
    raw.favorite_count,
    raw.question_count,
    raw.rating_value,
  ].filter((item) => toFinite(item) !== null).length;
  if (evidenceCount < 2) return "unclear";

  let score = 0;
  score += clamp(reviewCount / 500, 0, 1) * 0.4;
  score += clamp(favoriteCount / 2000, 0, 1) * 0.3;
  score += clamp(questionCount / 120, 0, 1) * 0.15;
  score += clamp((rating - 3.2) / 1.6, 0, 1) * 0.15;

  if (score >= 0.66) return "high";
  if (score >= 0.33) return "medium";
  return "low";
}

function countDirectDemandEvidence(raw: ExtractedProductFields) {
  return [
    toFinite(raw.review_count),
    toFinite(raw.favorite_count),
    toFinite(raw.question_count),
    toFinite(raw.rating_value),
  ].filter((item) => item != null).length;
}

function buildDirectDemandScore(raw: ExtractedProductFields) {
  const reviewCount = toFinite(raw.review_count) ?? 0;
  const favoriteCount = toFinite(raw.favorite_count) ?? 0;
  const questionCount = toFinite(raw.question_count) ?? 0;
  const rating = toFinite(raw.rating_value) ?? 0;

  return clamp(
    clamp(reviewCount / 500, 0, 1) * 0.38 +
      clamp(favoriteCount / 6000, 0, 1) * 0.27 +
      clamp(questionCount / 140, 0, 1) * 0.22 +
      clamp((rating - 3.5) / 1.4, 0, 1) * 0.13,
    0,
    1
  );
}

function buildSimilarDemandSupport(similarCandidates: SimilarCandidateLike[]) {
  const scored = similarCandidates
    .map((candidate) => {
      const parts: number[] = [];
      if (candidate.reviewCount != null) {
        parts.push(clamp(candidate.reviewCount / 500, 0, 1));
      }
      if (candidate.questionCount != null) {
        parts.push(clamp(candidate.questionCount / 120, 0, 1));
      }
      if (candidate.ratingValue != null) {
        parts.push(clamp((candidate.ratingValue - 3.5) / 1.4, 0, 1));
      }
      if (parts.length === 0) return null;
      return parts.reduce((sum, value) => sum + value, 0) / parts.length;
    })
    .filter((value): value is number => value != null);

  return {
    score: average(scored) ?? 0,
    comparableCount: scored.length,
  };
}

function resolveDemandStatus(params: {
  raw: ExtractedProductFields;
  comparisonMode: ComparisonMode;
  sameProductReferenceCount: number;
  similarCandidates: SimilarCandidateLike[];
}): DemandStatus {
  const evidenceCount = countDirectDemandEvidence(params.raw);
  const directScore = buildDirectDemandScore(params.raw);
  const reviewCount = toFinite(params.raw.review_count) ?? 0;
  const favoriteCount = toFinite(params.raw.favorite_count) ?? 0;
  const questionCount = toFinite(params.raw.question_count) ?? 0;
  const similarSupport = buildSimilarDemandSupport(params.similarCandidates);

  if (
    evidenceCount < DIAGNOSIS_THRESHOLDS.demand.minimumEvidenceCount &&
    params.comparisonMode === "insufficient_data"
  ) {
    return "unclear";
  }

  let status: DemandStatus =
    directScore >= 0.72 ? "high" : directScore >= 0.4 ? "medium" : "low";

  if (
    params.comparisonMode === "same_product" &&
    params.sameProductReferenceCount >= 3 &&
    status === "low" &&
    evidenceCount >= 2 &&
    directScore >= 0.3
  ) {
    status = "medium";
  }

  if (
    params.comparisonMode === "similar_products_fallback" &&
    status === "low" &&
    evidenceCount >= 2 &&
    similarSupport.comparableCount >= 3 &&
    similarSupport.score >= 0.52
  ) {
    status = "medium";
  }

  const hasStrongDirectDemand =
    reviewCount >= DIAGNOSIS_THRESHOLDS.demand.strongReviewCount &&
    favoriteCount >= DIAGNOSIS_THRESHOLDS.demand.strongFavoriteCount &&
    questionCount >= DIAGNOSIS_THRESHOLDS.demand.strongQuestionCount;

  if (status === "high" && !hasStrongDirectDemand && params.comparisonMode !== "same_product") {
    status = "medium";
  }

  if (status === "high" && evidenceCount < 3) {
    status = "medium";
  }

  if (evidenceCount < DIAGNOSIS_THRESHOLDS.demand.minimumEvidenceCount) {
    return "unclear";
  }

  return status;
}

function toTrustSignal(raw: ExtractedProductFields): "low" | "medium" | "high" | "unclear" {
  const rating = toFinite(raw.rating_value);
  const reviewCount = toFinite(raw.review_count);
  const sellerScore = toFinite(raw.seller_score);
  const signalCount = [rating, reviewCount, sellerScore].filter((item) => item != null).length;
  if (signalCount < 2) return "unclear";

  const parts: number[] = [];
  if (rating != null) parts.push(clamp((rating - 3.2) / 1.6, 0, 1));
  if (reviewCount != null) parts.push(clamp(reviewCount / 500, 0, 1));
  if (sellerScore != null) parts.push(clamp((sellerScore - 6.5) / 3.5, 0, 1));

  const avg = parts.reduce((sum, value) => sum + value, 0) / parts.length;
  if (avg >= 0.66) return "high";
  if (avg >= 0.33) return "medium";
  return "low";
}

function toPageSignal(raw: ExtractedProductFields): "low" | "medium" | "high" | "unclear" {
  const title = typeof raw.title === "string" ? raw.title.trim().length : 0;
  const imageCount = raw.image_count ?? 0;
  const descriptionLength = toFinite(raw.description_length) ?? 0;
  const parts = [
    title > 20 ? 1 : 0,
    imageCount >= 4 ? 1 : 0,
    descriptionLength >= 140 ? 1 : 0,
  ];

  const presentSignals = [
    typeof raw.title === "string" && raw.title.trim().length > 0,
    imageCount > 0,
    toFinite(raw.description_length) != null,
  ].filter(Boolean).length;

  if (presentSignals < 2) return "unclear";

  const score = parts.reduce((sum, value) => sum + value, 0) / parts.length;
  if (score >= 0.8) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function levelFromScore(score: number, signalCount: number): SalesLevel {
  if (signalCount < 2) return "unclear";
  if (score >= 0.8) return "high";
  if (score >= 0.62) return "good";
  if (score >= 0.45) return "medium";
  if (score >= 0.28) return "low";
  return "very_low";
}

function confidenceFromSignals(signalCount: number): EstimationConfidence {
  if (signalCount >= 6) return "high";
  if (signalCount >= 4) return "medium";
  if (signalCount >= 2) return "low";
  return "unclear";
}

function baseRangeFromLevel(level: SalesLevel): EstimatedSalesRange | null {
  switch (level) {
    case "very_low":
      return { min: 5, max: 25, windowDays: 3 };
    case "low":
      return { min: 25, max: 70, windowDays: 3 };
    case "medium":
      return { min: 70, max: 160, windowDays: 3 };
    case "good":
      return { min: 160, max: 320, windowDays: 3 };
    case "high":
      return { min: 320, max: 600, windowDays: 3 };
    default:
      return null;
  }
}

function buildAdaptiveRange(params: {
  level: SalesLevel;
  demand: MarketDemandSignal;
  confidence: EstimationConfidence;
  engagementScore: number;
  referenceCount: number;
  priceCompetitivenessBoost: number;
}): EstimatedSalesRange | null {
  const baseRange = baseRangeFromLevel(params.level);
  if (!baseRange) return null;

  const baseMid = (baseRange.min + baseRange.max) / 2;
  const demandMultiplier =
    params.demand === "high" ? 1.22 : params.demand === "medium" ? 1 : params.demand === "low" ? 0.78 : 0.9;
  const engagementMultiplier = 0.75 + clamp(params.engagementScore, 0, 1.3) * 0.7;
  const referenceMultiplier = 0.92 + clamp(params.referenceCount / 10, 0, 1) * 0.18;
  const midpoint = baseMid * demandMultiplier * engagementMultiplier * referenceMultiplier * params.priceCompetitivenessBoost;

  const baseSpreadRatio =
    params.level === "high"
      ? 0.42
      : params.level === "good"
        ? 0.36
        : params.level === "medium"
          ? 0.33
          : params.level === "low"
            ? 0.3
            : 0.28;
  const uncertaintyMultiplier =
    params.confidence === "high"
      ? 0.85
      : params.confidence === "medium"
        ? 1
        : params.confidence === "low"
          ? 1.22
          : 1.45;
  const halfSpread = Math.max(8, midpoint * baseSpreadRatio * uncertaintyMultiplier);

  return {
    min: Math.max(0, Math.round(midpoint - halfSpread)),
    max: Math.max(1, Math.round(midpoint + halfSpread)),
    windowDays: baseRange.windowDays,
  };
}

function scaleRange(
  range: EstimatedSalesRange | null,
  demand: MarketDemandSignal,
  confidence: EstimationConfidence
) {
  if (!range) return null;
  const demandMultiplier =
    demand === "high" ? 1.25 : demand === "medium" ? 1 : demand === "low" ? 0.75 : 0.9;
  const uncertaintyMultiplier =
    confidence === "high"
      ? 1
      : confidence === "medium"
        ? 1.15
        : confidence === "low"
          ? 1.35
          : 1.55;

  const min = Math.max(0, Math.round(range.min * demandMultiplier / uncertaintyMultiplier));
  const max = Math.max(min + 1, Math.round(range.max * demandMultiplier * uncertaintyMultiplier));
  return {
    min,
    max,
    windowDays: range.windowDays,
  };
}

function buildUncertainRange(demand: MarketDemandSignal): EstimatedSalesRange {
  if (demand === "high") return { min: 15, max: 460, windowDays: 3 };
  if (demand === "medium") return { min: 10, max: 320, windowDays: 3 };
  if (demand === "low") return { min: 2, max: 180, windowDays: 3 };
  return { min: 0, max: 260, windowDays: 3 };
}

function buildRelativeSignals(
  offer: OfferLike,
  medianPrice: number | null,
  userPrice: number | null
) {
  const signals: string[] = [];
  if (offer.price && medianPrice && offer.price < medianPrice * 0.96) {
    signals.push("below_median_price");
  }
  if (offer.price && userPrice && offer.price < userPrice * 0.98) {
    signals.push("cheaper_than_user");
  }
  if ((offer.sellerScore ?? 0) >= 9) {
    signals.push("high_seller_score");
  }
  if ((offer.followerCount ?? 0) >= 20000) {
    signals.push("high_follower_count");
  }
  if (offer.hasFreeShipping) {
    signals.push("free_shipping");
  }
  if (offer.hasFastDelivery) {
    signals.push("fast_delivery");
  }
  if ((offer.discountRate ?? 0) >= 10) {
    signals.push("discount_signal");
  }
  if (offer.isOfficial) {
    signals.push("official_seller");
  }
  return signals;
}

function toSourceConfidence(params: {
  sourceType: "same_product" | "similar_product";
  referenceCount: number;
  evidenceCount: number;
}): EstimationConfidence {
  const baseScore =
    (params.sourceType === "same_product" ? 2 : 1) +
    (params.referenceCount >= 6 ? 2 : params.referenceCount >= 3 ? 1 : 0) +
    (params.evidenceCount >= 4 ? 2 : params.evidenceCount >= 2 ? 1 : 0);

  if (baseScore >= 5) return "high";
  if (baseScore >= 3) return "medium";
  if (baseScore >= 1) return "low";
  return "unclear";
}

function scoreOfferStrength(offer: OfferLike, userPrice: number | null) {
  let score = 0;
  if (offer.price != null && userPrice != null && offer.price <= userPrice * 1.03) score += 2;
  if (offer.price != null) score += 1;
  if ((offer.sellerScore ?? 0) >= 9.2) score += 2;
  else if ((offer.sellerScore ?? 0) >= 8.7) score += 1;
  if (offer.hasFastDelivery) score += 1;
  if (offer.hasFreeShipping) score += 1;
  if (offer.isOfficial) score += 1;
  return score;
}

function selectReferenceOffers(offers: OfferLike[], userPrice: number | null, limit = 10) {
  if (offers.length <= limit) return offers;

  const selected: OfferLike[] = [];
  const seen = new Set<string>();

  const pushUnique = (offer: OfferLike) => {
    const key = `${offer.sellerName ?? "unknown"}|${offer.price ?? "na"}|${offer.sellerScore ?? "na"}`;
    if (seen.has(key) || selected.length >= limit) return;
    seen.add(key);
    selected.push(offer);
  };

  const closestByPrice = [...offers]
    .filter((offer) => offer.price != null && userPrice != null)
    .sort((a, b) => Math.abs((a.price as number) - (userPrice as number)) - Math.abs((b.price as number) - (userPrice as number)))
    .slice(0, 4);

  const cheapest = [...offers]
    .filter((offer) => offer.price != null)
    .sort((a, b) => (a.price as number) - (b.price as number))
    .slice(0, 3);

  const strongest = [...offers]
    .sort((a, b) => scoreOfferStrength(b, userPrice) - scoreOfferStrength(a, userPrice))
    .slice(0, 4);

  closestByPrice.forEach(pushUnique);
  cheapest.forEach(pushUnique);
  strongest.forEach(pushUnique);
  offers.forEach(pushUnique);

  return selected.slice(0, limit);
}

function downgradeComparisonConfidence(
  confidence: ComparisonConfidence
): ComparisonConfidence {
  if (confidence === "high") return "medium";
  return "low";
}

function getRawFieldMeta(raw: ExtractedProductFields, fieldName: string) {
  const withMeta = raw as ExtractedProductFields & {
    _fieldMetadata?: Record<string, { source?: string; confidence?: string }>;
    extracted_sources?: Record<string, { source?: string; confidence?: string }>;
  };

  return (
    withMeta._fieldMetadata?.[fieldName] ||
    withMeta.extracted_sources?.[fieldName] ||
    null
  );
}

function getOfferSignalQuality(offers: OfferLike[]): ComparisonSignalQuality {
  const total = offers.length || 1;
  const withPrice = offers.filter((offer) => offer.price != null).length;
  const withShipping = offers.filter(
    (offer) => offer.hasFastDelivery || offer.hasFreeShipping
  ).length;
  const withReputation = offers.filter(
    (offer) => offer.sellerScore != null || offer.isOfficial
  ).length;
  const withPromotion = offers.filter(
    (offer) => (offer.discountRate ?? 0) > 0 || offer.hasFreeShipping
  ).length;

  return {
    priceCoverage: withPrice / total,
    shippingCoverage: withShipping / total,
    reputationCoverage: withReputation / total,
    promotionCoverage: withPromotion / total,
    identifierCoverage: 0,
  };
}

function getIdentifierCoverage(raw: ExtractedProductFields): number {
  const offers = raw.other_seller_offers ?? [];
  if (!Array.isArray(offers) || offers.length === 0) return 0;
  const identified = offers.filter(
    (offer) => offer?.merchant_id != null && !!offer?.listing_id
  ).length;
  return identified / offers.length;
}

function resolveComparisonMode(
  sameProductOffers: OfferLike[],
  similarCandidates: SimilarCandidateLike[]
): ComparisonMode {
  if (sameProductOffers.length >= COMPARISON_THRESHOLDS.sameProduct.minimumUsableReferenceCount) {
    return "same_product";
  }
  if (similarCandidates.length >= COMPARISON_THRESHOLDS.similarFallback.minimumUsableReferenceCount) {
    return "similar_products_fallback";
  }
  return "insufficient_data";
}

function buildSameProductConfidence(params: {
  raw: ExtractedProductFields;
  referenceCount: number;
  quality: ComparisonSignalQuality;
}): { confidence: ComparisonConfidence; reasons: string[] } {
  let confidence: ComparisonConfidence =
    params.referenceCount >= COMPARISON_THRESHOLDS.sameProduct.highConfidenceReferenceCount
      ? "high"
      : params.referenceCount >= COMPARISON_THRESHOLDS.sameProduct.mediumConfidenceReferenceCount
        ? "medium"
        : "low";

  const reasons: string[] = [`Ayni urunu satan ${params.referenceCount} satici referans alindi.`];

  const identifierCoverage = getIdentifierCoverage(params.raw);
  if (identifierCoverage >= COMPARISON_THRESHOLDS.sameProduct.identifierCoverageHigh) {
    reasons.push("Saticilarin merchant ve listing kimlikleri buyuk oranda dogrulandi.");
  } else if (identifierCoverage >= COMPARISON_THRESHOLDS.sameProduct.identifierCoverageMedium) {
    reasons.push("Satici kimliklerinin bir kismi dogrulandi.");
    confidence = downgradeComparisonConfidence(confidence);
  } else {
    reasons.push("Satici kimlikleri sinirli dogrulandi.");
    confidence = "low";
  }

  if (params.quality.priceCoverage < 0.8) {
    reasons.push("Rakip fiyat kapsami tam degil.");
    confidence = downgradeComparisonConfidence(confidence);
  }
  if (params.quality.reputationCoverage < 0.6) {
    reasons.push("Rakip satici puani verisi kisitli.");
    confidence = downgradeComparisonConfidence(confidence);
  }
  if (params.quality.shippingCoverage < 0.5) {
    reasons.push("Kargo ve teslimat karsilastirmasi sinirli.");
  }

  const offersMeta = getRawFieldMeta(params.raw, "other_seller_offers");
  if (offersMeta?.confidence === "low" || offersMeta?.source === "not_found") {
    reasons.push("Rakip satici listesi dusuk guvenli kaynaktan geldi.");
    confidence = "low";
  }

  return { confidence, reasons };
}

function buildFallbackConfidence(params: {
  raw: ExtractedProductFields;
  referenceCount: number;
  similarCandidates: SimilarCandidateLike[];
}): { confidence: ComparisonConfidence; reasons: string[] } {
  let confidence: ComparisonConfidence =
    params.referenceCount >= COMPARISON_THRESHOLDS.similarFallback.mediumConfidenceReferenceCount
      ? "medium"
      : "low";

  const reasons: string[] = [
    `Ayni urunde yeterli satici bulunamadigi icin ${params.referenceCount} benzer urun referans alindi.`,
  ];

  const textOnlyMatches = params.similarCandidates.filter(
    (candidate) =>
      candidate.price == null &&
      candidate.ratingValue == null &&
      candidate.reviewCount == null &&
      candidate.questionCount == null
  ).length;

  if (textOnlyMatches > 0) {
    reasons.push("Benzer urunlerin bir kismi sadece metin eslesmesiyle geldi.");
    confidence = "low";
  }

  const similarMeta = getRawFieldMeta(params.raw, "similar_product_candidates");
  if (similarMeta?.source === "not_found") {
    reasons.push("Benzer urun fallback verisi sinirli.");
    confidence = "low";
  }

  reasons.push("Bu sonuc ayni urun satici karsilastirmasi degil, benzer urun fallback'idir.");
  return { confidence, reasons };
}

function computeShippingPosition(
  raw: ExtractedProductFields,
  offers: OfferLike[],
  mode: ComparisonMode
): ComparisonPosition {
  if (mode !== "same_product" || offers.length === 0) return "unknown";

  const userShippingAdvantage =
    (raw.has_free_shipping ? 1 : 0) +
    ((raw.delivery_type || "").toLocaleLowerCase("tr-TR").includes("fast") ? 1 : 0) +
    (typeof raw.shipping_days === "number" && raw.shipping_days <= 2 ? 1 : 0);

  const avgShippingAdvantage =
    offers.reduce(
      (sum, offer) =>
        sum +
        (offer.hasFreeShipping ? 1 : 0) +
        (offer.hasFastDelivery ? 1 : 0),
      0
    ) / offers.length;

  if (userShippingAdvantage >= avgShippingAdvantage + 0.75) return "better";
  if (userShippingAdvantage + 0.75 < avgShippingAdvantage) return "weaker";
  return "competitive";
}

function computeSellerReputationPosition(
  raw: ExtractedProductFields,
  offers: OfferLike[],
  mode: ComparisonMode
): ComparisonPosition {
  const userScore = toFinite(raw.seller_score);
  if (mode === "same_product" && offers.length > 0) {
    const scoredOffers = offers
      .map((offer) => offer.sellerScore)
      .filter((score): score is number => score != null);
    if (userScore == null || scoredOffers.length === 0) return "unknown";
    const avgScore = average(scoredOffers) ?? userScore;
    if (userScore >= avgScore + 0.25 || (raw.official_seller && !offers.some((offer) => offer.isOfficial))) {
      return "better";
    }
    if (userScore + 0.25 < avgScore) return "weaker";
    return "competitive";
  }

  if (mode === "similar_products_fallback" && userScore != null) {
    return raw.official_seller || userScore >= 8.8 ? "competitive" : "unknown";
  }

  return "unknown";
}

function computePromotionPosition(
  raw: ExtractedProductFields,
  offers: OfferLike[],
  mode: ComparisonMode
): ComparisonPosition {
  const userPromoStrength =
    (toFinite(raw.discount_rate) != null && (raw.discount_rate as number) >= 10 ? 1 : 0) +
    (raw.has_free_shipping ? 1 : 0) +
    (raw.has_campaign ? 1 : 0);

  if (mode !== "same_product" || offers.length === 0) {
    return userPromoStrength > 0 ? "competitive" : "unknown";
  }

  const avgPromoStrength =
    offers.reduce(
      (sum, offer) =>
        sum +
        ((offer.discountRate ?? 0) >= 10 ? 1 : 0) +
        (offer.hasFreeShipping ? 1 : 0),
      0
    ) / offers.length;

  if (userPromoStrength >= avgPromoStrength + 0.75) return "better";
  if (userPromoStrength + 0.75 < avgPromoStrength) return "weaker";
  return userPromoStrength > 0 || avgPromoStrength > 0 ? "competitive" : "unknown";
}

function toOfferCompetitiveness(params: {
  pricePosition: ComparisonPosition;
  shippingPosition: ComparisonPosition;
  reputationPosition: ComparisonPosition;
  promotionPosition: ComparisonPosition;
}): OverallOfferCompetitiveness {
  const score =
    (params.pricePosition === "better" ? 2 : params.pricePosition === "competitive" ? 1 : params.pricePosition === "weaker" ? -2 : 0) +
    (params.shippingPosition === "better" ? 1 : params.shippingPosition === "competitive" ? 0 : params.shippingPosition === "weaker" ? -1 : 0) +
    (params.reputationPosition === "better" ? 1 : params.reputationPosition === "competitive" ? 0 : params.reputationPosition === "weaker" ? -1 : 0) +
    (params.promotionPosition === "better" ? 1 : params.promotionPosition === "competitive" ? 0 : params.promotionPosition === "weaker" ? -1 : 0);

  if (score >= 2) return "strong";
  if (score <= -2) return "weak";
  if (score === 0 && params.pricePosition === "unknown" && params.shippingPosition === "unknown" && params.reputationPosition === "unknown" && params.promotionPosition === "unknown") {
    return "unknown";
  }
  return "balanced";
}

function getDominantGapReason(params: {
  pricePosition: ComparisonPosition;
  shippingPosition: ComparisonPosition;
  reputationPosition: ComparisonPosition;
  promotionPosition: ComparisonPosition;
  mode: ComparisonMode;
}): string | null {
  if (params.pricePosition === "weaker") return "Fiyat pozisyonu rakiplerin gerisinde kaliyor.";
  if (params.reputationPosition === "weaker") return "Satici guveni ve puani rakiplere gore daha zayif.";
  if (params.shippingPosition === "weaker") return "Teslimat ve kargo avantaji rakiplere gore zayif.";
  if (params.promotionPosition === "weaker") return "Promosyon ve teklif gucu rakiplere gore daha sinirli.";
  if (params.mode === "similar_products_fallback") {
    return "Ayni urunde yeterli satici bulunamadigi icin karar benzer urunler uzerinden kuruldu.";
  }
  return null;
}

function getStrongestAdvantageReason(params: {
  pricePosition: ComparisonPosition;
  shippingPosition: ComparisonPosition;
  reputationPosition: ComparisonPosition;
  promotionPosition: ComparisonPosition;
}): string | null {
  if (params.pricePosition === "better") return "Fiyat konumu rakiplere gore daha avantajli.";
  if (params.reputationPosition === "better") return "Satici guveni rakiplere gore daha guclu.";
  if (params.shippingPosition === "better") return "Teslimat ve kargo tarafi rakiplere gore daha guclu.";
  if (params.promotionPosition === "better") return "Promosyon yapisi rakiplere gore daha avantajli.";
  return null;
}

function getLowConfidenceMetaCount(
  raw: ExtractedProductFields,
  fieldNames: string[]
) {
  return fieldNames.reduce((count, fieldName) => {
    const meta = getRawFieldMeta(raw, fieldName);
    return meta?.confidence === "low" || meta?.confidence === "none" ? count + 1 : count;
  }, 0);
}

function resolveCaptureStatus(params: {
  comparisonMode: ComparisonMode;
  demandStatus: DemandStatus;
  pricePosition: ComparisonPosition;
  shippingPosition: ComparisonPosition;
  reputationPosition: ComparisonPosition;
  promotionPosition: ComparisonPosition;
  overallOfferCompetitiveness: OverallOfferCompetitiveness;
  trustSignal: "low" | "medium" | "high" | "unclear";
  pageSignal: "low" | "medium" | "high" | "unclear";
}): CaptureStatus {
  if (params.comparisonMode === "insufficient_data") {
    return "unclear";
  }

  const strongerSignals = [
    params.pricePosition,
    params.shippingPosition,
    params.reputationPosition,
    params.promotionPosition,
  ].filter((position) => position === "better").length;
  const weakerSignals = [
    params.pricePosition,
    params.shippingPosition,
    params.reputationPosition,
    params.promotionPosition,
  ].filter((position) => position === "weaker").length;
  const knownSignals = [
    params.pricePosition,
    params.shippingPosition,
    params.reputationPosition,
    params.promotionPosition,
  ].filter((position) => position !== "unknown").length;

  if (params.comparisonMode === "same_product") {
    if (knownSignals < DIAGNOSIS_THRESHOLDS.capture.minimumKnownSameProductSignals) {
      return "unclear";
    }

    if (
      params.overallOfferCompetitiveness === "strong" &&
      strongerSignals >= DIAGNOSIS_THRESHOLDS.capture.strongPositionSignals
    ) {
      return "strong";
    }

    if (
      params.demandStatus !== "low" &&
      params.overallOfferCompetitiveness === "weak" &&
      weakerSignals >= DIAGNOSIS_THRESHOLDS.capture.weakPositionSignals
    ) {
      return "weak";
    }

    if (
      params.demandStatus !== "unclear" &&
      (params.overallOfferCompetitiveness === "balanced" || knownSignals >= 2)
    ) {
      return "average";
    }

    return "unclear";
  }

  if (params.comparisonMode === "similar_products_fallback") {
    if (params.demandStatus === "unclear") return "unclear";
    if (params.pageSignal === "low" || params.trustSignal === "low") return "average";
    if (params.demandStatus === "high" || params.demandStatus === "medium") return "average";
  }

  return "unclear";
}

function buildDiagnosisConfidence(params: {
  comparisonMode: ComparisonMode;
  comparisonConfidence: ComparisonConfidence;
  demandStatus: DemandStatus;
  captureStatus: CaptureStatus;
  pricePosition: ComparisonPosition;
  shippingPosition: ComparisonPosition;
  reputationPosition: ComparisonPosition;
  promotionPosition: ComparisonPosition;
  directEvidenceCount: number;
  lowMetaCount: number;
}): DiagnosisConfidence {
  let score =
    params.comparisonMode === "same_product"
      ? 2
      : params.comparisonMode === "similar_products_fallback"
        ? 1
        : 0;

  score +=
    params.comparisonConfidence === "high"
      ? 2
      : params.comparisonConfidence === "medium"
        ? 1
        : 0;

  if (params.directEvidenceCount >= 3) score += 1;
  else if (params.directEvidenceCount < 2) score -= 1;

  const knownPositions = [
    params.pricePosition,
    params.shippingPosition,
    params.reputationPosition,
    params.promotionPosition,
  ].filter((position) => position !== "unknown").length;

  if (knownPositions >= 3) score += 1;
  else if (knownPositions < 2) score -= 1;

  if (params.demandStatus === "unclear" || params.captureStatus === "unclear") {
    score -= 1;
  }

  if (params.lowMetaCount >= 2) score -= 1;

  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function buildEvidenceSummary(params: {
  raw: ExtractedProductFields;
  comparisonMode: ComparisonMode;
  sameProductReferenceCount: number;
  similarCandidates: SimilarCandidateLike[];
  competitorSummary: CompetitorPriceSummary;
  pricePosition: ComparisonPosition;
  trustSignal: "low" | "medium" | "high" | "unclear";
  pageSignal: "low" | "medium" | "high" | "unclear";
}) {
  const items: string[] = [];
  const reviewCount = formatInt(toFinite(params.raw.review_count));
  const favoriteCount = formatInt(toFinite(params.raw.favorite_count));
  const questionCount = formatInt(toFinite(params.raw.question_count));

  if (reviewCount || favoriteCount || questionCount) {
    items.push(
      uniqueStrings([
        reviewCount ? `${reviewCount} yorum` : null,
        favoriteCount ? `${favoriteCount} favori` : null,
        questionCount ? `${questionCount} soru` : null,
      ]).join(", ") + " sinyali mevcut."
    );
  }

  if (params.comparisonMode === "same_product") {
    items.push(`Ayni urunu satan ${params.sameProductReferenceCount} magaza karsilastirildi.`);
  } else if (params.comparisonMode === "similar_products_fallback") {
    items.push(
      `Ayni urunde yeterli satici olmadigi icin ${params.similarCandidates.length} benzer urun referans alindi.`
    );
  }

  const medianPrice = formatPrice(params.competitorSummary.medianCompetitorPrice);
  const deltaPrice = formatPrice(params.competitorSummary.userPriceDeltaFromMedian);
  if (medianPrice) {
    items.push(`Rakip referans medyan fiyat ${medianPrice}.`);
  }
  if (deltaPrice && params.pricePosition !== "unknown") {
    items.push(
      params.pricePosition === "better"
        ? `Fiyat konumu medyana gore avantajli (${deltaPrice} fark).`
        : params.pricePosition === "weaker"
          ? `Fiyat konumu medyana gore daha yuksek (${deltaPrice} fark).`
          : `Fiyat konumu medyana yakin (${deltaPrice} fark).`
    );
  }

  if (params.trustSignal !== "unclear") {
    items.push(`Musteri guveni sinyali ${params.trustSignal}.`);
  }
  if (params.pageSignal !== "unclear") {
    items.push(`Sayfa kalitesi sinyali ${params.pageSignal}.`);
  }

  return uniqueStrings(items).slice(0, 5);
}

function buildUncertaintyNotes(params: {
  comparisonMode: ComparisonMode;
  comparisonConfidence: ComparisonConfidence;
  demandStatus: DemandStatus;
  captureStatus: CaptureStatus;
  sameProductReferenceCount: number;
  similarCandidates: SimilarCandidateLike[];
  lowMetaCount: number;
}): string[] {
  const notes: string[] = [
    "Gercek satis, ciro, goruntulenme veya sepete ekleme verisi kullanilmadi.",
  ];

  if (params.comparisonMode === "similar_products_fallback") {
    notes.push("Capture yorumu ayni urun saticilarina degil, benzer urun fallback'ine dayanir.");
  }

  if (params.comparisonMode === "insufficient_data") {
    notes.push("Ayni urun ve benzer urun karsilastirma verisi karar icin sinirli kaldi.");
  }

  if (
    params.comparisonMode === "same_product" &&
    params.sameProductReferenceCount < COMPARISON_THRESHOLDS.sameProduct.mediumConfidenceReferenceCount
  ) {
    notes.push("Ayni urunde referans satici sayisi sinirli oldugu icin capture karari temkinli okunmali.");
  }

  if (params.lowMetaCount >= 2) {
    notes.push("Temel sinyallerin bir kismi dusuk guvenli kaynaktan geldi.");
  }

  if (params.demandStatus === "unclear" || params.captureStatus === "unclear") {
    notes.push("Eksik veya dolayli kanit nedeniyle net olmayan alanlar korundu.");
  }

  return uniqueStrings(notes).slice(0, 4);
}

function buildDiagnosisReasons(params: {
  demandStatus: DemandStatus;
  captureStatus: CaptureStatus;
  comparisonMode: ComparisonMode;
  pricePosition: ComparisonPosition;
  shippingPosition: ComparisonPosition;
  reputationPosition: ComparisonPosition;
  promotionPosition: ComparisonPosition;
  trustSignal: "low" | "medium" | "high" | "unclear";
  pageSignal: "low" | "medium" | "high" | "unclear";
  marketDemandSignal: MarketDemandSignal;
}): string[] {
  const reasons: string[] = [];

  if (params.demandStatus === "high") {
    reasons.push("Dolayli talep sinyalleri birlikte guclu gorunuyor.");
  } else if (params.demandStatus === "medium") {
    reasons.push("Talep sinyalleri var, ancak cok guclu veya dogrudan degil.");
  } else if (params.demandStatus === "low") {
    reasons.push("Talep sinyalleri sinirli ve dikkatli okunmali.");
  } else {
    reasons.push("Talep tarafinda net karar kuracak kadar veri yok.");
  }

  if (params.comparisonMode === "same_product") {
    if (params.captureStatus === "strong") {
      reasons.push("Ayni urun satici karsilastirmasinda teklif gucu iyi gorunuyor.");
    } else if (params.captureStatus === "weak") {
      reasons.push("Ayni urun satici karsilastirmasi teklif tarafinda geride kalindigini gosteriyor.");
    } else if (params.captureStatus === "average") {
      reasons.push("Ayni urun karsilastirmasinda teklif dengeli ama belirgin ustun degil.");
    } else {
      reasons.push("Ayni urun karsilastirmasi capture kalitesi icin yetersiz kaldi.");
    }
  } else if (params.comparisonMode === "similar_products_fallback") {
    reasons.push("Capture yorumu benzer urun fallback'iyle sinirli tutuldu.");
  } else {
    reasons.push("Capture tarafi icin yeterli karsilastirma zemini yok.");
  }

  if (params.pricePosition === "weaker") {
    reasons.push("Fiyat konumu rakiplere gore baski altinda.");
  } else if (params.pricePosition === "better") {
    reasons.push("Fiyat konumu rakiplere gore avantaj sagliyor.");
  }

  if (params.reputationPosition === "weaker") {
    reasons.push("Satici itibari karsilastirmada zayif kaliyor.");
  } else if (params.reputationPosition === "better") {
    reasons.push("Satici itibari karsilastirmada avantajli.");
  }

  if (params.shippingPosition === "weaker") {
    reasons.push("Teslimat tarafi rakiplere gore daha zayif.");
  }

  if (params.promotionPosition === "better") {
    reasons.push("Promosyon ve teklif yapisi destekleyici gorunuyor.");
  }

  if (params.trustSignal === "low") {
    reasons.push("Musteri guveni sinyali zayif.");
  }
  if (params.pageSignal === "low") {
    reasons.push("Sayfa kalitesi sinyali zayif.");
  }

  if (params.marketDemandSignal === "unclear") {
    reasons.push("Talep sinyalleri dolayli oldugu icin belirsizlik korundu.");
  }

  return uniqueStrings(reasons).slice(0, 6);
}

function toSimilarCandidates(raw: ExtractedProductFields): SimilarCandidateLike[] {
  return (raw.similar_product_candidates ?? [])
    .map((item: SimilarProductCandidate): SimilarCandidateLike => ({
      title: item.title ?? null,
      price: toFinite(item.price),
      ratingValue: toFinite(item.rating_value),
      reviewCount: toFinite(item.review_count),
      questionCount: toFinite(item.question_count),
      sellerScore: toFinite(item.seller_score),
    }))
    .filter((item) => item.price != null || item.ratingValue != null || item.reviewCount != null);
}

function buildDemandVerdict(params: {
  marketDemandSignal: MarketDemandSignal;
  userLevel: SalesLevel;
  strongestCompetitorLevel: SalesLevel;
  priceCompetitiveness: PriceCompetitivenessLevel;
  referenceCount: number;
  sourceType: "same_product" | "similar_product";
  evidenceCount: number;
}): { result: string; confidence: EstimationConfidence; referenceSellerCount: number } {
  let confidence = toSourceConfidence({
    sourceType: params.sourceType,
    referenceCount: params.referenceCount,
    evidenceCount: params.evidenceCount,
  });

  if (params.sourceType === "similar_product" && confidence === "high") {
    confidence = "medium";
  }

  let result = "Talep gorunumu net degil, sonuc temkinli okunmali.";

  if (
    params.marketDemandSignal === "high" &&
    (params.strongestCompetitorLevel === "good" || params.strongestCompetitorLevel === "high") &&
    (params.userLevel === "very_low" || params.userLevel === "low" || params.priceCompetitiveness === "disadvantage")
  ) {
    result =
      params.sourceType === "same_product"
        ? "Ayni urunde talep var, fark daha cok teklif ve magaza gucu tarafinda olusuyor olabilir."
        : "Benzer urunlerde talep gorunuyor, bu urunde sorun daha cok teklif veya sayfa tarafinda olabilir.";
  } else if (params.marketDemandSignal === "high") {
    result =
      params.sourceType === "same_product"
        ? "Bu urunde talep guclu gorunuyor."
        : "Bu urunde ve benzer urunlerde talep guclu gorunuyor.";
  } else if (
    params.marketDemandSignal === "medium" &&
    params.sourceType === "similar_product" &&
    params.referenceCount >= 3
  ) {
    result = "Benzer urunlerde belirli bir talep gorunuyor, bu urun tamamen talepsiz degil.";
  } else if (
    params.marketDemandSignal === "low" &&
    (params.strongestCompetitorLevel === "unclear" ||
      params.strongestCompetitorLevel === "very_low" ||
      params.strongestCompetitorLevel === "low")
  ) {
    result = "Bu urunde talep sinyali sinirli gorunuyor.";
  } else if (
    params.marketDemandSignal === "medium" ||
    params.userLevel === "medium" ||
    params.strongestCompetitorLevel === "medium"
  ) {
    result = "Bu urunde belirli bir talep var, ancak sonuc dengeli ve temkinli okunmali.";
  } else if (
    (params.userLevel === "good" || params.userLevel === "high") &&
    (params.strongestCompetitorLevel === "good" || params.strongestCompetitorLevel === "high")
  ) {
    result = "Bu urunde talep var ve rekabet aktif gorunuyor.";
  }

  return {
    result,
    confidence,
    referenceSellerCount: params.referenceCount,
  };
}

function buildSalesEstimate(
  offer: OfferLike,
  params: {
    medianPrice: number | null;
    userPrice: number | null;
    marketDemandSignal: MarketDemandSignal;
    referenceReviewCount: number | null;
    referenceRating: number | null;
    referenceQuestionCount: number | null;
    referenceFavoriteCount: number | null;
    referenceCount: number;
  }
): CompetitorSalesEstimate {
  const signals: number[] = [];
  const relativeSignals = buildRelativeSignals(offer, params.medianPrice, params.userPrice);

  if (offer.price && params.medianPrice && params.medianPrice > 0) {
    const priceScore = clamp(
      (params.medianPrice - offer.price) / params.medianPrice + 0.5,
      0,
      1
    );
    signals.push(priceScore);
  }

  if (offer.sellerScore != null) {
    signals.push(clamp((offer.sellerScore - 6.5) / 3.5, 0, 1));
  }

  if (offer.followerCount != null) {
    signals.push(clamp(offer.followerCount / 60000, 0, 1));
  }

  if (offer.discountRate != null) {
    signals.push(clamp(offer.discountRate / 30, 0, 1));
  }

  if (params.referenceReviewCount != null) {
    signals.push(clamp(params.referenceReviewCount / 600, 0, 1));
  }

  if (params.referenceQuestionCount != null) {
    signals.push(clamp(params.referenceQuestionCount / 120, 0, 1));
  }

  if (params.referenceFavoriteCount != null) {
    signals.push(clamp(params.referenceFavoriteCount / 15000, 0, 1));
  }

  if (params.referenceRating != null) {
    signals.push(clamp((params.referenceRating - 3.2) / 1.6, 0, 1));
  }

  if (offer.hasFreeShipping) {
    signals.push(0.65);
  }
  if (offer.hasFastDelivery) {
    signals.push(0.7);
  }
  if (offer.isOfficial) {
    signals.push(0.68);
  }

  const signalCount = signals.length;
  const avgScore =
    signalCount > 0 ? signals.reduce((acc, item) => acc + item, 0) / signalCount : 0;
  const level = levelFromScore(avgScore, signalCount);
  const confidence = confidenceFromSignals(signalCount);
  const lowEvidence = signalCount < 4 || confidence === "low";
  const effectiveLevel: SalesLevel = lowEvidence ? "unclear" : level;
  const priceCompetitivenessBoost =
    relativeSignals.includes("below_median_price") || relativeSignals.includes("cheaper_than_user")
      ? 1.08
      : offer.price != null && params.medianPrice != null && offer.price > params.medianPrice * 1.05
        ? 0.9
        : 1;
  const baseRange = buildAdaptiveRange({
    level,
    demand: params.marketDemandSignal,
    confidence,
    engagementScore: avgScore,
    referenceCount: params.referenceCount,
    priceCompetitivenessBoost,
  });
  const range = lowEvidence
    ? buildUncertainRange(params.marketDemandSignal)
    : scaleRange(baseRange, params.marketDemandSignal, confidence);

  return {
    sellerName: offer.sellerName,
    estimatedSalesLevel: effectiveLevel,
    estimatedSalesRange: range,
    estimationConfidence: confidence,
    relativeAdvantageSignals: relativeSignals,
  };
}

function toMarketPosition(params: {
  userLevel: SalesLevel;
  strongestCompetitorLevel: SalesLevel;
  priceCompetitiveness: PriceCompetitivenessLevel;
  demand: MarketDemandSignal;
  trust: "low" | "medium" | "high" | "unclear";
  page: "low" | "medium" | "high" | "unclear";
}): MarketPositionLevel {
  const userScore = SALES_LEVEL_SCORE[params.userLevel];
  const competitorScore = SALES_LEVEL_SCORE[params.strongestCompetitorLevel];
  if (userScore === 0 || competitorScore === 0) return "unclear";
  const trustScore = params.trust === "high" ? 1 : params.trust === "medium" ? 0 : params.trust === "low" ? -1 : 0;
  const pageScore = params.page === "high" ? 1 : params.page === "medium" ? 0 : params.page === "low" ? -1 : 0;
  const demandScore = params.demand === "high" ? 1 : params.demand === "medium" ? 0 : params.demand === "low" ? -1 : 0;
  const supportScore = trustScore + pageScore + demandScore;

  if (
    userScore >= 4 &&
    params.priceCompetitiveness !== "disadvantage" &&
    userScore >= competitorScore &&
    supportScore >= 0
  ) {
    return "leading";
  }

  if (userScore >= 3 && userScore >= competitorScore - 1 && supportScore >= -1) {
    return "strong";
  }

  if (userScore <= 2 && competitorScore >= 4) {
    return "lagging";
  }

  if (supportScore <= -2) return "lagging";
  return "average";
}

function toGrowthOpportunity(params: {
  demand: MarketDemandSignal;
  userLevel: SalesLevel;
  strongestCompetitorLevel: SalesLevel;
  issuesCount: number;
  trust: "low" | "medium" | "high" | "unclear";
  page: "low" | "medium" | "high" | "unclear";
}): GrowthOpportunityLevel {
  const userScore = SALES_LEVEL_SCORE[params.userLevel];
  const competitorScore = SALES_LEVEL_SCORE[params.strongestCompetitorLevel];
  const trustGap = params.trust === "low" ? 1 : 0;
  const pageGap = params.page === "low" ? 1 : 0;
  const gapScore = trustGap + pageGap;

  if (params.demand === "low") return "low";
  if (params.demand === "unclear") return "unclear";
  if (
    params.demand === "high" &&
    userScore <= 2 &&
    (competitorScore >= 4 || gapScore >= 1)
  ) {
    return "very_high";
  }
  if (params.issuesCount >= 2 && userScore <= 3) return "high";
  if (gapScore >= 1 && userScore <= 3) return "high";
  return "medium";
}

function collectIssues(params: {
  raw: ExtractedProductFields;
  priceCompetitiveness: PriceCompetitivenessLevel;
  demand: MarketDemandSignal;
}) {
  const issues: MarketIssueType[] = [];
  if (params.priceCompetitiveness === "disadvantage") {
    issues.push("price");
  }
  if (toFinite(params.raw.seller_score) != null && (params.raw.seller_score as number) < 8) {
    issues.push("trust");
  }
  if (
    (params.raw.image_count ?? 0) < 4 ||
    (toFinite(params.raw.description_length) ?? 0) < 120
  ) {
    issues.push("listing");
  }
  if ((toFinite(params.raw.review_count) ?? 0) < 20) {
    issues.push("visibility");
  }
  if (params.demand === "low") {
    issues.push("demand");
  }

  if (issues.length === 0) return ["unclear"] as MarketIssueType[];
  return Array.from(new Set(issues));
}

function toOutcomeType(params: {
  userLevel: SalesLevel;
  demand: MarketDemandSignal;
  marketPosition: MarketPositionLevel;
  priceCompetitiveness: PriceCompetitivenessLevel;
  issues: MarketIssueType[];
}): AnalysisOutcomeType {
  if (params.demand === "low" && (params.userLevel === "very_low" || params.userLevel === "low")) {
    return "low_demand";
  }
  if (
    (params.userLevel === "good" || params.userLevel === "high") &&
    (params.marketPosition === "leading" || params.marketPosition === "strong")
  ) {
    return "working_good";
  }
  if (
    (params.userLevel === "very_low" || params.userLevel === "low") &&
    (params.demand === "medium" || params.demand === "high")
  ) {
    return "conversion_problem";
  }
  if (
    params.priceCompetitiveness === "disadvantage" ||
    params.issues.includes("trust") ||
    params.issues.includes("listing")
  ) {
    return "working_risky";
  }
  if (params.userLevel === "medium") {
    return "working_underperforming";
  }
  return "unclear";
}

export function buildMarketComparisonInsights(
  raw: ExtractedProductFields,
  trace?: DebugTraceHandle
): MarketComparisonInsights | null {
  const userPrice = toFinite(raw.normalized_price);
  const reviewCount = toFinite(raw.review_count);
  const favoriteCount = toFinite(raw.favorite_count);
  const questionCount = toFinite(raw.question_count);
  const ratingValue = toFinite(raw.rating_value);
  const sameProductOffers = (raw.other_seller_offers ?? [])
    .slice(0, 10)
    .filter(isOfferLike)
    .map((offer): OfferLike => ({
      sellerName: offer?.seller_name ?? null,
      sellerScore: toFinite(offer?.seller_score),
      followerCount: toFinite(offer?.follower_count),
      price: toFinite(offer?.price),
      discountRate: toFinite(offer?.discount_rate),
      hasFreeShipping: Boolean(offer?.has_free_shipping),
      hasFastDelivery: Boolean(offer?.has_fast_delivery),
      isOfficial: Boolean(offer?.is_official),
    }));

  const similarCandidates = toSimilarCandidates(raw);
  const comparisonMode = resolveComparisonMode(sameProductOffers, similarCandidates);
  const offers =
    comparisonMode === "same_product"
      ? selectReferenceOffers(sameProductOffers, userPrice, 10)
      : [];
  const usingSimilarFallback = comparisonMode === "similar_products_fallback";
  const insufficientData = comparisonMode === "insufficient_data";
  const referenceCount = usingSimilarFallback ? similarCandidates.length : offers.length;
  const directEvidenceCount = [reviewCount, favoriteCount, questionCount, ratingValue].filter(
    (item) => item != null
  ).length;
  const lowMetaCount = getLowConfidenceMetaCount(raw, [
    "review_count",
    "favorite_count",
    "question_count",
    "other_seller_offers",
    "similar_product_candidates",
  ]);

  const competitorPrices = (usingSimilarFallback ? similarCandidates : offers)
    .map((offer) => offer.price)
    .filter((price): price is number => price != null && price > 0);

  const competitorCount = competitorPrices.length;
  const lowestCompetitorPrice = competitorCount > 0 ? Math.min(...competitorPrices) : null;
  const highestCompetitorPrice = competitorCount > 0 ? Math.max(...competitorPrices) : null;
  const averageCompetitorPrice = average(competitorPrices);
  const medianCompetitorPrice = median(competitorPrices);

  let userPriceRank: number | null = null;
  if (userPrice != null && competitorCount > 0) {
    const cheaperCount = competitorPrices.filter((price) => price < userPrice).length;
    userPriceRank = cheaperCount + 1;
  }

  const userPriceDeltaFromMedian =
    userPrice != null && medianCompetitorPrice != null
      ? round2(userPrice - medianCompetitorPrice)
      : null;
  const userPricePosition = classifyUserPricePosition(userPrice, medianCompetitorPrice);
  const priceCompetitiveness = toPriceCompetitiveness(userPricePosition);
  const pricePosition: ComparisonPosition =
    userPricePosition === "affordable"
      ? "better"
      : userPricePosition === "average"
        ? "competitive"
        : userPricePosition === "expensive"
          ? "weaker"
          : "unknown";
  const marketDemandSignal = toDemandSignal(raw);
  const trustSignal = toTrustSignal(raw);
  const pageSignal = toPageSignal(raw);
  const offerQuality = getOfferSignalQuality(offers);

  const comparisonAssessment =
    comparisonMode === "same_product"
      ? buildSameProductConfidence({
          raw,
          referenceCount: offers.length,
          quality: {
            ...offerQuality,
            identifierCoverage: getIdentifierCoverage(raw),
          },
        })
      : comparisonMode === "similar_products_fallback"
        ? buildFallbackConfidence({
            raw,
            referenceCount: similarCandidates.length,
            similarCandidates,
          })
        : {
            confidence: "low" as ComparisonConfidence,
            reasons: [
              "Ayni urunde yeterli satici bulunamadi.",
              "Benzer urun fallback'i de guvenilir karar kurmak icin yeterli degil.",
            ],
          };

  if (comparisonMode === "similar_products_fallback") {
    traceEvent(trace ?? null, {
      stage: "confidence",
      code: "comparison_mode_downgraded",
      level: "warn",
      message: "Comparison mode same-product yerine similar_products_fallback olarak kullanildi.",
      meta: {
        sameProductOfferCount: sameProductOffers.length,
        similarCandidateCount: similarCandidates.length,
      },
    });
  } else if (comparisonMode === "insufficient_data") {
    traceEvent(trace ?? null, {
      stage: "confidence",
      code: "comparison_mode_insufficient",
      level: "warn",
      message: "Comparison mode insufficient_data olarak kaldi.",
      meta: {
        sameProductOfferCount: sameProductOffers.length,
        similarCandidateCount: similarCandidates.length,
      },
    });
  }

  const competitorSalesEstimates = offers.map((offer) =>
    buildSalesEstimate(offer, {
      medianPrice: medianCompetitorPrice,
      userPrice,
      marketDemandSignal,
      referenceReviewCount: reviewCount,
      referenceRating: ratingValue,
      referenceQuestionCount: questionCount,
      referenceFavoriteCount: favoriteCount,
      referenceCount,
    })
  );

  const strongestCompetitor = [...competitorSalesEstimates].sort((a, b) => {
    const byLevel =
      SALES_LEVEL_SCORE[b.estimatedSalesLevel] - SALES_LEVEL_SCORE[a.estimatedSalesLevel];
    if (byLevel !== 0) return byLevel;
    const aMax = a.estimatedSalesRange?.max ?? 0;
    const bMax = b.estimatedSalesRange?.max ?? 0;
    return bMax - aMax;
  })[0];

  const userEstimate = buildSalesEstimate(
    {
      sellerName: raw.seller_name ?? null,
      sellerScore: toFinite(raw.seller_score),
      followerCount: toFinite(raw.follower_count),
      price: userPrice,
      discountRate: toFinite(raw.discount_rate),
      hasFreeShipping: Boolean(raw.has_free_shipping),
      hasFastDelivery: (raw.delivery_type || "").toLocaleLowerCase("tr-TR").includes("fast"),
      isOfficial: Boolean(raw.official_seller),
    },
    {
      medianPrice: medianCompetitorPrice,
      userPrice,
      marketDemandSignal,
      referenceReviewCount: reviewCount,
      referenceRating: ratingValue,
      referenceQuestionCount: questionCount,
      referenceFavoriteCount: favoriteCount,
      referenceCount,
    }
  );

  const strongestCompetitorSalesLevel = strongestCompetitor?.estimatedSalesLevel ?? "unclear";
  const strongestCompetitorSalesRange = strongestCompetitor?.estimatedSalesRange ?? null;
  const userEstimatedSalesLevel = userEstimate.estimatedSalesLevel;
  const userEstimatedSalesRange = userEstimate.estimatedSalesRange;

  const similarCompetitorLevel = usingSimilarFallback
    ? levelFromScore(
        average(
          similarCandidates
            .map((candidate) => {
              const parts: number[] = [];
              if (candidate.price != null && medianCompetitorPrice != null && medianCompetitorPrice > 0) {
                parts.push(clamp((medianCompetitorPrice - candidate.price) / medianCompetitorPrice + 0.5, 0, 1));
              }
              if (candidate.ratingValue != null) {
                parts.push(clamp((candidate.ratingValue - 3.2) / 1.6, 0, 1));
              }
              if (candidate.reviewCount != null) {
                parts.push(clamp(candidate.reviewCount / 600, 0, 1));
              }
              if (candidate.questionCount != null) {
                parts.push(clamp(candidate.questionCount / 120, 0, 1));
              }
              if (candidate.sellerScore != null) {
                parts.push(clamp((candidate.sellerScore - 6.5) / 3.5, 0, 1));
              }
              if (parts.length === 0) return null;
              return parts.reduce((sum, value) => sum + value, 0) / parts.length;
            })
            .filter((value): value is number => value != null)
        ) ?? 0,
        similarCandidates.filter(
          (candidate) =>
            candidate.price != null ||
            candidate.ratingValue != null ||
            candidate.reviewCount != null ||
            candidate.questionCount != null
        ).length
      )
    : "unclear";

  const effectiveStrongestCompetitorSalesLevel = usingSimilarFallback
    ? similarCompetitorLevel
    : strongestCompetitorSalesLevel;

  const shippingPosition = computeShippingPosition(raw, offers, comparisonMode);
  const sellerReputationPosition = computeSellerReputationPosition(
    raw,
    offers,
    comparisonMode
  );
  const promotionPosition = computePromotionPosition(raw, offers, comparisonMode);
  const overallOfferCompetitiveness = toOfferCompetitiveness({
    pricePosition,
    shippingPosition,
    reputationPosition: sellerReputationPosition,
    promotionPosition,
  });

  const marketPosition = toMarketPosition({
    userLevel: userEstimatedSalesLevel,
    strongestCompetitorLevel: effectiveStrongestCompetitorSalesLevel,
    priceCompetitiveness,
    demand: marketDemandSignal,
    trust: trustSignal,
    page: pageSignal,
  });

  const issues = collectIssues({
    raw,
    priceCompetitiveness,
    demand: marketDemandSignal,
  });

  const growthOpportunityLevel = toGrowthOpportunity({
    demand: marketDemandSignal,
    userLevel: userEstimatedSalesLevel,
    strongestCompetitorLevel: effectiveStrongestCompetitorSalesLevel,
    issuesCount: issues.length,
    trust: trustSignal,
    page: pageSignal,
  });

  const outcomeType = toOutcomeType({
    userLevel: userEstimatedSalesLevel,
    demand: marketDemandSignal,
    marketPosition,
    priceCompetitiveness,
    issues,
  });

  const primaryIssue: MarketIssueType = issues[0] ?? "unclear";
  const secondaryIssues = issues.slice(1);
  const mainIssues = issues;

  const competitorSummary: CompetitorPriceSummary = {
    competitorCount: usingSimilarFallback ? similarCandidates.length : competitorCount,
    lowestCompetitorPrice,
    highestCompetitorPrice,
    averageCompetitorPrice,
    medianCompetitorPrice,
    userPriceRank,
    userPriceDeltaFromMedian,
    userPricePosition,
    priceCompetitiveness,
  };

  const evidenceCount = [favoriteCount, reviewCount, questionCount, referenceCount].filter(
    (item) => item != null
  ).length;

  const demandVerdict = insufficientData
    ? {
        result: "Karsilastirma verisi sinirli oldugu icin sonuc temkinli okunmali.",
        confidence: "low" as EstimationConfidence,
        referenceSellerCount: 0,
      }
    : buildDemandVerdict({
        marketDemandSignal,
        userLevel: userEstimatedSalesLevel,
        strongestCompetitorLevel: effectiveStrongestCompetitorSalesLevel,
        priceCompetitiveness,
        referenceCount,
        sourceType: usingSimilarFallback ? "similar_product" : "same_product",
        evidenceCount,
      });

  if (
    demandVerdict.confidence === "low" &&
    comparisonMode !== "insufficient_data"
  ) {
    traceEvent(trace ?? null, {
      stage: "confidence",
      code: "demand_verdict_confidence_downgraded",
      level: "warn",
      message: "Demand verdict confidence dusuruldu.",
      meta: {
        comparisonMode,
        comparisonConfidence: comparisonAssessment.confidence,
        referenceCount: usingSimilarFallback ? similarCandidates.length : offers.length,
        evidenceCount,
        reason: demandVerdict.result,
      },
    });
  }

  const dominantGapReason = getDominantGapReason({
    pricePosition,
    shippingPosition,
    reputationPosition: sellerReputationPosition,
    promotionPosition,
    mode: comparisonMode,
  });
  const strongestAdvantageReason = getStrongestAdvantageReason({
    pricePosition,
    shippingPosition,
    reputationPosition: sellerReputationPosition,
    promotionPosition,
  });
  const comparisonReasons = [
    ...comparisonAssessment.reasons,
    ...(dominantGapReason ? [dominantGapReason] : []),
    ...(strongestAdvantageReason ? [strongestAdvantageReason] : []),
  ];

  const demandStatus = resolveDemandStatus({
    raw,
    comparisonMode,
    sameProductReferenceCount: offers.length,
    similarCandidates,
  });
  const captureStatus = resolveCaptureStatus({
    comparisonMode,
    demandStatus,
    pricePosition,
    shippingPosition,
    reputationPosition: sellerReputationPosition,
    promotionPosition,
    overallOfferCompetitiveness,
    trustSignal,
    pageSignal,
  });
  const diagnosisConfidence = buildDiagnosisConfidence({
    comparisonMode,
    comparisonConfidence: comparisonAssessment.confidence,
    demandStatus,
    captureStatus,
    pricePosition,
    shippingPosition,
    reputationPosition: sellerReputationPosition,
    promotionPosition,
    directEvidenceCount,
    lowMetaCount,
  });
  const diagnosisReasons = buildDiagnosisReasons({
    demandStatus,
    captureStatus,
    comparisonMode,
    pricePosition,
    shippingPosition,
    reputationPosition: sellerReputationPosition,
    promotionPosition,
    trustSignal,
    pageSignal,
    marketDemandSignal,
  });
  const evidenceSummary = buildEvidenceSummary({
    raw,
    comparisonMode,
    sameProductReferenceCount: offers.length,
    similarCandidates,
    competitorSummary,
    pricePosition,
    trustSignal,
    pageSignal,
  });
  const uncertaintyNotes = buildUncertaintyNotes({
    comparisonMode,
    comparisonConfidence: comparisonAssessment.confidence,
    demandStatus,
    captureStatus,
    sameProductReferenceCount: offers.length,
    similarCandidates,
    lowMetaCount,
  });

  traceEvent(trace ?? null, {
    stage: "analysis",
    code: "market_comparison_summary",
    message: "Market comparison analizi tamamlandi.",
    meta: {
      comparisonMode,
      comparisonConfidence: comparisonAssessment.confidence,
      demandStatus,
      captureStatus,
      diagnosisConfidence,
      competitorCount: competitorSummary.competitorCount,
      uncertaintyNotes,
    },
  });

  return {
    comparisonMode,
    comparisonConfidence: comparisonAssessment.confidence,
    comparisonReasons,
    demandStatus,
    captureStatus,
    diagnosisConfidence,
    diagnosisReasons,
    evidenceSummary,
    uncertaintyNotes,
    pricePosition,
    shippingPosition,
    sellerReputationPosition,
    promotionPosition,
    overallOfferCompetitiveness,
    dominantGapReason,
    strongestAdvantageReason,
    competitorSummary,
    competitorSalesEstimates,
    strongestCompetitorSalesLevel: effectiveStrongestCompetitorSalesLevel,
    strongestCompetitorSalesRange,
    userEstimatedSalesLevel,
    userEstimatedSalesRange,
    marketDemandSignal,
    marketPosition,
    growthOpportunityLevel,
    outcomeType,
    primaryIssue,
    secondaryIssues,
    mainIssues,
    demandVerdict,
  };
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getCompetitorPressureLabel(
  summary: OtherSellersSummaryLike | null | undefined
): string | null {
  if (!summary) return null;
  const cheaper = toNumber(summary.cheaper_count) ?? 0;
  const total = toNumber(summary.count) ?? 0;
  const fast = toNumber(summary.fast_delivery_count) ?? 0;
  const official = toNumber(summary.official_count) ?? 0;

  if (total <= 0) return null;
  if (cheaper >= 4) return "Yuksek fiyat baskisi";
  if (cheaper >= 2) return "Orta fiyat baskisi";
  if (fast >= 3) return "Hizli teslimat baskisi";
  if (official >= 3) return "Resmi satici yogunlugu";
  return "Dengeli rekabet";
}

export function getCompetitorSummaryLabel(
  summary: OtherSellersSummaryLike | null | undefined
): string {
  if (!summary) return "Rakip verisi sinirli";
  const count = toNumber(summary.count) ?? 0;
  const cheaper = toNumber(summary.cheaper_count) ?? 0;

  if (count <= 0) return "Rakip gorunmuyor";
  if (cheaper > 0) return `${count} rakip, ${cheaper} daha ucuz`;
  return `${count} rakip, fiyat avantaji korunuyor`;
}

export function getCompetitorNarrative(params: {
  summary: OtherSellersSummaryLike | null;
  sellerScore: number | null;
  hasFreeShipping: boolean;
  shippingDays: number | null;
  deliveryType: string | null;
}): string {
  const { summary, sellerScore, hasFreeShipping, shippingDays, deliveryType } = params;
  if (!summary) {
    return "Rakip verisi sinirli oldugu icin rekabet yorumu temkinli tutuldu.";
  }

  const count = toNumber(summary.count) ?? 0;
  const cheaper = toNumber(summary.cheaper_count) ?? 0;
  const avgScore = toNumber(summary.avg_score);
  const fastCount = toNumber(summary.fast_delivery_count) ?? 0;

  const chunks: string[] = [];
  if (count > 0) {
    chunks.push(`${count} rakip satici gorunuyor`);
  }

  if (cheaper > 0) {
    chunks.push(`${cheaper} rakip daha dusuk fiyatta`);
  } else if (count > 0) {
    chunks.push("fiyat seviyesi rekabetci gorunuyor");
  }

  if (avgScore != null) {
    chunks.push(`rakip ortalama satici puani ${avgScore.toFixed(1)}`);
  }

  if (typeof sellerScore === "number") {
    chunks.push(`senin satici puanin ${sellerScore.toFixed(1)}`);
  }

  if (hasFreeShipping) {
    chunks.push("ucretsiz kargo avantaji var");
  }

  if (typeof shippingDays === "number") {
    chunks.push(
      shippingDays <= 3
        ? "teslimat hizli"
        : shippingDays >= 6
          ? "teslimat suresi uzun"
          : "teslimat suresi orta seviyede"
    );
  } else if (deliveryType) {
    chunks.push(`teslimat tipi ${deliveryType}`);
  }

  if (fastCount >= 3) {
    chunks.push("rakiplerde hizli teslimat yaygin");
  }

  if (chunks.length === 0) {
    return "Rekabet sinyalleri sinirli, net bir rekabet konumu cikmiyor.";
  }
  return `${chunks.join(", ")}.`;
}
