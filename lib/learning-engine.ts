import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CategoryBenchmarkSnapshot,
  ExtractedProductFields,
  LearningContext,
  LearningStatus,
  LearnedRuleSnapshot,
  MissingDataReport,
} from "@/types/analysis";

const LEARNING_ENGINE_ENABLED = process.env.LEARNING_ENGINE_ENABLED === "1";

export function getLearningEngineState() {
  return {
    enabled: LEARNING_ENGINE_ENABLED,
    mode: LEARNING_ENGINE_ENABLED ? "active" : "safe_noop",
    reason: LEARNING_ENGINE_ENABLED
      ? "Learning engine runtime is enabled."
      : "Learning engine is intentionally disabled to protect core deterministic analysis path.",
  } as const;
}

type LearningMemoryRecord = Awaited<
  ReturnType<typeof prisma.learningMemory.findMany>
>[number];

type RuleCandidate = {
  ruleKey: string;
  title: string;
  insight: string;
  confidence: number;
  supportCount: number;
  metadata: Record<string, unknown> | null;
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

export async function rebuildCategoryKnowledge(platform: string, category: string) {
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
  const benchmarkCreateData: Prisma.CategoryBenchmarkUncheckedCreateInput = {
    platform,
    category,
    ...benchmarkPayload,
  };
  const benchmarkUpdateData: Prisma.CategoryBenchmarkUncheckedUpdateInput = {
    ...benchmarkPayload,
  };

  await prisma.categoryBenchmark.upsert({
    where: {
      platform_category: {
        platform,
        category,
      },
    },
    update: benchmarkUpdateData,
    create: benchmarkCreateData,
  });

  const rules = buildRuleCandidatesFromBenchmark(benchmarkPayload);

  for (const rule of rules) {
    const ruleCreateData: Prisma.LearnedRuleUncheckedCreateInput = {
      platform,
      category,
      ruleKey: rule.ruleKey,
      title: rule.title,
      insight: rule.insight,
      confidence: rule.confidence,
      supportCount: rule.supportCount,
      metadata: rule.metadata as Prisma.InputJsonValue,
      lastSeenAt: new Date(),
    };
    const ruleUpdateData: Prisma.LearnedRuleUncheckedUpdateInput = {
      title: rule.title,
      insight: rule.insight,
      confidence: rule.confidence,
      supportCount: rule.supportCount,
      metadata: rule.metadata as Prisma.InputJsonValue,
      lastSeenAt: new Date(),
    };

    await prisma.learnedRule.upsert({
      where: {
        platform_category_ruleKey: {
          platform,
          category,
          ruleKey: rule.ruleKey,
        },
      },
      update: ruleUpdateData,
      create: ruleCreateData,
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
  void params;
  // MVP: Return minimal context without DB queries
  // Full learning engine disabled to reduce analysis latency and complexity
  // Can be re-enabled later for premium tiers
  if (LEARNING_ENGINE_ENABLED) {
    // Guarded future hook: even when runtime flag is enabled, we currently keep
    // the helper mode conservative to avoid overriding the core deterministic path.
  }
  
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
  void params;
  // MVP: Learning artifacts recording disabled
  // This reduces post-analysis latency and DB pressure
  // Can be re-enabled for future analytics/refinement
  if (LEARNING_ENGINE_ENABLED) {
    // Guarded future hook: keep no-op behavior until we explicitly open
    // persistence gates with additional quality controls.
  }
  
  // No-op for MVP
  return;
}
