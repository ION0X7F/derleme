import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  parseAnalysisSummary,
  syncStructuredSummaryWithSuggestions,
} from "@/lib/analysis-summary";
import {
  buildAiLearningPromptSection,
  readReviewerPromptTemplate,
} from "@/lib/ai-learning-memory";
import type {
  AnalysisSuggestion,
  ConsolidatedAnalysisInput,
  DataField,
  DecisionSupportPacket,
  ExtractedProductFields,
  LearningContext,
  MissingDataReport,
} from "@/types/analysis";
import type { AiEligibilityResult, AiEligibilityLevel } from "@/lib/ai-eligibility";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ... (rest of the types and constants are the same)
type SupportedDependency =
  | "title"
  | "h1"
  | "meta_description"
  | "brand"
  | "product_name"
  | "normalized_price"
  | "original_price"
  | "discount_rate"
  | "image_count"
  | "has_video"
  | "rating_value"
  | "review_count"
  | "question_count"
  | "description_length"
  | "bullet_point_count"
  | "has_add_to_cart"
  | "has_shipping_info"
  | "has_free_shipping"
  | "shipping_days"
  | "has_return_info"
  | "has_specs"
  | "has_faq"
  | "variant_count"
  | "stock_quantity"
  | "stock_status"
  | "seller_name"
  | "seller_badges"
  | "seller_score"
  | "follower_count"
  | "favorite_count"
  | "other_sellers_count"
  | "other_sellers_summary"
  | "other_seller_offers"
  | "has_brand_page"
  | "official_seller"
  | "has_campaign"
  | "campaign_label"
  | "delivery_type"
  | "review_summary"
  | "review_themes"
  | "qa_snippets"
  | "is_best_seller"
  | "best_seller_rank"
  | "best_seller_badge";

type AiWeaknessItem = {
  text: string;
  depends_on: SupportedDependency[];
};

type AiSuggestionItem = {
  key: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  depends_on: SupportedDependency[];
};

export type AiAnalysisResult = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: {
    key: string;
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
  }[];
  seo_score: number;
  conversion_score: number;
  overall_score: number;
};

type RawAiAnalysisResult = {
  summary: string;
  strengths: string[];
  weaknesses: AiWeaknessItem[];
  suggestions: AiSuggestionItem[];
  seo_score: number;
  conversion_score: number;
  overall_score: number;
};

type AiReviewerResult = {
  approved: boolean;
  confidence: "yüksek" | "orta" | "düşük";
  issues: Array<{
    severity: "yüksek" | "orta" | "düşük";
    message: string;
    reason: string;
  }>;
  fixSuggestions: string[];
};

type AiBaselineContext = {
  summary?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  suggestions?: AnalysisSuggestion[] | null;
  seo_score?: number | null;
  conversion_score?: number | null;
  overall_score?: number | null;
};

const SUPPORTED_DEPENDENCIES: SupportedDependency[] = [
  "title",
  "h1",
  "meta_description",
  "brand",
  "product_name",
  "normalized_price",
  "original_price",
  "discount_rate",
  "image_count",
  "has_video",
  "rating_value",
  "review_count",
  "question_count",
  "description_length",
  "bullet_point_count",
  "has_add_to_cart",
  "has_shipping_info",
  "has_free_shipping",
  "shipping_days",
  "has_return_info",
  "has_specs",
  "has_faq",
  "variant_count",
  "stock_quantity",
  "stock_status",
  "seller_name",
  "seller_badges",
  "seller_score",
  "follower_count",
  "favorite_count",
  "other_sellers_count",
  "other_sellers_summary",
  "other_seller_offers",
  "has_brand_page",
  "official_seller",
  "has_campaign",
  "campaign_label",
  "delivery_type",
  "review_summary",
  "review_themes",
  "qa_snippets",
  "is_best_seller",
  "best_seller_rank",
  "best_seller_badge",
];

const TURKISH_COMPARABLE_CHAR_MAP: Record<string, string> = {
  "ç": "c",
  "Ç": "c",
  "ğ": "g",
  "Ğ": "g",
  "ı": "i",
  "İ": "i",
  "ö": "o",
  "Ö": "o",
  "ş": "s",
  "Ş": "s",
  "ü": "u",
  "Ü": "u",
};

function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
}

function scoreToRange(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function humanizeAiText(value: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bnormalized_price\b/gi, "fiyat"],
    [/\boriginal_price\b/gi, "orijinal fiyat"],
    [/\bdiscount_rate\b/gi, "indirim orani"],
    [/\bmin_price\b/gi, "en dusuk rakip fiyat"],
    [/\bavg_price\b/gi, "rakip ortalama fiyat"],
    [/\bshipping_days\b/gi, "teslimat suresi"],
    [/\bdelivery_type\b/gi, "teslimat tipi"],
    [/\bfavorite_count\b/gi, "favori sayisi"],
    [/\breview_count\b/gi, "yorum sayisi"],
    [/\breview_summary\b/gi, "yorum ozeti"],
    [/\breview_risk\b/gi, "yorum riski"],
    [/\blow_rated_count\b/gi, "dusuk yildizli yorum sayisi"],
    [/\bpositive_count\b/gi, "olumlu yorum sayisi"],
    [/\bnegative_count\b/gi, "olumsuz yorum sayisi"],
    [/\bimage_count\b/gi, "gorsel sayisi"],
    [/\bseller_score\b/gi, "satici puani"],
    [/\bother_sellers_summary\b/gi, "rakip ozeti"],
    [/\bother_sellers_count\b/gi, "diger satici sayisi"],
    [/\bbest_seller_rank\b/gi, "cok satan sirasi"],
    [/\bhas_free_shipping\b/gi, "ucretsiz kargo"],
    [/\bhas_return_info\b/gi, "iade bilgisi"],
    [/\bhas_specs\b/gi, "ozellik alani"],
    [/\bdescription_length\b/gi, "aciklama derinligi"],
    [/\bweak\b/gi, "zayif"],
    [/\bstrong\b/gi, "guclu"],
    [/\bmedium\b/gi, "orta"],
    [/\bnot_enough_data\b/gi, "veri sinirli"],
    [/rakip en dusuk rakip fiyat/gi, "en dusuk rakip fiyat"],
    [/yorum ozetideki/gi, "yorum ozetindeki"],
    [/kategori benchmark[ıi]/gi, "kategori ortalamasi"],
  ];

  let next = value;

  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }

  return next
    .replace(/["']/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function containsSuspiciousSummaryArtifacts(value: string) {
  return /\b[a-z]+_[a-z0-9_]+\b/.test(value);
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function foldComparableCharacters(value: string) {
  return value.replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => {
    return TURKISH_COMPARABLE_CHAR_MAP[char] || char;
  });
}

function normalizeComparableText(value: string) {
  return foldComparableCharacters(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeStrings(items: Array<string | null | undefined>, limit: number) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const item of items) {
    if (!item || !item.trim()) continue;
    const normalized = normalizeComparableText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(item.trim());
    if (next.length >= limit) break;
  }

  return next;
}

function suggestionScore(severity: "high" | "medium" | "low") {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function getSuggestionTheme(title: string, detail: string) {
  const text = normalizeComparableText(`${title} ${detail}`);

  if (/(stok|varyant|envanter)/.test(text)) return "stock";
  if (/(fiyat|rakip|min fiyat|kupon|indirim)/.test(text)) return "price";
  if (/(teslim|kargo|sevkiyat|shipping|delivery)/.test(text)) return "delivery";
  if (/(guven|satici|magaza|yorum memnuniyeti|resmi satici|garanti|iade)/.test(text)) {
    return "trust";
  }
  if (/(icerik|aciklama|spec|ozellik|teknik|title|h1|meta|detay sayfasi|ikna)/.test(text)) {
    return "content";
  }
  if (/(gorsel|video|vitrin|fotograf|görüntü|medya)/.test(text)) return "visual";
  if (/(yorum|yildiz|social proof|sosyal kanit|review|sepet)/.test(text)) return "reviews";
  if (/(soru|cevap|sss|faq)/.test(text)) return "faq";
  if (/(kampanya|promosyon)/.test(text)) return "campaign";
  return null;
}

function getDiagnosisTheme(value: string | null | undefined) {
  const text = normalizeComparableText(value || "");

  if (!text) return null;
  if (/(stok|envanter|varyant)/.test(text)) return "stock";
  if (/(fiyat|rakip|min fiyat|indirim|kupon)/.test(text)) return "price";
  if (/(teslim|kargo|sevkiyat|shipping|delivery)/.test(text)) return "delivery";
  if (/(icerik|aciklama|ozellik|teknik|detay sayfasi|title|h1|meta)/.test(text)) {
    return "content";
  }
  if (/(guven|satici|magaza|garanti|iade)/.test(text)) return "trust";
  if (/(yorum|yildiz|sosyal kanit|review)/.test(text)) return "reviews";
  if (/(gorsel|video|goruntu|fotograf|vitrin)/.test(text)) return "visual";
  if (/(soru|cevap|sss|faq)/.test(text)) return "faq";
  if (/(kampanya|promosyon)/.test(text)) return "campaign";
  return null;
}

function prioritizeThemeAlignedSuggestions<
  T extends { title: string; detail: string }
>(items: T[], summary: string, fallbackSummary?: string | null) {
  const primaryTheme =
    getDiagnosisTheme(parseAnalysisSummary(summary).criticalDiagnosis) ||
    getDiagnosisTheme(parseAnalysisSummary(fallbackSummary).criticalDiagnosis);

  if (!primaryTheme) {
    return items;
  }

  const aligned: T[] = [];
  const remaining: T[] = [];

  for (const item of items) {
    if (getSuggestionTheme(item.title, item.detail) === primaryTheme) {
      aligned.push(item);
      continue;
    }

    remaining.push(item);
  }

  if (aligned.length === 0) {
    return items;
  }

  return [...aligned, ...remaining];
}

function dedupeSuggestions(
  items: Array<{
    key: string;
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
  }>,
  limit: number
) {
  const bestByFingerprint = new Map<
    string,
    {
      key: string;
      severity: "high" | "medium" | "low";
      title: string;
      detail: string;
    }
  >();
  const order: string[] = [];

  for (const item of items) {
    const title = item.title.trim();
    const detail = item.detail.trim();

    if (!title || !detail) continue;

    const theme = getSuggestionTheme(title, detail);
    const fingerprint = theme
      ? `theme:${theme}`
      : `${normalizeComparableText(title)}::${normalizeComparableText(detail)}`;
    const existing = bestByFingerprint.get(fingerprint);

    if (!existing) {
      bestByFingerprint.set(fingerprint, {
        ...item,
        title,
        detail,
      });
      order.push(fingerprint);
      continue;
    }

    if (suggestionScore(item.severity) > suggestionScore(existing.severity)) {
      bestByFingerprint.set(fingerprint, {
        ...item,
        title,
        detail,
      });
    }
  }

  return order
    .map((fingerprint) => bestByFingerprint.get(fingerprint))
    .filter(
      (
        item
      ): item is {
        key: string;
        severity: "high" | "medium" | "low";
        title: string;
        detail: string;
      } => !!item
    )
    .slice(0, limit);
}

function ensureStructuredSummary(params: {
  summary: string;
  fallbackSummary: string;
  learningContext?: LearningContext | null;
}) {
  const toClean = (value: string) =>
    humanizeAiText(
      value
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );

  const normalized = toClean(params.summary);
  const fallbackNormalized = toClean(params.fallbackSummary);
  const candidate = containsSuspiciousSummaryArtifacts(normalized)
    ? fallbackNormalized
    : normalized;

  const blockedTerms = [
    /\bdemand\b/gi,
    /\bcapture\b/gi,
    /\bsocial proof\b/gi,
    /\bbottleneck\b/gi,
    /\bconversion\b/gi,
    /\bmomentum\b/gi,
  ];

  let safe = candidate;
  for (const pattern of blockedTerms) {
    safe = safe.replace(pattern, "");
  }

  safe = safe
    .replace(/\[(KRITIK TESHIS|VERI CARPISTIRMA|STRATEJIK RECETE|SISTEM OGRENISI)\]:?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphCandidates = safe
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  const sourceParagraphs =
    paragraphCandidates.length >= 3
      ? paragraphCandidates
      : safe
          .split(/(?<=[.!?])\s+/)
          .map((item) => item.trim())
          .filter(Boolean);

  const paragraphs: string[] = [];
  for (const item of sourceParagraphs) {
    if (!item) continue;
    paragraphs.push(item);
    if (paragraphs.length >= 5) break;
  }

  if (paragraphs.length < 3) {
    const fallbackParts = fallbackNormalized
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
    for (const item of fallbackParts) {
      if (paragraphs.length >= 3) break;
      if (paragraphs.includes(item)) continue;
      paragraphs.push(item);
    }
  }

  return paragraphs
    .slice(0, Math.min(5, Math.max(3, paragraphs.length)))
    .join("\n\n");
}

function getScoreGuardrail(level: AiEligibilityLevel) {
  if (level === "high") return 18;
  if (level === "medium") return 12;
  return 8;
}

function guardScore(params: {
  candidate: number;
  baseline: number;
  level: AiEligibilityLevel;
}) {
  const maxDrift = getScoreGuardrail(params.level);
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Math.max(
          params.baseline - maxDrift,
          Math.min(params.baseline + maxDrift, params.candidate)
        )
      )
    )
  );
}

function buildBenchmarkDeltaSummary(
  extracted: ExtractedProductFields,
  learningContext: LearningContext | null | undefined
) {
  const benchmark = learningContext?.benchmark;

  if (!benchmark || benchmark.sampleSize < 5) {
    return [];
  }

  const deltas: string[] = [];

  if (
    typeof extracted.shipping_days === "number" &&
    typeof benchmark.avgShippingDays === "number"
  ) {
    if (extracted.shipping_days > benchmark.avgShippingDays * 1.25) {
      deltas.push(
        `Teslimat hizi kategori ortalamasindan yavas: mevcut ${extracted.shipping_days} gun, kategori ${benchmark.avgShippingDays} gun.`
      );
    } else if (
      typeof benchmark.successfulAvgShippingDays === "number" &&
      extracted.shipping_days <= benchmark.successfulAvgShippingDays
    ) {
      deltas.push(
        `Teslimat hizi basarili urun bandina yakin: mevcut ${extracted.shipping_days} gun.`
      );
    }
  }

  if (
    typeof extracted.image_count === "number" &&
    typeof benchmark.avgImageCount === "number"
  ) {
    if (extracted.image_count < benchmark.avgImageCount * 0.75) {
      deltas.push(
        `Gorsel cesitliligi kategori ortalamasinin altinda: mevcut ${extracted.image_count}, kategori ${benchmark.avgImageCount}.`
      );
    } else if (
      typeof benchmark.successfulAvgImageCount === "number" &&
      extracted.image_count >= benchmark.successfulAvgImageCount
    ) {
      deltas.push(
        `Gorsel cesitliligi basarili urun bandini yakaliyor: mevcut ${extracted.image_count}.`
      );
    }
  }

  if (
    typeof extracted.description_length === "number" &&
    typeof benchmark.avgDescriptionLength === "number" &&
    extracted.description_length < benchmark.avgDescriptionLength * 0.75
  ) {
    deltas.push(
      `Aciklama derinligi kategori ortalamasinin altinda: mevcut ${extracted.description_length}, kategori ${benchmark.avgDescriptionLength}.`
    );
  }

  if (
    typeof extracted.seller_score === "number" &&
    typeof benchmark.avgSellerScore === "number" &&
    extracted.seller_score < benchmark.avgSellerScore - 0.3
  ) {
    deltas.push(
      `Satici guveni kategori ortalamasinin gerisinde: mevcut ${extracted.seller_score}, kategori ${benchmark.avgSellerScore}.`
    );
  }

  if (
    typeof extracted.normalized_price === "number" &&
    typeof benchmark.avgPrice === "number" &&
    extracted.normalized_price > benchmark.avgPrice * 1.15 &&
    !extracted.official_seller &&
    (extracted.seller_score ?? 0) < 8.5
  ) {
    deltas.push(
      `Fiyat kategori ortalamasinin ustunde ama bunu telafi edecek guven sinyali sinirli: mevcut ${formatPrice(
        extracted.normalized_price
      )}, kategori ${formatPrice(benchmark.avgPrice)}.`
    );
  }

  return deltas.slice(0, 4);
}

function buildSignalDigest(params: {
  packet: DecisionSupportPacket;
  extracted: ExtractedProductFields;
  learningContext?: LearningContext | null;
  missingDataReport?: MissingDataReport | null;
}) {
  const { packet, extracted, learningContext, missingDataReport } = params;
  const criticalCandidates: string[] = [];

  if (
    extracted.stock_status?.toLocaleLowerCase("tr-TR").includes("tuk") ||
    extracted.stock_status?.toLocaleLowerCase("tr-TR").includes("stokta yok") ||
    extracted.stock_quantity === 0
  ) {
    criticalCandidates.push("Stok erisilebilirligi kritik risk.");
  }

  if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number" &&
    extracted.other_sellers_summary.cheaper_count > 0
  ) {
    criticalCandidates.push("Rakip fiyat baskisi mevcut.");
  }

  if (typeof extracted.shipping_days === "number" && extracted.shipping_days >= 6) {
    criticalCandidates.push("Teslimat bariyeri belirgin.");
  }

  if (
    hasText(extracted.title) &&
    hasText(extracted.h1) &&
    ((extracted.description_length ?? 0) < 120 || extracted.has_specs === false)
  ) {
    criticalCandidates.push("Trafik sinyali var ama detay sayfasi iknasi zayif.");
  }

  if (
    (extracted.favorite_count ?? 0) >= 500000 &&
    ((extracted.review_count ?? 0) < 50 ||
      (!!extracted.review_summary &&
        extracted.review_summary.sampled_count > 0 &&
        extracted.review_summary.low_rated_count >=
          Math.max(2, Math.ceil(extracted.review_summary.sampled_count * 0.4))))
  ) {
    criticalCandidates.push("Ilgi var ama sepet oncesi guven veya teklif surtunmesi var.");
  }

  return {
    coverage_confidence: packet.coverage.confidence,
    unresolved_critical_fields: missingDataReport?.unresolvedCriticalFields ?? [],
    critical_candidates: criticalCandidates.slice(0, 4),
    benchmark_deltas: buildBenchmarkDeltaSummary(extracted, learningContext),
    top_rules:
      learningContext?.rules
        .filter((rule) => rule.confidence >= 0.55)
        .map((rule) => rule.insight)
        .slice(0, 2) ?? [],
  };
}

function buildDataQualitySummary(
  input: ConsolidatedAnalysisInput
): string {
  const importantFields = [
    "title",
    "price",
    "brand",
    "reviewCount",
    "ratingValue",
    "imageCount",
    "sellerScore",
    "descriptionLength",
  ] as const satisfies ReadonlyArray<keyof ConsolidatedAnalysisInput>;

  const fieldLabel: Record<(typeof importantFields)[number], string> = {
    title: "baslik",
    price: "fiyat",
    brand: "marka",
    reviewCount: "yorum sayisi",
    ratingValue: "puan",
    imageCount: "gorsel",
    sellerScore: "satici puani",
    descriptionLength: "aciklama",
  };

  const qualitySignals: string[] = [];
  const lowConfidence: string[] = [];
  const missing: string[] = [];

  for (const key of importantFields) {
    const field = input[key] as DataField<string | number | boolean>;
    if (!field) continue;

    if (field.value === null) {
      missing.push(fieldLabel[key]);
      continue;
    }

    if (field.confidence >= 0.9) {
      qualitySignals.push(`${fieldLabel[key]}: yuksek guven (${field.source})`);
    } else if (field.confidence >= 0.5) {
      qualitySignals.push(`${fieldLabel[key]}: orta guven (${field.source})`);
    } else {
      lowConfidence.push(fieldLabel[key]);
    }
  }

  if (qualitySignals.length === 0) {
    return "Veri kalitesi sinyalleri hesaplanamadi.";
  }

  const parts = [`Guvenilirlik: ${qualitySignals.join(", ")}.`];

  if (lowConfidence.length > 0) {
    parts.push(`Temkinli alanlar: ${lowConfidence.join(", ")}.`);
  }

  if (missing.length > 0) {
    parts.push(`Eksik alanlar: ${missing.join(", ")}.`);
  }

  return parts.join(" ");
}

function buildAiMarketContext(input: ConsolidatedAnalysisInput) {
  const market = input.marketComparison;
  const safeList = (items: unknown[]) =>
    items
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, 3);

  if (!market) {
    return {
      sales_status: "net degil",
      market_position: "net degil",
      growth_opportunity: "net degil",
      price_advantage: "net degil",
      customer_trust: "net degil",
      page_strength: "net degil",
      main_pressure_areas: [] as string[],
      competitor_context: "rakip verisi sinirli",
      uncertainty: "market verisi sinirli oldugu icin yorumlar temkinli kalmali",
    };
  }

  const customerTrust = input.sellerScore.value != null
    ? input.sellerScore.value >= 8.8
      ? "guclu"
      : input.sellerScore.value >= 8
        ? "orta"
        : "zayif"
    : "net degil";

  const pageStrengthParts = [
    typeof input.title.value === "string" && input.title.value.trim().length >= 20 ? 1 : 0,
    (input.descriptionLength.value ?? 0) >= 140 ? 1 : 0,
    (input.imageCount.value ?? 0) >= 4 ? 1 : 0,
  ];
  const pageStrengthScore = pageStrengthParts.reduce((sum, value) => sum + value, 0);
  const pageStrength =
    pageStrengthScore >= 3 ? "guclu" : pageStrengthScore >= 2 ? "orta" : "zayif";

  return {
    sales_status: market.userEstimatedSalesLevel,
    market_position: market.marketPosition,
    growth_opportunity: market.growthOpportunityLevel,
    price_advantage: market.competitorSummary.priceCompetitiveness ?? "unclear",
    customer_trust: customerTrust,
    page_strength: pageStrength,
    main_pressure_areas: safeList(market.mainIssues.map((item) => String(item))),
    competitor_context: `rakip_sayisi=${market.competitorSummary.competitorCount ?? 0}, en_guclu_rakip_satis=${market.strongestCompetitorSalesLevel}`,
    uncertainty:
      packetLikeConfidence(input) < 0.58
        ? "veri guveni dusuk, kesin yargidan kacinin"
        : "veri guveni orta-yuksek",
  };
}

function packetLikeConfidence(input: ConsolidatedAnalysisInput) {
  const fields = [
    input.title.confidence,
    input.price.confidence,
    input.reviewCount.confidence,
    input.ratingValue.confidence,
    input.sellerScore.confidence,
    input.descriptionLength.confidence,
    input.imageCount.confidence,
  ].filter((value) => Number.isFinite(value));
  if (fields.length === 0) return 0.4;
  return fields.reduce((sum, value) => sum + value, 0) / fields.length;
}

function toSalesNarrativeLabel(level: string | null | undefined) {
  switch (level) {
    case "high":
      return "guclu";
    case "good":
      return "iyi";
    case "medium":
      return "orta";
    case "low":
      return "dusuk";
    case "very_low":
      return "cok dusuk";
    default:
      return "net degil";
  }
}

function toPositionNarrativeLabel(level: string | null | undefined) {
  switch (level) {
    case "leading":
      return "onde";
    case "strong":
      return "guclu";
    case "average":
      return "ortada";
    case "lagging":
      return "geride";
    default:
      return "net degil";
  }
}

function toGrowthNarrativeLabel(level: string | null | undefined) {
  switch (level) {
    case "very_high":
      return "cok guclu";
    case "high":
      return "guclu";
    case "medium":
      return "orta";
    case "low":
      return "sinirli";
    default:
      return "net degil";
  }
}

function toIssueNarrative(issue: string | null | undefined) {
  switch (issue) {
    case "price":
      return "fiyat/teklif";
    case "trust":
      return "musteri guveni";
    case "listing":
      return "sayfa gucu";
    case "visibility":
      return "gorunurluk";
    case "demand":
      return "urune ilgi";
    default:
      return "net degil";
  }
}

function buildAlignedParagraphs(
  input: ConsolidatedAnalysisInput,
  confidence: number
) {
  const market = input.marketComparison;
  if (!market) {
    return [
      "Urun icin temel sinyaller okunuyor, ancak pazar karsilastirma verisi sinirli oldugu icin yorumlar temkinli tutuldu.",
      "Diger magazalara gore net konum ve buyume alani bu veride kesinlesmiyor.",
      "Bu nedenle once fiyat, musteri guveni ve sayfa gucunu birlikte guclendirip tekrar olcum yapmak daha dogru olur.",
    ];
  }

  const sales = toSalesNarrativeLabel(market.userEstimatedSalesLevel);
  const position = toPositionNarrativeLabel(market.marketPosition);
  const growth = toGrowthNarrativeLabel(market.growthOpportunityLevel);
  const strongest = toSalesNarrativeLabel(market.strongestCompetitorSalesLevel);
  const primaryIssue = toIssueNarrative(market.primaryIssue);
  const secondary = (market.mainIssues || [])
    .map((item) => toIssueNarrative(item))
    .filter((item) => item !== "net degil")
    .slice(0, 2);

  const p1 =
    market.userEstimatedSalesLevel === "good" || market.userEstimatedSalesLevel === "high"
      ? `Urun su an ${sales} seviyede satis aliyor olabilir, ancak bu seviye pazarin zirvesi anlamina gelmeyebilir.`
      : market.userEstimatedSalesLevel === "medium"
        ? "Urun su an orta seviyede ilerliyor ve daha yukari cikmak icin belirgin alan barindiriyor."
        : market.userEstimatedSalesLevel === "low" || market.userEstimatedSalesLevel === "very_low"
          ? "Urun su an zayif satis sinyali veriyor; bu nedenle kararlar daha temkinli alinmali."
          : "Satis seviyesi net degil, bu nedenle yorumlar temkinli tutuldu.";

  const p2 = `Diger magazalara gore konumun ${position}; buyume firsati ${growth} gorunuyor. En guclu rakiplerde satis seviyesi ${strongest} bandinda.`;

  const p3 =
    primaryIssue !== "net degil"
      ? `En baskin engel ${primaryIssue}. ${secondary.length ? `Ek baski alanlari: ${secondary.join(" ve ")}.` : ""}`.trim()
      : "Baski alanlari sinirli veri nedeniyle netlesmiyor; fiyat, guven ve sayfa gucu birlikte izlenmeli.";

  const p4 =
    primaryIssue === "fiyat/teklif"
      ? "Ilk adimda fiyat, kupon ve kargo teklifini birlikte optimize etmek daha hizli etki verebilir."
      : primaryIssue === "musteri guveni"
        ? "Ilk adimda yorum kalitesi, satici puani ve iade/teslimat netligini guclendirmek daha dogru olur."
        : primaryIssue === "sayfa gucu"
          ? "Ilk adimda baslik, aciklama ve gorselleri netlestirerek karar anini guclendirmek gerekir."
          : "Ilk adimda fiyat, guven ve sayfa gucu tarafinda kucuk ama olculebilir denemelerle ilerlemek en guvenli yaklasim olur.";

  if (confidence < 0.58) {
    return [p1, p2, `${p3} Veri sinirli oldugu icin kesin yargidan kacinildi.`];
  }

  return [p1, p2, p3, p4];
}

function alignSummaryWithMarket(params: {
  summary: string;
  fallbackSummary: string;
  input: ConsolidatedAnalysisInput;
  eligibility: AiEligibilityResult;
}) {
  const normalized = ensureStructuredSummary({
    summary: params.summary,
    fallbackSummary: params.fallbackSummary,
    learningContext: null,
  });
  const confidence = packetLikeConfidence(params.input);
  const market = params.input.marketComparison;
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  const contradictionText = normalizeComparableText(paragraphs.join(" "));
  const salesLevel = market?.userEstimatedSalesLevel ?? "unclear";
  const saysWeak = /(zayif satis|satislar zayif|cok dusuk satis)/.test(contradictionText);
  const saysStrong = /(guclu satis|guclu gidiyor|cok iyi satis)/.test(contradictionText);
  const contradiction =
    ((salesLevel === "good" || salesLevel === "high") && saysWeak) ||
    ((salesLevel === "low" || salesLevel === "very_low") && saysStrong);

  const mustRebuild =
    paragraphs.length < 3 ||
    paragraphs.length > 5 ||
    contradiction ||
    !/pazar|magaza|rakip/.test(contradictionText) ||
    !/buyume|firsat/.test(contradictionText);

  if (!mustRebuild) return paragraphs.slice(0, 5).join("\n\n");

  const rebuilt = buildAlignedParagraphs(params.input, confidence);
  const limit = params.eligibility.level === "medium" ? 4 : 5;
  return rebuilt.slice(0, limit).join("\n\n");
}

async function buildPrompt(params: {
  consolidatedInput: ConsolidatedAnalysisInput,
  packet: DecisionSupportPacket,
  extracted: ExtractedProductFields,
  url: string,
  learningContext?: LearningContext | null,
  missingDataReport?: MissingDataReport | null,
  eligibility: AiEligibilityResult,
}) {
  const {
    consolidatedInput,
    packet,
    extracted,
    url,
    learningContext,
    missingDataReport,
    eligibility,
  } = params;
  
  const signalDigest = buildSignalDigest({
    packet,
    extracted,
    learningContext,
    missingDataReport,
  });
  const marketContext = buildAiMarketContext(consolidatedInput);
  const payload = {
    url,
    supported_dependencies: SUPPORTED_DEPENDENCIES,
    packet,
    market_context: marketContext,
    signal_digest: signalDigest,
    learning_context: learningContext ?? null,
    missing_data_report: missingDataReport ?? null,
  };

  const dataQualitySummary = buildDataQualitySummary(consolidatedInput);
  const learningMemory = await buildAiLearningPromptSection({ area: "genel", limit: 6 });

  const confidenceWarning = eligibility.level === "medium"
    ? `Veri guveni orta seviyede (${eligibility.score.toFixed(2)}). Kesin yargi yerine temkinli ve net ifadeler kullan.`
    : `Veri guveni gorece daha yuksek (${eligibility.score.toFixed(2)}). Yine de asiri iddiadan kacinin.`;

  return `
Sen Trendyol urun analizi yapan bir yardimci asistansin.
Amacin: sabit iskelet ile dinamik icerik uretmek.

${learningMemory}

VERI KALITESI OZETI:
${dataQualitySummary}
${confidenceWarning}

CIKTI KURALLARI:
1) summary tam 3 ila 5 kisa paragraf olsun.
2) summary icinde baslik, madde imi veya sabit etiket kullanma.
3) Paragraf sirasini koru:
   - 1. paragraf: genel durum (urun ne durumda)
   - 2. paragraf: diger magazalara gore durum + buyume firsati
   - 3. paragraf: en olasi baski alanlari (fiyat avantaji, musteri guveni, sayfa gucu vb.)
   - 4. paragraf: oncelikli yapilacaklar (gerekiyorsa)
4) Urun satis aliyor olabilecek bir seviyedeyse negatif acilis yapma.
5) Teknik jargon, hikaye anlatimi ve pazarlama dili kullanma.
6) Su kelimeleri kullanma: demand, capture, social proof, bottleneck, conversion, momentum.
7) Su sade ifadeleri tercih et: urune ilgi, satis durumu, musteri guveni, diger magazalara gore durum, fiyat avantaji, sayfa gucu, buyume firsati, en buyuk engel.
8) Veri zayifsa daha kisa ve daha temkinli yaz; kesin iddialardan kacinin.
9) strengths en fazla 4, weaknesses en fazla 5, suggestions en fazla 10 olsun.
10) weaknesses ve suggestions ogelerinde depends_on alanini doldur.

Veri:
${JSON.stringify(payload)}

Su JSON semasina tam uy:
{
  "summary": "string",
  "strengths": ["string"],
  "weaknesses": [
    {
      "text": "string",
      "depends_on": ["supported_dependency"]
    }
  ],
  "suggestions": [
    {
      "key": "kebab-case-string",
      "severity": "high | medium | low",
      "title": "string",
      "detail": "string",
      "depends_on": ["supported_dependency"]
    }
  ],
  "seo_score": 0,
  "conversion_score": 0,
  "overall_score": 0
}
`.trim();
}

function cleanJsonText(text: string) {
  return text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

function parseAiJson(text: string): unknown {
  const cleaned = cleanJsonText(text);
  const candidates = [cleaned];

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        const withoutTrailingCommas = candidate.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(withoutTrailingCommas);
      } catch {
        // Try the next candidate.
      }
    }
  }

  throw new SyntaxError("AI response could not be parsed as JSON.");
}

function asStringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function sanitizeKey(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "-");

  return normalized || fallback;
}

function sanitizeDependsOn(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is SupportedDependency =>
        typeof item === "string" &&
        SUPPORTED_DEPENDENCIES.includes(item as SupportedDependency)
    )
    .slice(0, 4);
}

function hasDependencyData(
  dependency: SupportedDependency,
  extracted: ExtractedProductFields
) {
  switch (dependency) {
    case "title":
    case "h1":
    case "meta_description":
    case "brand":
    case "product_name":
    case "stock_status":
    case "seller_name":
    case "campaign_label":
    case "delivery_type":
    case "best_seller_badge":
      return hasText(extracted[dependency]);
    case "seller_badges":
      return Array.isArray(extracted.seller_badges) && extracted.seller_badges.length > 0;
    case "seller_score":
    case "follower_count":
    case "favorite_count":
    case "other_sellers_count":
    case "stock_quantity":
      return typeof extracted[dependency] === "number";
    case "other_seller_offers":
      return (
        Array.isArray(extracted.other_seller_offers) &&
        extracted.other_seller_offers.length > 0
      );
    case "other_sellers_summary":
      return !!extracted.other_sellers_summary;
    case "review_summary":
      return !!extracted.review_summary;
    case "review_themes":
      return !!extracted.review_themes;
    case "qa_snippets":
      return Array.isArray(extracted.qa_snippets) && extracted.qa_snippets.length > 0;
    case "normalized_price":
    case "original_price":
    case "discount_rate":
    case "rating_value":
    case "review_count":
    case "question_count":
    case "description_length":
    case "bullet_point_count":
    case "shipping_days":
    case "variant_count":
    case "best_seller_rank":
      return typeof extracted[dependency] === "number";
    case "image_count":
      return typeof extracted.image_count === "number" && extracted.image_count > 0;
    case "has_video":
    case "has_add_to_cart":
    case "has_shipping_info":
    case "has_free_shipping":
    case "has_return_info":
    case "has_specs":
    case "has_faq":
    case "has_brand_page":
    case "official_seller":
    case "has_campaign":
    case "is_best_seller":
      return typeof extracted[dependency] === "boolean";
    default:
      return false;
  }
}

function sanitizeWeaknesses(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text.trim() : "";
      const depends_on = sanitizeDependsOn(record.depends_on);

      if (!text || depends_on.length === 0) return null;

      return {
        text,
        depends_on,
      };
    })
    .filter(
      (
        item
      ): item is {
        text: string;
        depends_on: SupportedDependency[];
      } => item !== null
    )
    .slice(0, 10);
}

function sanitizeSuggestions(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title =
        typeof record.title === "string" ? record.title.trim() : "";
      const detail =
        typeof record.detail === "string" ? record.detail.trim() : "";
      const severity =
        record.severity === "high" ||
        record.severity === "medium" ||
        record.severity === "low"
          ? record.severity
          : "medium";
      const depends_on = sanitizeDependsOn(record.depends_on);

      if (!title || !detail || depends_on.length === 0) return null;

      return {
        key: sanitizeKey(record.key, `ai-suggestion-${index + 1}`),
        severity,
        title,
        detail,
        depends_on,
      };
    })
    .filter((item): item is AiSuggestionItem => item !== null)
    .slice(0, 5);
}

function sanitizeAiResult(raw: unknown): RawAiAnalysisResult | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const summary =
    typeof record.summary === "string" ? record.summary.trim() : "";
  const strengths = asStringArray(record.strengths, 4);
  const weaknesses = sanitizeWeaknesses(record.weaknesses);
  const suggestions = sanitizeSuggestions(record.suggestions);
  const seo_score = scoreToRange(record.seo_score);
  const conversion_score = scoreToRange(record.conversion_score);
  const overall_score = scoreToRange(record.overall_score);

  if (!summary) return null;
  if (seo_score == null || conversion_score == null || overall_score == null) {
    return null;
  }

  return {
    summary,
    strengths,
    weaknesses,
    suggestions,
    seo_score,
    conversion_score,
    overall_score,
  };
}

function sanitizeReviewerResult(raw: unknown): AiReviewerResult | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.approved !== "boolean") return null;
  const confidence =
    record.confidence === "yüksek" || record.confidence === "orta" || record.confidence === "düşük"
      ? record.confidence
      : "orta";
  const issues = Array.isArray(record.issues)
    ? record.issues
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const issue = item as Record<string, unknown>;
          if (typeof issue.message !== "string" || typeof issue.reason !== "string") return null;
          return {
            severity:
              issue.severity === "yüksek" || issue.severity === "orta" || issue.severity === "düşük"
                ? issue.severity
                : "orta",
            message: issue.message.trim(),
            reason: issue.reason.trim(),
          };
        })
        .filter((item): item is AiReviewerResult["issues"][number] => item !== null)
    : [];
  const fixSuggestions = Array.isArray(record.fixSuggestions)
    ? record.fixSuggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return { approved: record.approved, confidence, issues, fixSuggestions };
}

async function reviewAiResult(params: {
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
  sanitized: RawAiAnalysisResult;
  extracted: ExtractedProductFields;
  packet: DecisionSupportPacket;
  learningContext?: LearningContext | null;
}) {
  try {
    const reviewerTemplate = await readReviewerPromptTemplate();
    const memory = await buildAiLearningPromptSection({ area: "genel", limit: 4 });
    const prompt = [
      reviewerTemplate,
      "",
      memory,
      "",
      "DENETLENECEK AI CIKTISI:",
      JSON.stringify(params.sanitized, null, 2),
      "",
      "KAYNAK VERI OZETI:",
      JSON.stringify(
        {
          extracted: {
            title: params.extracted.title,
            normalized_price: params.extracted.normalized_price,
            rating_value: params.extracted.rating_value,
            review_count: params.extracted.review_count,
            question_count: params.extracted.question_count,
            favorite_count: params.extracted.favorite_count,
            seller_score: params.extracted.seller_score,
            other_sellers_count: params.extracted.other_sellers_count,
            has_return_info: params.extracted.has_return_info,
            shipping_days: params.extracted.shipping_days,
          },
          metrics: params.packet.metrics,
          learning_context: params.learningContext ?? null,
        },
        null,
        2
      ),
    ].join("\n");

    const result = await params.model.generateContent(prompt);
    const parsed = parseAiJson(result.response.text()) as unknown;
    return sanitizeReviewerResult(parsed);
  } catch {
    return null;
  }
}

function collectEvidenceFilteredSuggestions(params: {
  suggestions: AiSuggestionItem[];
  extracted: ExtractedProductFields;
  limit: number;
}) {
  return dedupeSuggestions(
    params.suggestions
      .filter((item) =>
        item.depends_on.every((dependency) => hasDependencyData(dependency, params.extracted))
      )
      .map((item) => ({
        key: item.key,
        severity: item.severity,
        title: humanizeAiText(item.title),
        detail: humanizeAiText(item.detail),
      }))
      .slice(0, params.limit),
    params.limit
  );
}

function postProcessAiResult(
  result: RawAiAnalysisResult,
  extracted: ExtractedProductFields,
  fallback: AiAnalysisResult,
  consolidatedInput: ConsolidatedAnalysisInput,
  eligibility: AiEligibilityResult,
  learningContext?: LearningContext | null
): AiAnalysisResult {
  const suggestionLimit = eligibility.guidance.maxSuggestions;
  // For medium confidence, we rely more on the deterministic fallback
  if (eligibility.level === "medium") {
    const evidenceFilteredAiSuggestions = collectEvidenceFilteredSuggestions({
      suggestions: result.suggestions,
      extracted,
      limit: suggestionLimit,
    });

    const mergedSuggestions = dedupeSuggestions(
      [...fallback.suggestions, ...evidenceFilteredAiSuggestions],
      suggestionLimit
    );

    return {
      ...fallback,
      summary: alignSummaryWithMarket({
        summary: ensureStructuredSummary({
          summary: result.summary,
          fallbackSummary: fallback.summary,
          learningContext,
        }),
        fallbackSummary: fallback.summary,
        input: consolidatedInput,
        eligibility,
      }),
      suggestions: mergedSuggestions,
    };
  }

  const validatedAiSuggestions = collectEvidenceFilteredSuggestions({
    suggestions: result.suggestions,
    extracted,
    limit: suggestionLimit,
  });

  const weaknesses = dedupeStrings(
    [
      ...result.weaknesses
        .filter((item) =>
          item.depends_on.every((dependency) => hasDependencyData(dependency, extracted))
        )
        .map((item) => humanizeAiText(item.text))
        .slice(0, 5),
      ...fallback.weaknesses,
    ],
    5
  );

  const mergedSuggestions = dedupeSuggestions(
    [...fallback.suggestions, ...validatedAiSuggestions],
    suggestionLimit
  );
  const prioritizedSuggestions = prioritizeThemeAlignedSuggestions(
    mergedSuggestions,
    fallback.summary,
    result.summary
  );
  const suggestions = fallback.suggestions[0]
    ? dedupeSuggestions([fallback.suggestions[0], ...prioritizedSuggestions], suggestionLimit)
    : prioritizedSuggestions;

  const ensuredSummary = ensureStructuredSummary({
    summary: result.summary,
    fallbackSummary: fallback.summary,
    learningContext,
  });
  const summary = alignSummaryWithMarket({
    summary: ensuredSummary,
    fallbackSummary: fallback.summary,
    input: consolidatedInput,
    eligibility,
  });
  const safeSummary = containsSuspiciousSummaryArtifacts(summary)
    ? fallback.summary
    : summary;
  const safeSuggestions = suggestions.some((item) =>
    containsSuspiciousSummaryArtifacts(`${item.title} ${item.detail}`)
  )
    ? fallback.suggestions
    : suggestions;
  const shouldKeepDeterministicSummary =
    fallback.suggestions.length === 0 &&
    fallback.overall_score >= 75 &&
    fallback.seo_score >= 70 &&
    fallback.conversion_score >= 70;

  return {
    summary: shouldKeepDeterministicSummary ? fallback.summary : safeSummary,
    strengths: dedupeStrings(
      [...result.strengths.map((item) => humanizeAiText(item)), ...fallback.strengths],
      4
    ),
    weaknesses,
    suggestions: safeSuggestions,
    seo_score: guardScore({
      candidate: result.seo_score,
      baseline: fallback.seo_score,
      level: eligibility.level,
    }),
    conversion_score: guardScore({
      candidate: result.conversion_score,
      baseline: fallback.conversion_score,
      level: eligibility.level,
    }),
    overall_score: guardScore({
      candidate: result.overall_score,
      baseline: fallback.overall_score,
      level: eligibility.level,
    }),
  };
}

// ... (buildStrategicSections and other functions remain the same)

type StrategicCriticalCandidate = {
  theme: "delivery" | "visual" | "content" | "trust" | "price";
  score: number;
  criticalDiagnosis: string;
  dataCollision: string;
  weakness: AiWeaknessItem;
};

function getTopBenchmarkCriticalCandidate(
  extracted: ExtractedProductFields,
  learningContext?: LearningContext | null
) {
  const benchmark = learningContext?.benchmark;

  if (!benchmark || benchmark.sampleSize < 5) {
    return null;
  }

  const candidates: StrategicCriticalCandidate[] = [];

  if (
    typeof extracted.shipping_days === "number" &&
    typeof benchmark.avgShippingDays === "number" &&
    benchmark.avgShippingDays > 0 &&
    extracted.shipping_days > benchmark.avgShippingDays * 1.4
  ) {
    candidates.push({
      theme: "delivery",
      score: extracted.shipping_days / benchmark.avgShippingDays,
      criticalDiagnosis:
        "Veriler gosteriyor ki kategori benchmarkina gore yavas teslimat ana darbozaga donusuyor.",
      dataCollision: `Mevcut teslimat suresi ${extracted.shipping_days} gun iken kategori ortalamasi ${benchmark.avgShippingDays} gun; teklif makul olsa bile musteri daha hizli teslim edilen alternatiflere kayabilir.`,
      weakness: {
        text: "Teslimat hizi kategori standardinin belirgin gerisinde kaldigi icin karar aninda kayip yaratiyor.",
        depends_on: ["shipping_days"],
      },
    });
  }

  if (
    typeof extracted.image_count === "number" &&
    typeof benchmark.avgImageCount === "number" &&
    benchmark.avgImageCount > 0 &&
    extracted.image_count < benchmark.avgImageCount * 0.7
  ) {
    candidates.push({
      theme: "visual",
      score: benchmark.avgImageCount / Math.max(extracted.image_count, 1),
      criticalDiagnosis:
        "Veriler gosteriyor ki gorsel anlatim kategori standardinin gerisinde kaldigi icin karar aninda ikna zayifliyor.",
      dataCollision: `Mevcut sayfada ${extracted.image_count} gorsel bulunurken kategori ortalamasi ${benchmark.avgImageCount}; lider urunler urunu daha zengin gorsel vitrinle anlatiyor.`,
      weakness: {
        text: "Gorsel cesitliligi benchmark seviyesinin altinda kaldigi icin urun yeterince guclu anlatilmiyor.",
        depends_on: ["image_count"],
      },
    });
  }

  if (
    typeof extracted.description_length === "number" &&
    typeof benchmark.avgDescriptionLength === "number" &&
    benchmark.avgDescriptionLength > 0 &&
    (extracted.description_length < benchmark.avgDescriptionLength * 0.65 ||
      extracted.has_specs === false)
  ) {
    candidates.push({
      theme: "content",
      score:
        benchmark.avgDescriptionLength / Math.max(extracted.description_length, 40) +
        (extracted.has_specs === false ? 0.4 : 0),
      criticalDiagnosis:
        "Veriler gosteriyor ki urun detayi kategori benchmarkinin gerisinde kaldigi icin trafik karar asamasinda eriyor.",
      dataCollision: `Aciklama derinligi ve ozellik alani benchmark seviyesini yakalayamiyor; kategori ortalamasi ${benchmark.avgDescriptionLength} karakter civarindayken mevcut urun ${extracted.description_length} karakterde kaliyor.`,
      weakness: {
        text: "Aciklama ve ozellik derinligi benchmark seviyesini yakalayamadigi icin detay sayfasi ikna gucunu kaybediyor.",
        depends_on: ["description_length", "has_specs"],
      },
    });
  }

  if (
    typeof extracted.seller_score === "number" &&
    typeof benchmark.avgSellerScore === "number" &&
    extracted.seller_score < benchmark.avgSellerScore - 0.45
  ) {
    candidates.push({
      theme: "trust",
      score: benchmark.avgSellerScore - extracted.seller_score,
      criticalDiagnosis:
        "Veriler gosteriyor ki satici guveni kategori standardinin altinda kaldigi icin satin alma karari zayifliyor.",
      dataCollision: `Mevcut satici puani ${extracted.seller_score} seviyesindeyken kategori ortalamasi ${benchmark.avgSellerScore}; guven farki benzer tekliflerde rakibe alan aciyor.`,
      weakness: {
        text: "Satici puani benchmark seviyesinin altinda kaldigi icin guven duvari olusuyor.",
        depends_on: ["seller_score"],
      },
    });
  }

  if (
    typeof extracted.normalized_price === "number" &&
    typeof benchmark.avgPrice === "number" &&
    benchmark.avgPrice > 0 &&
    extracted.normalized_price > benchmark.avgPrice * 1.18 &&
    !extracted.official_seller &&
    (extracted.seller_score ?? 0) < 8.5
  ) {
    candidates.push({
      theme: "price",
      score: extracted.normalized_price / benchmark.avgPrice,
      criticalDiagnosis:
        "Veriler gosteriyor ki fiyat benchmark ustunde kalirken bunu tasiyacak guven sinyali sinirli oldugu icin teklif zayifliyor.",
      dataCollision: `Mevcut fiyat ${formatPrice(extracted.normalized_price)} seviyesindeyken kategori ortalamasi ${formatPrice(benchmark.avgPrice)} bandinda; guven telafisi zayif oldugunda fiyat primi karar kaybina donusuyor.`,
      weakness: {
        text: "Fiyat benchmark ustunde kaldigi halde bunu tasiyacak guven sinyali yeterince guclu degil.",
        depends_on: ["normalized_price", "seller_score", "official_seller"],
      },
    });
  }

  return candidates.sort((left, right) => right.score - left.score)[0] || null;
}

function buildStrategicSections(params: {
  packet: DecisionSupportPacket;
  extracted: ExtractedProductFields;
  learningContext?: LearningContext | null;
  missingDataReport?: MissingDataReport | null;
}) {
  const { extracted, learningContext, missingDataReport } = params;
  const weaknesses: AiWeaknessItem[] = [];
  const suggestions: AiSuggestionItem[] = [];
  const strengths: string[] = [];

  const price = extracted.normalized_price;
  const cheapest = extracted.other_sellers_summary?.min_price ?? null;
  const avgCompetitor = extracted.other_sellers_summary?.avg_price ?? null;
  const cheaperCount = extracted.other_sellers_summary?.cheaper_count ?? null;
  const fastDeliveryCount = extracted.other_sellers_summary?.fast_delivery_count ?? null;
  const priceDelta =
    typeof price === "number" && typeof cheapest === "number"
      ? Number((price - cheapest).toFixed(2))
      : null;
  const avgDelta =
    typeof price === "number" && typeof avgCompetitor === "number"
      ? Number((price - avgCompetitor).toFixed(2))
      : null;
  const isOutOfStock =
    extracted.stock_status?.toLocaleLowerCase("tr-TR").includes("tuk") ||
    extracted.stock_status?.toLocaleLowerCase("tr-TR").includes("stokta yok") ||
    extracted.stock_quantity === 0;
  const titleStrong = hasText(extracted.title) && hasText(extracted.h1);
  const contentWeak =
    (extracted.description_length ?? 0) < 120 || extracted.has_specs === false;
  const favoriteHigh = (extracted.favorite_count ?? 0) >= 500000;
  const reviewWeak =
    (extracted.review_count ?? 0) < 50 ||
    (!!extracted.review_summary &&
      extracted.review_summary.sampled_count > 0 &&
      extracted.review_summary.low_rated_count >=
        Math.max(2, Math.ceil(extracted.review_summary.sampled_count * 0.4)));
  const slowDelivery = typeof extracted.shipping_days === "number" && extracted.shipping_days >= 6;
  const competitorDeliveryBetter = typeof fastDeliveryCount === "number" && fastDeliveryCount >= 2;
  const sellerTrustWeak =
    typeof extracted.seller_score === "number" && extracted.seller_score < 7.5;
  const benchmark = learningContext?.benchmark;
  const benchmarkVisualWeak =
    typeof extracted.image_count === "number" &&
    typeof benchmark?.avgImageCount === "number" &&
    benchmark.avgImageCount > 0 &&
    extracted.image_count < benchmark.avgImageCount * 0.75;
  const benchmarkContentWeak =
    typeof extracted.description_length === "number" &&
    typeof benchmark?.avgDescriptionLength === "number" &&
    benchmark.avgDescriptionLength > 0 &&
    (extracted.description_length < benchmark.avgDescriptionLength * 0.75 ||
      extracted.has_specs === false);
  const topBenchmarkCritical = getTopBenchmarkCriticalCandidate(
    extracted,
    learningContext
  );

  if (
    typeof extracted.rating_value === "number" &&
    extracted.rating_value >= 4.3 &&
    (extracted.review_count ?? 0) >= 100
  ) {
    strengths.push("Yorum hacmi ve puan seviyesi temel sosyal kaniti destekliyor.");
  }
  if (typeof priceDelta === "number" && priceDelta <= 0) {
    strengths.push("Rakip fiyat bandina gore fiyat avantaji gorunuyor.");
  }
  if (extracted.has_free_shipping) {
    strengths.push("Ucretsiz kargo sinyali teklif gucunu destekliyor.");
  }
  if (extracted.official_seller) {
    strengths.push("Resmi satici sinyali guven tarafini destekliyor.");
  }
  if (extracted.is_best_seller && typeof extracted.best_seller_rank === "number") {
    strengths.push(`Kategori liderligi sinyali mevcut: En Cok Satilan #${extracted.best_seller_rank}.`);
  }

  let criticalDiagnosis = "Veri yetersizligi nedeniyle ana darbozagin bir kismi analiz disi birakildi.";
  let dataCollision =
    "Veri yetersizligi nedeniyle capraz sorgu sinirli kapsama sahip.";

  if (isOutOfStock) {
    criticalDiagnosis =
      "Veriler gosteriyor ki urun stokta olmadigi icin satisin onundeki ana darbozag dogrudan erisilebilirlik problemi.";
    dataCollision =
      "Stok durumu satisi sifirlarken diger fiyat, yorum veya guven sinyalleri ikinci planda kaliyor.";
    weaknesses.push({
      text: "Stok olmadigi icin urun satin alma akisinin disina dusuyor.",
      depends_on: ["stock_status", "stock_quantity"],
    });
    suggestions.push({
      key: "restore-stock-first",
      severity: "high",
      title: "Stogu once geri acin",
      detail:
        "Veriler stok kesintisi gosteriyor; urun listede kalsa da satis akisi durur, bu nedenle once stok ve varyant erisilebilirligini normale dondurun.",
      depends_on: ["stock_status", "stock_quantity"],
    });
  } else if (topBenchmarkCritical) {
    criticalDiagnosis = topBenchmarkCritical.criticalDiagnosis;
    dataCollision = topBenchmarkCritical.dataCollision;
    weaknesses.push(topBenchmarkCritical.weakness);
  } else if (
    typeof priceDelta === "number" &&
    priceDelta > 0 &&
    ((typeof avgCompetitor === "number" && typeof avgDelta === "number" && avgDelta / avgCompetitor >= 0.5) ||
      (typeof cheapest === "number" && priceDelta / cheapest >= 0.5))
  ) {
    criticalDiagnosis =
      `Veriler gosteriyor ki fiyat bariyeri ana darbozagi olusturuyor; mevcut teklif rakip bandinin belirgin sekilde ustunde konumlaniyor.`;
    dataCollision =
      `Kendi fiyatin ${formatPrice(price)} seviyesindeyken en dusuk rakip ${formatPrice(
        cheapest
      )} bandinda; fiyat algisi urun detayindan once satin alma istegini kiriyor.`;
    weaknesses.push({
      text: "Fiyat rakip bandinin belirgin ustunde kaldigi icin teklif rekabetci degil.",
      depends_on: ["normalized_price", "other_sellers_summary"],
    });
  } else if (typeof priceDelta === "number" && priceDelta <= 0 && slowDelivery) {
    criticalDiagnosis =
      "Veriler gosteriyor ki fiyat avantaji olmasina ragmen teslimat hizi satisi baskiliyor.";
    dataCollision =
      `Fiyat liderligi korunurken teslimat suresi ${extracted.shipping_days} gun seviyesine cikiyor; musteri benzer fiyat bandinda daha hizli teslim edilen rakibe kayabilir.`;
    weaknesses.push({
      text: "Fiyat avantaji teslimat yavasligi nedeniyle etkisini kaybediyor.",
      depends_on: ["normalized_price", "shipping_days", "other_sellers_summary"],
    });
  } else if (titleStrong && contentWeak) {
    criticalDiagnosis =
      "Veriler gosteriyor ki gorunurluk var ama urun detayi ikna etmeye yetmedigi icin karar asamasinda kopus yasaniyor.";
    dataCollision =
      "Baslik ve temel listeleme sinyali mevcutken aciklama ve ozellik alani zayif; trafik urune geliyor ama urun detayi sorulari kapatamiyor.";
    weaknesses.push({
      text: "Baslik calisiyor ancak aciklama ve ozellik alani karar vermeyi desteklemiyor.",
      depends_on: ["title", "h1", "description_length", "has_specs"],
    });
  } else if (favoriteHigh && reviewWeak) {
    criticalDiagnosis =
      "Veriler gosteriyor ki urun ilgi cekiyor ancak sepet oncesi guven veya teklif bariyeri satisa donusmeyi kesiyor.";
    dataCollision =
      `Favori hacmi yuksek kalirken yorum ve sosyal kanit hizi bunu takip etmiyor; musteri urunu istiyor ama satin alma asamasinda cekiniyor.`;
    weaknesses.push({
      text: "Yuksek ilgi satisa donusmedigi icin sepet oncesi surtunme olusuyor.",
      depends_on: ["favorite_count", "review_count", "review_summary"],
    });
  } else if (sellerTrustWeak) {
    criticalDiagnosis =
      "Veriler gosteriyor ki guven bariyeri fiyat ve icerik sinyallerinin onune geciyor.";
    dataCollision =
      "Urun verisi mevcut olsa da satici puani zayif kaldigi icin musteri satin alma kararinda risk algiliyor.";
    weaknesses.push({
      text: "Satici puani guven tarafinda karar kirici bir bariyer olusturuyor.",
      depends_on: ["seller_score"],
    });
  } else if (typeof cheaperCount === "number" && cheaperCount > 0) {
    criticalDiagnosis =
      "Veriler gosteriyor ki ayni urunde rakip fiyat baskisi ana darbozaga donusuyor.";
    dataCollision =
      `En az ${cheaperCount} rakip daha dusuk fiyatla gorunuyor; urun detayi yeterli olsa bile teklif farki karar aninda rakibe alan aciyor.`;
    weaknesses.push({
      text: "Daha ucuz rakipler nedeniyle teklif algisi zayif kaliyor.",
      depends_on: ["other_sellers_summary", "normalized_price"],
    });
  }

  if (titleStrong && contentWeak) {
    suggestions.push({
      key: "strengthen-detail-conviction",
      severity: "high",
      title: "Detay sayfasini ikna edici hale getirin",
      detail:
        "Baslik ve listeleme sinyali calisiyor ancak aciklama ve ozellik alani zayif kaldigi icin musteri karar veremiyor; ilk blokta kullanim, fark ve teknik ozellikleri daha net katmanlayin.",
      depends_on: ["title", "h1", "description_length", "has_specs"],
    });
  }

  if (favoriteHigh && reviewWeak) {
    suggestions.push({
      key: "unlock-cart-barrier",
      severity: "high",
      title: "Sepet oncesi bariyeri azaltin",
      detail:
        "Favori ilgisi yuksek ama satis hizi bunu izlemiyor; teslimat, iade, garanti ve en kritik itirazlari ust blokta daha gorunur vererek tereddudu azaltin.",
      depends_on: ["favorite_count", "review_count", "review_summary", "has_return_info"],
    });
  }

  if (typeof priceDelta === "number" && priceDelta > 0) {
    suggestions.push({
      key: "close-price-gap",
      severity: "high",
      title: "Rakip fiyat farkini kapatin",
      detail:
        `Veriler rakip min fiyat ile aranda ${formatPrice(priceDelta)} fark oldugunu gosteriyor; fiyat, kupon veya kargo paketini bu farki azaltacak sekilde yeniden konumlandirin.`,
      depends_on: ["normalized_price", "other_sellers_summary"],
    });
  }

  if (slowDelivery || competitorDeliveryBetter) {
    suggestions.push({
      key: "fix-delivery-penalty",
      severity: slowDelivery ? "high" : "medium",
      title: "Teslimat cezasini dusurun",
      detail:
        slowDelivery
          ? `Teslimat suresi ${extracted.shipping_days} gun bandinda oldugu icin fiyat avantaji eriyor; hizli sevk, net teslim vaadi veya ayni fiyat bandinda daha hizli alternatif paket sunun.`
          : "Rakiplerde hizli teslimat sinyali birikiyor; teslimat vaadini ust alanda daha netlestirip sevk hizini rekabetci hale getirin.",
      depends_on: slowDelivery
        ? ["shipping_days", "delivery_type", "other_sellers_summary"]
        : ["delivery_type", "other_sellers_summary"],
    });
  }

  if (benchmarkVisualWeak) {
    suggestions.push({
      key: "lift-visual-benchmark",
      severity: topBenchmarkCritical?.theme === "visual" ? "high" : "medium",
      title: "Gorsel vitrini benchmark seviyesine tasiyin",
      detail:
        typeof benchmark?.avgImageCount === "number"
          ? `Mevcut ${extracted.image_count} gorsel kategori ortalamasi olan ${benchmark.avgImageCount} seviyesinin gerisinde kaliyor; farkli acilar, kullanim sahneleri ve detay yakin planlariyla urun anlatimini zenginlestirin.`
          : "Gorsel cesitliligini artirarak urunun ilk bakista anlasilmasini kolaylastirin.",
      depends_on: ["image_count", "has_video"],
    });
  }

  if (benchmarkContentWeak && !(titleStrong && contentWeak)) {
    suggestions.push({
      key: "raise-content-depth",
      severity: topBenchmarkCritical?.theme === "content" ? "high" : "medium",
      title: "Icerik derinligini benchmark seviyesine cekin",
      detail:
        typeof benchmark?.avgDescriptionLength === "number"
          ? `Aciklama derinligi kategori ortalamasi olan ${benchmark.avgDescriptionLength} karakter bandinin gerisinde; kullanim, fark ve teknik detaylari daha net katmanlayarak karar anini destekleyin.`
          : "Aciklama ve teknik detay katmanini genisleterek karar icin gereken bilgi derinligini artirin.",
      depends_on: ["description_length", "has_specs"],
    });
  }

  if (sellerTrustWeak) {
    suggestions.push({
      key: "reinforce-trust-signals",
      severity: "medium",
      title: "Guven sinyallerini sertlestirin",
      detail:
        "Satici puani zayif kaldigi icin musteri risk algiliyor; resmi satici, garanti, iade ve olumlu yorum sinyallerini ilk karar alaninda daha gorunur hale getirin.",
      depends_on: ["seller_score", "official_seller", "has_return_info", "review_count"],
    });
  }

  if (Array.isArray(extracted.qa_snippets) && extracted.qa_snippets.length > 0) {
    suggestions.push({
      key: "promote-faq-answers",
      severity: "low",
      title: "En cok sorulanlari ustte cevaplayin",
      detail:
        "Soru-cevap ornekleri musteri tereddudunun tekrar ettigini gosteriyor; ayni sorulari aciklama ve SSS alanina tasiyarak karar suresini kisaltin.",
      depends_on: ["qa_snippets", "has_faq", "description_length"],
    });
  }

  const recipeLines = suggestions
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${item.title}: ${item.detail}`);

  while (recipeLines.length < 3) {
    recipeLines.push(
      `${recipeLines.length + 1}. Veri yetersizligi nedeniyle bu alan analiz disi birakildi.`
    );
  }

  const unresolvedCritical = missingDataReport?.unresolvedCriticalFields ?? [];
  const unresolvedCriticalText =
    unresolvedCritical.length > 0
      ? ` Veri yetersizligi nedeniyle su kritik alanlar analiz disi kaldi: ${unresolvedCritical.join(", ")}.`
      : "";

  const systemLearning =
    learningContext?.systemLearning ||
    "Bu kategoride yeterli tarihsel ogrenim birikmedigi icin sistem ilk benchmark setini olusturuyor.";

  const summary = [
    `[KRITIK TESHIS]: ${criticalDiagnosis}${unresolvedCriticalText}`,
    `[VERI CARPISTIRMA]: ${dataCollision}${unresolvedCriticalText}`,
    `[STRATEJIK RECETE]:`,
    ...recipeLines,
    `[SISTEM OGRENISI]: ${systemLearning}`,
  ].join("\n");

  return {
    summary,
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 5),
    suggestions: suggestions.slice(0, 5),
  };
}

function buildDeterministicFallback(params: {
  consolidatedInput: ConsolidatedAnalysisInput;
  packet: DecisionSupportPacket;
  extracted: ExtractedProductFields;
  learningContext?: LearningContext | null;
  missingDataReport?: MissingDataReport | null;
  baseline?: AiBaselineContext | null;
  eligibility: AiEligibilityResult;
}) {
  const strategic = buildStrategicSections(params);
  const suggestionLimit = params.eligibility.guidance.maxSuggestions;
  const suggestions = prioritizeThemeAlignedSuggestions(
    dedupeSuggestions(
      [
        ...strategic.suggestions.map((item) => ({
          key: item.key,
          severity: item.severity,
          title: item.title,
          detail: item.detail,
        })),
        ...((params.baseline?.suggestions ?? []).map((item) => ({
          key: item.key,
          severity: item.severity,
          title: item.title,
          detail: item.detail,
        })) as AiAnalysisResult["suggestions"]),
      ],
      suggestionLimit
    ),
    strategic.summary,
    params.baseline?.summary ?? null
  ).slice(0, suggestionLimit);
  const summary = alignSummaryWithMarket({
    summary: ensureStructuredSummary({
      summary: strategic.summary,
      fallbackSummary: params.baseline?.summary ?? strategic.summary,
      learningContext: params.learningContext,
    }) || strategic.summary,
    fallbackSummary: params.baseline?.summary ?? strategic.summary,
    input: params.consolidatedInput,
    eligibility: params.eligibility,
  });

  return {
    summary,
    strengths: dedupeStrings(
      [...strategic.strengths, ...(params.baseline?.strengths ?? [])],
      4
    ),
    weaknesses: dedupeStrings(
      [
        ...strategic.weaknesses.map((item) => item.text),
        ...(params.baseline?.weaknesses ?? []),
      ],
      5
    ),
    suggestions,
    seo_score:
      scoreToRange(params.baseline?.seo_score) ??
      scoreToRange(params.packet.metrics.productQuality.score) ??
      0,
    conversion_score:
      scoreToRange(params.baseline?.conversion_score) ??
      scoreToRange(params.packet.metrics.marketPosition.score) ??
      0,
    overall_score:
      scoreToRange(params.baseline?.overall_score) ??
      scoreToRange(
        ((params.packet.metrics.productQuality.score ?? 0) +
          (params.packet.metrics.sellerTrust.score ?? 0) +
          (params.packet.metrics.marketPosition.score ?? 0)) /
          3
      ) ?? 0,
  } satisfies AiAnalysisResult;
}

export async function analyzeWithAi(params: {
  consolidatedInput: ConsolidatedAnalysisInput;
  packet: DecisionSupportPacket;
  extracted: ExtractedProductFields;
  url: string;
  learningContext?: LearningContext | null;
  missingDataReport?: MissingDataReport | null;
  baseline?: AiBaselineContext | null;
  eligibility: AiEligibilityResult;
}): Promise<AiAnalysisResult | null> {
  try {
    const fallback = buildDeterministicFallback(params);

    // This case should be already handled by the caller, but as a safeguard:
    if (!params.eligibility.eligible) {
      return fallback;
    }

    if (!genAI) {
      console.warn(
        "AI analysis fallback active: GEMINI_API_KEY is missing, deterministic strategy engine will be used."
      );
      return fallback;
    }

    const model = genAI.getGenerativeModel({
      model: geminiModel,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const prompt = await buildPrompt(params);
    const result = await model.generateContent(prompt);
    const parsed = parseAiJson(result.response.text()) as unknown;
    const sanitized = sanitizeAiResult(parsed);

    if (!sanitized) {
      return fallback;
    }

    const reviewer = await reviewAiResult({
      model,
      sanitized,
      extracted: params.extracted,
      packet: params.packet,
      learningContext: params.learningContext,
    });

    if (reviewer && reviewer.approved === false) {
      console.warn("AI reviewer fallback active:", reviewer.issues.map((item) => item.message).join(" | "));
      return fallback;
    }

    return postProcessAiResult(
      sanitized,
      params.extracted,
      fallback,
      params.consolidatedInput,
      params.eligibility,
      params.learningContext
    );
  } catch (err) {
    console.error("AI analysis error:", err);
    return buildDeterministicFallback(params);
  }
}
