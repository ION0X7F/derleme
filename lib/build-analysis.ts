import { buildAnalysisTrace } from "@/lib/analysis-trace";
import type {
  AccessPlan,
  AnalysisSuggestion,
  BuildAnalysisResult,
  DecisionSupportPacket,
  DerivedMetric,
  DerivedMetrics,
  ExtractedProductFields,
  PriorityAction,
} from "@/types/analysis";

type BuildAnalysisParams = {
  platform: string | null;
  url: string;
  extracted: ExtractedProductFields;
  planContext?: AccessPlan;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
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

function getReviewRiskSummary(extracted: ExtractedProductFields) {
  const themes = extractReviewThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);

  if (!themes && lowRatedRatio == null) return null;

  if (
    lowRatedRatio != null &&
    lowRatedRatio >= 0.5 &&
    themes?.negative?.length
  ) {
    return `Yorum riski yuksek: dusuk yildizli ornekler agirlikta ve su temalar tekrar ediyor: ${themes.negative.join(", ")}.`;
  }

  if (lowRatedRatio != null && lowRatedRatio >= 0.4) {
    return "Yorum riski orta-yuksek: dusuk yildizli ornekler belirgin gorunuyor.";
  }

  if (themes?.negative?.length) {
    return `Yorumlarda dikkat ceken sikayet temalari var: ${themes.negative.join(", ")}.`;
  }

  if (themes?.positive?.length) {
    return `Yorumlarda olumlu sinyaller baskin: ${themes.positive.join(", ")}.`;
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
      return "Ayni gun kargo";
    case "next_day":
      return "Ertesi gun kargo";
    case "fast_delivery":
      return "Hizli teslimat";
    case "standard":
      return "Standart teslimat";
    default:
      return value;
  }
}

function metricLabel(score: number | null): DerivedMetric["label"] {
  if (score == null) return "not_enough_data";
  if (score >= 75) return "strong";
  if (score >= 45) return "medium";
  return "weak";
}

function buildMetric(score: number | null, evidence: string[]): DerivedMetric {
  return {
    score,
    label: metricLabel(score),
    evidence: evidence.slice(0, 4),
  };
}

function getCompletenessScore(extracted: ExtractedProductFields) {
  let score = 0;

  if (hasText(extracted.title)) score += 8;
  if (hasText(extracted.meta_description)) score += 6;
  if (hasText(extracted.h1)) score += 6;
  if (hasText(extracted.brand)) score += 8;
  if (hasText(extracted.product_name)) score += 10;
  if (hasText(extracted.model_code)) score += 4;
  if (hasText(extracted.sku)) score += 4;
  if (hasText(extracted.mpn)) score += 4;
  if (hasText(extracted.gtin)) score += 5;
  if (typeof extracted.normalized_price === "number") score += 10;
  if ((extracted.image_count || 0) >= 1) score += 6;
  if ((extracted.image_count || 0) >= 4) score += 4;
  if (typeof extracted.rating_value === "number") score += 5;
  if (typeof extracted.review_count === "number") score += 5;
  if (typeof extracted.question_count === "number") score += 2;
  if (typeof extracted.favorite_count === "number") score += 2;
  if ((extracted.description_length || 0) >= 120) score += 4;
  if ((extracted.description_length || 0) >= 300) score += 4;
  if ((extracted.bullet_point_count || 0) >= 3) score += 2;
  if (extracted.has_add_to_cart) score += 5;
  if (extracted.has_shipping_info) score += 4;
  if (extracted.has_free_shipping) score += 2;
  if (extracted.has_return_info) score += 4;
  if (extracted.has_specs) score += 6;
  if (extracted.has_faq) score += 2;
  if (extracted.has_video) score += 2;
  if (hasText(extracted.seller_name)) score += 4;
  if (Array.isArray(extracted.other_seller_offers) && extracted.other_seller_offers.length > 0) {
    score += 4;
  }
  if (hasText(extracted.stock_status)) score += 2;
  if (extracted.extractor_status === "ok") score += 5;
  if (extracted.extractor_status === "partial") score += 2;
  if (extracted.extractor_status === "blocked") score -= 8;

  return clampScore(score);
}

function getSeoScore(extracted: ExtractedProductFields) {
  let score = 0;

  if (hasText(extracted.title)) score += 25;
  if (hasText(extracted.meta_description)) score += 15;
  if (hasText(extracted.h1)) score += 15;
  if (hasText(extracted.brand)) score += 10;
  if (hasText(extracted.product_name)) score += 10;
  if (hasText(extracted.model_code)) score += 5;
  if ((extracted.image_count || 0) >= 3) score += 10;
  if ((extracted.description_length || 0) >= 120) score += 5;
  if (extracted.has_specs) score += 5;

  return clampScore(score);
}

function getConversionScore(extracted: ExtractedProductFields) {
  let score = 0;
  const reviewThemes = extractReviewThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);
  const sampledReviewCount = extracted.review_summary?.sampled_count ?? 0;

  if (typeof extracted.normalized_price === "number") score += 15;
  if (extracted.has_add_to_cart) score += 20;
  if ((extracted.image_count || 0) >= 3) score += 10;
  if ((extracted.description_length || 0) >= 120) score += 10;
  if (typeof extracted.rating_value === "number") score += 10;
  if ((extracted.review_count || 0) > 0) score += 10;
  if ((extracted.favorite_count || 0) > 0) score += 5;
  if (extracted.has_shipping_info) score += 10;
  if (extracted.has_return_info) score += 10;
  if (extracted.has_free_shipping) score += 5;

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

function buildContentQualityMetric(extracted: ExtractedProductFields): DerivedMetric {
  let score = 0;
  const evidence: string[] = [];

  if (hasText(extracted.title) && hasText(extracted.h1)) {
    score += 25;
    evidence.push("Title ve H1 alanlari mevcut.");
  } else if (hasText(extracted.title) || hasText(extracted.h1)) {
    score += 12;
    evidence.push("Baslik alanlarinin bir kismi mevcut.");
  }

  if (hasText(extracted.meta_description)) {
    score += 15;
    evidence.push("Meta aciklama tespit edildi.");
  }

  if ((extracted.description_length || 0) >= 300) {
    score += 25;
    evidence.push("Aciklama uzunlugu guclu.");
  } else if ((extracted.description_length || 0) >= 120) {
    score += 12;
    evidence.push("Aciklama temel karar destegi sagliyor.");
  }

  if ((extracted.bullet_point_count || 0) >= 3) {
    score += 10;
    evidence.push("Maddeli icerik yapisi mevcut.");
  }

  if (extracted.has_specs) {
    score += 15;
    evidence.push("Teknik ozellik alani mevcut.");
  }

  if (extracted.has_faq) {
    score += 5;
    evidence.push("SSS alani mevcut.");
  }

  if (hasText(extracted.brand) && hasText(extracted.model_code)) {
    score += 5;
    evidence.push("Marka ve model bilgisi ayrisiyor.");
  }

  return buildMetric(clampScore(score), evidence);
}

function buildTrustStrengthMetric(extracted: ExtractedProductFields): DerivedMetric {
  let score = 0;
  const evidence: string[] = [];
  const reviewThemes = extractReviewThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);
  const sampledReviewCount = extracted.review_summary?.sampled_count ?? 0;

  if (
    typeof extracted.rating_value === "number" &&
    extracted.rating_value >= 4.3 &&
    (extracted.review_count || 0) >= 20
  ) {
    score += 35;
    evidence.push("Puan ve yorum hacmi guven sinyali uretiyor.");
  } else if (
    typeof extracted.rating_value === "number" &&
    typeof extracted.review_count === "number"
  ) {
    score += 18;
    evidence.push("Temel sosyal kanit verisi mevcut.");
  }

  if (hasText(extracted.seller_name)) {
    score += 10;
    evidence.push("Satici bilgisi gorunur.");
  }

  if (Array.isArray(extracted.seller_badges) && extracted.seller_badges.length > 0) {
    score += 8;
    evidence.push(`Satici rozetleri mevcut: ${extracted.seller_badges.join(", ")}.`);
  }

  if (typeof extracted.seller_score === "number") {
    if (extracted.seller_score >= 8.5) {
      score += 10;
      evidence.push("Satici puani guclu gorunuyor.");
    } else if (extracted.seller_score >= 7.5) {
      score += 5;
      evidence.push("Satici puani orta seviyede.");
    } else {
      score -= 5;
      evidence.push("Satici puani guven tarafinda risk olusturabilir.");
    }
  }

  if (typeof extracted.follower_count === "number") {
    score += extracted.follower_count >= 10000 ? 8 : extracted.follower_count >= 1000 ? 4 : 2;
    evidence.push("Magaza takipci verisi mevcut.");
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 4 &&
    typeof extracted.seller_score === "number" &&
    extracted.seller_score > 0 &&
    extracted.seller_score < 7.5
  ) {
    score -= 8;
    evidence.push("Yuksek rekabette satici guven sinyali zayif kalabilir.");
  }

  if (
    typeof getOtherSellerScoreGap(extracted) === "number" &&
    (getOtherSellerScoreGap(extracted) as number) >= 0.5
  ) {
    score -= 8;
    evidence.push("Diger saticilarin guven seviyesi daha guclu olabilir.");
  }

  if (typeof extracted.question_count === "number" && extracted.question_count >= 5) {
    score += 10;
    evidence.push("Soru-cevap hacmi guven sinyali uretiyor.");
  } else if (typeof extracted.question_count === "number" && extracted.question_count > 0) {
    score += 5;
    evidence.push("Temel soru-cevap sinyali mevcut.");
  }

  if (extracted.official_seller) {
    score += 10;
    evidence.push("Resmi satici sinyali mevcut.");
  }

  if (extracted.has_brand_page) {
    score += 10;
    evidence.push("Marka sayfasi sinyali mevcut.");
  }

  if (extracted.has_return_info) {
    score += 15;
    evidence.push("Iade bilgisi gorunur.");
  }

  if (extracted.has_shipping_info) {
    score += 10;
    evidence.push("Kargo bilgisi gorunur.");
  }

  if (hasText(extracted.stock_status)) {
    score += 5;
    evidence.push("Stok durumu belirtilmis.");
  }

  if (lowRatedRatio != null) {
    if (lowRatedRatio >= 0.5) {
      score -= 18;
      evidence.push("Dusuk yildizli yorum orani guven tarafinda risk olusturuyor.");
    } else if (lowRatedRatio >= 0.4) {
      score -= 10;
      evidence.push("Yorumlardaki dusuk yildiz yogunlugu guven algisini zayiflatabilir.");
    } else if (lowRatedRatio <= 0.2 && sampledReviewCount >= 3) {
      score += 6;
      evidence.push("Ornek yorumlarda dusuk yildizli geri bildirim sinirli.");
    }
  }

  if (reviewThemes?.negative?.length) {
    score -= Math.min(12, reviewThemes.negative.length * 4);
      evidence.push(`Yorumlarda tekrar eden sikayetler var: ${reviewThemes.negative.join(", ")}.`);
  } else if (reviewThemes?.positive?.length) {
    score += Math.min(8, reviewThemes.positive.length * 2);
    evidence.push(`Yorumlarda olumlu temalar gorunuyor: ${reviewThemes.positive.join(", ")}.`);
  }

  return buildMetric(clampScore(score), evidence);
}

function buildOfferStrengthMetric(extracted: ExtractedProductFields): DerivedMetric {
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
    evidence.push("Indirim sinyali hesaplanabiliyor.");
  }

  if (extracted.has_free_shipping) {
    score += 20;
    evidence.push("Ucretsiz kargo avantaji var.");
  }

  if (isCheapestOffer(extracted) && extracted.other_sellers_summary?.count) {
    score += 25;
    evidence.push("Rakip saticilar icinde en dusuk fiyat sinyali gorunuyor.");
  } else if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number" &&
    extracted.other_sellers_summary.cheaper_count > 0
  ) {
    score -= Math.min(20, extracted.other_sellers_summary.cheaper_count * 6);
    evidence.push(
      `${extracted.other_sellers_summary.cheaper_count} rakip satici daha dusuk fiyatla gorunuyor.`
    );
  }

  if (extracted.has_campaign) {
    score += 10;
    evidence.push(
      extracted.campaign_label
        ? `Kampanya sinyali gorunuyor: ${extracted.campaign_label}.`
        : "Kampanya veya kupon sinyali gorunuyor."
    );
  }

  if (
    Array.isArray(extracted.seller_badges) &&
    extracted.seller_badges.some((badge) => /hizli teslimat/i.test(badge))
  ) {
    score += 10;
    evidence.push("Hizli teslimat rozeti teklif gucunu destekliyor.");
  }

  if (typeof extracted.shipping_days === "number") {
    if (extracted.shipping_days <= 3) {
      score += 20;
      evidence.push("Teslim suresi guclu gorunuyor.");
    } else if (extracted.shipping_days <= 5) {
      score += 10;
      evidence.push("Teslim suresi orta seviyede.");
    } else {
      evidence.push("Teslim suresi uzun olabilir.");
    }
  }

  if (typeof extracted.variant_count === "number" && extracted.variant_count >= 2) {
    score += 10;
    evidence.push("Teklif varyant secenegi destekliyor.");
  }

  if (typeof extracted.other_sellers_count === "number") {
    if (extracted.other_sellers_count >= 4) {
      if (!extracted.has_free_shipping && typeof extracted.discount_rate !== "number") {
        score -= 10;
      }
      evidence.push("Ayni urunde rekabet baskisi yuksek gorunuyor.");
    } else if (extracted.other_sellers_count >= 2) {
      if (!extracted.has_free_shipping && typeof extracted.discount_rate !== "number") {
        score -= 5;
      }
      evidence.push("Ayni urunde birden fazla satici gorunuyor.");
    }
  }

  if (
    hasStrongCompetitorDelivery(extracted) &&
    extracted.has_free_shipping !== true &&
    (!hasText(extracted.delivery_type) || extracted.delivery_type === "standard")
  ) {
    score -= 8;
    evidence.push("Rakip tarafta teslimat avantaji daha guclu olabilir.");
  }

  if (hasText(extracted.delivery_type)) {
    score += 5;
    evidence.push(
      `${formatDeliveryType(extracted.delivery_type) || "Teslimat tipi"} belirtilmis.`
    );
  }

  return buildMetric(clampScore(score), evidence);
}

function buildVisualStrengthMetric(extracted: ExtractedProductFields): DerivedMetric {
  let score = 0;
  const evidence: string[] = [];

  if ((extracted.image_count || 0) >= 6) {
    score += 50;
    evidence.push("Gorsel sayisi guclu.");
  } else if ((extracted.image_count || 0) >= 3) {
    score += 30;
    evidence.push("Gorsel sayisi temel seviyede.");
  } else if ((extracted.image_count || 0) > 0) {
    score += 12;
    evidence.push("Gorsel sayisi sinirli.");
  }

  if (extracted.has_video) {
    score += 25;
    evidence.push("Urun videosu mevcut.");
  }

  if (typeof extracted.variant_count === "number" && extracted.variant_count >= 2) {
    score += 10;
    evidence.push("Varyant secenekleri vitrini zenginlestiriyor.");
  }

  if ((extracted.bullet_point_count || 0) >= 3) {
    score += 10;
    evidence.push("Gorseli destekleyen maddeli anlatim var.");
  }

  return buildMetric(clampScore(score), evidence);
}

function buildDecisionClarityMetric(extracted: ExtractedProductFields): DerivedMetric {
  let score = 0;
  const evidence: string[] = [];

  if ((extracted.description_length || 0) >= 120) {
    score += 20;
    evidence.push("Aciklama karar destegi sagliyor.");
  }

  if ((extracted.bullet_point_count || 0) >= 3) {
    score += 15;
    evidence.push("Bilgi maddeli sekilde sunuluyor.");
  }

  if (extracted.has_specs) {
    score += 20;
    evidence.push("Teknik detaylar mevcut.");
  }

  if (extracted.has_faq) {
    score += 10;
    evidence.push("Sik sorulan sorular alani mevcut.");
  }

  if (typeof extracted.variant_count === "number" && extracted.variant_count >= 2) {
    score += 10;
    evidence.push("Varyant secimi destekleniyor.");
  }

  if (typeof extracted.question_count === "number" && extracted.question_count > 0) {
    score += 10;
    evidence.push("Soru-cevap alani karar oncesi bariyerleri azaltabilir.");
  }

  if (typeof extracted.shipping_days === "number") {
    score += 10;
    evidence.push("Teslimat beklentisi gorunur.");
  }

  if (extracted.has_return_info) {
    score += 10;
    evidence.push("Iade bilgisi karar engelini azaltir.");
  }

  if (hasText(extracted.stock_status)) {
    score += 5;
    evidence.push("Stok durumu gorunur.");
  }

  return buildMetric(clampScore(score), evidence);
}

function buildReviewRiskMetric(extracted: ExtractedProductFields): DerivedMetric {
  const snippets = Array.isArray(extracted.review_snippets) ? extracted.review_snippets : [];
  const reviewThemes = extractReviewThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);
  const riskSummary = getReviewRiskSummary(extracted);

  if (snippets.length === 0 && lowRatedRatio == null && !reviewThemes) {
    return buildMetric(null, ["Yorum ornegi bulunamadigi icin yorum riski olculemedi."]);
  }

  let score = 70;
  const evidence: string[] = [];

  if (lowRatedRatio != null) {
    if (lowRatedRatio >= 0.5) {
      score -= 35;
      evidence.push("Dusuk yildizli yorum orani yuksek.");
    } else if (lowRatedRatio >= 0.4) {
      score -= 22;
      evidence.push("Dusuk yildizli yorumlar dikkat cekiyor.");
    } else if (lowRatedRatio <= 0.2 && (extracted.review_summary?.sampled_count ?? 0) >= 3) {
      score += 10;
      evidence.push("Dusuk yildizli yorum yogunlugu sinirli.");
    }
  }

  if (reviewThemes?.negative?.length) {
    score -= Math.min(24, reviewThemes.negative.length * 8);
    evidence.push(`Negatif yorum temalari: ${reviewThemes.negative.join(", ")}.`);
  }

  if (reviewThemes?.positive?.length && !reviewThemes?.negative?.length) {
    score += Math.min(12, reviewThemes.positive.length * 4);
    evidence.push(`Olumlu yorum temalari: ${reviewThemes.positive.join(", ")}.`);
  }

  if (riskSummary && evidence.length < 4) {
    evidence.push(riskSummary);
  }

  return buildMetric(clampScore(score), evidence);
}

function buildDerivedMetrics(extracted: ExtractedProductFields): DerivedMetrics {
  return {
    contentQuality: buildContentQualityMetric(extracted),
    trustStrength: buildTrustStrengthMetric(extracted),
    offerStrength: buildOfferStrengthMetric(extracted),
    visualStrength: buildVisualStrengthMetric(extracted),
    decisionClarity: buildDecisionClarityMetric(extracted),
    reviewRisk: buildReviewRiskMetric(extracted),
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
    ["question_count", typeof extracted.question_count === "number"],
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
      h1: extracted.h1,
      brand: extracted.brand,
      product_name: extracted.product_name,
      model_code: extracted.model_code,
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

  if (metrics.contentQuality.label === "strong") {
    strengths.push("Icerik kalitesi temel satis kararini destekliyor.");
  }

  if (metrics.trustStrength.label === "strong") {
    strengths.push("Guven sinyalleri guclu gorunuyor.");
  }

  if (metrics.visualStrength.label === "strong") {
    strengths.push("Vitrin gucu gorsel acidan yeterli.");
  }

  if (metrics.offerStrength.label === "strong") {
    strengths.push("Teklif gucu rekabeti destekleyebilir.");
  }

  if (isCheapestOffer(extracted) && extracted.other_sellers_summary?.count) {
    strengths.push("Rakip saticilar arasinda en dusuk fiyat sinyali gorunuyor.");
  }

  if (extracted.official_seller) {
    strengths.push("Resmi satici sinyali guveni destekliyor.");
  }

  if (Array.isArray(extracted.seller_badges) && extracted.seller_badges.length > 0) {
    strengths.push(`Satici rozetleri gorunur: ${extracted.seller_badges.join(", ")}.`);
  }

  if (
    Array.isArray(extracted.seller_badges) &&
    extracted.seller_badges.some((badge) => /hizli teslimat/i.test(badge))
  ) {
    strengths.push("Hizli teslimat rozeti teklif hizini destekliyor.");
  }

  if (typeof extracted.seller_score === "number" && extracted.seller_score >= 8.5) {
    strengths.push("Satici puani guven tarafini destekliyor.");
  }

  if (typeof extracted.follower_count === "number" && extracted.follower_count >= 1000) {
    strengths.push("Magaza takipci tabani guven sinyali uretiyor.");
  }

  if (
    extracted.other_sellers_summary &&
    extracted.other_sellers_summary.count >= 2 &&
    typeof extracted.seller_score === "number" &&
    typeof extracted.other_sellers_summary.avg_score === "number" &&
    extracted.seller_score >= extracted.other_sellers_summary.avg_score
  ) {
    strengths.push("Satici guven seviyesi rekabete gore zayif degil.");
  }

  if (hasText(extracted.campaign_label)) {
    strengths.push(`Kampanya gorunurlugu mevcut: ${extracted.campaign_label}.`);
  } else if (extracted.has_campaign) {
    strengths.push("Kampanya veya kupon sinyali teklif gucunu destekliyor.");
  }

  if (extracted.has_free_shipping) {
    strengths.push("Ucretsiz kargo teklif gucunu destekliyor.");
  }

  if (typeof extracted.question_count === "number" && extracted.question_count >= 5) {
    strengths.push("Soru-cevap hacmi satin alma guvenini destekleyebilir.");
  }

  if (hasText(extracted.model_code)) {
    strengths.push("Model kodu ayrismis.");
  }

  if (reviewThemes?.positive.length) {
    strengths.push(`Yorumlarda olumlu tema sinyali var: ${reviewThemes.positive.join(", ")}.`);
  }

  if (
    lowRatedRatio != null &&
    lowRatedRatio <= 0.2 &&
    extracted.review_summary &&
    extracted.review_summary.sampled_count >= 3
  ) {
    strengths.push("Ornek yorumlarda dusuk yildizli geri bildirim orani sinirli.");
  }

  return strengths.slice(0, 5);
}

function getWeaknesses(extracted: ExtractedProductFields, metrics: DerivedMetrics): string[] {
  const weaknesses: string[] = [];
  const reviewThemes = extractReviewThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);

  if (metrics.contentQuality.label === "weak") {
    weaknesses.push("Icerik kalitesi satis kararini desteklemek icin zayif.");
  }

  if (metrics.trustStrength.label === "weak") {
    weaknesses.push("Guven sinyalleri yetersiz gorunuyor.");
  }

  if (
    typeof extracted.seller_score === "number" &&
    extracted.seller_score > 0 &&
    extracted.seller_score < 7.5
  ) {
    weaknesses.push("Satici puani guven bariyeri olusturabilir.");
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 4 &&
    typeof extracted.seller_score === "number" &&
    extracted.seller_score > 0 &&
    extracted.seller_score < 7.5
  ) {
    weaknesses.push("Yuksek rekabette satici guven farki zayif kalabilir.");
  }

  if (hasStrongCompetitorTrust(extracted) && typeof getOtherSellerScoreGap(extracted) === "number") {
    const scoreGap = getOtherSellerScoreGap(extracted) as number;
    if (scoreGap >= 0.5) {
      weaknesses.push("Rakip saticilarin guven seviyesi daha guclu gorunebilir.");
    }
  }

  if (
    hasStrongCompetitorDelivery(extracted) &&
    extracted.has_free_shipping !== true &&
    (!hasText(extracted.delivery_type) || extracted.delivery_type === "standard")
  ) {
    weaknesses.push("Rakip tarafta daha hizli teslimat sinyali bulunabilir.");
  }

  if (metrics.offerStrength.label === "weak") {
    weaknesses.push("Fiyat ve teklif gucu yeterince net degil.");
  }

  if (metrics.visualStrength.label === "weak") {
    weaknesses.push("Vitrin gucu zayif, gorsel destek sinirli olabilir.");
  }

  if (metrics.decisionClarity.label === "weak") {
    weaknesses.push("Karar vermeyi kolaylastiran bilgi yapisi eksik gorunuyor.");
  }

  if (
    typeof extracted.review_count === "number" &&
    extracted.review_count < 5
  ) {
    weaknesses.push("Yorum hacmi dusuk oldugu icin sosyal kanit sinirli kalabilir.");
  }

  if (
    typeof extracted.question_count === "number" &&
    extracted.question_count >= 0 &&
    extracted.question_count < 3
  ) {
    weaknesses.push("Soru-cevap hacmi dusuk oldugu icin karar oncesi guven zayif kalabilir.");
  }

  if (extracted.has_free_shipping === false) {
    weaknesses.push("Ucretsiz kargo avantaji gorunmedigi icin teklif gucu zayiflayabilir.");
  }

  if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number" &&
    extracted.other_sellers_summary.cheaper_count > 0
  ) {
    const delta = getCompetitorPriceDelta(extracted);
    weaknesses.push(
      delta && delta > 0
        ? `En dusuk rakip fiyat senden ${formatPriceNumber(delta)} daha avantajli gorunuyor.`
        : "Daha ucuz rakip saticilar oldugu icin fiyat baskisi olusabilir."
    );
  }

  if (
    typeof extracted.shipping_days === "number" &&
    extracted.shipping_days >= 6
  ) {
    weaknesses.push("Teslimat suresi uzun oldugu icin donusum bariyeri olusabilir.");
  }

  if (extracted.extractor_status === "blocked") {
    weaknesses.push("Bazi Trendyol verileri cekilemedigi icin analiz kapsami sinirli.");
  }

  if (reviewThemes?.negative.length) {
    weaknesses.push(`Yorumlarda tekrar eden sikayet sinyali var: ${reviewThemes.negative.join(", ")}.`);
  }

  if (
    lowRatedRatio != null &&
    lowRatedRatio >= 0.4 &&
    extracted.review_summary &&
    extracted.review_summary.sampled_count >= 3
  ) {
    weaknesses.push("Ornek yorumlarda dusuk yildizli geri bildirim orani yuksek gorunuyor.");
  }

  return weaknesses.slice(0, 5);
}

function getSuggestions(
  extracted: ExtractedProductFields,
  metrics: DerivedMetrics
): AnalysisSuggestion[] {
  const suggestions: AnalysisSuggestion[] = [];
  const reviewThemes = extractReviewThemes(extracted);
  const qaThemes = extractQaThemes(extracted);
  const lowRatedRatio = getLowRatedSampleRatio(extracted);

  if (metrics.contentQuality.label === "weak") {
    suggestions.push({
      key: "improve-content-depth",
      severity: "high",
      title: "Icerik kalitesini guclendirin",
      detail:
        "Title, H1, meta aciklama ve aciklama derinligi birlikte guclendirilirse urun sayfasi daha ikna edici olur.",
    });
  }

  if ((extracted.description_length || 0) < 120) {
    suggestions.push({
      key: "expand-description",
      severity: "high",
      title: "Aciklamayi daha karar destekli hale getirin",
      detail:
        "Kullanim senaryosu, fayda ve ayirt edici ozellikleri aciklamaya ekleyin.",
    });
  }

  if (!extracted.has_specs) {
    suggestions.push({
      key: "add-specs",
      severity: "medium",
      title: "Teknik ozellik alanini guclendirin",
      detail:
        "Olcu, materyal, kapasite veya teknik ozellikler acik sekilde listelenmeli.",
    });
  }

  if ((extracted.image_count || 0) < 3) {
    suggestions.push({
      key: "increase-images",
      severity: "medium",
      title: "Gorsel sayisini artirin",
      detail:
        "Farkli acilar, kullanim goruntusu ve detay kareleri vitrin gucunu artirir.",
    });
  }

  if (extracted.has_video === false) {
    suggestions.push({
      key: "add-video",
      severity: "low",
      title: "Urun videosu sinyalini kontrol edin",
      detail:
        "Sayfada video sinyali tespit edilemedigi icin urun videosu varsa gorunurlugunu kontrol edin; yoksa video eklemek kullanim algisini destekleyebilir.",
    });
  }

  if (
    typeof extracted.rating_value === "number" &&
    extracted.rating_value < 4 &&
    (extracted.review_count || 0) > 0
  ) {
    suggestions.push({
      key: "fix-low-rating",
      severity: "high",
      title: "Dusuk puan nedenlerini inceleyin",
      detail:
        "Yorumlarda tekrar eden sorunlari tespit edip urun veya teslimat tarafinda duzeltin.",
    });
  }

  if ((extracted.review_count || 0) < 5) {
    suggestions.push({
      key: "increase-social-proof",
      severity: "medium",
      title: "Sosyal kaniti guclendirin",
      detail:
        "Satis sonrasi yorum toplama akisi kurularak guven bariyeri azaltilabilir.",
    });
  }

  if (
    extracted.review_summary &&
    extracted.review_summary.sampled_count > 0 &&
    extracted.review_summary.low_rated_count >= 2
  ) {
    suggestions.push({
      key: "inspect-low-rated-review-themes",
      severity: "medium",
      title: "Dusuk yildizli yorum temalarini inceleyin",
      detail:
        "Sayfadaki yorum orneklerinde birden fazla dusuk yildizli geri bildirim gorunuyor; tekrar eden sikayet basliklarini urun, paketleme veya teslimat tarafinda kapatmak faydali olabilir.",
    });
  }

  if (reviewThemes?.negative.length) {
    suggestions.push({
      key: "address-review-themes",
      severity: "medium",
      title: "Yorumlarda gecen ana sikayetleri kapatin",
      detail: `Ornek yorumlarda su basliklar tekrar ediyor: ${reviewThemes.negative.join(", ")}. Urun, paketleme veya teslimat tarafinda bunlari azaltacak iyilestirmeler planlanabilir.`,
    });
  }

  if (
    lowRatedRatio != null &&
    lowRatedRatio >= 0.5 &&
    extracted.review_summary &&
    extracted.review_summary.sampled_count >= 3
  ) {
    suggestions.push({
      key: "prioritize-review-risk",
      severity: "high",
      title: "Dusuk yildizli yorum riskini onceliklendirin",
      detail:
        "Ornek yorumlarda dusuk yildizli geri bildirim orani yuksek gorundugu icin urun kalitesi, paketleme veya teslimat kaynakli temel problemi hizla izole etmek faydali olur.",
    });
  }

  if (
    typeof extracted.question_count === "number" &&
    extracted.question_count >= 0 &&
    extracted.question_count < 3
  ) {
    suggestions.push({
      key: "increase-question-coverage",
      severity: "low",
      title: "Soru-cevap guvenini artirin",
      detail:
        "Potansiyel itirazlari cevaplayan soru-cevap birikimi, karar vermeyi kolaylastirabilir.",
    });
  }

  if (qaThemes?.length) {
    suggestions.push({
      key: "answer-top-customer-questions",
      severity: "low",
      title: "En cok sorulan konulari daha gorunur cevaplayin",
      detail: `Soru-cevap orneklerinde en cok su basliklar one cikiyor: ${qaThemes
        .map((item) => item.label)
        .join(", ")}. Bu konulari aciklama, gorsel veya SSS alaninda daha netlestirmek karar hizini artirabilir.`,
    });
  }

  if (!extracted.official_seller && hasText(extracted.seller_name)) {
    suggestions.push({
      key: "strengthen-seller-trust",
      severity: "low",
      title: "Satici guven sinyallerini guclendirin",
      detail:
        "Magaza guvenini destekleyen rozet, resmi satici veya garanti sinyalleri daha gorunur sunulabilir.",
    });
  }

  if (
    typeof extracted.seller_score === "number" &&
    extracted.seller_score > 0 &&
    extracted.seller_score < 7.5
  ) {
    suggestions.push({
      key: "improve-seller-trust-score",
      severity: "medium",
      title: "Satici guven skorunu yukseltecek adimlari one cikarin",
      detail:
        "Satici puani sinirli gorundugu icin yorum memnuniyeti, teslimat deneyimi ve magaza guven sinyalleri birlikte guclendirilmeli.",
    });
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 2
  ) {
    suggestions.push({
      key: "differentiate-against-other-sellers",
      severity: "low",
      title: "Diger saticilardan ayrismayi guclendirin",
      detail:
        "Ayni urunde birden fazla satici oldugu icin fiyat, kargo ve guven sinyallerini daha belirgin sunmak donusume yardimci olabilir.",
    });
  }

  if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number" &&
    extracted.other_sellers_summary.cheaper_count > 0
  ) {
    const delta = getCompetitorPriceDelta(extracted);
    suggestions.push({
      key: "respond-to-lower-priced-competitors",
      severity: "high",
      title: "Rakip fiyat farkina cevap verin",
      detail:
        delta && delta > 0
          ? `En dusuk rakip fiyat senden ${formatPriceNumber(delta)} daha dusuk gorunuyor; fiyat, kupon veya kargo avantajini netlestirerek farki kapatmayi dusunun.`
          : "Daha ucuz rakip saticilar gorundugu icin fiyat, kupon veya kargo avantajini daha netlestirin.",
    });
  } else if (isCheapestOffer(extracted) && extracted.other_sellers_summary?.count) {
    suggestions.push({
      key: "protect-price-lead",
      severity: "low",
      title: "Fiyat liderligini gorunur kullanin",
      detail:
        "En dusuk fiyat sinyali gorunuyorsa bunu kargo, teslimat ve guven sinyalleriyle birlikte daha belirgin sunmak donusume yardimci olabilir.",
    });
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 4 &&
    extracted.has_free_shipping !== true &&
    typeof extracted.discount_rate !== "number"
  ) {
    suggestions.push({
      key: "increase-offer-pressure-resistance",
      severity: "medium",
      title: "Rekabet baskisina karsi teklifi sertlestirin",
      detail:
        "Birden fazla satici gorundugu halde belirgin indirim veya kargo avantaji yoksa teklif gucu zayif algilanabilir; fiyat, kargo veya kampanya sinyalini daha netlestirin.",
    });
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 4 &&
    typeof extracted.seller_score === "number" &&
    extracted.seller_score > 0 &&
    extracted.seller_score < 7.5
  ) {
    suggestions.push({
      key: "strengthen-trust-under-competition",
      severity: "medium",
      title: "Rekabette guven farkini guclendirin",
      detail:
        "Yuksek satici rekabeti ve sinirli satici puani birlikte guven bariyeri olusturabilecegi icin yorum kalitesi, magaza guveni ve teslimat deneyimi daha net desteklenmeli.",
    });
  }

  if (hasStrongCompetitorTrust(extracted) && typeof getOtherSellerScoreGap(extracted) === "number") {
    const scoreGap = getOtherSellerScoreGap(extracted) as number;
    if (scoreGap >= 0.5) {
      suggestions.push({
        key: "close-competitor-trust-gap",
        severity: "medium",
        title: "Rakip guven farkini kapatin",
        detail:
          "Diger saticilarda daha guclu magaza guveni sinyali olabilir; yorum memnuniyeti, satici puani ve resmi magaza guvenini daha belirgin hale getirerek farki daraltin.",
      });
    }
  }

  if (
    hasStrongCompetitorDelivery(extracted) &&
    extracted.has_free_shipping !== true &&
    (!hasText(extracted.delivery_type) || extracted.delivery_type === "standard")
  ) {
    suggestions.push({
      key: "improve-delivery-competitiveness",
      severity: "medium",
      title: "Teslimat rekabetini guclendirin",
      detail:
        "Rakip saticilarda hizli teslimat sinyali gorunurken mevcut teklifte teslimat avantaji zayif kalabilir; kargo vaadini, hizli teslimati veya ucretsiz kargo faydasini daha netlestirin.",
    });
  }

  if (!extracted.has_return_info) {
    suggestions.push({
      key: "show-return-policy",
      severity: "medium",
      title: "Iade bilgisini netlestirin",
      detail:
        "Iade kosullari gorunur oldugunda satin alma riski daha dusuk algilanir.",
    });
  }

  if (
    typeof extracted.shipping_days === "number" &&
    extracted.shipping_days >= 6
  ) {
    suggestions.push({
      key: "improve-delivery-promise",
      severity: "medium",
      title: "Teslimat vaadini guclendirin",
      detail:
        "Uzun teslim suresi donusum bariyeri olusturabilir; daha hizli kargo veya net teslim beklentisi sunun.",
    });
  }

  if (
    extracted.delivery_type === "standard" &&
    typeof extracted.shipping_days !== "number"
  ) {
    suggestions.push({
      key: "clarify-delivery-type",
      severity: "low",
      title: "Teslimat tipini daha net anlatin",
      detail:
        "Standart teslimat kullaniyorsaniz teslim beklentisini ve kargo vaadini daha gorunur hale getirin.",
    });
  }

  if (metrics.offerStrength.label === "weak") {
    suggestions.push({
      key: "improve-offer-clarity",
      severity: "medium",
      title: "Teklif gucunu daha gorunur yapin",
      detail:
        "Indirim, kargo avantaji ve stok sinyalleri varsa sayfada daha belirgin sunulmasi gerekir.",
    });
  }

  if (extracted.has_free_shipping === false) {
    suggestions.push({
      key: "evaluate-shipping-advantage",
      severity: "low",
      title: "Kargo avantajini guclendirin",
      detail:
        "Ucretsiz kargo veya daha net kargo avantaji, teklif gucunu daha cazip hale getirebilir.",
    });
  }

  return suggestions.slice(0, 5);
}

export function buildPriorityActions(
  extracted: ExtractedProductFields,
  metrics: DerivedMetrics,
  suggestions: AnalysisSuggestion[]
): PriorityAction[] {
  const base: Array<{ title: string; detail: string; weight: number }> = [];
  const lowRatedRatio = getLowRatedSampleRatio(extracted);

  const pushAction = (params: {
    title: string;
    detail: string;
    weight: number;
  }) => {
    if (base.some((item) => item.title === params.title)) return;
    base.push(params);
  };

  if (metrics.offerStrength.label === "weak") {
    const deliveryRisk =
      typeof extracted.shipping_days === "number" && extracted.shipping_days >= 6;
    const competitionRisk =
      typeof extracted.other_sellers_count === "number" &&
      extracted.other_sellers_count >= 4;

    pushAction({
      title: "Teklif gucunu ilk sirada toparlayin",
      detail:
        competitionRisk || deliveryRisk
          ? "Rekabet veya teslimat bariyeri varken fiyat, kargo ve kampanya farkini daha netlestirmek donusum uzerinde ilk etkiyi yaratir."
          : "Fiyat, kargo ve kampanya sinyalleri netlestiginde urunun teklif algisi daha guclu hale gelir.",
      weight: 100,
    });
  }

  if (
    metrics.trustStrength.label === "weak" ||
    (typeof extracted.seller_score === "number" &&
      extracted.seller_score > 0 &&
      extracted.seller_score < 7.5)
  ) {
    pushAction({
      title: "Guven bariyerini azaltin",
      detail:
        hasStrongCompetitorTrust(extracted)
          ? "Rakip saticilar daha guclu guven sinyali veriyorsa yorum memnuniyeti, satici puani ve resmi magaza guvenini birlikte belirginlestirmek gerekir."
          : "Satici puani, yorum kalitesi ve iade guveni daha gorunur oldugunda satin alma bariyeri azalir.",
      weight: 95,
    });
  }

  if (
    (extracted.favorite_count ?? 0) >= 500000 &&
    ((typeof extracted.review_count === "number" && extracted.review_count < 50) ||
      (lowRatedRatio != null && lowRatedRatio >= 0.4))
  ) {
    pushAction({
      title: "Sosyal kaniti hizla guclendirin",
      detail:
        "Ilgi yuksek kalirken yorum hacmi veya yorum tonu guven tasimiyorsa sepet oncesi kayip artar; yorum, puan ve musteri memnuniyeti sinyallerini ilk ekranda daha net toplayin.",
      weight: 94,
    });
  }

  if (
    metrics.contentQuality.label === "weak" ||
    (extracted.description_length || 0) < 120 ||
    extracted.has_specs === false
  ) {
    pushAction({
      title: "Icerik karar kalitesini guclendirin",
      detail:
        "Aciklama, teknik ozellikler ve maddeli anlatim birlikte guclendiginde urun neden alinmali sorusu daha net cevaplanir.",
      weight: 88,
    });
  }

  if (
    extracted.has_video === false ||
    (extracted.image_count || 0) < 3 ||
    metrics.visualStrength.label === "weak"
  ) {
    pushAction({
      title: "Vitrin anlatimini zenginlestirin",
      detail:
        "Video, kullanim senaryosu ve ek gorseller urunun algilanan kalitesini ve ikna hizini artirir.",
      weight: 78,
    });
  }

  if (
    Array.isArray(extracted.qa_snippets) &&
    extracted.qa_snippets.length > 0 &&
    extracted.has_faq === false
  ) {
    pushAction({
      title: "Tekrarlanan sorulari tek blokta kapatin",
      detail:
        "Musteri ayni konulari tekrar soruyorsa bu itirazlari aciklama ve SSS katmaninda daha gorunur cevaplamak karar hizini artirir.",
      weight: 72,
    });
  }

  if (
    hasStrongCompetitorDelivery(extracted) &&
    extracted.has_free_shipping !== true &&
    (!hasText(extracted.delivery_type) || extracted.delivery_type === "standard")
  ) {
    pushAction({
      title: "Teslimat rekabetine cevap verin",
      detail:
        "Rakiplerde hizli teslimat gorunuyorsa kargo vaadini, ucretsiz kargo avantajini veya hizli teslimat secenegini daha belirgin sunmak gerekir.",
      weight: 92,
    });
  }

  for (const suggestion of suggestions) {
    pushAction({
      title: suggestion.title,
      detail: suggestion.detail,
      weight:
        suggestion.severity === "high"
          ? 80
          : suggestion.severity === "medium"
            ? 60
            : 40,
    });
  }

  return base
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((item, index) => ({
      priority: index + 1,
      title: item.title,
      detail: item.detail,
    }));
}

function getPriceCompetitiveness(
  extracted: ExtractedProductFields
): string | null {
  if (typeof extracted.normalized_price !== "number") {
    return null;
  }

  if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number"
  ) {
    if (extracted.other_sellers_summary.cheaper_count > 0) {
      const delta = getCompetitorPriceDelta(extracted);
      return delta && delta > 0
        ? `En dusuk rakipten ${formatPriceNumber(delta)} daha pahali`
        : "Daha ucuz rakip saticilar var";
    }

    if (isCheapestOffer(extracted)) {
      if (extracted.other_sellers_summary.same_price_count > 0) {
        return "En dusuk fiyat bandinda, esit fiyatli rakipler var";
      }
      return "Rakipler arasinda en dusuk fiyat";
    }
  }

  if (
    typeof extracted.original_price === "number" &&
    typeof extracted.discount_rate === "number" &&
    extracted.discount_rate >= 10 &&
    extracted.has_free_shipping &&
    typeof extracted.shipping_days === "number" &&
    extracted.shipping_days <= 3
  ) {
    return "Guclu teklif ve hizli teslimat sinyali";
  }

  if (
    typeof extracted.original_price === "number" &&
    typeof extracted.discount_rate === "number" &&
    extracted.discount_rate >= 10
  ) {
    return hasText(extracted.campaign_label)
      ? `Indirim ve kampanya sinyali mevcut`
      : "Indirim sinyali mevcut";
  }

  if (
    extracted.has_free_shipping &&
    typeof extracted.shipping_days === "number" &&
    extracted.shipping_days <= 3
  ) {
    return "Ucretsiz kargo ve hizli teslimat avantaji";
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 4 &&
    !extracted.has_free_shipping &&
    typeof extracted.discount_rate !== "number"
  ) {
    return "Rekabet baskisi var, teklif farki zayif gorunuyor";
  }

  if (
    hasStrongCompetitorTrust(extracted) &&
    typeof getOtherSellerScoreGap(extracted) === "number" &&
    (getOtherSellerScoreGap(extracted) as number) >= 0.5
  ) {
    return "Rakip guven seviyesi daha guclu gorunuyor";
  }

  if (
    hasStrongCompetitorDelivery(extracted) &&
    extracted.has_free_shipping !== true &&
    (!hasText(extracted.delivery_type) || extracted.delivery_type === "standard")
  ) {
    return "Rakip teslimat gucu daha guclu gorunuyor";
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 2
  ) {
    return "Rekabet bulunan urunde fiyat konumu gorunuyor";
  }

  if (extracted.has_free_shipping) {
    return "Kargo avantaji ile desteklenen teklif";
  }

  if (hasText(extracted.campaign_label) || extracted.has_campaign) {
    return "Kampanya ile desteklenen teklif";
  }

  if (
    typeof extracted.shipping_days === "number" &&
    extracted.shipping_days >= 6
  ) {
    return "Fiyat var ama teslimat bariyeri olusabilir";
  }

  return "Temel fiyat sinyali mevcut";
}

function buildSummary(params: {
  platform: string | null;
  extracted: ExtractedProductFields;
  seoScore: number;
  completenessScore: number;
  conversionScore: number;
  derivedMetrics: DerivedMetrics;
}) {
  const { platform, extracted, seoScore, completenessScore, conversionScore, derivedMetrics } =
    params;

  const parts: string[] = [];
  const reviewRiskSummary = getReviewRiskSummary(extracted);
  const qaThemes = extractQaThemes(extracted);

  parts.push(
    `${platform || "Trendyol"} urun sayfasi icin veri odakli analiz olusturuldu.`
  );

  if (derivedMetrics.contentQuality.label === "weak") {
    parts.push("Icerik kalitesi satis kararini desteklemekte zorlanabilir.");
  }

  if (derivedMetrics.trustStrength.label === "weak") {
    parts.push("Guven sinyalleri zayif oldugu icin ikna gucu dusuyor olabilir.");
  }

  if (
    typeof extracted.seller_score === "number" &&
    extracted.seller_score > 0 &&
    extracted.seller_score < 7.5
  ) {
    parts.push("Satici puani guven tarafinda ek bariyer olusturabilir.");
  }

  if (derivedMetrics.offerStrength.label === "weak") {
    parts.push("Fiyat ve teklif gucu yeterince net gorunmuyor olabilir.");
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 2
  ) {
    parts.push(
      extracted.other_sellers_count >= 4
        ? "Ayni urunde yuksek satici sayisi gorunmesi rekabet baskisini artiriyor olabilir."
        : "Ayni urunde birden fazla satici gorunmesi ayrisma ihtiyacini artiriyor olabilir."
    );
  }

  if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary.cheaper_count === "number" &&
    extracted.other_sellers_summary.cheaper_count > 0
  ) {
    const delta = getCompetitorPriceDelta(extracted);
    parts.push(
      delta && delta > 0
        ? `En dusuk rakip fiyat senden ${formatPriceNumber(delta)} daha avantajli gorunuyor.`
        : "Rakip tarafta daha dusuk fiyat sinyali gorunuyor."
    );
  } else if (isCheapestOffer(extracted) && extracted.other_sellers_summary?.count) {
    parts.push("Rakip saticilar icinde en dusuk fiyat sinyali mevcut.");
  }

  if (hasStrongCompetitorTrust(extracted) && typeof getOtherSellerScoreGap(extracted) === "number") {
    const scoreGap = getOtherSellerScoreGap(extracted) as number;
    if (scoreGap >= 0.5) {
      parts.push("Rakip saticilarin guven seviyesi daha yuksek gorunebilir.");
    }
  }

  if (
    hasStrongCompetitorDelivery(extracted) &&
    extracted.has_free_shipping !== true &&
    (!hasText(extracted.delivery_type) || extracted.delivery_type === "standard")
  ) {
    parts.push("Rakip tarafta teslimat avantaji daha guclu algilanabilir.");
  }

  if (extracted.official_seller) {
    parts.push("Resmi satici sinyali guven tarafini destekliyor.");
  }

  if (hasText(extracted.campaign_label)) {
    parts.push(`Kampanya gorunurlugu mevcut: ${extracted.campaign_label}.`);
  }

  if (reviewRiskSummary) {
    parts.push(reviewRiskSummary);
  }

  if (qaThemes?.length) {
    parts.push(
      `Soru-cevap tarafinda en cok ${qaThemes
        .map((item) => item.label)
        .join(", ")} konulari soruluyor.`
    );
  }

  if (
    typeof extracted.follower_count === "number" &&
    extracted.follower_count >= 1000
  ) {
    parts.push("Magaza takipci tabani guven sinyalini destekliyor.");
  }

  if (
    Array.isArray(extracted.seller_badges) &&
    extracted.seller_badges.some((badge) => /hizli teslimat/i.test(badge))
  ) {
    parts.push("Hizli teslimat rozeti teklif hizini destekliyor.");
  }

  if (derivedMetrics.visualStrength.label === "weak") {
    parts.push("Vitrin gucu gorsel veya medya tarafinda sinirli olabilir.");
  }

  if (extracted.extractor_status === "blocked") {
    parts.push("Bazi Trendyol alanlari cekilemedigi icin analiz kapsami sinirli kaldi.");
  }

  parts.push(
    `SEO ${seoScore}/100, veri butunlugu ${completenessScore}/100, donusum sinyalleri ${conversionScore}/100.`
  );

  return parts.join(" ");
}

export function buildAnalysis({
  platform,
  extracted,
  planContext = "free",
}: BuildAnalysisParams): BuildAnalysisResult {
  const seoScore = getSeoScore(extracted);
  const dataCompletenessScore = getCompletenessScore(extracted);
  const conversionScore = getConversionScore(extracted);

  const overallScore = clampScore(
    seoScore * 0.35 + dataCompletenessScore * 0.35 + conversionScore * 0.3
  );

  const derivedMetrics = buildDerivedMetrics(extracted);
  const strengths = getStrengths(extracted, derivedMetrics);
  const weaknesses = getWeaknesses(extracted, derivedMetrics);
  const suggestions = getSuggestions(extracted, derivedMetrics);
  const priorityActions = buildPriorityActions(extracted, derivedMetrics, suggestions);

  const summary = buildSummary({
    platform,
    extracted,
    seoScore,
    completenessScore: dataCompletenessScore,
    conversionScore,
    derivedMetrics,
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

  return {
    summary,
    seoScore,
    dataCompletenessScore,
    conversionScore,
    overallScore,
    extractedData: extracted,
    derivedMetrics,
    decisionSupportPacket,
    strengths,
    weaknesses,
    suggestions,
    priorityActions,
    analysisTrace,
    priceCompetitiveness: getPriceCompetitiveness(extracted),
    dataSource: "real-extraction",
  };
}
