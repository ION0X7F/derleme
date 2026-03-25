import { buildAnalysisTrace } from "@/lib/analysis-trace";
import { buildAnalysisVisuals } from "@/lib/analysis-visuals";
import { buildTrendyolScorecard } from "@/lib/trendyol-scorecard";
import type {
  AccessPlan,
  AnalysisSuggestion,
  BuildAnalysisResult,
  ConsolidatedAnalysisInput,
  DecisionSupportPacket,
  DerivedMetric,
  DerivedMetrics,
  ExtractedProductFields,
  MarketComparisonInsights,
  MarketOverviewSummary,
  NormalizedFieldMetadata,
  PriorityAction,
} from "@/types/analysis";

const SCORING_CONFIG = {
  thresholds: {
    strong: 75,
    medium: 45,
  },
  weights: {
    seo: 0.35,
    completeness: 0.35,
    conversion: 0.3,
  },
} as const;

type BuildAnalysisParams = {
  platform: string | null;
  url: string;
  consolidatedInput: ConsolidatedAnalysisInput;
  extracted: ExtractedProductFields;
  planContext?: AccessPlan;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
}

function hasPresentValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return hasText(value);
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function getNormalizedMetadataWeight(metadata?: NormalizedFieldMetadata) {
  if (!metadata) return 0.4;

  const sourceWeight =
    metadata.source === "runtime_xhr"
      ? 0.94
      : metadata.source === "embedded_json"
      ? 0.9
      : metadata.source === "html"
      ? 0.78
      : metadata.source === "keyword_search"
      ? 0.5
      : metadata.source === "derived_from_similar_products"
      ? 0.48
      : metadata.source === "parser_inference"
      ? 0.56
      : 0;

  const confidenceWeight =
    metadata.confidence === "high"
      ? 0.95
      : metadata.confidence === "medium"
      ? 0.75
      : metadata.confidence === "low"
      ? 0.5
      : 0;

  const fallbackPenalty =
    (metadata.fallbackChain?.length ?? 0) > 2
      ? Math.max(0, ((metadata.fallbackChain?.length ?? 0) - 2) * 0.06)
      : 0;
  const derivationPenalty = metadata.derivedFrom?.length ? 0.04 : 0;

  return Math.max(
    0,
    Math.min(1, Math.min(sourceWeight, confidenceWeight) - fallbackPenalty - derivationPenalty)
  );
}

function getRawFieldTrustWeight(
  input: ConsolidatedAnalysisInput,
  fieldName: keyof ExtractedProductFields
) {
  return getNormalizedMetadataWeight(input._fieldMetadata?.[fieldName]);
}

function getWeightedRawPresenceScore(
  input: ConsolidatedAnalysisInput,
  fieldName: keyof ExtractedProductFields,
  value: unknown,
  baseScore: number
) {
  if (!hasPresentValue(value)) return 0;
  return baseScore * getRawFieldTrustWeight(input, fieldName);
}

function getMetaDescriptionSourceWeight(extracted: ExtractedProductFields) {
  if (!hasText(extracted.meta_description)) return 0;

  switch (extracted.meta_description_source) {
    case "meta_description":
    case "og_description":
    case "twitter_description":
    case "itemprop_description":
      return 1;
    case "jsonld_description":
    case "itemprop_text":
      return 0.7;
    case "visible_description_fallback":
      return 0.4;
    default:
      return 0;
  }
}

function getWeightedMetaDescriptionScore(
  extracted: ExtractedProductFields,
  baseScore: number
) {
  return baseScore * getMetaDescriptionSourceWeight(extracted);
}

function getHeadingSourceWeight(extracted: ExtractedProductFields) {
  if (!hasText(extracted.h1)) return 0;

  switch (extracted.heading_source) {
    case "raw_h1":
    case "itemprop_name":
    case "visible_product_title":
    case "visible_product_name":
    case "jsonld_name":
      return 1;
    case "og_title":
    case "twitter_title":
      return 0.7;
    case "html_title":
      return 0.4;
    default:
      return 0;
  }
}

function getWeightedHeadingScore(
  extracted: ExtractedProductFields,
  baseScore: number
) {
  return baseScore * getHeadingSourceWeight(extracted);
}

function getMetaDescriptionEvidence(extracted: ExtractedProductFields) {
  switch (extracted.meta_description_source) {
    case "meta_description":
    case "og_description":
    case "twitter_description":
    case "itemprop_description":
      return "Meta açıklaması güçlü kaynaklardan doğrulandı.";
    case "jsonld_description":
    case "itemprop_text":
      return "Meta açıklaması sayfa içi yapısal kaynaktan türetildi.";
    case "visible_description_fallback":
      return "Meta açıklaması görünür açıklamadan yedek olarak üretildi.";
    default:
      return null;
  }
}

function getHeadingEvidence(extracted: ExtractedProductFields) {
  switch (extracted.heading_source) {
    case "raw_h1":
      return "Ana baslik dogrudan H1 etiketinden dogrulandi.";
    case "itemprop_name":
    case "visible_product_title":
    case "visible_product_name":
    case "jsonld_name":
      return "Ana baslik sayfa ici guclu kaynaklardan cozuldu.";
    case "og_title":
    case "twitter_title":
      return "Ana baslik sosyal meta basligindan tamamlandi.";
    case "html_title":
      return "Ana baslik HTML title alanindan yedek olarak tamamlandi.";
    default:
      return null;
  }
}

function getIdentitySourceWeight(source: string | null | undefined) {
  switch (source) {
    case "jsonld":
    case "state":
    case "spec_table":
      return 1;
    case "labeled_text":
      return 0.7;
    default:
      return 0;
  }
}

function getWeightedIdentityScore(
  value: string | null | undefined,
  source: string | null | undefined,
  baseScore: number
) {
  if (!hasText(value)) return 0;
  return baseScore * getIdentitySourceWeight(source);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getFallbackEvidenceFactor(input: ConsolidatedAnalysisInput) {
  const coreConfidence = average(
    [
      input.title.confidence,
      input.price.confidence,
      input.imageCount.confidence,
      input.descriptionLength.confidence,
      input.reviewCount.confidence,
      input.sellerScore.confidence,
    ].filter((value) => Number.isFinite(value))
  );

  const extractorStatus = input._raw.extractor_status ?? "fallback";
  let extractorFactor = 1;
  if (extractorStatus === "partial") extractorFactor = 0.88;
  if (extractorStatus === "fallback") extractorFactor = 0.74;
  if (extractorStatus === "blocked") extractorFactor = 0.55;

  return Math.max(0.5, Math.min(1, coreConfidence * extractorFactor + 0.15));
}

function hasReliableQuestionSignal(extracted: ExtractedProductFields) {
  const count = extracted.question_count;
  if (typeof count !== "number" || count <= 0) return false;

  const qaSample = Array.isArray(extracted.qa_snippets)
    ? extracted.qa_snippets.length
    : 0;

  return qaSample > 0 || extracted.has_faq === true || count >= 5;
}

function getOtherSellerScoreGap(extracted: ExtractedProductFields) {
  if (
    typeof extracted.seller_score !== "number" ||
    !extracted.other_sellers_summary ||
    typeof extracted.other_sellers_summary.avg_score !== "number"
  ) {
    return null;
  }

  return Number(
    (extracted.other_sellers_summary.avg_score - extracted.seller_score).toFixed(1)
  );
}

function getCompetitorPriceDelta(extracted: ExtractedProductFields) {
  if (
    typeof extracted.normalized_price !== "number" ||
    !extracted.other_sellers_summary ||
    typeof extracted.other_sellers_summary.min_price !== "number"
  ) {
    return null;
  }

  return Number(
    (extracted.normalized_price - extracted.other_sellers_summary.min_price).toFixed(2)
  );
}

function isCheapestOffer(extracted: ExtractedProductFields) {
  return (
    typeof extracted.normalized_price === "number" &&
    !!extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number" &&
    extracted.other_sellers_summary.cheaper_count === 0
  );
}

function formatPriceNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} TL`;
}

const REVIEW_THEME_DICTIONARY = {
  positive: [
    ["kaliteli", "kalite", "dayanikli"],
    ["hizli kargo", "hizli teslimat", "hemen geldi", "cok hizli"],
    ["paketleme", "guzel paketlenmis", "iyi paketlenmis"],
    ["orijinal", "gercek urun"],
    ["fiyat performans", "fp urunu", "uygun fiyat"],
    ["memnun", "begendim", "tavsiye ederim", "harika"],
  ],
  negative: [
    ["kalitesiz", "kalite dusuk", "cok kotu"],
    ["kirilmis", "hasarli", "bozuk", "arizali"],
    ["gec geldi", "kargo gec", "teslimat gecikti"],
    ["paketleme kotu", "kotu paketleme"],
    ["eksik urun", "parca eksik"],
    ["orijinal degil", "sahte", "cakma"],
    ["iade", "geri gonderdim"],
  ],
} as const;

const QA_THEME_DICTIONARY = [
  ["uyumluluk", "uyumlu", "uyar mi", "olur mu", "compatible"],
  ["garanti", "garantili", "servis", "resmi distributor"],
  ["orijinallik", "orijinal", "sahte mi", "gercek urun"],
  ["kargo", "ne zaman gelir", "teslimat", "kac gunde", "hizli teslimat"],
  ["stok", "stokta var mi", "yeniden gelir mi"],
  ["iade", "iade edilir mi", "degisim", "geri gonderim"],
  ["beden", "olcu", "kalip"],
  ["icerik", "kutuda ne var", "icinden ne cikiyor"],
] as const;

function extractReviewThemes(extracted: ExtractedProductFields) {
  if (!Array.isArray(extracted.review_snippets) || extracted.review_snippets.length === 0) {
    return null;
  }

  const texts = extracted.review_snippets
    .map((item) => item.text?.toLocaleLowerCase("tr-TR") || "")
    .filter(Boolean);

  if (texts.length === 0) return null;

  const collect = (groups: readonly (readonly string[])[]) =>
    groups
      .map((group) => ({
        label: group[0],
        count: texts.reduce(
          (sum, text) => sum + (group.some((token) => text.includes(token)) ? 1 : 0),
          0
        ),
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((item) => item.label)
      .slice(0, 3);

  const positive = collect(REVIEW_THEME_DICTIONARY.positive);
  const negative = collect(REVIEW_THEME_DICTIONARY.negative);

  if (positive.length === 0 && negative.length === 0) {
    return null;
  }

  return { positive, negative };
}

function getReviewThemeHits(extracted: ExtractedProductFields) {
  if (!Array.isArray(extracted.review_snippets) || extracted.review_snippets.length === 0) {
    return { positive: null, negative: null };
  }

  const texts = extracted.review_snippets
    .map((item) => item.text?.toLocaleLowerCase("tr-TR") || "")
    .filter(Boolean);

  if (texts.length === 0) {
    return { positive: null, negative: null };
  }

  const collect = (groups: readonly (readonly string[])[]) =>
    groups
      .map((group) => ({
        label: group[0],
        count: texts.reduce(
          (sum, text) => sum + (group.some((token) => text.includes(token)) ? 1 : 0),
          0
        ),
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

  const positive = collect(REVIEW_THEME_DICTIONARY.positive);
  const negative = collect(REVIEW_THEME_DICTIONARY.negative);

  return {
    positive: positive.length > 0 ? positive : null,
    negative: negative.length > 0 ? negative : null,
  };
}

function getLowRatedSampleRatio(extracted: ExtractedProductFields) {
  if (
    !extracted.review_summary ||
    extracted.review_summary.sampled_count <= 0 ||
    extracted.review_summary.low_rated_count < 0
  ) {
    return null;
  }

  return Number(
    (
      extracted.review_summary.low_rated_count / extracted.review_summary.sampled_count
    ).toFixed(2)
  );
}

function getReviewRiskSummary(extracted: ExtractedProductFields): string | null {
  const themes = extractReviewThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);

  if (!themes && lowRatedRatio == null) return null;

  if (lowRatedRatio != null && lowRatedRatio >= 0.5 && themes?.negative?.length) {
    return `Yüksek yorum riski: Hem düşük puanlı yorumların oranı yüksek hem de yorumlarda tekrar eden şikayetler (${themes.negative.join(
      ", "
    )}) mevcut.`;
  }

  if (lowRatedRatio != null && lowRatedRatio >= 0.4) {
    return "Yorum riski: Düşük puanlı yorumların yoğunluğu, müşteri memnuniyetinde bir soruna işaret ediyor olabilir.";
  }

  if (themes?.negative?.length) {
    return `Tekrarlayan şikayetler: Yorumlarda ${themes.negative.join(
      ", "
    )} gibi konulara odaklanan olumsuz geri bildirimler var.`;
  }

  if (themes?.positive?.length) {
    return `Olumlu sinyaller: Yorumlarda ${themes.positive.join(
      ", "
    )} gibi konularda memnuniyet öne çıkıyor.`;
  }

  return null;
}

function extractQaThemes(extracted: ExtractedProductFields) {
  if (!Array.isArray(extracted.qa_snippets) || extracted.qa_snippets.length === 0) {
    return null;
  }

  const texts = extracted.qa_snippets
    .flatMap((item) => [item.question, item.answer])
    .map((item) => item?.toLocaleLowerCase("tr-TR") || "")
    .filter(Boolean);

  if (texts.length === 0) return null;

  const hits = QA_THEME_DICTIONARY.map((group) => ({
    label: group[0],
    count: texts.reduce(
      (sum, text) => sum + (group.some((token) => text.includes(token)) ? 1 : 0),
      0
    ),
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return hits.length > 0 ? hits : null;
}

function hasStrongCompetitorTrust(extracted: ExtractedProductFields) {
  return (
    !!extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.avg_score === "number" &&
    extracted.other_sellers_summary.avg_score >= 8.5
  );
}

function hasStrongCompetitorDelivery(extracted: ExtractedProductFields) {
  return (
    !!extracted.other_sellers_summary &&
    extracted.other_sellers_summary.fast_delivery_count >= 2
  );
}

function formatDeliveryType(value: string | null | undefined) {
  switch (value) {
    case "same_day":
      return "Aynı Gün Teslimat";
    case "next_day":
      return "Ertesi Gün Teslimat";
    case "fast_delivery":
      return "Hızlı Teslimat";
    case "standard":
      return "Standart Teslimat";
    default:
      return value;
  }
}

function metricLabel(score: number | null): DerivedMetric["label"] {
  if (score == null) return "not_enough_data";
  if (score >= SCORING_CONFIG.thresholds.strong) return "strong";
  if (score >= SCORING_CONFIG.thresholds.medium) return "medium";
  return "weak";
}

function buildMetric(score: number | null, evidence: string[]): DerivedMetric {
  return {
    score,
    label: metricLabel(score),
    evidence: evidence.slice(0, 4),
  };
}

function getCompletenessScore(input: ConsolidatedAnalysisInput) {
  let score = 0;
  const extracted = input._raw; // for fields not yet in ConsolidatedAnalysisInput
  const fallbackEvidenceFactor = getFallbackEvidenceFactor(input);

  score += hasText(input.title.value) ? 8 * input.title.confidence : 0;
  score += hasText(input.brand.value) ? 8 * input.brand.confidence : 0;
  score += hasText(input.productName.value)
    ? 10 * input.productName.confidence
    : 0;
  score += hasText(input.modelCode.value) ? 4 * input.modelCode.confidence : 0;
  score +=
    typeof input.price.value === "number" ? 10 * input.price.confidence : 0;
  score +=
    (input.imageCount.value || 0) >= 1 ? 6 * input.imageCount.confidence : 0;
  score +=
    (input.imageCount.value || 0) >= 4 ? 4 * input.imageCount.confidence : 0;
  score +=
    typeof input.ratingValue.value === "number"
      ? 5 * input.ratingValue.confidence
      : 0;
  score +=
    typeof input.reviewCount.value === "number"
      ? 5 * input.reviewCount.confidence
      : 0;
  score +=
    (input.descriptionLength.value || 0) >= 120
      ? 4 * input.descriptionLength.confidence
      : 0;
  score +=
    (input.descriptionLength.value || 0) >= 300
      ? 4 * input.descriptionLength.confidence
      : 0;
  score +=
    (input.bulletPointCount.value || 0) >= 3
      ? 2 * input.bulletPointCount.confidence
      : 0;
  score +=
    input.hasFreeShipping.value === true
      ? 2 * input.hasFreeShipping.confidence
      : 0;
  score += hasText(input.sellerName.value)
    ? 4 * input.sellerName.confidence
    : 0;

  // Fields still using raw extracted data
  score +=
    getWeightedMetaDescriptionScore(extracted, 6) * fallbackEvidenceFactor;
  score += getWeightedHeadingScore(extracted, 6) * fallbackEvidenceFactor;
  score +=
    getWeightedIdentityScore(
      extracted.sku,
      extracted.sku_source,
      4
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedIdentityScore(
      extracted.mpn,
      extracted.mpn_source,
      4
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedIdentityScore(
      extracted.gtin,
      extracted.gtin_source,
      5
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(
      input,
      "question_count",
      hasReliableQuestionSignal(extracted) ? extracted.question_count ?? 1 : null,
      2
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(
      input,
      "favorite_count",
      extracted.favorite_count,
      2
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(
      input,
      "has_add_to_cart",
      extracted.has_add_to_cart,
      5
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(
      input,
      "has_shipping_info",
      extracted.has_shipping_info,
      4
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(
      input,
      "has_return_info",
      extracted.has_return_info,
      4
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(input, "has_specs", extracted.has_specs, 6) *
    fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(input, "has_faq", extracted.has_faq, 2) *
    fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(input, "has_video", extracted.has_video, 2) *
    fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(
      input,
      "other_seller_offers",
      extracted.other_seller_offers,
      4
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(
      input,
      "stock_status",
      extracted.stock_status,
      2
    ) * fallbackEvidenceFactor;
  if (extracted.extractor_status === "ok") score += 5;
  if (extracted.extractor_status === "partial") score += 2;
  if (extracted.extractor_status === "blocked") score -= 8;

  return clampScore(score);
}

function getSeoScore(input: ConsolidatedAnalysisInput) {
  let score = 0;
  const extracted = input._raw; // for fields not yet in ConsolidatedAnalysisInput
  const fallbackEvidenceFactor = getFallbackEvidenceFactor(input);

  score += hasText(input.title.value) ? 25 * input.title.confidence : 0;
  score += hasText(input.brand.value) ? 10 * input.brand.confidence : 0;
  score += hasText(input.productName.value)
    ? 10 * input.productName.confidence
    : 0;
  score += hasText(input.modelCode.value) ? 5 * input.modelCode.confidence : 0;
  score +=
    (input.imageCount.value || 0) >= 3 ? 10 * input.imageCount.confidence : 0;
  score +=
    (input.descriptionLength.value || 0) >= 120
      ? 5 * input.descriptionLength.confidence
      : 0;

  // Fields still using raw extracted data during transition
  score +=
    getWeightedMetaDescriptionScore(extracted, 15) * fallbackEvidenceFactor;
  score += getWeightedHeadingScore(extracted, 15) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(input, "has_specs", extracted.has_specs, 5) *
    fallbackEvidenceFactor;

  return clampScore(score);
}

function getConversionScore(input: ConsolidatedAnalysisInput) {
  let score = 0;
  const extracted = input._raw; // for complex logic not yet refactored
  const reviewThemes = extractReviewThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);
  const sampledReviewCount = extracted.review_summary?.sampled_count ?? 0;
  const fallbackEvidenceFactor = getFallbackEvidenceFactor(input);

  score +=
    typeof input.price.value === "number" ? 15 * input.price.confidence : 0;
  score +=
    (input.imageCount.value || 0) >= 3 ? 10 * input.imageCount.confidence : 0;
  score +=
    (input.descriptionLength.value || 0) >= 120
      ? 10 * input.descriptionLength.confidence
      : 0;
  score +=
    typeof input.ratingValue.value === "number"
      ? 10 * input.ratingValue.confidence
      : 0;
  score +=
    (input.reviewCount.value || 0) > 0
      ? 10 * input.reviewCount.confidence
      : 0;
  score +=
    input.hasFreeShipping.value === true
      ? 5 * input.hasFreeShipping.confidence
      : 0;

  // Logic still dependent on old structure
  score +=
    getWeightedRawPresenceScore(
      input,
      "has_add_to_cart",
      extracted.has_add_to_cart,
      20
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(
      input,
      "favorite_count",
      extracted.favorite_count && extracted.favorite_count > 0
        ? extracted.favorite_count
        : null,
      5
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(
      input,
      "has_shipping_info",
      extracted.has_shipping_info,
      10
    ) * fallbackEvidenceFactor;
  score +=
    getWeightedRawPresenceScore(
      input,
      "has_return_info",
      extracted.has_return_info,
      10
    ) * fallbackEvidenceFactor;

  if (lowRatedRatio != null) {
    if (lowRatedRatio >= 0.5) {
      score -= 15;
    } else if (lowRatedRatio >= 0.4) {
      score -= 10;
    } else if (lowRatedRatio <= 0.2 && sampledReviewCount >= 3) {
      score += 4;
    }
  }

  if (reviewThemes?.negative?.length) {
    score -= Math.min(10, reviewThemes.negative.length * 3);
  }

  if (reviewThemes?.positive?.length && !reviewThemes?.negative?.length) {
    score += Math.min(6, reviewThemes.positive.length * 2);
  }

  return clampScore(score);
}

function buildProductQualityMetric(
  extracted: ExtractedProductFields,
  input: ConsolidatedAnalysisInput
): DerivedMetric {
  let score = 0;
  const evidence: string[] = [];

  const headingScore = getWeightedHeadingScore(extracted, 20);
  // Content quality elements
  if (hasText(extracted.title) && headingScore > 0) {
    score += 20;
    evidence.push("Başlık ve H1 etiketleri mevcut.");
  } else if (hasText(extracted.title) || headingScore > 0) {
    score += 10;
    evidence.push("Sayfa başlıklarından biri eksik.");
  }

  const headingEvidence = getHeadingEvidence(extracted);
  if (headingEvidence) {
    evidence.push(headingEvidence);
  }

  const metaDescriptionScore = getWeightedMetaDescriptionScore(extracted, 12);
  if (metaDescriptionScore > 0) {
    score += metaDescriptionScore;
    const metaDescriptionEvidence = getMetaDescriptionEvidence(extracted);
    if (metaDescriptionEvidence) {
      evidence.push(metaDescriptionEvidence);
    }
  }

  if ((extracted.description_length || 0) >= 300) {
    score += 20;
    evidence.push("Açıklama metni uzun ve detaylı.");
  } else if ((extracted.description_length || 0) >= 120) {
    score += 10;
    evidence.push("Açıklama metni yeterli uzunlukta.");
  }

  if ((extracted.bullet_point_count || 0) >= 3) {
    score += 8;
    evidence.push("Maddeli anlatım (bullet points) kullanılıyor.");
  }

  if (extracted.has_specs) {
    score += getWeightedRawPresenceScore(input, "has_specs", extracted.has_specs, 12);
    evidence.push("Teknik özellikler tablosu bulunuyor.");
  }

  if (hasText(extracted.brand) && hasText(extracted.model_code)) {
    score += 4;
    evidence.push("Marka ve model kodu bilgisi ayrıştırılmış.");
  }

  // Visual strength elements
  if ((extracted.image_count || 0) >= 6) {
    score += 40;
    evidence.push("Görsel sayısı (6+) zengin.");
  } else if ((extracted.image_count || 0) >= 3) {
    score += 25;
    evidence.push("Yeterli sayıda (3+) ürün görseli mevcut.");
  } else if ((extracted.image_count || 0) > 0) {
    score += 10;
    evidence.push("Görsel sayısı (1-2) sınırlı.");
  }

  if (extracted.has_video) {
    score += getWeightedRawPresenceScore(input, "has_video", extracted.has_video, 20);
    evidence.push("Ürün videosu mevcut.");
  }

  if (typeof extracted.variant_count === "number" && extracted.variant_count >= 2) {
    score += 8;
    evidence.push("Ürün varyantları (renk/beden vb.) bulunuyor.");
  }

  // Decision clarity elements
  if (extracted.has_faq) {
    score += getWeightedRawPresenceScore(input, "has_faq", extracted.has_faq, 8);
    evidence.push("Sıkça Sorulan Sorular (SSS) bölümü mevcut.");
  }

  if (hasReliableQuestionSignal(extracted)) {
    score += getWeightedRawPresenceScore(
      input,
      "question_count",
      extracted.question_count ?? 1,
      8
    );
    evidence.push("Soru-Cevap bölümü aktif.");
  }

  if (typeof extracted.shipping_days === "number") {
    score += getWeightedRawPresenceScore(
      input,
      "shipping_days",
      extracted.shipping_days,
      8
    );
    evidence.push("Teslimat süresi belirtilmiş.");
  }

  if (extracted.has_return_info) {
    score += getWeightedRawPresenceScore(
      input,
      "has_return_info",
      extracted.has_return_info,
      8
    );
    evidence.push("İade politikası bilgisi mevcut.");
  }

  return buildMetric(clampScore(score), evidence);
}

function buildSellerTrustMetric(
  extracted: ExtractedProductFields,
  input: ConsolidatedAnalysisInput
): DerivedMetric {
  let score = 70; // Start from neutral for review risk
  const evidence: string[] = [];
  const reviewThemes = extractReviewThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);
  const sampledReviewCount = extracted.review_summary?.sampled_count ?? 0;

  // Trust strength elements
  if (
    typeof extracted.rating_value === "number" &&
    extracted.rating_value >= 4.3 &&
    (extracted.review_count || 0) >= 20
  ) {
    score += 20;
    evidence.push("Puan ve yorum hacmi güven algısını destekliyor.");
  } else if (
    typeof extracted.rating_value === "number" &&
    typeof extracted.review_count === "number"
  ) {
    score += 10;
    evidence.push("Temel sosyal kanıt (puan/yorum) verisi mevcut.");
  }

  if (hasText(extracted.seller_name)) {
    score += getWeightedRawPresenceScore(input, "seller_name", extracted.seller_name, 8);
    evidence.push("Satıcı bilgisi görünür durumda.");
  }

  if (Array.isArray(extracted.seller_badges) && extracted.seller_badges.length > 0) {
    score += getWeightedRawPresenceScore(
      input,
      "seller_badges",
      extracted.seller_badges,
      6
    );
    evidence.push(`Satıcı rozetleri mevcut: ${extracted.seller_badges.join(", ")}.`);
  }

  if (typeof extracted.seller_score === "number") {
    if (extracted.seller_score >= 8.5) {
      score += 8;
      evidence.push("Satıcı puanı güçlü.");
    } else if (extracted.seller_score >= 7.5) {
      score += 4;
      evidence.push("Satıcı puanı orta seviyede.");
    } else {
      score -= 6;
      evidence.push("Satıcı puanı güven konusunda risk oluşturabilir.");
    }
  }

  if (typeof extracted.follower_count === "number") {
    score += extracted.follower_count >= 10000 ? 6 : extracted.follower_count >= 1000 ? 3 : 1;
    evidence.push("Mağaza takipçi verisi mevcut.");
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 4 &&
    typeof extracted.seller_score === "number" &&
    extracted.seller_score > 0 &&
    extracted.seller_score < 7.5
  ) {
    score -= 6;
    evidence.push("Yüksek rekabette satıcı güven sinyali zayıf kalabilir.");
  }

  if (
    typeof getOtherSellerScoreGap(extracted) === "number" &&
    (getOtherSellerScoreGap(extracted) as number) >= 0.5
  ) {
    score -= 6;
    evidence.push("Diğer satıcıların güven seviyesi daha güçlü olabilir.");
  }

  if (hasReliableQuestionSignal(extracted) && (extracted.question_count ?? 0) >= 5) {
    score += getWeightedRawPresenceScore(
      input,
      "question_count",
      extracted.question_count ?? 5,
      8
    );
    evidence.push("Soru-cevap hacmi güven sinyali oluşturuyor.");
  } else if (hasReliableQuestionSignal(extracted)) {
    score += getWeightedRawPresenceScore(
      input,
      "question_count",
      extracted.question_count ?? 1,
      4
    );
    evidence.push("Temel soru-cevap sinyali mevcut.");
  }

  if (extracted.official_seller) {
    score += getWeightedRawPresenceScore(
      input,
      "official_seller",
      extracted.official_seller,
      8
    );
    evidence.push("Resmi satıcı sinyali mevcut.");
  }

  if (extracted.has_brand_page) {
    score += getWeightedRawPresenceScore(
      input,
      "has_brand_page",
      extracted.has_brand_page,
      8
    );
    evidence.push("Marka sayfası sinyali mevcut.");
  }

  if (extracted.has_return_info) {
    score += getWeightedRawPresenceScore(
      input,
      "has_return_info",
      extracted.has_return_info,
      12
    );
    evidence.push("İade bilgisi görünür durumda.");
  }

  if (extracted.has_shipping_info) {
    score += getWeightedRawPresenceScore(
      input,
      "has_shipping_info",
      extracted.has_shipping_info,
      8
    );
    evidence.push("Kargo bilgisi görünür durumda.");
  }

  if (hasText(extracted.stock_status)) {
    score += getWeightedRawPresenceScore(
      input,
      "stock_status",
      extracted.stock_status,
      4
    );
    evidence.push("Stok durumu belirtilmiş.");
  }

  // Review risk elements (negative impact)
  if (lowRatedRatio != null) {
    if (lowRatedRatio >= 0.5) {
      score -= 25;
      evidence.push("Düşük yıldızlı yorum oranı güven konusunda risk oluşturuyor.");
    } else if (lowRatedRatio >= 0.4) {
      score -= 15;
      evidence.push("Yorumlardaki düşük yıldız yoğunluğu güven algısını zayıflatabilir.");
    } else if (lowRatedRatio <= 0.2 && sampledReviewCount >= 3) {
      score += 8;
      evidence.push("Örnek yorumlarda düşük yıldızlı geri bildirim oranı sınırlı.");
    }
  }

  if (reviewThemes?.negative?.length) {
    score -= Math.min(15, reviewThemes.negative.length * 5);
    evidence.push(`Yorumlarda tekrar eden şikayetler var: ${reviewThemes.negative.join(", ")}.`);
  } else if (reviewThemes?.positive?.length) {
    score += Math.min(10, reviewThemes.positive.length * 3);
    evidence.push(`Yorumlarda olumlu temalar öne çıkıyor: ${reviewThemes.positive.join(", ")}.`);
  }

  return buildMetric(clampScore(score), evidence);
}

function buildMarketPositionMetric(
  extracted: ExtractedProductFields,
  input: ConsolidatedAnalysisInput
): DerivedMetric {
  let score = 0;
  const evidence: string[] = [];

  if (typeof extracted.normalized_price === "number") {
    score += 25;
    evidence.push("Fiyat verisi mevcut.");
  }

  if (
    typeof extracted.original_price === "number" &&
    typeof extracted.discount_rate === "number"
  ) {
    score += 25;
    evidence.push("İndirim sinyali hesaplanabiliyor.");
  }

  if (extracted.has_free_shipping) {
    score += getWeightedRawPresenceScore(
      input,
      "has_free_shipping",
      extracted.has_free_shipping,
      20
    );
    evidence.push("Ücretsiz kargo avantajı sunuluyor.");
  }

  if (isCheapestOffer(extracted) && extracted.other_sellers_summary?.count) {
    score += 25;
    evidence.push("Rakip satıcılar içinde en düşük fiyata sahip.");
  } else if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number" &&
    extracted.other_sellers_summary.cheaper_count > 0
  ) {
    score -= Math.min(20, extracted.other_sellers_summary.cheaper_count * 6);
    evidence.push(
      `${extracted.other_sellers_summary.cheaper_count} rakip satıcı daha düşük fiyat sunuyor.`
    );
  }

  if (extracted.has_campaign) {
    score += getWeightedRawPresenceScore(
      input,
      "has_campaign",
      extracted.has_campaign,
      10
    );
    evidence.push(
      extracted.campaign_label
        ? `Kampanya sinyali mevcut: ${extracted.campaign_label}.`
        : "Kampanya veya kupon sinyali mevcut."
    );
  }

  if (
    Array.isArray(extracted.seller_badges) &&
    extracted.seller_badges.some((badge) => /hizli teslimat/i.test(badge))
  ) {
    score += getWeightedRawPresenceScore(
      input,
      "seller_badges",
      extracted.seller_badges,
      10
    );
    evidence.push("Hızlı teslimat rozeti teklif gücünü destekliyor.");
  }

  if (typeof extracted.shipping_days === "number") {
    if (extracted.shipping_days <= 3) {
      score += getWeightedRawPresenceScore(
        input,
        "shipping_days",
        extracted.shipping_days,
        20
      );
      evidence.push("Teslim süresi hızlı görünüyor.");
    } else if (extracted.shipping_days <= 5) {
      score += getWeightedRawPresenceScore(
        input,
        "shipping_days",
        extracted.shipping_days,
        10
      );
      evidence.push("Teslim süresi makul seviyede.");
    } else {
      evidence.push("Teslim süresi uzun olabilir.");
    }
  }

  if (typeof extracted.variant_count === "number" && extracted.variant_count >= 2) {
    score += 10;
    evidence.push("Teklif, varyant seçeneğiyle zenginleştirilmiş.");
  }

  if (typeof extracted.other_sellers_count === "number") {
    if (extracted.other_sellers_count >= 4) {
      if (!extracted.has_free_shipping && typeof extracted.discount_rate !== "number") {
        score -= 10;
      }
      evidence.push("Aynı üründe rekabet baskısı yüksek.");
    } else if (extracted.other_sellers_count >= 2) {
      if (!extracted.has_free_shipping && typeof extracted.discount_rate !== "number") {
        score -= 5;
      }
      evidence.push("Aynı üründe birden fazla satıcı bulunuyor.");
    }
  }

  if (
    hasStrongCompetitorDelivery(extracted) &&
    extracted.has_free_shipping !== true &&
    (!hasText(extracted.delivery_type) || extracted.delivery_type === "standard")
  ) {
    score -= 8;
    evidence.push("Rakiplerin teslimat avantajı daha güçlü olabilir.");
  }

  if (hasText(extracted.delivery_type)) {
    score += getWeightedRawPresenceScore(
      input,
      "delivery_type",
      extracted.delivery_type,
      5
    );
    evidence.push(
      `${formatDeliveryType(extracted.delivery_type) || "Teslimat tipi"} belirtilmiş.`
    );
  }

  return buildMetric(clampScore(score), evidence);
}




function buildDerivedMetrics(
  extracted: ExtractedProductFields,
  input: ConsolidatedAnalysisInput
): DerivedMetrics {
  return {
    productQuality: buildProductQualityMetric(extracted, input),
    sellerTrust: buildSellerTrustMetric(extracted, input),
    marketPosition: buildMarketPositionMetric(extracted, input),
  };
}

function getAvailableFields(extracted: ExtractedProductFields) {
  const checks: Array<[string, boolean]> = [
    ["title", hasText(extracted.title)],
    ["h1", hasText(extracted.h1)],
    ["meta_description", hasText(extracted.meta_description)],
    ["brand", hasText(extracted.brand)],
    ["product_name", hasText(extracted.product_name)],
    ["model_code", hasText(extracted.model_code)],
    ["normalized_price", typeof extracted.normalized_price === "number"],
    ["original_price", typeof extracted.original_price === "number"],
    ["discount_rate", typeof extracted.discount_rate === "number"],
    ["image_count", extracted.image_count > 0],
    ["has_video", typeof extracted.has_video === "boolean"],
    ["rating_value", typeof extracted.rating_value === "number"],
    ["rating_breakdown", !!extracted.rating_breakdown],
    ["review_count", typeof extracted.review_count === "number"],
    [
      "review_snippets",
      Array.isArray(extracted.review_snippets) && extracted.review_snippets.length > 0,
    ],
    ["review_summary", !!extracted.review_summary],
    ["question_count", hasReliableQuestionSignal(extracted)],
    ["description_length", typeof extracted.description_length === "number"],
    ["bullet_point_count", typeof extracted.bullet_point_count === "number"],
    ["has_shipping_info", typeof extracted.has_shipping_info === "boolean"],
    ["has_free_shipping", typeof extracted.has_free_shipping === "boolean"],
    ["shipping_days", typeof extracted.shipping_days === "number"],
    ["has_return_info", typeof extracted.has_return_info === "boolean"],
    ["has_specs", typeof extracted.has_specs === "boolean"],
    ["has_faq", typeof extracted.has_faq === "boolean"],
    ["variant_count", typeof extracted.variant_count === "number"],
    ["stock_quantity", typeof extracted.stock_quantity === "number"],
    ["stock_status", hasText(extracted.stock_status)],
    ["seller_name", hasText(extracted.seller_name)],
    ["merchant_id", typeof extracted.merchant_id === "number"],
    ["listing_id", hasText(extracted.listing_id)],
    ["seller_badges", Array.isArray(extracted.seller_badges) && extracted.seller_badges.length > 0],
    ["seller_score", typeof extracted.seller_score === "number"],
    ["follower_count", typeof extracted.follower_count === "number"],
    ["favorite_count", typeof extracted.favorite_count === "number"],
    ["other_sellers_count", typeof extracted.other_sellers_count === "number"],
    [
      "other_seller_offers",
      Array.isArray(extracted.other_seller_offers) && extracted.other_seller_offers.length > 0,
    ],
    ["other_sellers_summary", !!extracted.other_sellers_summary],
    ["has_brand_page", typeof extracted.has_brand_page === "boolean"],
    ["official_seller", typeof extracted.official_seller === "boolean"],
    ["has_campaign", typeof extracted.has_campaign === "boolean"],
    ["campaign_label", hasText(extracted.campaign_label)],
    [
      "promotion_labels",
      Array.isArray(extracted.promotion_labels) && extracted.promotion_labels.length > 0,
    ],
    ["delivery_type", hasText(extracted.delivery_type)],
    ["is_best_seller", extracted.is_best_seller === true],
    ["best_seller_rank", typeof extracted.best_seller_rank === "number"],
    ["best_seller_badge", hasText(extracted.best_seller_badge)],
  ];

  return {
    availableFields: checks.filter(([, ok]) => ok).map(([name]) => name),
    missingFields: checks.filter(([, ok]) => !ok).map(([name]) => name),
  };
}

function buildCoverage(extracted: ExtractedProductFields) {
  const { availableFields, missingFields } = getAvailableFields(extracted);
  const total = availableFields.length + missingFields.length;
  const ratio = total === 0 ? 0 : availableFields.length / total;
  const criticalFields = [
    hasText(extracted.title),
    hasText(extracted.h1),
    typeof extracted.normalized_price === "number",
    extracted.image_count > 0,
    typeof extracted.rating_value === "number",
    typeof extracted.review_count === "number",
    typeof extracted.description_length === "number",
    typeof extracted.has_specs === "boolean",
  ];
  const criticalAvailable = criticalFields.filter(Boolean).length;

  let confidence: "high" | "medium" | "low" =
    ratio >= 0.75 ? "high" : ratio >= 0.45 ? "medium" : "low";

  if (criticalAvailable <= 4 && confidence === "high") {
    confidence = "medium";
  }

  if (
    (extracted.extractor_status === "partial" || extracted.extractor_status === "blocked") &&
    confidence === "high"
  ) {
    confidence = "medium";
  }

  if (extracted.extractor_status === "blocked") {
    confidence = "low";
  }

  return {
    availableFields,
    missingFields,
    confidence,
  } as const;
}

function buildDecisionSupportPacket(params: {
  extracted: ExtractedProductFields;
  planContext: AccessPlan;
  derivedMetrics: DerivedMetrics;
}): DecisionSupportPacket {
  const { extracted, planContext, derivedMetrics } = params;
  const reviewThemes = extractReviewThemes(extracted);
  const reviewThemeHits = getReviewThemeHits(extracted);

  return {
    platform: "trendyol",
    planContext,
    category: extracted.category,
    raw: {
      title: extracted.title,
      meta_description: extracted.meta_description,
      meta_description_source: extracted.meta_description_source,
      search_snippet_fallback: extracted.search_snippet_fallback,
      h1: extracted.h1,
      raw_h1: extracted.raw_h1 ?? null,
      resolved_primary_heading: extracted.resolved_primary_heading ?? null,
      heading_source: extracted.heading_source ?? null,
      brand: extracted.brand,
      product_name: extracted.product_name,
      model_code: extracted.model_code,
      sku_source: extracted.sku_source ?? null,
      mpn_source: extracted.mpn_source ?? null,
      gtin_source: extracted.gtin_source ?? null,
      price: extracted.price,
      normalized_price: extracted.normalized_price,
      original_price: extracted.original_price,
      discount_rate: extracted.discount_rate,
      currency: extracted.currency,
      image_count: extracted.image_count,
      has_video: extracted.has_video,
      rating_value: extracted.rating_value,
      rating_breakdown: extracted.rating_breakdown,
    review_count: extracted.review_count,
    review_snippets: extracted.review_snippets,
    qa_snippets: extracted.qa_snippets,
    review_summary: extracted.review_summary,
      review_themes: reviewThemes,
      top_positive_review_hits: reviewThemeHits.positive,
      top_negative_review_hits: reviewThemeHits.negative,
      question_count: extracted.question_count,
      description_length: extracted.description_length,
      bullet_point_count: extracted.bullet_point_count,
      has_add_to_cart: extracted.has_add_to_cart,
      has_shipping_info: extracted.has_shipping_info,
      has_free_shipping: extracted.has_free_shipping,
      shipping_days: extracted.shipping_days,
      has_return_info: extracted.has_return_info,
      has_specs: extracted.has_specs,
      has_faq: extracted.has_faq,
      variant_count: extracted.variant_count,
      stock_quantity: extracted.stock_quantity,
      stock_status: extracted.stock_status,
      seller_name: extracted.seller_name,
      merchant_id: extracted.merchant_id,
      listing_id: extracted.listing_id,
      seller_badges: extracted.seller_badges,
      seller_score: extracted.seller_score,
      follower_count: extracted.follower_count,
      favorite_count: extracted.favorite_count,
      other_sellers_count: extracted.other_sellers_count,
      other_seller_offers: extracted.other_seller_offers,
      other_sellers_summary: extracted.other_sellers_summary,
      has_brand_page: extracted.has_brand_page,
      official_seller: extracted.official_seller,
      has_campaign: extracted.has_campaign,
      campaign_label: extracted.campaign_label,
      promotion_labels: extracted.promotion_labels,
      delivery_type: extracted.delivery_type,
      is_best_seller: extracted.is_best_seller,
      best_seller_rank: extracted.best_seller_rank,
      best_seller_badge: extracted.best_seller_badge,
    },
    metrics: derivedMetrics,
    coverage: buildCoverage(extracted),
  };
}

function getStrengths(extracted: ExtractedProductFields, metrics: DerivedMetrics): string[] {
  const strengths: string[] = [];
  const reviewThemes = extractReviewThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);

  if (metrics.productQuality.label === "strong") {
    strengths.push("Güçlü ve detaylı ürün içeriği");
  }

  if (metrics.sellerTrust.label === "strong") {
    strengths.push("Yüksek satıcı güveni ve itibarı");
  }

  if (metrics.marketPosition.label === "strong") {
    strengths.push("Net ve rekabetçi pazar konumu");
  }

  if (isCheapestOffer(extracted) && extracted.other_sellers_summary?.count) {
    strengths.push("Rakipler arasında en iyi fiyata sahip");
  }

  if (extracted.official_seller) {
    strengths.push("Resmi veya yetkili satıcı sinyali");
  }

  if (Array.isArray(extracted.seller_badges) && extracted.seller_badges.length > 0) {
    strengths.push(`Satıcı rozetleri (${extracted.seller_badges.join(", ")})`);
  }

  if (typeof extracted.seller_score === "number" && extracted.seller_score >= 8.5) {
    strengths.push(`Yüksek satıcı puanı (${extracted.seller_score})`);
  }

  if (typeof extracted.follower_count === "number" && extracted.follower_count >= 5000) {
    strengths.push("Yüksek mağaza takipçi sayısı");
  }

  if (hasText(extracted.campaign_label)) {
    strengths.push(`Belirgin kampanya (${extracted.campaign_label})`);
  } else if (extracted.has_campaign) {
    strengths.push("Teklifi güçlendiren kampanya varlığı");
  }

  if (extracted.has_free_shipping) {
    strengths.push("Ücretsiz kargo avantajı");
  }

  if (reviewThemes?.positive.length) {
    strengths.push(`Olumlu yorum temaları (${reviewThemes.positive.join(", ")})`);
  }

  if (
    lowRatedRatio != null &&
    lowRatedRatio <= 0.2 &&
    extracted.review_summary &&
    extracted.review_summary.sampled_count >= 3
  ) {
    strengths.push("Düşük oranda negatif geri bildirim");
  }

  if ((extracted.image_count || 0) >= 5) {
    strengths.push("Zengin ürün görseli sayısı");
  }

  // Remove duplicates and limit
  return [...new Set(strengths)].slice(0, 5);
}

function getWeaknesses(extracted: ExtractedProductFields, metrics: DerivedMetrics): string[] {
  const weaknesses: string[] = [];
  const reviewThemes = extractReviewThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);

  if (metrics.productQuality.label === "weak") {
    weaknesses.push("Zayıf veya eksik ürün içeriği");
  }

  if (metrics.sellerTrust.label === "weak") {
    weaknesses.push("Düşük satıcı güven sinyalleri");
  }

  if (metrics.marketPosition.label === "weak") {
    weaknesses.push("Belirsiz veya zayıf pazar konumu");
  }

  if (
    typeof extracted.seller_score === "number" &&
    extracted.seller_score > 0 &&
    extracted.seller_score < 8.0
  ) {
    weaknesses.push(`Düşük satıcı puanı (${extracted.seller_score})`);
  }

  if (hasStrongCompetitorTrust(extracted) && typeof getOtherSellerScoreGap(extracted) === "number") {
    const scoreGap = getOtherSellerScoreGap(extracted) as number;
    if (scoreGap >= 0.5) {
      weaknesses.push("Rakiplere göre daha düşük satıcı güveni");
    }
  }

  if (
    hasStrongCompetitorDelivery(extracted) &&
    !extracted.has_free_shipping &&
    (!hasText(extracted.delivery_type) || extracted.delivery_type === "standard")
  ) {
    weaknesses.push("Rakiplere göre daha yavaş teslimat algısı");
  }

  if (typeof extracted.review_count === "number" && extracted.review_count < 10) {
    weaknesses.push("Yetersiz yorum sayısı (sosyal kanıt eksikliği)");
  }

  if (extracted.has_free_shipping === false) {
    weaknesses.push("Ücretsiz kargo avantajının olmaması");
  }

  if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number" &&
    extracted.other_sellers_summary.cheaper_count > 0
  ) {
    const delta = getCompetitorPriceDelta(extracted);
    weaknesses.push(
      delta && delta > 0
        ? `Rakipten ${formatPriceNumber(delta)} daha pahalı`
        : "Fiyat rekabetinde dezavantajlı konum"
    );
  }

  if (typeof extracted.shipping_days === "number" && extracted.shipping_days >= 5) {
    weaknesses.push(`Uzun teslimat süresi (${extracted.shipping_days} gün)`);
  }

  if (reviewThemes?.negative.length) {
    weaknesses.push(`Tekrarlayan olumsuz yorumlar (${reviewThemes.negative.join(", ")})`);
  }

  if (
    lowRatedRatio != null &&
    lowRatedRatio >= 0.4 &&
    extracted.review_summary &&
    extracted.review_summary.sampled_count >= 3
  ) {
    weaknesses.push("Yüksek oranda düşük puanlı yorum");
  }

  if (extracted.extractor_status === "blocked") {
    weaknesses.push("Sınırlı veri (bazı alanlar okunamadı)");
  }

  // Remove duplicates and limit
  return [...new Set(weaknesses)].slice(0, 5);
}

function getSuggestionThemeByKey(key: string): "content" | "trust" | "market" | "general" {
  if (
    key === "expand-description" ||
    key === "add-specs" ||
    key === "increase-images" ||
    key === "add-video"
  ) {
    return "content";
  }

  if (
    key === "fix-low-rating" ||
    key === "address-review-themes" ||
    key === "increase-social-proof" ||
    key === "improve-seller-trust-score" ||
    key === "close-competitor-trust-gap"
  ) {
    return "trust";
  }

  if (
    key === "respond-to-lower-priced-competitors" ||
    key === "evaluate-shipping-advantage" ||
    key === "improve-delivery-competitiveness" ||
    key === "improve-delivery-promise"
  ) {
    return "market";
  }

  return "general";
}

function suggestionWeight(
  suggestion: AnalysisSuggestion,
  metrics: DerivedMetrics
) {
  const severityWeight =
    suggestion.severity === "high" ? 30 : suggestion.severity === "medium" ? 20 : 10;
  const theme = getSuggestionThemeByKey(suggestion.key);
  const themeWeight =
    theme === "content"
      ? metrics.productQuality.label === "weak"
        ? 20
        : 8
      : theme === "trust"
        ? metrics.sellerTrust.label === "weak"
          ? 20
          : 8
        : theme === "market"
          ? metrics.marketPosition.label === "weak"
            ? 20
            : 8
          : 5;

  return severityWeight + themeWeight;
}

function toSalesStatusLabel(level?: MarketComparisonInsights["userEstimatedSalesLevel"]) {
  switch (level) {
    case "very_low":
      return "cok dusuk";
    case "low":
      return "dusuk";
    case "medium":
      return "orta";
    case "good":
      return "iyi";
    case "high":
      return "guclu";
    default:
      return "net degil";
  }
}

function toMarketPositionLabel(level?: MarketComparisonInsights["marketPosition"]) {
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

function toGrowthLabel(level?: MarketComparisonInsights["growthOpportunityLevel"]) {
  switch (level) {
    case "low":
      return "dusuk firsat";
    case "medium":
      return "orta firsat";
    case "high":
      return "guclu firsat";
    case "very_high":
      return "cok guclu firsat";
    default:
      return "net degil";
  }
}

function toPriceAdvantageLabel(level?: MarketComparisonInsights["competitorSummary"]["priceCompetitiveness"]) {
  switch (level) {
    case "strong_advantage":
      return "fiyat avantaji guclu";
    case "neutral":
      return "fiyat avantaji orta";
    case "disadvantage":
      return "fiyat avantaji zayif";
    default:
      return "fiyat avantaji net degil";
  }
}

function toPressureLabel(issue: string) {
  switch (issue) {
    case "price":
      return "fiyat baskisi";
    case "trust":
      return "guven baskisi";
    case "listing":
      return "sayfa kalitesi baskisi";
    case "visibility":
      return "gorunurluk baskisi";
    case "demand":
      return "talep baskisi";
    default:
      return "karisik baski";
  }
}

function buildMarketOverview(
  input: ConsolidatedAnalysisInput
): MarketOverviewSummary | null {
  const market = input.marketComparison;
  if (!market) return null;

  const salesLabel = toSalesStatusLabel(market.userEstimatedSalesLevel);
  const positionLabel = toMarketPositionLabel(market.marketPosition);
  const growthLabel = toGrowthLabel(market.growthOpportunityLevel);
  const priceAdvantageLabel = toPriceAdvantageLabel(
    market.competitorSummary.priceCompetitiveness
  );

  let relativeMarketStatus = market.demandVerdict.result;
  if (!relativeMarketStatus) {
    relativeMarketStatus = "Pazar konumu net degil.";
  }

  const mainPressureAreas =
    (market.mainIssues ?? [])
      .filter((item) => item !== "unclear")
      .map((item) => toPressureLabel(item))
      .slice(0, 3);

  return {
    salesStatus: {
      level: market.userEstimatedSalesLevel,
      label: salesLabel,
    },
    marketPosition: {
      level: market.marketPosition,
      label: positionLabel,
    },
    growthOpportunity: {
      level: market.growthOpportunityLevel,
      label: growthLabel,
    },
    priceAdvantage: {
      level: market.competitorSummary.priceCompetitiveness ?? "unclear",
      label: priceAdvantageLabel,
    },
    relativeMarketStatus,
    demandConfidence: market.demandVerdict.confidence,
    mainPressureAreas,
  };
}

function getSuggestions(
  extracted: ExtractedProductFields,
  metrics: DerivedMetrics,
  market: MarketComparisonInsights | null | undefined
): AnalysisSuggestion[] {
  const suggestions: AnalysisSuggestion[] = [];
  const reviewThemes = extractReviewThemes(extracted);
  const qaThemes = extractQaThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);

  // --- Product Quality Suggestions ---
  if (metrics.productQuality.label === "weak" || (extracted.description_length || 0) < 120) {
    suggestions.push({
      key: "expand-description",
      severity: "high",
      title: "Ürün açıklamasını zenginleştirin",
      detail:
        "Mevcut açıklama, müşteriyi ikna etmek için yetersiz. Ürünün faydalarını, kullanım senaryolarını ve neden doğru seçim olduğunu anlatan detaylı bir metin hazırlayarak müşterinin karar verme sürecini kolaylaştırın.",
    });
  }
  if (metrics.productQuality.label === "weak" || !extracted.has_specs) {
    suggestions.push({
      key: "add-specs",
      severity: "medium",
      title: "Teknik özellikleri listeleyin",
      detail:
        "Teknik detaylar eksik veya belirsiz. Ölçü, materyal, uyumluluk, kapasite gibi kritik bilgileri net bir tablo veya liste halinde sunarak müşteri sorularını proaktif olarak yanıtlayın ve iade oranını düşürün.",
    });
  }
  if (metrics.productQuality.label === "weak" || (extracted.image_count || 0) < 4) {
    suggestions.push({
      key: "increase-images",
      severity: "medium",
      title: "Daha fazla ürün görseli ekleyin",
      detail:
        "Yetersiz görsel sayısı, müşterinin ürünü zihninde canlandırmasını zorlaştırır. Farklı açılardan çekilmiş, detayları gösteren, kullanım anını yansıtan ve mümkünse boyutlarını belli eden görseller ekleyin.",
    });
  }
  if (extracted.has_video === false) {
    suggestions.push({
      key: "add-video",
      severity: "low",
      title: "Ürün videosu eklemeyi düşünün",
      detail:
        "Video, dönüşüm oranlarını en çok artıran içerik türlerinden biridir. Ürünün kullanımını veya temel özelliklerini gösteren 30-60 saniyelik kısa bir video, müşterinin satın alma kararını önemli ölçüde etkileyebilir.",
    });
  }

  // --- Seller Trust Suggestions ---
  if (
    metrics.sellerTrust.label === "weak" ||
    ((typeof extracted.rating_value === "number" &&
      extracted.rating_value < 4.2 &&
      (extracted.review_count || 0) >= 5) ||
      (lowRatedRatio != null &&
        lowRatedRatio >= 0.4 &&
        extracted.review_summary &&
        extracted.review_summary.sampled_count >= 3))
  ) {
    suggestions.push({
      key: "fix-low-rating",
      severity: "high",
      title: "Düşük puanların kök nedenini bulun",
      detail:
        "Ürün puanı veya yorumlardaki olumsuzluklar kritik seviyede. Yorumlarda tekrar eden sorunları (kalite, kargo, paketleme vb.) tespit edip operasyonel iyileştirmeler yaparak müşteri memnuniyetini artırın.",
    });
  }
  if (reviewThemes?.negative.length) {
    suggestions.push({
      key: "address-review-themes",
      severity: "medium",
      title: "Tekrarlayan şikayet konularını giderin",
      detail: `Yorumlarda sıkça tekrar eden şikayetler var: ${reviewThemes.negative.join(
        ", "
      )}. Bu sorunları çözmek, müşteri memnuniyetini ve puanınızı doğrudan etkileyecektir.`,
    });
  }
  if (metrics.sellerTrust.label === "weak" || (extracted.review_count || 0) < 10) {
    suggestions.push({
      key: "increase-social-proof",
      severity: "medium",
      title: "Sosyal kanıtı (yorum sayısı) artırın",
      detail:
        "Yorum sayısı az olduğu için ürün yeterince güven vermiyor. Satış sonrası müşterilerden yorum bırakmalarını teşvik edecek (örn: kupon, puan) bir sistem kurarak sosyal kanıtı güçlendirin.",
    });
  }
  if (
    metrics.sellerTrust.label === "weak" ||
    (typeof extracted.seller_score === "number" &&
      extracted.seller_score > 0 &&
      extracted.seller_score < 8.0)
  ) {
    suggestions.push({
      key: "improve-seller-trust-score",
      severity: "medium",
      title: "Satıcı puanını yükseltmeye odaklanın",
      detail:
        "Satıcı puanınız rekabette geride kalıyor. Puanı artırmak için sipariş karşılama hızı, paketleme doğruluğu ve müşteri iletişimi gibi temel operasyonel alanlara odaklanın.",
    });
  }
  if (
    hasStrongCompetitorTrust(extracted) &&
    typeof getOtherSellerScoreGap(extracted) === "number" &&
    (getOtherSellerScoreGap(extracted) as number) >= 0.5
  ) {
    suggestions.push({
      key: "close-competitor-trust-gap",
      severity: "medium",
      title: "Rakiplerle aranızdaki güven farkını kapatın",
      detail:
        "Rakiplerin satıcı puanı ortalaması sizden daha yüksek. Müşteri memnuniyetini artırarak, yorumlara özen göstererek ve satıcı rozetleri kazanarak bu farkı kapatabilirsiniz.",
    });
  }

  // --- Market Position Suggestions ---
  if (
    metrics.marketPosition.label === "weak" ||
    (extracted.other_sellers_summary &&
      typeof extracted.other_sellers_summary.cheaper_count === "number" &&
      extracted.other_sellers_summary.cheaper_count > 0)
  ) {
    const delta = getCompetitorPriceDelta(extracted);
    suggestions.push({
      key: "respond-to-lower-priced-competitors",
      severity: "high",
      title: "Fiyat rekabetine cevap verin",
      detail:
        delta && delta > 0
          ? `En ucuz rakibiniz ${formatPriceNumber(
              delta
            )} daha avantajlı. Bu farkı kapatmak için fiyatınızı ayarlamayı veya kupon/kargo avantajı gibi ek faydalar sunmayı düşünün.`
          : "Rakipler arasında daha ucuza satanlar var. Fiyatınızı gözden geçirin veya ek avantajlarla (ücretsiz kargo, kupon vb.) teklifinizi güçlendirin.",
    });
  }
  if (metrics.marketPosition.label === "weak" || extracted.has_free_shipping === false) {
    suggestions.push({
      key: "evaluate-shipping-advantage",
      severity: "medium",
      title: "Ücretsiz kargo avantajı sunmayı değerlendirin",
      detail:
        "Ücretsiz kargo, dönüşüm oranını en çok etkileyen faktörlerden biridir. Rakipleriniz sunuyorsa veya pazar standardı haline geldiyse, maliyetlerinizi analiz ederek bu seçeneği mutlaka değerlendirin.",
    });
  }
  if (
    hasStrongCompetitorDelivery(extracted) &&
    !extracted.has_free_shipping &&
    (!hasText(extracted.delivery_type) || extracted.delivery_type === "standard")
  ) {
    suggestions.push({
      key: "improve-delivery-competitiveness",
      severity: "medium",
      title: "Teslimat hızında rekabet gücünüzü artırın",
      detail:
        "Rakipler daha hızlı teslimat sunuyor olabilir. Kargo süreçlerinizi optimize ederek veya 'Hızlı Teslimat' gibi seçenekler sunarak rekabette geri düşmeyin.",
    });
  }
  if (typeof extracted.shipping_days === "number" && extracted.shipping_days >= 5) {
    suggestions.push({
      key: "improve-delivery-promise",
      severity: "medium",
      title: "Teslimat süresini kısaltın",
      detail:
        "Belirtilen teslimat süresi uzun. Müşteriler genellikle daha hızlı teslimat bekler. Operasyonel verimliliği artırarak kargoya verme süresini azaltmaya odaklanın.",
    });
  }

  // --- General & Other Suggestions ---
  if (qaThemes?.length) {
    suggestions.push({
      key: "answer-top-customer-questions",
      severity: "low",
      title: "Sık sorulan soruları proaktif olarak yanıtlayın",
      detail: `Müşteriler en çok şu konuları merak ediyor: ${qaThemes
        .map((item) => item.label)
        .join(", ")}. Bu konuları ürün açıklamasında veya görsellerde netleştirmek, karar sürecini hızlandırır.`,
    });
  }
  if (!extracted.has_return_info) {
    suggestions.push({
      key: "show-return-policy",
      severity: "medium",
      title: "İade politikasını görünür ve net yapın",
      detail:
        "İade koşullarının net olmaması müşteriyi satın almaktan caydırabilir. Kolay ve şeffaf bir iade politikası sunarak bu önemli güven engelini kaldırın.",
    });
  }

  if (market?.primaryIssue === "price") {
    suggestions.push({
      key: "market-price-pressure",
      severity: "high",
      title: "Fiyat/teklif gucunu one alin",
      detail:
        "Pazarda fiyat baskisi yuksek gorunuyor. Fiyati, kuponu veya kargo avantajini birlikte optimize ederek teklifinizi guclendirin.",
    });
  }

  if (market?.primaryIssue === "trust") {
    suggestions.push({
      key: "market-trust-pressure",
      severity: "high",
      title: "Musteri guvenini one alin",
      detail:
        "Guven baskisi yuksek. Satici puani, yorum kalitesi ve iade/teslimat netligi gibi guven sinyallerini guclendirin.",
    });
  }

  if (market?.primaryIssue === "listing") {
    suggestions.push({
      key: "market-listing-pressure",
      severity: "medium",
      title: "Sayfa kalitesini one alin",
      detail:
        "Sayfa icerigi baskin sorun olarak gorunuyor. Baslik, aciklama ve gorselleri daha net ve ikna edici hale getirin.",
    });
  }

  if (market?.marketDemandSignal === "low") {
    suggestions.push({
      key: "market-low-demand-cautious",
      severity: "low",
      title: "Talep sinyali zayif, adimlari temkinli planlayin",
      detail:
        "Talep dusuk oldugu icin buyuk fiyat kirilimlari yerine once icerik, guven ve kampanya testleri ile olcumlu ilerleyin.",
    });
  }

  const uniqueSuggestions = suggestions.filter(
    (v, i, a) => a.findIndex((t) => t.key === v.key) === i
  );

  const ranked = uniqueSuggestions
    .map((item) => ({
      item,
      theme: getSuggestionThemeByKey(item.key),
      weight: suggestionWeight(item, metrics),
    }))
    .sort((left, right) => right.weight - left.weight);

  const selected: AnalysisSuggestion[] = [];
  const selectedThemes = new Set<string>();

  for (const candidate of ranked) {
    if (selected.length >= 6) break;
    if (candidate.theme !== "general" && selectedThemes.has(candidate.theme)) continue;
    selected.push(candidate.item);
    selectedThemes.add(candidate.theme);
  }

  for (const candidate of ranked) {
    if (selected.length >= 6) break;
    if (selected.some((item) => item.key === candidate.item.key)) continue;
    selected.push(candidate.item);
  }

  return selected.slice(0, 6);
}

export function buildPriorityActions(
  extracted: ExtractedProductFields,
  metrics: DerivedMetrics,
  suggestions: AnalysisSuggestion[],
  market?: MarketComparisonInsights | null
): PriorityAction[] {
  const base: Array<{ title: string; detail: string; weight: number; key: string }> = [];
  const lowRatedRatio = getLowRatedSampleRatio(extracted);

  const pushAction = (params: { title: string; detail: string; weight: number; key: string }) => {
    if (base.some((item) => item.key === params.key)) return;
    base.push(params);
  };

  if (metrics.marketPosition.label === "weak") {
    pushAction({
      key: "priority-market-position",
      title: "Öncelik: Pazar Konumunu Netleştirin",
      detail:
        "Fiyat, kargo ve kampanya avantajlarınız rakipler arasında belirgin değil. Bu sinyalleri güçlendirmek, dönüşüm oranını en hızlı etkileyecek adımdır.",
      weight: 100,
    });
  }

  if (market?.primaryIssue === "price") {
    pushAction({
      key: "priority-market-price-pressure",
      title: "Oncelik: Fiyat ve teklif gucunu artirin",
      detail:
        "Pazar verisi fiyat baskisinin one ciktigini gosteriyor. Fiyat, kupon ve kargo teklifini birlikte optimize edin.",
      weight: 102,
    });
  }

  if (market?.primaryIssue === "trust") {
    pushAction({
      key: "priority-market-trust-pressure",
      title: "Oncelik: Guven sinyallerini guclendirin",
      detail:
        "Pazar verisi guven baskisini isaret ediyor. Yorum kalitesi, satici puani ve iade/teslimat netligi odak alaniniz olmali.",
      weight: 101,
    });
  }

  if (market?.primaryIssue === "listing") {
    pushAction({
      key: "priority-market-listing-pressure",
      title: "Oncelik: Sayfa kalitesini iyilestirin",
      detail:
        "Baskin sorun sayfa kalitesi gorunuyor. Baslik, aciklama ve gorselleri guclendirerek donusumu destekleyin.",
      weight: 96,
    });
  }

  if (metrics.sellerTrust.label === "weak") {
    pushAction({
      key: "priority-seller-trust",
      title: "Öncelik: Satıcı Güvenini Artırın",
      detail:
        "Düşük satıcı puanı veya zayıf yorumlar müşteriyi caydırıyor. Güveni artırmak için yorum memnuniyetine, puanınıza ve hizmet kalitesine odaklanın.",
      weight: 95,
    });
  }

  if (
    lowRatedRatio != null &&
    lowRatedRatio >= 0.4 &&
    (extracted.favorite_count ?? 0) >= 1000
  ) {
    pushAction({
      key: "priority-review-crisis",
      title: "Yüksek İlgi Varken Yorum Krizini Çözün",
      detail:
        "Ürüne yüksek bir ilgi varken, artan negatif yorum oranı satışları baltalıyor. Acilen şikayetlerin kök nedenini bulup çözmeniz gerekiyor.",
      weight: 94,
    });
  }

  if (metrics.productQuality.label === "weak") {
    pushAction({
      key: "priority-product-content",
      title: "Ürün İçeriğinin İkna Gücünü Artırın",
      detail:
        "Eksik veya zayıf içerik (açıklama, görsel, teknik bilgi) nedeniyle müşteri 'Neden almalıyım?' sorusuna net cevap bulamıyor.",
      weight: 88,
    });
  }

  // Add suggestion-backed priorities with metric-aware weight.
  suggestions
    .filter((s) => s.severity !== "low")
    .forEach((s) => {
      pushAction({
        key: s.key,
        title: s.title,
        detail: s.detail,
        weight: 60 + suggestionWeight(s, metrics),
      });
    });

  // Remove duplicates by key
  const uniqueActions = base.filter((v, i, a) => a.findIndex((t) => t.key === v.key) === i);

  return uniqueActions
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((item, index) => ({
      priority: index + 1,
      title: item.title,
      detail: item.detail,
    }));
}

function getPriceCompetitiveness(
  extracted: ExtractedProductFields
): string | null {
  // This function is intended to return a single, most prominent pricing signal.
  if (typeof extracted.normalized_price !== "number") {
    return null;
  }

  // 1. Direct price comparison is the strongest signal
  if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number"
  ) {
    if (extracted.other_sellers_summary.cheaper_count > 0) {
      const delta = getCompetitorPriceDelta(extracted);
      return delta && delta > 0
        ? `En düşük rakipten ${formatPriceNumber(delta)} daha pahalı`
        : "Daha ucuz rakip satıcılar mevcut";
    }

    if (isCheapestOffer(extracted)) {
      if ((extracted.other_sellers_summary.count ?? 0) > 0) {
        return "Rakipler arasında en düşük fiyat";
      }
      // If no other sellers, this isn't a competitive statement.
    }
  }

  // 2. Strong offer signals (discount + free/fast shipping)
  if (
    typeof extracted.discount_rate === "number" &&
    extracted.discount_rate >= 10 &&
    extracted.has_free_shipping
  ) {
    return "İndirim ve ücretsiz kargo ile güçlü teklif";
  }

  // 3. Standalone signals
  if (typeof extracted.discount_rate === "number" && extracted.discount_rate >= 10) {
    return `Belirgin indirim oranı (%${Math.round(extracted.discount_rate)})`;
  }

  if (extracted.has_free_shipping) {
    return "Ücretsiz kargo avantajı sunuluyor";
  }

  if (hasText(extracted.campaign_label)) {
    return `Kampanya ile desteklenen teklif (${extracted.campaign_label})`;
  }

  // 4. Negative environmental signals
  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 4 &&
    !extracted.has_free_shipping &&
    typeof extracted.discount_rate !== "number"
  ) {
    return "Yüksek rekabette teklif yeterince farklılaşmıyor";
  }

  // 5. Default statement if a price exists but no other signals found
  return "Temel fiyat bilgisi mevcut";
}

function buildSummary(params: {
  platform: string | null;
  consolidatedInput: ConsolidatedAnalysisInput;
  extracted: ExtractedProductFields;
  derivedMetrics: DerivedMetrics;
}) {
  const { consolidatedInput, extracted, derivedMetrics } = params;

  const parts: string[] = [];
  const reviewRiskSummary = getReviewRiskSummary(extracted);

  const weakPoints: string[] = [];
  if (derivedMetrics.productQuality.label === "weak") {
    weakPoints.push("ürün içeriği");
  }
  if (derivedMetrics.sellerTrust.label === "weak") {
    weakPoints.push("satıcı güvenilirliği");
  }
  if (derivedMetrics.marketPosition.label === "weak") {
    weakPoints.push("pazar konumu");
  }

  let mainFinding = "Ürün sayfası genel olarak ortalama bir performans sergiliyor.";
  if (weakPoints.length > 0) {
    mainFinding = `Analiz, özellikle ${weakPoints.join(
      " ve "
    )} alanlarında önemli iyileştirme fırsatları olduğunu gösteriyor.`;
  }
  parts.push(mainFinding);

  const competitionParts: string[] = [];
  if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number" &&
    extracted.other_sellers_summary.cheaper_count > 0
  ) {
    competitionParts.push("fiyat dezavantajı");
  } else if (isCheapestOffer(extracted) && extracted.other_sellers_summary?.count) {
    competitionParts.push("fiyat avantajı");
  }

  if (
    hasStrongCompetitorTrust(extracted) &&
    typeof getOtherSellerScoreGap(extracted) === "number" &&
    (getOtherSellerScoreGap(extracted) as number) >= 0.5
  ) {
    competitionParts.push("daha güvenilir rakipler");
  }

  if (competitionParts.length > 0) {
    parts.push(`Rekabette ${competitionParts.join(" ve ")} gibi faktörler öne çıkıyor.`);
  }

  if (reviewRiskSummary) {
    parts.push(reviewRiskSummary);
  }

  if (
    !extracted.official_seller &&
    typeof extracted.seller_score === "number" &&
    extracted.seller_score > 0 &&
    extracted.seller_score < 7.5
  ) {
    parts.push("Düşük satıcı puanı güveni olumsuz etkileyebilir.");
  }

  if (extracted.extractor_status === "blocked") {
    parts.push("Sayfa yapısı nedeniyle bazı kritik veriler okunamadı, bu nedenle analiz kapsamı sınırlıdır.");
  }

  const reliableCoreFields = [
    consolidatedInput.title,
    consolidatedInput.price,
    consolidatedInput.imageCount,
    consolidatedInput.descriptionLength,
    consolidatedInput.reviewCount,
    consolidatedInput.sellerScore,
  ].filter((field) => field.value !== null && field.confidence >= 0.65).length;

  if (
    consolidatedInput.title.confidence < 0.45 ||
    consolidatedInput.price.confidence < 0.45
  ) {
    parts.push(
      "Temel urun verileri sinirli guvenle okundugu icin yorumlar temkinli tutuldu."
    );
  } else if (reliableCoreFields <= 2) {
    parts.push(
      "Kritik verilerin bir kismi orta veya dusuk guvenli oldugu icin analiz ozeti daha temkinli tutuldu."
    );
  }

  return parts.filter(Boolean).join(" ");
}

function buildSummaryWithMarket(params: {
  consolidatedInput: ConsolidatedAnalysisInput;
  extracted: ExtractedProductFields;
  derivedMetrics: DerivedMetrics;
  marketOverview: MarketOverviewSummary | null;
}) {
  const { consolidatedInput, extracted, derivedMetrics, marketOverview } = params;
  const parts: string[] = [];

  const weakPoints: string[] = [];
  if (derivedMetrics.productQuality.label === "weak") weakPoints.push("urun icerigi");
  if (derivedMetrics.sellerTrust.label === "weak") weakPoints.push("satici guvenilirligi");
  if (derivedMetrics.marketPosition.label === "weak") weakPoints.push("pazar konumu");

  if (marketOverview?.relativeMarketStatus) {
    parts.push(marketOverview.relativeMarketStatus);
    parts.push(`Guven: ${marketOverview.demandConfidence}.`);
    parts.push(
      `Satis durumu ${marketOverview.salesStatus.label}, pazar konumu ${marketOverview.marketPosition.label}, buyume gorunumu ${marketOverview.growthOpportunity.label}.`
    );
    parts.push(`Fiyat resmi: ${marketOverview.priceAdvantage.label}.`);
  } else if (weakPoints.length > 0) {
    parts.push(
      `Analiz, ozellikle ${weakPoints.join(
        " ve "
      )} alanlarinda belirgin iyilestirme firsati oldugunu gosteriyor.`
    );
  } else {
    parts.push("Urun sayfasi genel olarak dengeli bir gorunum veriyor.");
  }

  const reviewRiskSummary = getReviewRiskSummary(extracted);
  if (reviewRiskSummary) {
    parts.push(reviewRiskSummary);
  }

  const reliableCoreFields = [
    consolidatedInput.title,
    consolidatedInput.price,
    consolidatedInput.imageCount,
    consolidatedInput.descriptionLength,
    consolidatedInput.reviewCount,
    consolidatedInput.sellerScore,
  ].filter((field) => field.value !== null && field.confidence >= 0.65).length;

  if (
    consolidatedInput.title.confidence < 0.45 ||
    consolidatedInput.price.confidence < 0.45
  ) {
    parts.push("Temel urun verileri sinirli guvenle okundugu icin yorumlar temkinli tutuldu.");
  } else if (reliableCoreFields <= 2) {
    parts.push("Kritik verilerin bir kismi orta veya dusuk guvenli oldugu icin analiz ozeti daha temkinli kaldi.");
  }

  return parts.filter(Boolean).join(" ");
}

export function buildAnalysis({
  platform,
  consolidatedInput,
  extracted,
  planContext = "free",
}: BuildAnalysisParams): BuildAnalysisResult {
  const trendyolScorecard = buildTrendyolScorecard({
    extracted,
    consolidatedInput,
  });
  const seoScore = trendyolScorecard.searchVisibility.score;
  const dataCompletenessScore = getCompletenessScore(consolidatedInput);
  const conversionScore = trendyolScorecard.conversionPotential.score;

  const overallScore = clampScore(
    trendyolScorecard.overall.score * 0.65 +
      dataCompletenessScore * 0.2 +
      getConversionScore(consolidatedInput) * 0.15
  );

  const derivedMetrics = buildDerivedMetrics(extracted, consolidatedInput);
  const marketOverview = buildMarketOverview(consolidatedInput);
  const strengths = getStrengths(extracted, derivedMetrics);
  const weaknesses = getWeaknesses(extracted, derivedMetrics);
  const suggestions = getSuggestions(
    extracted,
    derivedMetrics,
    consolidatedInput.marketComparison
  );
  const priorityActions = buildPriorityActions(
    extracted,
    derivedMetrics,
    suggestions,
    consolidatedInput.marketComparison
  );

  const summary = buildSummaryWithMarket({
    consolidatedInput,
    extracted,
    derivedMetrics,
    marketOverview,
  });
  const decisionSupportPacket = buildDecisionSupportPacket({
    extracted,
    planContext,
    derivedMetrics,
  });
  const analysisTrace = buildAnalysisTrace({
    mode: "deterministic",
    summary,
    suggestions,
    packet: decisionSupportPacket,
    extracted,
    derivedMetrics,
    seoScore,
    conversionScore,
    overallScore,
  });
  const analysisVisuals = buildAnalysisVisuals(consolidatedInput);

  return {
    summary,
    seoScore,
    dataCompletenessScore,
    conversionScore,
    overallScore,
    trendyolScorecard,
    extractedData: extracted,
    derivedMetrics,
    decisionSupportPacket,
    strengths,
    weaknesses,
    suggestions,
    priorityActions,
    analysisVisuals,
    marketOverview: marketOverview ?? undefined,
    marketComparison: consolidatedInput.marketComparison ?? null,
    aiCommentary: {
      mode: "deterministic",
      summary,
    },
    analysisTrace,
    priceCompetitiveness: getPriceCompetitiveness(extracted),
    dataSource: "real-extraction",
  };
}
