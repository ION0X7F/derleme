import type {
  AnalysisVisualBlock,
  AnalysisVisualFunnelStage,
  AnalysisVisualsPack,
  ConsolidatedAnalysisInput,
  ExtractedProductFields,
  GrowthOpportunityLevel,
  MarketIssueType,
  MarketPositionLevel,
  SalesLevel,
} from "@/types/analysis";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function salesLevelScore(level: SalesLevel | null | undefined): number | null {
  switch (level) {
    case "very_low":
      return 0.1;
    case "low":
      return 0.28;
    case "medium":
      return 0.5;
    case "good":
      return 0.74;
    case "high":
      return 0.92;
    default:
      return null;
  }
}

function salesLevelLabel(level: SalesLevel | null | undefined) {
  switch (level) {
    case "very_low":
      return "Çok düşük";
    case "low":
      return "Düşük";
    case "medium":
      return "Orta";
    case "good":
      return "İyi";
    case "high":
      return "Yüksek";
    default:
      return "Net değil";
  }
}

function growthScore(level: GrowthOpportunityLevel | null | undefined): number | null {
  switch (level) {
    case "low":
      return 0.2;
    case "medium":
      return 0.45;
    case "high":
      return 0.72;
    case "very_high":
      return 0.9;
    default:
      return null;
  }
}

function growthLabel(level: GrowthOpportunityLevel | null | undefined) {
  switch (level) {
    case "low":
      return "Sınırlı fırsat";
    case "medium":
      return "Orta fırsat";
    case "high":
      return "Yüksek fırsat";
    case "very_high":
      return "Çok yüksek fırsat";
    default:
      return "Net değil";
  }
}

function marketPositionLabel(level: MarketPositionLevel | null | undefined) {
  switch (level) {
    case "leading":
      return "Öndesin";
    case "strong":
      return "Güçlüsün";
    case "average":
      return "Ortadasın";
    case "lagging":
      return "Geridesin";
    default:
      return "Net değil";
  }
}

function demandScore(extracted: ExtractedProductFields): number | null {
  const parts: number[] = [];
  const reviewCount = toNumber(extracted.review_count);
  const favoriteCount = toNumber(extracted.favorite_count);
  const questionCount = toNumber(extracted.question_count);
  const ratingValue = toNumber(extracted.rating_value);

  if (reviewCount != null) parts.push(clamp01(reviewCount / 500));
  if (favoriteCount != null) parts.push(clamp01(favoriteCount / 2000));
  if (questionCount != null) parts.push(clamp01(questionCount / 120));
  if (ratingValue != null) parts.push(clamp01((ratingValue - 3.2) / 1.6));

  if (parts.length < 2) return null;
  return clamp01(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function demandLevelFromScore(score: number | null): "low" | "medium" | "high" | "unclear" {
  if (score == null) return "unclear";
  if (score >= 0.66) return "high";
  if (score >= 0.33) return "medium";
  return "low";
}

function demandLabel(level: "low" | "medium" | "high" | "unclear") {
  switch (level) {
    case "high":
      return "İlgi yüksek";
    case "medium":
      return "İlgi orta";
    case "low":
      return "İlgi düşük";
    default:
      return "Net değil";
  }
}

function simpleLevel(value: number | null): "low" | "medium" | "high" | "unclear" {
  if (value == null) return "unclear";
  if (value >= 0.7) return "high";
  if (value >= 0.4) return "medium";
  return "low";
}

function issueLabel(issue: MarketIssueType): string {
  switch (issue) {
    case "price":
      return "Fiyat";
    case "trust":
      return "Güven";
    case "listing":
      return "Sayfa içeriği";
    case "visibility":
      return "Görünürlük";
    case "demand":
      return "Talep";
    case "mixed":
      return "Karışık";
    default:
      return "Net değil";
  }
}

function toStatusLabel(availability: "ready" | "limited" | "hidden", fallback?: string) {
  if (availability === "ready") return "Hazir";
  if (availability === "hidden") return "Net degil";
  return fallback || "Net degil";
}

function isVisible(availability: "ready" | "limited" | "hidden") {
  return availability !== "hidden";
}

export function buildAnalysisVisuals(
  consolidatedInput: ConsolidatedAnalysisInput
): AnalysisVisualsPack {
  const market = consolidatedInput.marketComparison;
  const extracted = consolidatedInput._raw;

  const priceAvailability =
    market?.competitorSummary.medianCompetitorPrice != null &&
    market?.competitorSummary.lowestCompetitorPrice != null &&
    market?.competitorSummary.highestCompetitorPrice != null &&
    consolidatedInput.price.value != null
      ? "ready"
      : "limited";

  const priceBlock: AnalysisVisualBlock = {
    key: "price_position",
    title: "Fiyatın Nerede?",
    chartType: "range_distribution",
    availability: priceAvailability,
    visible: isVisible(priceAvailability),
    shortLabel: "Fiyat konumu",
    statusLabel: toStatusLabel(priceAvailability, "Kismi veri"),
    description: "Fiyatının rakip dağılımında nerede durduğunu tek bakışta gösterir.",
    data: {
      min: market?.competitorSummary.lowestCompetitorPrice ?? null,
      median: market?.competitorSummary.medianCompetitorPrice ?? null,
      max: market?.competitorSummary.highestCompetitorPrice ?? null,
      userValue: consolidatedInput.price.value,
      userLabel:
        market?.competitorSummary.userPricePosition === "affordable"
          ? "Ortalamanın altında"
          : market?.competitorSummary.userPricePosition === "average"
            ? "Ortalamaya yakın"
            : market?.competitorSummary.userPricePosition === "expensive"
              ? "Ortalamanın üstünde"
              : "Net değil",
    },
    reasonIfLimited:
      market == null ? "Rakip fiyat dağılımı eksik olduğu için konum net değil." : undefined,
  };

  const userSalesLevel = market?.userEstimatedSalesLevel ?? "unclear";
  const salesScore = salesLevelScore(userSalesLevel);
  const salesAvailability = salesScore != null ? "ready" : "limited";
  const salesBlock: AnalysisVisualBlock = {
    key: "sales_status",
    title: "Satış Durumu",
    chartType: "segmented_meter",
    availability: salesAvailability,
    visible: isVisible(salesAvailability),
    shortLabel: "Satis seviyesi",
    statusLabel: toStatusLabel(salesAvailability, "Net degil"),
    description: "Ürünün mevcut satış seviyesini sade bir seviye göstergesiyle özetler.",
    data: {
      level: userSalesLevel,
      normalizedScore: salesScore,
      label: salesLevelLabel(userSalesLevel),
    },
    reasonIfLimited: salesScore == null ? "Satış tahmini için sinyal yetersiz." : undefined,
  };

  const growthLevel = market?.growthOpportunityLevel ?? "unclear";
  const growthAvailability = growthScore(growthLevel) != null ? "ready" : "limited";
  const growthBlock: AnalysisVisualBlock = {
    key: "growth_opportunity",
    title: "Büyüme Fırsatı",
    chartType: "gauge",
    availability: growthAvailability,
    visible: isVisible(growthAvailability),
    shortLabel: "Buyume alani",
    statusLabel: toStatusLabel(growthAvailability, "Net degil"),
    description: "Yukarı çıkma alanının büyüklüğünü gösterir.",
    data: {
      level: growthLevel,
      normalizedScore: growthScore(growthLevel),
      label: growthLabel(growthLevel),
    },
    reasonIfLimited:
      growthScore(growthLevel) == null ? "Fırsat hesabı için pazar sinyali düşük." : undefined,
  };

  const position = market?.marketPosition ?? "unclear";
  const positionAvailability = position === "unclear" ? "limited" : "ready";
  const marketPositionBlock: AnalysisVisualBlock = {
    key: "market_position",
    title: "Diğer Mağazalara Göre Durumun",
    chartType: "position_ladder",
    availability: positionAvailability,
    visible: isVisible(positionAvailability),
    shortLabel: "Pazar konumu",
    statusLabel: toStatusLabel(positionAvailability, "Net degil"),
    description: "Pazardaki göreli konumunu net bir bant üzerinde gösterir.",
    data: {
      position,
      label: marketPositionLabel(position),
      rankHint:
        market?.competitorSummary.competitorCount != null
          ? `${market.competitorSummary.competitorCount} rakip mağaza ile karşılaştırma`
          : null,
    },
    reasonIfLimited: position === "unclear" ? "Pazar konumu için veri sınırlı." : undefined,
  };

  const interestScore = demandScore(extracted);
  const interestLevel = demandLevelFromScore(interestScore);
  const supportSignals: string[] = [];
  if (toNumber(extracted.favorite_count) != null) {
    supportSignals.push(`Favori: ${extracted.favorite_count}`);
  }
  if (toNumber(extracted.review_count) != null) {
    supportSignals.push(`Yorum: ${extracted.review_count}`);
  }
  if (toNumber(extracted.question_count) != null) {
    supportSignals.push(`Soru: ${extracted.question_count}`);
  }
  if (toNumber(extracted.rating_value) != null) {
    supportSignals.push(`Puan: ${extracted.rating_value}`);
  }

  const interestAvailability = interestScore != null ? "ready" : "limited";
  const interestBlock: AnalysisVisualBlock = {
    key: "market_interest",
    title: "Ürüne İlgi",
    chartType: "score_bar",
    availability: interestAvailability,
    visible: isVisible(interestAvailability),
    shortLabel: "Ilgi seviyesi",
    statusLabel: toStatusLabel(interestAvailability, "Net degil"),
    description: "Ürüne olan ilginin güçlü mü zayıf mı olduğunu gösterir.",
    data: {
      level: interestLevel,
      normalizedScore: interestScore,
      supportingSignals: supportSignals,
    },
    reasonIfLimited: interestScore == null ? "İlgi sinyalleri az olduğu için net değil." : undefined,
  };

  const stageView = toNumber((extracted as Record<string, unknown>).view_count) ?? null;
  const stageInterest =
    toNumber(extracted.favorite_count) ??
    (toNumber(extracted.review_count) != null ? Math.round((extracted.review_count ?? 0) * 0.35) : null);
  const stageCart = extracted.has_add_to_cart
    ? (stageInterest != null ? Math.max(1, Math.round(stageInterest * 0.45)) : 1)
    : null;
  const stageSalesClose =
    market?.userEstimatedSalesRange != null
      ? Math.round((market.userEstimatedSalesRange.min + market.userEstimatedSalesRange.max) / 2)
      : null;

  const rawStages: AnalysisVisualFunnelStage[] = [
    { label: "Görme", value: stageView, normalizedValue: null },
    { label: "İlgilenme", value: stageInterest, normalizedValue: null },
    { label: "Sepete yaklaşma", value: stageCart, normalizedValue: null },
    { label: "Satışa yakınlık", value: stageSalesClose, normalizedValue: null },
  ];
  const maxStageValue = Math.max(
    ...rawStages.map((stage) => stage.value ?? 0),
    0
  );
  const funnelStages = rawStages.map((stage) => ({
    ...stage,
    normalizedValue:
      stage.value != null && maxStageValue > 0 ? clamp01(stage.value / maxStageValue) : null,
  }));

  const funnelReadyCount = funnelStages.filter((item) => item.value != null).length;
  const funnelAvailability =
    funnelReadyCount >= 3 ? "ready" : funnelReadyCount >= 2 ? "limited" : "hidden";
  const funnelBlock: AnalysisVisualBlock = {
    key: "interest_to_sales_funnel",
    title: "İlgi Satışa Dönüyor mu?",
    chartType: "funnel",
    availability: funnelAvailability,
    visible: isVisible(funnelAvailability),
    shortLabel: "Ilgi -> satis",
    statusLabel: toStatusLabel(funnelAvailability, "Kismi veri"),
    description: "İlginin satışa dönüşüm yolunda nerede zayıfladığını gösterir.",
    data: { stages: funnelStages },
    reasonIfLimited:
      funnelReadyCount < 3 ? "Dönüşüm hunisi için bazı adımların verisi eksik." : undefined,
  };

  const ratingNorm =
    toNumber(extracted.rating_value) != null ? clamp01(((extracted.rating_value ?? 0) - 3) / 2) : null;
  const reviewsNorm =
    toNumber(extracted.review_count) != null ? clamp01((extracted.review_count ?? 0) / 500) : null;
  const questionsNorm =
    toNumber(extracted.question_count) != null ? clamp01((extracted.question_count ?? 0) / 120) : null;
  const sellerNorm =
    toNumber(extracted.seller_score) != null ? clamp01(((extracted.seller_score ?? 0) - 6.5) / 3.5) : null;

  const trustSubs = [
    {
      key: "rating" as const,
      label: "Ürün puanı",
      value: toNumber(extracted.rating_value),
      normalizedScore: ratingNorm,
    },
    {
      key: "reviews" as const,
      label: "Yorum hacmi",
      value: toNumber(extracted.review_count),
      normalizedScore: reviewsNorm,
    },
    {
      key: "questions" as const,
      label: "Soru hareketi",
      value: toNumber(extracted.question_count),
      normalizedScore: questionsNorm,
    },
    {
      key: "seller" as const,
      label: "Mağaza puanı",
      value: toNumber(extracted.seller_score),
      normalizedScore: sellerNorm,
    },
  ];
  const trustValues = trustSubs
    .map((item) => item.normalizedScore)
    .filter((item): item is number => item != null);
  const trustOverall =
    trustValues.length >= 2
      ? clamp01(trustValues.reduce((sum, value) => sum + value, 0) / trustValues.length)
      : null;

  const trustAvailability = trustOverall != null ? "ready" : "limited";
  const trustBlock: AnalysisVisualBlock = {
    key: "customer_trust",
    title: "Müşteri Güveni",
    chartType: "stacked_meter",
    availability: trustAvailability,
    visible: isVisible(trustAvailability),
    shortLabel: "Guven seviyesi",
    statusLabel: toStatusLabel(trustAvailability, "Net degil"),
    description: "Güveni etkileyen ana bileşenleri birlikte gösterir.",
    data: {
      overallLevel: simpleLevel(trustOverall),
      subScores: trustSubs,
    },
    reasonIfLimited: trustOverall == null ? "Güven bileşenlerinde veri yetersiz." : undefined,
  };

  const titleNorm =
    typeof extracted.title === "string" && extracted.title.trim().length > 0
      ? clamp01(extracted.title.trim().length / 80)
      : null;
  const descriptionNorm =
    toNumber(extracted.description_length) != null
      ? clamp01((extracted.description_length ?? 0) / 500)
      : null;
  const imageNorm = clamp01((extracted.image_count ?? 0) / 8);
  const pageParts = [
    {
      key: "title" as const,
      label: "Başlık",
      normalizedScore: titleNorm,
      level: simpleLevel(titleNorm),
    },
    {
      key: "description" as const,
      label: "Açıklama",
      normalizedScore: descriptionNorm,
      level: simpleLevel(descriptionNorm),
    },
    {
      key: "images" as const,
      label: "Görseller",
      normalizedScore: imageNorm,
      level: simpleLevel(imageNorm),
    },
  ];
  const pageValues = pageParts
    .map((item) => item.normalizedScore)
    .filter((item): item is number => item != null);
  const pageOverall =
    pageValues.length >= 2
      ? clamp01(pageValues.reduce((sum, value) => sum + value, 0) / pageValues.length)
      : null;

  const pageAvailability = pageOverall != null ? "ready" : "limited";
  const pageBlock: AnalysisVisualBlock = {
    key: "page_strength",
    title: "Sayfa Gücü",
    chartType: "quality_indicator",
    availability: pageAvailability,
    visible: isVisible(pageAvailability),
    shortLabel: "Sayfa kalitesi",
    statusLabel: toStatusLabel(pageAvailability, "Net degil"),
    description: "Başlık, açıklama ve görsellerin birlikte ne kadar güçlü olduğunu gösterir.",
    data: {
      overallLevel: simpleLevel(pageOverall),
      parts: pageParts,
    },
    reasonIfLimited: pageOverall == null ? "Sayfa kalite verisi sınırlı." : undefined,
  };

  const issueSeed: Record<MarketIssueType, number> = {
    price: 0,
    trust: 0,
    listing: 0,
    visibility: 0,
    demand: 0,
    mixed: 0,
    unclear: 0,
  };
  const mainIssues = market?.mainIssues ?? [];
  mainIssues.forEach((issue, index) => {
    issueSeed[issue] += Math.max(0.2, 1 - index * 0.2);
  });
  if (market?.competitorSummary.priceCompetitiveness === "disadvantage") issueSeed.price += 0.8;
  if ((toNumber(extracted.seller_score) ?? 10) < 8) issueSeed.trust += 0.6;
  if ((extracted.image_count ?? 0) < 4 || (toNumber(extracted.description_length) ?? 0) < 120) {
    issueSeed.listing += 0.6;
  }
  if ((toNumber(extracted.review_count) ?? 0) < 20) issueSeed.visibility += 0.55;
  if (demandLevelFromScore(interestScore) === "low") issueSeed.demand += 0.65;

  const issueCandidates = (Object.keys(issueSeed) as MarketIssueType[])
    .filter((key) => key !== "unclear")
    .map((key) => ({ key, value: issueSeed[key] }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const maxIssue = Math.max(...issueCandidates.map((item) => item.value), 1);
  const issueBars = issueCandidates.map((item) => ({
    key: item.key,
    label: issueLabel(item.key),
    value: Number(item.value.toFixed(2)),
    normalizedValue: clamp01(item.value / maxIssue),
  }));

  const issueAvailability = issueBars.length > 0 ? "ready" : "limited";
  const issueBlock: AnalysisVisualBlock = {
    key: "main_challenges",
    title: "Seni En Çok Ne Zorluyor?",
    chartType: "ranked_bars",
    availability: issueAvailability,
    visible: isVisible(issueAvailability),
    shortLabel: "Ana engeller",
    statusLabel: toStatusLabel(issueAvailability, "Net degil"),
    description: "En baskın sorun alanlarını öncelik sırasıyla gösterir.",
    data: { issueBars },
    reasonIfLimited: issueBars.length === 0 ? "Sorun önceliği için sinyal yok." : undefined,
  };

  const competitorEstimates = market?.competitorSalesEstimates ?? [];
  const bucketSeed = { strong: 0, medium: 0, weak: 0, unclear: 0 };
  competitorEstimates.forEach((estimate) => {
    if (estimate.estimatedSalesLevel === "high" || estimate.estimatedSalesLevel === "good") {
      bucketSeed.strong += 1;
      return;
    }
    if (estimate.estimatedSalesLevel === "medium") {
      bucketSeed.medium += 1;
      return;
    }
    if (estimate.estimatedSalesLevel === "low" || estimate.estimatedSalesLevel === "very_low") {
      bucketSeed.weak += 1;
      return;
    }
    bucketSeed.unclear += 1;
  });
  const maxBucket = Math.max(bucketSeed.strong, bucketSeed.medium, bucketSeed.weak, bucketSeed.unclear, 1);

  const competitorAvailability = competitorEstimates.length > 0 ? "ready" : "limited";
  const competitorBlock: AnalysisVisualBlock = {
    key: "competitor_strength",
    title: "Rakipler Ne Kadar Güçlü?",
    chartType: "grouped_buckets",
    availability: competitorAvailability,
    visible: isVisible(competitorAvailability),
    shortLabel: "Rakip gucu",
    statusLabel: toStatusLabel(competitorAvailability, "Net degil"),
    description: "Rakiplerin satış gücünü güçlü-orta-zayıf dağılımında özetler.",
    data: {
      buckets: [
        {
          key: "strong",
          label: "Güçlü rakip",
          count: bucketSeed.strong,
          normalizedValue: clamp01(bucketSeed.strong / maxBucket),
        },
        {
          key: "medium",
          label: "Orta rakip",
          count: bucketSeed.medium,
          normalizedValue: clamp01(bucketSeed.medium / maxBucket),
        },
        {
          key: "weak",
          label: "Zayıf rakip",
          count: bucketSeed.weak,
          normalizedValue: clamp01(bucketSeed.weak / maxBucket),
        },
        {
          key: "unclear",
          label: "Net olmayan",
          count: bucketSeed.unclear,
          normalizedValue: clamp01(bucketSeed.unclear / maxBucket),
        },
      ],
    },
    reasonIfLimited: competitorEstimates.length === 0 ? "Rakip satış tahmini oluşmadı." : undefined,
  };

  return {
    version: 1,
    blocks: [
      priceBlock,
      salesBlock,
      growthBlock,
      marketPositionBlock,
      interestBlock,
      funnelBlock,
      trustBlock,
      pageBlock,
      issueBlock,
      competitorBlock,
    ],
  };
}
