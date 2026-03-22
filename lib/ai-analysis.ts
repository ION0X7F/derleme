import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  parseAnalysisSummary,
  syncStructuredSummaryWithSuggestions,
} from "@/lib/analysis-summary";
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

// ... (rest of the types and constants are the same)
type SupportedDependency =
  | "title"
  | "h1"
  | "meta_description"
  | "brand"
  | "product_name"
  | "model_code"
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
  "model_code",
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
  const normalized = humanizeAiText(
    params.summary
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
  const fallbackNormalized = humanizeAiText(params.fallbackSummary);
  const parsed = parseAnalysisSummary(normalized);

  if (!parsed.hasStructuredSummary) {
    return fallbackNormalized;
  }

  if (containsSuspiciousSummaryArtifacts(normalized)) {
    return fallbackNormalized;
  }

  if (normalized.includes("[SISTEM OGRENISI]:")) {
    return normalized;
  }

  return `${normalized}\n[SISTEM OGRENISI]: ${
    params.learningContext?.systemLearning ||
    "Bu kategoride yeterli tarihsel ogrenim birikmedigi icin sistem ilk benchmark setini olusturuyor."
  }`;
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
  const quality_signals: string[] = [];

  // Iterate over a curated list of important fields for brevity
  const importantFields: Array<keyof ConsolidatedAnalysisInput> = [
    "title",
    "price",
    "brand",
    "reviewCount",
    "ratingValue",
    "imageCount",
    "sellerScore",
    "descriptionLength",
  ];

  for (const key of importantFields) {
    const field = input[key] as DataField<string | number | boolean>;
    if (!field) continue;

    if (field.confidence >= 0.9) {
      quality_signals.push(`${key}: yuksek guvenilirlik (${field.source})`);
    } else if (field.confidence >= 0.5) {
      quality_signals.push(`${key}: orta guvenilirlik (${field.source})`);
    } else if (field.value !== null && field.confidence > 0) {
      quality_signals.push(`${key}: dusuk guvenilirlik (${field.source})`);
    }
  }

  if (quality_signals.length === 0) {
    return "Veri kalitesi sinyalleri hesaplanamadi.";
  }

  return `Guvenilirlik Raporu: ${quality_signals.join(", ")}.`;
}

function buildPrompt(params: {
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
  const payload = {
    url,
    supported_dependencies: SUPPORTED_DEPENDENCIES,
    packet,
    signal_digest: signalDigest,
    learning_context: learningContext ?? null,
    missing_data_report: missingDataReport ?? null,
  };

  const dataQualitySummary = buildDataQualitySummary(consolidatedInput);

  const confidenceWarning = eligibility.level === 'medium'
    ? `VERI KALITESI UYARISI:
Sana saglanan verilerin bir kismi dusuk veya orta guvenilirlikli kaynaklardan geliyor (ortalama guven skoru: ${eligibility.score.toFixed(2)}).
Bu nedenle, cikarimlarini yaparken daha temkinli ol. Sadece yuksek guvenilirlikli verilere dayanarak kesin ifadeler kullan, geri kalaninda 'mevcut veriler isiginda...' gibi daha yumusak bir dil kullan.`
    : '';

  return `
Sen Trendyol ekosisteminde uzmanlasmis veri odakli bir "Pazar Yeri Stratejistisin".
Gorevin, sana saglanan karar destek paketini capraz sorgulama yontemiyle analiz edip "Neden satamiyorum?" sorusuna net cevap vermek.

VERI KALITESI OZETI:
${dataQualitySummary}
Bu ozeti dikkate al. Yuksek guvenilirlikli verilere oncelik ver. Dusuk guvenilirlikli verilere dayali cikarimlar yapmaktan kacinin.

${confidenceWarning}

ANALIZ AKISI:
1. Temel Varlik ve Erisilebilirlik:
- stock_status, stock_quantity, normalized_price, other_sellers_summary.min_price, other_sellers_summary.avg_price alanlarini kontrol et.
- Urun stokta degilse bunu tek basina kritik teshis yap.
- Fiyat rakip min veya rakip ortalamasinin cok ustundeyse bunu kritik bariyer olarak one al.

2. Algoritmik Gorunurluk:
- title, h1, description_length, bullet_point_count, has_specs alanlarini capraz sorgula.
- Baslik varken aciklama ve ozellik alani zayifsa "trafik var ama ikna yetersiz" mantigini kur.

3. Guven ve Sosyal Kanit:
- seller_score, review_count, rating_value, favorite_count, review_summary, review_themes alanlarini capraz sorgula.
- Favori yuksek ama review_count veya review_summary zayifsa "ilgi var ama sepet bariyeri var" teshisi kur.

4. Kritik Surtunme Analizi:
- normalized_price vs shipping_days vs delivery_type vs other_sellers_summary vs other_seller_offers capraz sorgusunu yap.
- Urun fiyat avantajliysa ama teslimat yavas veya rakipte hizli teslimat fazlaysa bunu acikca yaz.
- Rakipler daha ucuzsa fiyat baskisini acikca yaz.

5. Kendi Kendine Ogrenme ve Adaptasyon:
- learning_context icindeki benchmark, rules ve memorySnippets alanlarini kullan.
- signal_digest.critical_candidates alanini ana darbozag aday listesi olarak kullan.
- signal_digest.benchmark_deltas ve signal_digest.top_rules alanlarini veri carpistirma bolumune sadece gercek destek varsa dahil et.
- Kategori benchmark'i varsa sabit esik kullanma; urunu kategori ortalamasi ve basarili orneklerle karsilastir.
- is_best_seller veya best_seller_rank sinyali varsa bunu ogretmen verisi gibi yorumla.
- Pahali ama guclu yorum/guven/hizli teslimat kombinasyonu varsa telafi faktorunu acikca not et.
- Her ucuz urunun kazanmadigini kabul et; guven zayifsa fiyat avantaji etkisiz kalabilir.

6. Eksik Veri Disiplini:
- missing_data_report.after.unresolvedReasons alanini oku.
- Bir alan eksikse ve o alan kararin merkezindeyse bunu acikca "Veri yetersizligi nedeniyle bu alan analiz disi birakildi." diye yaz.
- Eksik olan alanlar icin yorum yapma, tahmin uretme.

CIKTI KURALLARI:
1. Sadece eldeki veriye dayan.
2. Tahmin etme, uydurma yapma.
3. Eksik veri varsa ilgili alanda acikca "Veri yetersizligi nedeniyle bu alan analiz disi birakildi." de.
4. "Bence", "gorunuyor", "olabilir" gibi zayif ifadeler kullanma. "Veriler gosteriyor ki..." diliyle kesin konus.
5. Summary alani tam olarak su 3 bloktan olussun:
[KRITIK TESHIS]: ...
[VERI CARPISTIRMA]: ...
[STRATEJIK RECETE]:
1. ...
2. ...
3. ...
6. strengths en fazla 4 madde olsun.
7. weaknesses en fazla 5 madde olsun.
8. suggestions tam 3 maddeye yakin kalsin; en fazla 5 olabilir ama once en kritik 3 aksiyonu ver.
9. Her weakness ve suggestion icin depends_on doldurmak zorunlu.
10. depends_on icine sadece supported_dependencies listesindeki alanlari yaz.
11. Bir weakness veya suggestion ilgili veriye dayanmiyorsa o maddeyi hic yazma.
12. Summary icindeki KRITIK TESHIS tek ana darbozagi secsin.
13. VERI CARPISTIRMA bolumu en az iki veri grubunu birbirine karsilastirsin.
14. STRATEJIK RECETE maddeleri aksiyon odakli ve oncelik sirali olsun.
15. Summary sonuna su blok eklenmek zorunda:
[SISTEM OGRENISI]: ...
16. learning_context.benchmark?.sampleSize dusukse kesin kural yazma; "veri yetersizligi" de.
17. packet.coverage.confidence dusukse skor ve iddialari asiri uclara tasima.

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
    case "model_code":
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
    .slice(0, 5);
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

function postProcessAiResult(
  result: RawAiAnalysisResult,
  extracted: ExtractedProductFields,
  fallback: AiAnalysisResult,
  eligibility: AiEligibilityResult,
  learningContext?: LearningContext | null
): AiAnalysisResult {
  // For medium confidence, we rely more on the deterministic fallback
  if (eligibility.level === "medium") {
     const mergedSuggestions = dedupeSuggestions(
      [...fallback.suggestions, ...result.suggestions.map(s => ({...s, title: humanizeAiText(s.title), detail: humanizeAiText(s.detail)}))],
      5
    );
    return {
       ...fallback,
       summary: syncStructuredSummaryWithSuggestions({
          summary: fallback.summary, // prioritize deterministic summary
          fallbackSummary: result.summary,
          suggestions: mergedSuggestions,
          systemLearning: learningContext?.systemLearning,
       }) || fallback.summary,
       suggestions: mergedSuggestions,
    }
  }

  const validatedAiSuggestions = dedupeSuggestions(
    result.suggestions
      .filter((item) =>
        item.depends_on.every((dependency) => hasDependencyData(dependency, extracted))
      )
      .map((item) => ({
        key: item.key,
        severity: item.severity,
        title: humanizeAiText(item.title),
        detail: humanizeAiText(item.detail),
      }))
      .slice(0, 5),
    5
  );

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
    5
  );
  const prioritizedSuggestions = prioritizeThemeAlignedSuggestions(
    mergedSuggestions,
    fallback.summary,
    result.summary
  );
  const suggestions = fallback.suggestions[0]
    ? dedupeSuggestions([fallback.suggestions[0], ...prioritizedSuggestions], 5)
    : prioritizedSuggestions;

  const ensuredSummary = ensureStructuredSummary({
    summary: result.summary,
    fallbackSummary: fallback.summary,
    learningContext,
  });
  const summary =
    syncStructuredSummaryWithSuggestions({
      summary: ensuredSummary,
      fallbackSummary: fallback.summary,
      suggestions,
      systemLearning: learningContext?.systemLearning,
    }) || ensuredSummary;
  const safeSummary = containsSuspiciousSummaryArtifacts(summary)
    ? fallback.summary
    : summary;
  const safeSuggestions = suggestions.some((item) =>
    containsSuspiciousSummaryArtifacts(`${item.title} ${item.detail}`)
  )
    ? fallback.suggestions
    : suggestions;

  return {
    summary: safeSummary,
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
  packet: DecisionSupportPacket;
  extracted: ExtractedProductFields;
  learningContext?: LearningContext | null;
  missingDataReport?: MissingDataReport | null;
  baseline?: AiBaselineContext | null;
}) {
  const strategic = buildStrategicSections(params);
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
      5
    ),
    strategic.summary,
    params.baseline?.summary ?? null
  );
  const summary =
    syncStructuredSummaryWithSuggestions({
      summary: strategic.summary,
      fallbackSummary: params.baseline?.summary,
      suggestions,
      systemLearning: params.learningContext?.systemLearning,
    }) || strategic.summary;

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
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const prompt = buildPrompt(params);
    const result = await model.generateContent(prompt);
    const text = cleanJsonText(result.response.text());
    const parsed = JSON.parse(text) as unknown;
    const sanitized = sanitizeAiResult(parsed);

    if (!sanitized) {
      return fallback;
    }

    return postProcessAiResult(
      sanitized,
      params.extracted,
      fallback,
      params.eligibility,
      params.learningContext
    );
  } catch (err) {
    console.error("AI analysis error:", err);
    return buildDeterministicFallback(params);
  }
}
