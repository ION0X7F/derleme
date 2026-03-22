import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAnalysisSummary } from "@/lib/analysis-summary";
import type {
  CategoryBenchmarkSnapshot,
  ExtractedProductFields,
  LearningContext,
  LearningStatus,
  LearnedRuleSnapshot,
  MissingDataReport,
} from "@/types/analysis";

type LearningMemoryRecord = Awaited<
  ReturnType<typeof prisma.learningMemory.findMany>
>[number];

type RuleCandidate = {
  ruleKey: string;
  title: string;
  insight: string;
  confidence: number;
  supportCount: number;
  metadata: Prisma.InputJsonValue;
};

function round(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function cleanText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function average(values: Array<number | null | undefined>, digits = 2) {
  const normalized = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (normalized.length === 0) return null;
  return round(
    normalized.reduce((sum, value) => sum + value, 0) / normalized.length,
    digits
  );
}

function ratioFromBooleans(values: boolean[], digits = 2) {
  if (values.length === 0) return null;
  const positive = values.filter(Boolean).length;
  return round(positive / values.length, digits);
}

function toSafeCategory(value: string | null | undefined) {
  return cleanText(value) || "General";
}

function humanizeCategoryLabel(value: string | null | undefined) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "genel";
  }

  const normalized = cleaned.replace(/^__TEST[_-]*/i, "").replace(/_/g, " ").trim();

  if (!normalized) {
    return "genel";
  }

  if (normalized.toLocaleLowerCase("tr-TR") === "general") {
    return "genel";
  }

  return normalized;
}

function toSafePlatform(value: string | null | undefined) {
  return cleanText(value) || "trendyol";
}

function getPriceBand(price: number | null | undefined) {
  if (typeof price !== "number" || !Number.isFinite(price)) return "unknown";
  if (price < 500) return "entry";
  if (price < 1500) return "mid";
  if (price < 4000) return "premium";
  return "high";
}

function inferOutcomeLabel(params: {
  extracted: ExtractedProductFields;
  overallScore: number | null | undefined;
}) {
  const { extracted, overallScore } = params;

  if (extracted.is_best_seller) return "leader";
  if (
    (typeof overallScore === "number" && overallScore >= 80) ||
    ((extracted.review_count ?? 0) >= 1000 && (extracted.rating_value ?? 0) >= 4.4) ||
    ((extracted.favorite_count ?? 0) >= 100000 && (extracted.seller_score ?? 0) >= 8.5)
  ) {
    return "strong";
  }
  if (typeof overallScore === "number" && overallScore >= 60) {
    return "average";
  }
  return "weak";
}

function buildSignalSnapshot(extracted: ExtractedProductFields) {
  return {
    normalized_price: extracted.normalized_price ?? null,
    shipping_days: extracted.shipping_days ?? null,
    image_count: extracted.image_count ?? null,
    description_length: extracted.description_length ?? null,
    rating_value: extracted.rating_value ?? null,
    review_count: extracted.review_count ?? null,
    seller_score: extracted.seller_score ?? null,
    favorite_count: extracted.favorite_count ?? null,
    other_sellers_count: extracted.other_sellers_count ?? null,
    has_video: extracted.has_video,
    has_free_shipping: extracted.has_free_shipping,
    official_seller: extracted.official_seller,
    has_campaign: extracted.has_campaign,
    is_best_seller: extracted.is_best_seller,
    best_seller_rank: extracted.best_seller_rank ?? null,
  };
}

function mapBenchmarkRecord(
  record: Awaited<ReturnType<typeof prisma.categoryBenchmark.findUnique>>
): CategoryBenchmarkSnapshot | null {
  if (!record) return null;

  return {
    platform: record.platform,
    category: record.category,
    sampleSize: record.sampleSize,
    successfulSampleSize: record.successfulSampleSize,
    avgShippingDays: record.avgShippingDays,
    avgImageCount: record.avgImageCount,
    avgDescriptionLength: record.avgDescriptionLength,
    avgRatingValue: record.avgRatingValue,
    avgSellerScore: record.avgSellerScore,
    avgPrice: record.avgPrice,
    avgReviewCount: record.avgReviewCount,
    avgFavoriteCount: record.avgFavoriteCount,
    avgOtherSellersCount: record.avgOtherSellersCount,
    fastDeliveryRate: record.fastDeliveryRate,
    freeShippingRate: record.freeShippingRate,
    hasVideoRate: record.hasVideoRate,
    officialSellerRate: record.officialSellerRate,
    campaignRate: record.campaignRate,
    bestSellerRate: record.bestSellerRate,
    successfulAvgShippingDays: record.successfulAvgShippingDays,
    successfulAvgImageCount: record.successfulAvgImageCount,
    successfulAvgRatingValue: record.successfulAvgRatingValue,
    successfulAvgSellerScore: record.successfulAvgSellerScore,
    successfulAvgPrice: record.successfulAvgPrice,
    successfulFastDeliveryRate: record.successfulFastDeliveryRate,
    successfulVideoRate: record.successfulVideoRate,
    successfulOfficialSellerRate: record.successfulOfficialSellerRate,
  };
}

function buildBenchmarkPayloadFromMemories(memories: LearningMemoryRecord[]) {
  const successful = memories.filter((item) =>
    item.outcomeLabel === "leader" || item.outcomeLabel === "strong"
  );

  return {
    sampleSize: memories.length,
    successfulSampleSize: successful.length,
    avgShippingDays: average(memories.map((item) => item.shippingDays), 1),
    avgImageCount: average(memories.map((item) => item.imageCount), 1),
    avgDescriptionLength: average(memories.map((item) => item.descriptionLength), 1),
    avgRatingValue: average(memories.map((item) => item.ratingValue), 2),
    avgSellerScore: average(memories.map((item) => item.sellerScore), 2),
    avgPrice: average(memories.map((item) => item.normalizedPrice), 2),
    avgReviewCount: average(memories.map((item) => item.reviewCount), 1),
    avgFavoriteCount: average(memories.map((item) => item.favoriteCount), 1),
    avgOtherSellersCount: average(memories.map((item) => item.otherSellersCount), 1),
    fastDeliveryRate: ratioFromBooleans(
      memories.map((item) => typeof item.shippingDays === "number" && item.shippingDays <= 3)
    ),
    freeShippingRate: ratioFromBooleans(memories.map((item) => item.hasFreeShipping)),
    hasVideoRate: ratioFromBooleans(memories.map((item) => item.hasVideo)),
    officialSellerRate: ratioFromBooleans(memories.map((item) => item.officialSeller)),
    campaignRate: ratioFromBooleans(memories.map((item) => item.hasCampaign)),
    bestSellerRate: ratioFromBooleans(memories.map((item) => item.isBestSeller)),
    successfulAvgShippingDays: average(successful.map((item) => item.shippingDays), 1),
    successfulAvgImageCount: average(successful.map((item) => item.imageCount), 1),
    successfulAvgRatingValue: average(successful.map((item) => item.ratingValue), 2),
    successfulAvgSellerScore: average(successful.map((item) => item.sellerScore), 2),
    successfulAvgPrice: average(successful.map((item) => item.normalizedPrice), 2),
    successfulFastDeliveryRate: ratioFromBooleans(
      successful.map((item) => typeof item.shippingDays === "number" && item.shippingDays <= 3)
    ),
    successfulVideoRate: ratioFromBooleans(successful.map((item) => item.hasVideo)),
    successfulOfficialSellerRate: ratioFromBooleans(
      successful.map((item) => item.officialSeller)
    ),
    notes: {
      updatedFromMemories: memories.length,
      latestCriticalDiagnoses: memories
        .map((item) => cleanText(item.criticalDiagnosis))
        .filter((item): item is string => !!item)
        .slice(0, 5),
    } as Prisma.InputJsonValue,
  };
}

function mapComputedBenchmark(params: {
  platform: string;
  category: string;
  benchmarkPayload: ReturnType<typeof buildBenchmarkPayloadFromMemories>;
}): CategoryBenchmarkSnapshot {
  const { platform, category, benchmarkPayload } = params;

  return {
    platform,
    category,
    sampleSize: benchmarkPayload.sampleSize,
    successfulSampleSize: benchmarkPayload.successfulSampleSize,
    avgShippingDays: benchmarkPayload.avgShippingDays,
    avgImageCount: benchmarkPayload.avgImageCount,
    avgDescriptionLength: benchmarkPayload.avgDescriptionLength,
    avgRatingValue: benchmarkPayload.avgRatingValue,
    avgSellerScore: benchmarkPayload.avgSellerScore,
    avgPrice: benchmarkPayload.avgPrice,
    avgReviewCount: benchmarkPayload.avgReviewCount,
    avgFavoriteCount: benchmarkPayload.avgFavoriteCount,
    avgOtherSellersCount: benchmarkPayload.avgOtherSellersCount,
    fastDeliveryRate: benchmarkPayload.fastDeliveryRate,
    freeShippingRate: benchmarkPayload.freeShippingRate,
    hasVideoRate: benchmarkPayload.hasVideoRate,
    officialSellerRate: benchmarkPayload.officialSellerRate,
    campaignRate: benchmarkPayload.campaignRate,
    bestSellerRate: benchmarkPayload.bestSellerRate,
    successfulAvgShippingDays: benchmarkPayload.successfulAvgShippingDays,
    successfulAvgImageCount: benchmarkPayload.successfulAvgImageCount,
    successfulAvgRatingValue: benchmarkPayload.successfulAvgRatingValue,
    successfulAvgSellerScore: benchmarkPayload.successfulAvgSellerScore,
    successfulAvgPrice: benchmarkPayload.successfulAvgPrice,
    successfulFastDeliveryRate: benchmarkPayload.successfulFastDeliveryRate,
    successfulVideoRate: benchmarkPayload.successfulVideoRate,
    successfulOfficialSellerRate: benchmarkPayload.successfulOfficialSellerRate,
  };
}

function buildRuleCandidatesFromBenchmark(
  benchmarkPayload: ReturnType<typeof buildBenchmarkPayloadFromMemories>
) {
  const rules: RuleCandidate[] = [];

  if (
    benchmarkPayload.successfulSampleSize >= 4 &&
    typeof benchmarkPayload.successfulAvgShippingDays === "number" &&
    typeof benchmarkPayload.avgShippingDays === "number" &&
    benchmarkPayload.successfulAvgShippingDays <= benchmarkPayload.avgShippingDays * 0.8
  ) {
    rules.push({
      ruleKey: "fast-delivery-advantage",
      title: "Hizli teslimat bu kategoride kritik",
      insight:
        "Bu kategoride basarili urunler kategori ortalamasindan belirgin daha hizli teslim ediliyor; teslimat hizi fiyat farkini bile telafi edebiliyor.",
      confidence: 0.74,
      supportCount: benchmarkPayload.successfulSampleSize,
      metadata: {
        avgShippingDays: benchmarkPayload.avgShippingDays,
        successfulAvgShippingDays: benchmarkPayload.successfulAvgShippingDays,
      },
    });
  }

  if (
    benchmarkPayload.successfulSampleSize >= 4 &&
    typeof benchmarkPayload.successfulAvgImageCount === "number" &&
    typeof benchmarkPayload.avgImageCount === "number" &&
    benchmarkPayload.successfulAvgImageCount >= benchmarkPayload.avgImageCount * 1.15
  ) {
    rules.push({
      ruleKey: "visual-depth-matters",
      title: "Gorsel cesitliligi basari formulu",
      insight:
        "Bu kategoride lider urunler daha zengin gorsel anlatim kullaniyor; gorsel cesitliligi karar hizini belirgin etkiliyor.",
      confidence: 0.68,
      supportCount: benchmarkPayload.successfulSampleSize,
      metadata: {
        avgImageCount: benchmarkPayload.avgImageCount,
        successfulAvgImageCount: benchmarkPayload.successfulAvgImageCount,
      },
    });
  }

  if (
    benchmarkPayload.successfulSampleSize >= 4 &&
    typeof benchmarkPayload.successfulOfficialSellerRate === "number" &&
    typeof benchmarkPayload.officialSellerRate === "number" &&
    benchmarkPayload.successfulOfficialSellerRate >= benchmarkPayload.officialSellerRate + 0.15
  ) {
    rules.push({
      ruleKey: "trust-compensates-price",
      title: "Guven sinyali fiyat primini tolere ediyor",
      insight:
        "Bu kategoride resmi satici ve guclu magaza guveni, fiyat priminin musteri tarafinda daha kolay tolere edilmesini sagliyor.",
      confidence: 0.63,
      supportCount: benchmarkPayload.successfulSampleSize,
      metadata: {
        officialSellerRate: benchmarkPayload.officialSellerRate,
        successfulOfficialSellerRate: benchmarkPayload.successfulOfficialSellerRate,
      },
    });
  }

  if (
    benchmarkPayload.successfulSampleSize >= 4 &&
    typeof benchmarkPayload.successfulAvgSellerScore === "number" &&
    typeof benchmarkPayload.avgSellerScore === "number" &&
    benchmarkPayload.successfulAvgSellerScore >= benchmarkPayload.avgSellerScore + 0.3
  ) {
    rules.push({
      ruleKey: "trust-wall-on-cheap-offers",
      title: "Ucuz teklif guven duvarina carpmamali",
      insight:
        "Bu kategoride yalnizca dusuk fiyat yetmiyor; satici guveni zayif kalirsa ucuz teklif bile donusumu tasimiyor.",
      confidence: 0.66,
      supportCount: benchmarkPayload.successfulSampleSize,
      metadata: {
        avgSellerScore: benchmarkPayload.avgSellerScore,
        successfulAvgSellerScore: benchmarkPayload.successfulAvgSellerScore,
      },
    });
  }

  return rules;
}

function buildSystemLearning(params: {
  extracted: ExtractedProductFields;
  benchmark: CategoryBenchmarkSnapshot | null;
  rules: LearnedRuleSnapshot[];
}) {
  const { extracted, benchmark, rules } = params;

  if (!benchmark || benchmark.sampleSize < 5) {
    return "Bu kategoride yeterli tarihsel veri henuz birikmedigi icin sistem benchmark setini buyutuyor.";
  }

  const insights: string[] = [];

  if (
    typeof extracted.shipping_days === "number" &&
    typeof benchmark.avgShippingDays === "number"
  ) {
    if (extracted.shipping_days > benchmark.avgShippingDays * 1.4) {
      insights.push(
        `${humanizeCategoryLabel(benchmark.category)} kategorisinde ortalama teslimat ${benchmark.avgShippingDays} gun civarindayken mevcut urun ${extracted.shipping_days} gun ile belirgin sekilde yavas kaliyor.`
      );
    } else if (
      typeof benchmark.successfulAvgShippingDays === "number" &&
      extracted.shipping_days <= benchmark.successfulAvgShippingDays
    ) {
      insights.push(
        `Teslimat hizi bu kategoride basarili urun bandina yakin duruyor.`
      );
    }
  }

  if (
    typeof extracted.image_count === "number" &&
    typeof benchmark.avgImageCount === "number"
  ) {
    if (extracted.image_count < benchmark.avgImageCount * 0.7) {
      insights.push(
        `Gorsel cesitliligi kategori ortalamasinin gerisinde; lider urunler ortalama ${benchmark.avgImageCount} gorsel kullanirken mevcut urun ${extracted.image_count} gorselde kaliyor.`
      );
    } else if (
      typeof benchmark.successfulAvgImageCount === "number" &&
      extracted.image_count >= benchmark.successfulAvgImageCount
    ) {
      insights.push("Gorsel cesitliligi basarili urun seviyesine yaklasiyor.");
    }
  }

  if (
    typeof extracted.normalized_price === "number" &&
    typeof benchmark.avgPrice === "number" &&
    extracted.normalized_price > benchmark.avgPrice * 1.15 &&
    (extracted.official_seller || (extracted.seller_score ?? 0) >= 8.8)
  ) {
    insights.push(
      "Bu kategoride guclu guven sinyali olan urunler fiyat primini daha rahat tasiyabiliyor."
    );
  }

  const topRule = rules[0];
  if (topRule && topRule.confidence >= 0.55) {
    insights.push(topRule.insight);
  }

  if (insights.length === 0) {
    return `Bu kategoride son ${benchmark.sampleSize} incelemeye gore belirgin bir baskin kural cikmadi; sistem daha cok veri biriktiriyor.`;
  }

  return `Bu kategoride yaptigim son incelemelere dayanarak; ${insights
    .slice(0, 2)
    .join(" ")}`.trim();
}

async function rebuildCategoryKnowledge(platform: string, category: string) {
  const memories = await prisma.learningMemory.findMany({
    where: {
      platform,
      category,
      sourceType: "real",
      learningEligible: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 150,
  });

  if (memories.length === 0) {
    return;
  }
  const benchmarkPayload = buildBenchmarkPayloadFromMemories(memories);

  await prisma.categoryBenchmark.upsert({
    where: {
      platform_category: {
        platform,
        category,
      },
    },
    update: benchmarkPayload,
    create: {
      platform,
      category,
      ...benchmarkPayload,
    },
  });

  const rules = buildRuleCandidatesFromBenchmark(benchmarkPayload);

  for (const rule of rules) {
    await prisma.learnedRule.upsert({
      where: {
        platform_category_ruleKey: {
          platform,
          category,
          ruleKey: rule.ruleKey,
        },
      },
      update: {
        title: rule.title,
        insight: rule.insight,
        confidence: rule.confidence,
        supportCount: rule.supportCount,
        metadata: rule.metadata,
        lastSeenAt: new Date(),
      },
      create: {
        platform,
        category,
        ruleKey: rule.ruleKey,
        title: rule.title,
        insight: rule.insight,
        confidence: rule.confidence,
        supportCount: rule.supportCount,
        metadata: rule.metadata,
        lastSeenAt: new Date(),
      },
    });
  }
}

export async function getLearningContext(params: {
  platform: string | null | undefined;
  category: string | null | undefined;
  brand?: string | null;
  extracted: ExtractedProductFields;
  includeSynthetic?: boolean;
}): Promise<LearningContext> {
  // MVP: Return minimal context without DB queries
  // Full learning engine disabled to reduce analysis latency and complexity
  // Can be re-enabled later for premium tiers
  
  return {
    benchmark: null,
    rules: [],
    memorySnippets: [],
    systemLearning: null,
  };
}

export async function recordLearningArtifacts(params: {
  reportId: string | null;
  platform: string | null;
  category: string | null;
  extracted: ExtractedProductFields;
  summary: string;
  overallScore: number;
  sourceType: "real" | "synthetic";
  missingDataReport?: MissingDataReport;
  learningStatus?: LearningStatus;
}): Promise<void> {
  // MVP: Learning artifacts recording disabled
  // This reduces post-analysis latency and DB pressure
  // Can be re-enabled for future analytics/refinement
  
  // No-op for MVP
  return;
}
