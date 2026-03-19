"use client";

import Link from "next/link";
import { AnalysisResult } from "@/types";
import { formatCoverageFields } from "@/lib/coverage-utils";
import { getPlanLabel } from "@/lib/plan-label";
import { getPriceCompetitivenessLabel } from "@/lib/price-competitiveness";
import { getCompetitorNarrative } from "@/lib/competitor-summary";

type Props = {
  result: AnalysisResult;
  autoSaved?: boolean;
};

type SuggestionItem = {
  key?: string;
  icon?: string;
  severity?: "high" | "medium" | "low";
  title?: string;
  detail?: string;
};

type PriorityActionItem = {
  priority?: number;
  title?: string;
  detail?: string;
};

type AccessState = {
  plan?: string;
  lockedSections?: string[];
  teaserSections?: string[];
  maxFindings?: number;
  maxSuggestions?: number;
  maxPriorityActions?: number;
};

type TeaserItem = {
  key?: string;
  teaser?: string;
};

type DerivedMetricShape = {
  score?: number | null;
  label?: string;
  evidence?: string[];
};

type DerivedMetricsShape = {
  contentQuality?: DerivedMetricShape;
  trustStrength?: DerivedMetricShape;
  offerStrength?: DerivedMetricShape;
  visualStrength?: DerivedMetricShape;
  decisionClarity?: DerivedMetricShape;
  reviewRisk?: DerivedMetricShape;
};

type CoverageShape = {
  availableFields?: string[];
  missingFields?: string[];
  confidence?: "high" | "medium" | "low";
} | null;

type ExtractedDataShape = {
  title?: string | null;
  meta_description?: string | null;
  h1?: string | null;
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
  has_shipping_info?: boolean;
  has_return_info?: boolean;
  has_specs?: boolean;
  has_faq?: boolean;
  has_free_shipping?: boolean;
  shipping_days?: number | null;
  delivery_type?: string | null;
  has_video?: boolean;
  has_brand_page?: boolean;
  official_seller?: boolean;
  has_campaign?: boolean;
  campaign_label?: string | null;
  promotion_labels?: string[] | null;
  seller_name?: string | null;
  merchant_id?: number | null;
  listing_id?: string | null;
  seller_badges?: string[] | null;
  favorite_count?: number | null;
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
  other_seller_offers?: Array<{
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
  }> | null;
  stock_status?: string | null;
  [key: string]: unknown;
};

type SignalItem = {
  label: string;
  value: string | null;
  tone?: "positive" | "warning" | "neutral";
};

type QualityCard = {
  title: string;
  value: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
};

function getMetricLabelMeta(label?: string) {
  if (label === "strong") {
    return { text: "Guclu", tone: "positive" as const };
  }

  if (label === "medium") {
    return { text: "Orta", tone: "neutral" as const };
  }

  if (label === "weak") {
    return { text: "Zayif", tone: "warning" as const };
  }

  return { text: "Veri sinirli", tone: "neutral" as const };
}

function getUpgradeCopy(plan?: string) {
  if (plan === "guest") {
    return {
      title: "Tam rapor icin giris yap",
      detail:
        "Daha fazla bulgu, daha fazla oneriler ve premium bolum onizlemeleri icin uye girisi yapin.",
      cta: "Giris Yap",
      href: "/login",
    };
  }

  return {
    title: "Premium bolumleri ac",
    detail:
      "Fiyat konumlandirma, export ve premium aksiyon plani gibi bolumler ust pakette tam acilir.",
    cta: "Dashboard'a Git",
    href: "/dashboard",
  };
}

function getTeaserTitle(key?: string) {
  switch (key) {
    case "advancedOfferAnalysis":
      return "Gelismis teklif analizi";
    case "competitorAnalysis":
      return "Rakip ve diger saticilar";
    case "premiumActionPlan":
      return "Premium aksiyon plani";
    case "export":
      return "Export";
    case "history":
      return "Genis rapor gecmisi";
    case "reanalysis":
      return "Yeniden analiz";
    default:
      return (key || "premium-bolum").replace(/([A-Z])/g, " $1");
  }
}

function getLockedSectionTitle(sectionKey: string) {
  switch (sectionKey) {
    case "advancedOfferAnalysis":
      return "Gelismis teklif analizi";
    case "competitorAnalysis":
      return "Rakip ve diger saticilar";
    case "premiumActionPlan":
      return "Premium aksiyon plani";
    case "history":
      return "Rapor gecmisi";
    case "export":
      return "Export";
    case "reanalysis":
      return "Yeniden analiz";
    default:
      return sectionKey.replace(/([A-Z])/g, " $1");
  }
}

function getScoreTone(score?: number | null) {
  if (score == null) {
    return {
      text: "-",
      label: "Skor yok",
      color: "#FB923C",
      glow: "rgba(251,146,60,0.18)",
      background:
        "linear-gradient(135deg, rgba(251,146,60,0.14), rgba(251,146,60,0.06))",
      border: "rgba(251,146,60,0.22)",
    };
  }

  if (score >= 80) {
    return {
      text: `${score}/100`,
      label: "Guclu gorunum",
      color: "#4ADE80",
      glow: "rgba(74,222,128,0.20)",
      background:
        "linear-gradient(135deg, rgba(74,222,128,0.16), rgba(74,222,128,0.06))",
      border: "rgba(74,222,128,0.24)",
    };
  }

  if (score >= 50) {
    return {
      text: `${score}/100`,
      label: "Gelistirilebilir",
      color: "#FB923C",
      glow: "rgba(251,146,60,0.20)",
      background:
        "linear-gradient(135deg, rgba(251,146,60,0.16), rgba(251,146,60,0.06))",
      border: "rgba(251,146,60,0.24)",
    };
  }

  return {
    text: `${score}/100`,
    label: "Zayif gorunum",
    color: "#F87171",
    glow: "rgba(248,113,113,0.20)",
    background:
      "linear-gradient(135deg, rgba(248,113,113,0.16), rgba(248,113,113,0.06))",
    border: "rgba(248,113,113,0.24)",
  };
}

function getCoverageTone(confidence?: "high" | "medium" | "low") {
  if (confidence === "high") {
    return {
      label: "Yuksek kapsam",
      color: "#4ADE80",
      border: "rgba(74,222,128,0.22)",
      background: "rgba(74,222,128,0.10)",
    };
  }

  if (confidence === "medium") {
    return {
      label: "Orta kapsam",
      color: "#FB923C",
      border: "rgba(251,146,60,0.22)",
      background: "rgba(251,146,60,0.10)",
    };
  }

  return {
    label: "Sinirli kapsam",
    color: "#F87171",
    border: "rgba(248,113,113,0.22)",
    background: "rgba(248,113,113,0.10)",
  };
}

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function formatPriceDelta(delta?: number | null) {
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
    return "Ayni fiyat";
  }

  const abs = formatCurrency(Math.abs(delta));
  if (!abs) return null;
  return delta < 0 ? `${abs} daha ucuz` : `${abs} daha pahali`;
}

function getDeltaVisual(delta?: number | null) {
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
    return {
      arrow: "›",
      color: "#FB923C",
      background: "rgba(251,146,60,0.12)",
      border: "rgba(251,146,60,0.18)",
    };
  }

  if (delta < 0) {
    return {
      arrow: "v",
      color: "#4ADE80",
      background: "rgba(74,222,128,0.12)",
      border: "rgba(74,222,128,0.18)",
    };
  }

  return {
    arrow: "^",
    color: "#F87171",
    background: "rgba(248,113,113,0.12)",
    border: "rgba(248,113,113,0.18)",
  };
}

function getPriceTone(value?: string | null) {
  return getPriceCompetitivenessLabel(value);
}

function formatSignalValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Var" : "Yok";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return null;
}

function formatRatingBreakdown(
  breakdown: ExtractedDataShape["rating_breakdown"]
) {
  if (!breakdown) return null;

  const parts = [
    typeof breakdown.five_star === "number" ? `5? ${breakdown.five_star}` : null,
    typeof breakdown.four_star === "number" ? `4? ${breakdown.four_star}` : null,
    typeof breakdown.three_star === "number" ? `3? ${breakdown.three_star}` : null,
    typeof breakdown.two_star === "number" ? `2? ${breakdown.two_star}` : null,
    typeof breakdown.one_star === "number" ? `1? ${breakdown.one_star}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatDeliveryTypeLabel(value: string | null) {
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

function getSignalTone(label: string, value: string | null): SignalItem["tone"] {
  if (!value) return "neutral";

  if (label === "Ucretsiz kargo") {
    return value === "Var" ? "positive" : "warning";
  }

  if (label === "Kargo bilgisi") {
    return value === "Var" ? "positive" : "warning";
  }

  if (label === "Iade bilgisi") {
    return value === "Var" ? "positive" : "warning";
  }

  if (label === "Stok durumu") {
    const lower = value.toLowerCase();
    if (lower.includes("stokta") || lower.includes("var") || lower.includes("available")) {
      return "positive";
    }
    if (lower.includes("tuk") || lower.includes("yok")) {
      return "warning";
    }
    return "neutral";
  }

  if (label === "Video") {
    return value === "Var" ? "positive" : "warning";
  }

  if (label === "Marka sayfasi") {
    return value === "Var" ? "positive" : "neutral";
  }

  if (label === "Resmi satici") {
    return value === "Var" ? "positive" : "neutral";
  }

  if (label === "Satici rozetleri") {
    return "positive";
  }

  if (label === "Satici puani") {
    const score = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(score) && score >= 8.5) return "positive";
    if (Number.isFinite(score) && score < 7.5) return "warning";
    return "neutral";
  }

  if (label === "Diger satici") {
    const count = Number.parseInt(value, 10);
    if (Number.isFinite(count) && count >= 4) return "warning";
    if (Number.isFinite(count) && count >= 2) return "neutral";
    return "positive";
  }

  if (label === "Rakip ozeti") {
    if (value.toLowerCase().includes("hizli teslimat")) return "warning";
    return "neutral";
  }

  if (label === "Kampanya") {
    return value === "Var" ? "positive" : "neutral";
  }

  if (label === "Ozellik alani") {
    return value === "Var" ? "positive" : "warning";
  }

  if (label === "SSS") {
    return value === "Var" ? "positive" : "neutral";
  }

  if (label === "Teslim suresi") {
    const days = Number.parseInt(value, 10);
    if (Number.isFinite(days) && days >= 6) return "warning";
    if (Number.isFinite(days) && days <= 3) return "positive";
    return "neutral";
  }

  if (label === "Puan / Yorum") {
    return "positive";
  }

  if (label === "Indirim") {
    return "positive";
  }

  return "neutral";
}

function getSuggestionVisual(item: SuggestionItem) {
  const text = `${item.title || ""} ${item.detail || ""}`.toLowerCase();

  if (item.severity === "high") {
    return {
      icon: "!!",
      tone: "high",
    } as const;
  }

  if (text.includes("video")) {
    return {
      icon: "VD",
      tone: "medium",
    } as const;
  }

  if (text.includes("kargo") || text.includes("teslim")) {
    return {
      icon: "KG",
      tone: "medium",
    } as const;
  }

  if (text.includes("gorsel") || text.includes("icerik") || text.includes("aciklama")) {
    return {
      icon: "IC",
      tone: "medium",
    } as const;
  }

  if (item.severity === "low") {
    return {
      icon: "OK",
      tone: "low",
    } as const;
  }

  return {
    icon: item.icon || "!",
    tone: item.severity || "medium",
  } as const;
}

function buildQuickDiagnosis(extracted: ExtractedDataShape) {
  const strengths: string[] = [];
  const risks: string[] = [];

  if (
    typeof extracted.rating_value === "number" &&
    extracted.rating_value >= 4.5 &&
    typeof extracted.review_count === "number" &&
    extracted.review_count >= 50
  ) {
    strengths.push("puan ve yorum guclu");
  }

  if (extracted.has_free_shipping === true) {
    strengths.push("ucretsiz kargo var");
  }

  if (extracted.official_seller === true) {
    strengths.push("resmi satici guveni var");
  }

  if (Array.isArray(extracted.seller_badges) && extracted.seller_badges.length > 0) {
    strengths.push("satici rozetleri gorunuyor");
  }

  if (
    Array.isArray(extracted.seller_badges) &&
    extracted.seller_badges.some((badge) => /hizli teslimat/i.test(badge))
  ) {
    strengths.push("hizli teslimat rozeti var");
  }

  if (
    typeof extracted.seller_score === "number" &&
    extracted.seller_score >= 8.5
  ) {
    strengths.push("satici puani guclu");
  }

  if (
    typeof extracted.follower_count === "number" &&
    extracted.follower_count >= 1000
  ) {
    strengths.push("magaza takipci tabani var");
  }

  if (extracted.has_brand_page === true) {
    strengths.push("marka guveni destekleniyor");
  }

  if (typeof extracted.image_count === "number" && extracted.image_count >= 5) {
    strengths.push("gorsel sayisi yeterli");
  }

  if (
    typeof extracted.question_count === "number" &&
    extracted.question_count >= 5
  ) {
    strengths.push("soru-cevap guveni var");
  }

  if (extracted.has_specs === true && extracted.has_faq === true) {
    strengths.push("bilgi tamligi guclu");
  }

  if (extracted.has_video === false) {
    risks.push("video tespit edilemedi");
  }

  if (typeof extracted.shipping_days === "number" && extracted.shipping_days >= 6) {
    risks.push("teslim suresi uzun");
  }

  if (
    typeof extracted.bullet_point_count === "number" &&
    extracted.bullet_point_count > 0 &&
    extracted.bullet_point_count < 4
  ) {
    risks.push("icerik maddeleri sinirli");
  }

  if (
    typeof extracted.seller_score === "number" &&
    extracted.seller_score > 0 &&
    extracted.seller_score < 7.5
  ) {
    risks.push("satici puani zayif");
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 2
  ) {
    risks.push(
      extracted.other_sellers_count >= 4
        ? "rekabet baskisi yuksek"
        : "rekabet yogunlugu var"
    );
  }

  if (
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 4 &&
    extracted.has_free_shipping !== true &&
    typeof extracted.discount_rate !== "number"
  ) {
    risks.push("teklif farki sinirli");
  }

  if (
    extracted.other_sellers_summary &&
    typeof extracted.seller_score === "number" &&
    typeof extracted.other_sellers_summary.avg_score === "number" &&
    extracted.other_sellers_summary.avg_score - extracted.seller_score >= 0.5
  ) {
    risks.push("rakip guveni daha yuksek");
  }

  if (
    extracted.other_sellers_summary &&
    extracted.other_sellers_summary.fast_delivery_count >= 2 &&
    extracted.has_free_shipping !== true
  ) {
    risks.push("rakip teslimat avantaji var");
  }

  if (extracted.has_specs === false) {
    risks.push("teknik ozellikler zayif");
  }

  if (extracted.has_return_info === false) {
    risks.push("iade guveni zayif");
  }

  if (
    typeof extracted.stock_status === "string" &&
    /tukendi|stok yok|out of stock/i.test(extracted.stock_status)
  ) {
    risks.push("stok durumu sorunlu");
  }

  if (strengths.length === 0 && risks.length === 0) {
    return null;
  }

  const parts: string[] = [];

  if (strengths.length > 0) {
    parts.push(`Guclu: ${strengths.slice(0, 2).join(", ")}`);
  }

  if (risks.length > 0) {
    parts.push(`Risk: ${risks.slice(0, 2).join(", ")}`);
  }

  return parts.join(" | ");
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function buildQualityCards(extracted: ExtractedDataShape): QualityCard[] {
  const cards: QualityCard[] = [];

  const titleSignals =
    (hasText(extracted.title) ? 1 : 0) +
    (hasText(extracted.h1) ? 1 : 0) +
    (hasText(extracted.meta_description) ? 1 : 0);

  let titleTone: QualityCard["tone"] = "warning";
  let titleValue = "Zayif";

  if (titleSignals === 3) {
    titleTone = "positive";
    titleValue = "Guclu";
  } else if (titleSignals === 2) {
    titleTone = "neutral";
    titleValue = "Orta";
  }

  cards.push({
    title: "Baslik kalitesi",
    value: titleValue,
    detail: `${hasText(extracted.title) ? "title" : "title yok"}, ${hasText(extracted.h1) ? "h1" : "h1 yok"}, ${hasText(extracted.meta_description) ? "meta var" : "meta yok"}`,
    tone: titleTone,
  });

  const descriptionLength = extracted.description_length || 0;
  let descriptionTone: QualityCard["tone"] = "warning";
  let descriptionValue = "Zayif";
  const descriptionSignals =
    (descriptionLength >= 120 ? 1 : 0) +
    (typeof extracted.bullet_point_count === "number" &&
    extracted.bullet_point_count >= 3
      ? 1
      : 0) +
    (extracted.has_video ? 1 : 0);

  if (descriptionLength >= 300 && descriptionSignals >= 2) {
    descriptionTone = "positive";
    descriptionValue = "Guclu";
  } else if (descriptionLength >= 120 || descriptionSignals >= 2) {
    descriptionTone = "neutral";
    descriptionValue = "Orta";
  }

  cards.push({
    title: "Aciklama kalitesi",
    value: descriptionValue,
    detail: [
      descriptionLength > 0
        ? `${descriptionLength} karakter aciklama`
        : "aciklama verisi yok",
      typeof extracted.bullet_point_count === "number"
        ? `${extracted.bullet_point_count} madde`
        : "madde yok",
      extracted.has_video ? "video var" : "video tespit edilemedi",
    ].join(", "),
    tone: descriptionTone,
  });

  const completenessSignals =
    (typeof extracted.bullet_point_count === "number" &&
    extracted.bullet_point_count >= 3
      ? 1
      : 0) +
    (extracted.has_specs ? 1 : 0) +
    (extracted.has_faq ? 1 : 0);

  let completenessTone: QualityCard["tone"] = "warning";
  let completenessValue = "Zayif";

  if (completenessSignals >= 3) {
    completenessTone = "positive";
    completenessValue = "Guclu";
  } else if (
    completenessSignals >= 1 ||
    (typeof extracted.question_count === "number" && extracted.question_count > 0)
  ) {
    completenessTone = "neutral";
    completenessValue = "Orta";
  }

  cards.push({
    title: "Bilgi tamligi",
    value: completenessValue,
    detail: [
      typeof extracted.bullet_point_count === "number"
        ? `${extracted.bullet_point_count} madde`
        : "madde yok",
      extracted.has_specs ? "ozellik var" : "ozellik yok",
      extracted.has_faq ? "sss var" : "sss yok",
      typeof extracted.question_count === "number"
        ? `${extracted.question_count} soru`
        : "soru verisi yok",
    ].join(", "),
    tone: completenessTone,
  });

  let trustTone: QualityCard["tone"] = "warning";
  let trustValue = "Zayif";
  const trustSignals =
    (typeof extracted.rating_value === "number" && extracted.rating_value >= 4.3 ? 1 : 0) +
    (typeof extracted.review_count === "number" && extracted.review_count >= 20 ? 1 : 0) +
    (typeof extracted.seller_score === "number" && extracted.seller_score >= 8.5 ? 1 : 0) +
    (extracted.official_seller === true ? 1 : 0) +
    (extracted.has_return_info === true ? 1 : 0);

  if (trustSignals >= 4) {
    trustTone = "positive";
    trustValue = "Guclu";
  } else if (trustSignals >= 2) {
    trustTone = "neutral";
    trustValue = "Orta";
  }

  cards.push({
    title: "Guven gorunumu",
    value: trustValue,
    detail: [
      typeof extracted.rating_value === "number"
        ? `${extracted.rating_value} puan`
        : "puan yok",
      typeof extracted.review_count === "number"
        ? `${extracted.review_count} yorum`
        : "yorum yok",
      typeof extracted.seller_score === "number"
        ? `${extracted.seller_score.toLocaleString("tr-TR", {
            minimumFractionDigits: extracted.seller_score % 1 === 0 ? 0 : 1,
            maximumFractionDigits: 1,
          })} satici puani`
        : "satici puani yok",
      extracted.official_seller === true ? "resmi satici" : "resmi satici yok",
      extracted.has_return_info === true ? "iade var" : "iade yok",
    ].join(", "),
    tone: trustTone,
  });

  let offerTone: QualityCard["tone"] = "warning";
  let offerValue = "Zayif";
  const hasDiscount = typeof extracted.discount_rate === "number";
  const hasCompetition =
    typeof extracted.other_sellers_count === "number" &&
    extracted.other_sellers_count >= 2;

  if (
    (hasDiscount || extracted.has_free_shipping === true) &&
    typeof extracted.shipping_days === "number" &&
    extracted.shipping_days <= 3
  ) {
    offerTone = "positive";
    offerValue = "Guclu";
  } else if (
    hasDiscount ||
    extracted.has_free_shipping === true ||
    !hasCompetition
  ) {
    offerTone = "neutral";
    offerValue = "Orta";
  }

  cards.push({
    title: "Teklif gucu",
    value: offerValue,
    detail: [
      hasDiscount ? `%${extracted.discount_rate} indirim` : "indirim verisi yok",
      extracted.has_free_shipping === true
        ? "ucretsiz kargo var"
        : "ucretsiz kargo yok",
      typeof extracted.shipping_days === "number"
        ? `${extracted.shipping_days} gun teslimat`
        : "teslimat verisi yok",
      typeof extracted.other_sellers_count === "number"
        ? `${extracted.other_sellers_count} diger satici`
        : "rekabet verisi yok",
    ].join(", "),
    tone: offerTone,
  });

  if (extracted.other_sellers_summary) {
    let competitionTone: QualityCard["tone"] = "neutral";
    let competitionValue = "Orta";

    const scoreGap =
      typeof extracted.seller_score === "number" &&
      typeof extracted.other_sellers_summary.avg_score === "number"
        ? extracted.other_sellers_summary.avg_score - extracted.seller_score
        : null;

    if (
      extracted.other_sellers_summary.count >= 4 &&
      ((typeof scoreGap === "number" && scoreGap >= 0.5) ||
        extracted.other_sellers_summary.fast_delivery_count >= 2)
    ) {
      competitionTone = "warning";
      competitionValue = "Baski yuksek";
    } else if (extracted.other_sellers_summary.count <= 1) {
      competitionTone = "positive";
      competitionValue = "Sinirli";
    }

    cards.push({
      title: "Rekabet gorunumu",
      value: competitionValue,
      detail: [
        `${extracted.other_sellers_summary.count} diger satici`,
        typeof extracted.other_sellers_summary.avg_score === "number"
          ? `ort. puan ${extracted.other_sellers_summary.avg_score.toLocaleString("tr-TR", {
              minimumFractionDigits: extracted.other_sellers_summary.avg_score % 1 === 0 ? 0 : 1,
              maximumFractionDigits: 1,
            })}`
          : "puan verisi sinirli",
        extracted.other_sellers_summary.fast_delivery_count > 0
          ? `${extracted.other_sellers_summary.fast_delivery_count} hizli teslimat`
          : "hizli teslimat sinyali yok",
      ].join(", "),
      tone: competitionTone,
    });
  }

  return cards;
}

export default function AnalysisResultBox({ result, autoSaved }: Props) {
  const seoTone = getScoreTone(result.seoScore);
  const conversionTone = getScoreTone(result.conversionScore);
  const overallTone = getScoreTone(result.overallScore);
  const completenessTone = getScoreTone(result.dataCompletenessScore);
  const extracted = (result.extractedData || {}) as ExtractedDataShape;
  const access = (result.access || null) as AccessState | null;
  const derivedMetrics = (result.derivedMetrics || null) as DerivedMetricsShape | null;
  const coverage = (result.coverage || null) as CoverageShape;
  const quickDiagnosis = buildQuickDiagnosis(extracted);
  const competitorNarrative = getCompetitorNarrative({
    summary: extracted.other_sellers_summary || null,
    sellerScore:
      typeof extracted.seller_score === "number" ? extracted.seller_score : null,
    hasFreeShipping: extracted.has_free_shipping === true,
    shippingDays:
      typeof extracted.shipping_days === "number" ? extracted.shipping_days : null,
    deliveryType:
      typeof extracted.delivery_type === "string" ? extracted.delivery_type : null,
  });
  const competitorOffers = Array.isArray(extracted.other_seller_offers)
    ? extracted.other_seller_offers.slice(0, 10)
    : [];
  const ownNormalizedPrice =
    typeof extracted.normalized_price === "number" ? extracted.normalized_price : null;
  const sortedCompetitorOffers = [...competitorOffers].sort((a, b) => {
    const aPrice =
      typeof a.price === "number" ? a.price : Number.POSITIVE_INFINITY;
    const bPrice =
      typeof b.price === "number" ? b.price : Number.POSITIVE_INFINITY;
    return aPrice - bPrice;
  });
  const pricedCompetitorOffers = sortedCompetitorOffers.filter(
    (offer) => typeof offer.price === "number"
  );
  const cheaperCompetitorOffers =
    typeof ownNormalizedPrice === "number"
      ? pricedCompetitorOffers.filter((offer) => (offer.price as number) < ownNormalizedPrice)
      : [];
  const samePriceCompetitorOffers =
    typeof ownNormalizedPrice === "number"
      ? pricedCompetitorOffers.filter((offer) => (offer.price as number) === ownNormalizedPrice)
      : [];
  const moreExpensiveCompetitorOffers =
    typeof ownNormalizedPrice === "number"
      ? pricedCompetitorOffers.filter((offer) => (offer.price as number) > ownNormalizedPrice)
      : [];
  const cheapestCompetitorDelta =
    typeof ownNormalizedPrice === "number" &&
    pricedCompetitorOffers.length > 0 &&
    typeof pricedCompetitorOffers[0]?.price === "number"
      ? (pricedCompetitorOffers[0].price as number) - ownNormalizedPrice
      : null;
  const competitorHeadline =
    cheaperCompetitorOffers.length > 0
      ? `${cheaperCompetitorOffers.length} rakip senden daha ucuz. En dusuk fark ${formatCurrency(
          Math.abs(cheapestCompetitorDelta ?? 0)
        )}.`
      : pricedCompetitorOffers.length > 0 && ownNormalizedPrice != null
        ? "Gorunen rakipler icinde en dusuk fiyat sendeki teklifte."
        : "Rakip teklifleri bulundu; fiyat karsilastirmasi sinirli veriyle yapildi.";
  const reviewSnippets = Array.isArray(extracted.review_snippets)
    ? extracted.review_snippets.slice(0, 3)
    : [];
  const qaSnippets = Array.isArray(extracted.qa_snippets)
    ? extracted.qa_snippets.slice(0, 4)
    : [];
  const qualityCards = buildQualityCards(extracted);
  const coverageTone = getCoverageTone(coverage?.confidence);
  const availableFields = Array.isArray(coverage?.availableFields)
    ? coverage?.availableFields ?? []
    : [];
  const missingFields = Array.isArray(coverage?.missingFields)
    ? coverage?.missingFields ?? []
    : [];

  const suggestions = Array.isArray(
    (result as AnalysisResult & { suggestions?: SuggestionItem[] | null })
      .suggestions
  )
    ? (((result as AnalysisResult & { suggestions?: SuggestionItem[] | null })
        .suggestions as SuggestionItem[]) ?? [])
    : [];

  const priorityActions = Array.isArray(
    (result as AnalysisResult & {
      priorityActions?: PriorityActionItem[] | null;
    }).priorityActions
  )
    ? (((result as AnalysisResult & {
        priorityActions?: PriorityActionItem[] | null;
      }).priorityActions as PriorityActionItem[]) ?? [])
    : [];

  const teaserItems = Array.isArray(
    (result as AnalysisResult & { teaserSections?: TeaserItem[] | null })
      .teaserSections
  )
    ? (((result as AnalysisResult & { teaserSections?: TeaserItem[] | null })
        .teaserSections as TeaserItem[]) ?? [])
    : [];
  const lockedSections = access?.lockedSections ?? [];
  const upgradeCopy = getUpgradeCopy(access?.plan);

  const derivedMetricCards = [
    {
      title: "Icerik",
      metric: derivedMetrics?.contentQuality,
    },
    {
      title: "Guven",
      metric: derivedMetrics?.trustStrength,
    },
    {
      title: "Teklif",
      metric: derivedMetrics?.offerStrength,
    },
    {
      title: "Vitrin",
      metric: derivedMetrics?.visualStrength,
    },
    {
      title: "Karar kolayligi",
      metric: derivedMetrics?.decisionClarity,
    },
    {
      title: "Yorum riski",
      metric: derivedMetrics?.reviewRisk,
    },
  ].filter((item) => item.metric);

  const signalItems: SignalItem[] = [
    {
      label: "Fiyat",
      value: formatSignalValue(extracted.price),
    },
    {
      label: "Indirim",
      value:
        typeof extracted.discount_rate === "number"
          ? `%${extracted.discount_rate}`
          : null,
    },
    {
      label: "Eski fiyat",
      value:
        typeof extracted.original_price === "number"
          ? `${extracted.original_price.toLocaleString("tr-TR")} TL`
          : null,
    },
    {
      label: "Gorsel",
      value:
        typeof extracted.image_count === "number"
          ? `${extracted.image_count} adet`
          : null,
    },
    {
      label: "Puan / Yorum",
      value:
        typeof extracted.rating_value === "number" &&
        typeof extracted.review_count === "number"
          ? `${extracted.rating_value} / ${extracted.review_count} yorum`
          : null,
    },
    {
      label: "Yildiz dagilimi",
      value: formatRatingBreakdown(extracted.rating_breakdown),
    },
    {
      label: "Yorum ozeti",
      value:
        extracted.review_summary && extracted.review_summary.sampled_count > 0
          ? [
              `${extracted.review_summary.sampled_count} ornek`,
              extracted.review_summary.low_rated_count > 0
                ? `${extracted.review_summary.low_rated_count} dusuk yildiz`
                : null,
              extracted.review_summary.positive_count > 0
                ? `${extracted.review_summary.positive_count} olumlu`
                : null,
            ]
              .filter(Boolean)
              .join(", ")
          : null,
    },
    {
      label: "Olumlu temalar",
      value:
        extracted.review_themes?.positive?.length
          ? extracted.review_themes.positive.join(", ")
          : null,
    },
    {
      label: "Olumsuz temalar",
      value:
        extracted.review_themes?.negative?.length
          ? extracted.review_themes.negative.join(", ")
          : null,
    },
    {
      label: "En sik memnuniyetler",
      value:
        extracted.top_positive_review_hits?.length
          ? extracted.top_positive_review_hits
              .map((item) => `${item.label} (${item.count})`)
              .join(", ")
          : null,
    },
    {
      label: "En sik sikayetler",
      value:
        extracted.top_negative_review_hits?.length
          ? extracted.top_negative_review_hits
              .map((item) => `${item.label} (${item.count})`)
              .join(", ")
          : null,
    },
    {
      label: "Soru sayisi",
      value:
        typeof extracted.question_count === "number"
          ? `${extracted.question_count} soru`
          : null,
    },
    {
      label: "Favori",
      value:
        typeof extracted.favorite_count === "number"
          ? extracted.favorite_count.toLocaleString("tr-TR")
          : null,
    },
    {
      label: "Stok durumu",
      value: formatSignalValue(extracted.stock_status),
    },
    {
      label: "Stok adedi",
      value:
        typeof extracted.stock_quantity === "number"
          ? `${extracted.stock_quantity} adet`
          : null,
    },
    {
      label: "Satici puani",
      value:
        typeof extracted.seller_score === "number"
          ? extracted.seller_score.toLocaleString("tr-TR", {
              minimumFractionDigits: extracted.seller_score % 1 === 0 ? 0 : 1,
              maximumFractionDigits: 1,
            })
          : null,
    },
    {
      label: "Takipci",
      value:
        typeof extracted.follower_count === "number"
          ? extracted.follower_count.toLocaleString("tr-TR")
          : null,
    },
    {
      label: "Satici rozetleri",
      value:
        Array.isArray(extracted.seller_badges) && extracted.seller_badges.length > 0
          ? extracted.seller_badges.join(", ")
          : null,
    },
    {
      label: "Diger satici",
      value:
        typeof extracted.other_sellers_count === "number"
          ? `${extracted.other_sellers_count} teklif`
          : null,
    },
    {
      label: "Rakip ozeti",
      value:
        extracted.other_sellers_summary
          ? [
              `${extracted.other_sellers_summary.count} satici`,
              typeof extracted.other_sellers_summary.avg_score === "number"
                ? `ort. ${extracted.other_sellers_summary.avg_score.toLocaleString("tr-TR", {
                    minimumFractionDigits:
                      extracted.other_sellers_summary.avg_score % 1 === 0 ? 0 : 1,
                    maximumFractionDigits: 1,
                  })} puan`
                : null,
              extracted.other_sellers_summary.fast_delivery_count > 0
                ? `${extracted.other_sellers_summary.fast_delivery_count} hizli teslimat`
                : null,
            ]
              .filter(Boolean)
              .join(", ")
          : null,
    },
    {
      label: "Ucretsiz kargo",
      value: formatSignalValue(extracted.has_free_shipping),
    },
    {
      label: "Kargo bilgisi",
      value: formatSignalValue(extracted.has_shipping_info),
    },
    {
      label: "Iade bilgisi",
      value: formatSignalValue(extracted.has_return_info),
    },
    {
      label: "Teslim suresi",
      value:
        typeof extracted.shipping_days === "number"
          ? `${extracted.shipping_days} gun`
          : null,
    },
    {
      label: "Teslimat tipi",
      value: formatDeliveryTypeLabel(formatSignalValue(extracted.delivery_type)),
    },
    {
      label: "Varyant",
      value:
        typeof extracted.variant_count === "number"
          ? `${extracted.variant_count} secenek`
          : null,
    },
    {
      label: "Bullet sayisi",
      value:
        typeof extracted.bullet_point_count === "number"
          ? `${extracted.bullet_point_count} madde`
          : null,
    },
    {
      label: "Ozellik alani",
      value: formatSignalValue(extracted.has_specs),
    },
    {
      label: "SSS",
      value: formatSignalValue(extracted.has_faq),
    },
    {
      label: "Video",
      value:
        typeof extracted.has_video === "boolean"
          ? extracted.has_video
            ? "Var"
            : "Tespit edilemedi"
          : null,
    },
    {
      label: "Marka sayfasi",
      value: formatSignalValue(extracted.has_brand_page),
    },
    {
      label: "Resmi satici",
      value: formatSignalValue(extracted.official_seller),
    },
    {
      label: "Kampanya",
      value:
        formatSignalValue(extracted.campaign_label) ||
        formatSignalValue(extracted.has_campaign),
    },
    {
      label: "Promosyonlar",
      value:
        Array.isArray(extracted.promotion_labels) && extracted.promotion_labels.length > 0
          ? extracted.promotion_labels.join(", ")
          : null,
    },
    {
      label: "Satici",
      value: formatSignalValue(extracted.seller_name),
    },
  ]
    .map((item) => ({
      ...item,
      tone: getSignalTone(item.label, item.value),
    }))
    .filter((item) => item.value !== null);

  const signalGroups = [
    {
      title: "Teklif",
      items: signalItems.filter((item) =>
        [
          "Fiyat",
          "Indirim",
          "Eski fiyat",
          "Ucretsiz kargo",
          "Kargo bilgisi",
          "Iade bilgisi",
          "Teslim suresi",
          "Teslimat tipi",
          "Varyant",
          "Kampanya",
        ].includes(item.label)
      ),
    },
    {
      title: "Guven",
      items: signalItems.filter((item) =>
        [
          "Puan / Yorum",
          "Soru sayisi",
          "Satici puani",
          "Takipci",
          "Satici rozetleri",
          "Diger satici",
          "Marka sayfasi",
          "Resmi satici",
          "Satici",
        ].includes(item.label)
      ),
    },
    {
      title: "Icerik",
      items: signalItems.filter((item) =>
        ["Gorsel", "Bullet sayisi", "Ozellik alani", "SSS", "Video", "Stok durumu"].includes(item.label)
      ),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      <style>{`
        .ar-wrap {
          display: grid;
          gap: 18px;
        }

        .ar-card {
          position: relative;
          overflow: hidden;
          border-radius: 26px;
          border: 1px solid var(--line);
          background: var(--surface);
          box-shadow: var(--shadow-lg);
        }

        .ar-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--brand) 14%, transparent), transparent 28%),
            radial-gradient(circle at bottom right, color-mix(in srgb, var(--accent) 14%, transparent), transparent 28%);
        }

        .ar-main {
          position: relative;
          z-index: 1;
          padding: 26px;
        }

        .ar-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 24px;
        }

        .ar-top-left {
          min-width: 0;
        }

        .ar-kicker,
        .ar-save-badge,
        .ar-plan-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .ar-kicker {
          color: var(--brand-strong);
          background: color-mix(in srgb, var(--brand) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--brand) 24%, transparent);
          margin-bottom: 14px;
        }

        .ar-save-badge {
          margin-top: 14px;
          color: var(--success);
          background: color-mix(in srgb, var(--success) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--success) 24%, transparent);
        }

        .ar-plan-badge {
          margin-top: 12px;
          color: var(--accent);
          background: color-mix(in srgb, var(--accent) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
        }

        .ar-title {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 30px;
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.05em;
          color: var(--text);
          margin-bottom: 10px;
        }

        .ar-subtitle {
          color: var(--text-muted);
          font-size: 14px;
          line-height: 1.8;
          max-width: 760px;
        }

        .ar-score,
        .ar-stat,
        .ar-block,
        .ar-quality-card,
        .ar-metric-card,
        .ar-item,
        .ar-teaser,
        .ar-lock-card,
        .ar-offer-summary,
        .ar-offer-item,
        .ar-signal-group,
        .ar-signal {
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--surface-soft) 100%, transparent);
        }

        .ar-score {
          flex-shrink: 0;
          min-width: 220px;
          padding: 18px;
          border-radius: 22px;
        }

        .ar-score-stack {
          display: grid;
          gap: 12px;
        }

        .ar-score-ring {
          width: 100%;
          border-radius: 20px;
          padding: 20px 16px;
          text-align: center;
          border: 1px solid transparent;
          box-shadow: inset 0 1px 0 color-mix(in srgb, white 8%, transparent);
        }

        .ar-score-value {
          font-size: 34px;
          font-weight: 800;
          letter-spacing: -0.06em;
          margin-bottom: 6px;
        }

        .ar-score-label,
        .ar-score-mini-label,
        .ar-metric-label,
        .ar-signal-group-title {
          color: var(--text-soft);
        }

        .ar-score-label {
          font-size: 13px;
          font-weight: 700;
        }

        .ar-score-mini-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .ar-score-mini {
          padding: 12px;
          border-radius: 16px;
          min-width: 0;
          border: 1px solid var(--line);
          background: color-mix(in srgb, var(--surface-muted) 100%, transparent);
        }

        .ar-score-mini-name,
        .ar-stat-label,
        .ar-quality-title,
        .ar-metric-name,
        .ar-offer-summary-label,
        .ar-lock-kicker,
        .ar-signal-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        .ar-score-mini-value,
        .ar-quality-value,
        .ar-metric-score,
        .ar-offer-summary-value {
          font-family: var(--font-space-grotesk), sans-serif;
          font-weight: 800;
          color: var(--text);
        }

        .ar-score-mini-value {
          font-size: 18px;
        }

        .ar-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .ar-stat {
          padding: 18px;
          border-radius: 20px;
          min-width: 0;
        }

        .ar-stat-value {
          font-size: 18px;
          font-weight: 800;
          line-height: 1.4;
          color: var(--text);
          word-break: break-word;
        }

        .ar-block {
          margin-top: 14px;
          padding: 20px;
          border-radius: 22px;
        }

        .ar-block-title,
        .ar-offer-name,
        .ar-lock-title,
        .ar-upgrade-title,
        .ar-item-title,
        .ar-teaser-title {
          color: var(--text);
        }

        .ar-block-title {
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
        }

        .ar-summary,
        .ar-quality-detail,
        .ar-metric-evidence,
        .ar-item-detail,
        .ar-teaser-text,
        .ar-lock-text,
        .ar-upgrade-text,
        .ar-offer-meta,
        .ar-empty {
          color: var(--text-soft);
        }

        .ar-summary {
          font-size: 15px;
          line-height: 1.9;
          white-space: pre-wrap;
        }

        .ar-diagnosis {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--brand) 12%, transparent));
          font-size: 13px;
          line-height: 1.7;
          color: var(--text);
        }

        .ar-quality-grid,
        .ar-lock-grid,
        .ar-offer-summary-grid,
        .ar-signals {
          display: grid;
          gap: 12px;
        }

        .ar-quality-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .ar-lock-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .ar-offer-summary-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-bottom: 14px;
        }

        .ar-signals {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .ar-quality-card,
        .ar-metric-card,
        .ar-teaser,
        .ar-lock-card,
        .ar-offer-summary,
        .ar-offer-item,
        .ar-signal-group,
        .ar-signal,
        .ar-item {
          padding: 16px;
          border-radius: 18px;
        }

        .ar-quality-card--positive,
        .ar-metric-card--positive,
        .ar-signal--positive,
        .ar-offer-summary--good,
        .ar-item--low {
          border-color: color-mix(in srgb, var(--success) 24%, transparent);
          background: linear-gradient(135deg, color-mix(in srgb, var(--success) 10%, transparent), color-mix(in srgb, var(--surface-muted) 100%, transparent));
        }

        .ar-quality-card--neutral,
        .ar-metric-card--neutral,
        .ar-signal--neutral,
        .ar-offer-summary--mid,
        .ar-item--medium {
          border-color: color-mix(in srgb, var(--warning) 24%, transparent);
          background: linear-gradient(135deg, color-mix(in srgb, var(--warning) 10%, transparent), color-mix(in srgb, var(--surface-muted) 100%, transparent));
        }

        .ar-quality-card--warning,
        .ar-metric-card--warning,
        .ar-signal--warning,
        .ar-offer-summary--bad,
        .ar-item--high {
          border-color: color-mix(in srgb, var(--danger) 24%, transparent);
          background: linear-gradient(135deg, color-mix(in srgb, var(--danger) 10%, transparent), color-mix(in srgb, var(--surface-muted) 100%, transparent));
        }

        .ar-quality-title,
        .ar-metric-name,
        .ar-offer-summary-label,
        .ar-signal-label {
          margin-bottom: 8px;
        }

        .ar-quality-value,
        .ar-metric-score,
        .ar-offer-summary-value {
          font-size: 20px;
          margin-bottom: 8px;
        }

        .ar-metric-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        .ar-list,
        .ar-teaser-list,
        .ar-signal-group-list {
          display: grid;
          gap: 12px;
        }

        .ar-item-head,
        .ar-offer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        .ar-offer-head {
          align-items: flex-start;
          gap: 12px;
        }

        .ar-item-icon,
        .ar-priority {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-size: 14px;
          font-weight: 800;
          color: var(--text);
          background: linear-gradient(135deg, color-mix(in srgb, var(--brand) 18%, transparent), color-mix(in srgb, var(--accent) 16%, transparent));
          border: 1px solid var(--line);
        }

        .ar-item-title,
        .ar-lock-title,
        .ar-offer-name {
          font-size: 15px;
          font-weight: 800;
        }

        .ar-teaser::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, color-mix(in srgb, var(--surface-soft) 48%, transparent), color-mix(in srgb, var(--surface-strong) 68%, transparent));
          backdrop-filter: blur(3px);
          pointer-events: none;
        }

        .ar-teaser-title,
        .ar-teaser-text,
        .ar-teaser-cta {
          position: relative;
          z-index: 1;
        }

        .ar-teaser-cta,
        .ar-lock-kicker {
          color: var(--brand-strong);
        }

        .ar-offer-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .ar-offer-item {
          min-height: 176px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: linear-gradient(180deg, color-mix(in srgb, var(--surface-soft) 100%, transparent), color-mix(in srgb, var(--surface-muted) 100%, transparent));
        }

        .ar-offer-arrow {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-size: 18px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .ar-offer-price-main {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 24px;
          font-weight: 800;
          color: var(--text);
          line-height: 1.1;
        }

        .ar-offer-price-sub {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 700;
        }

        .ar-offer-tags {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .ar-offer-tag {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-soft);
          background: color-mix(in srgb, var(--surface-strong) 100%, transparent);
          border: 1px solid var(--line);
        }

        .ar-upgrade {
          margin-top: 14px;
          padding: 18px;
          border-radius: 20px;
          border: 1px solid color-mix(in srgb, var(--brand) 24%, transparent);
          background: linear-gradient(135deg, color-mix(in srgb, var(--brand) 12%, transparent), color-mix(in srgb, var(--surface-muted) 100%, transparent));
        }

        .ar-upgrade-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 800;
          color: var(--text);
          background: color-mix(in srgb, var(--surface-strong) 100%, transparent);
          border: 1px solid var(--line-strong);
        }

        @media (max-width: 980px) {
          .ar-top {
            flex-direction: column;
          }

          .ar-score,
          .ar-grid {
            width: 100%;
            min-width: 0;
          }

          .ar-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .ar-main {
            padding: 20px;
          }

          .ar-title {
            font-size: 24px;
          }

          .ar-summary,
          .ar-item-detail,
          .ar-signal-value {
            font-size: 14px;
          }

          .ar-signals,
          .ar-quality-grid,
          .ar-lock-grid,
          .ar-metric-grid,
          .ar-offer-summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="ar-wrap">
        <div className="ar-card">
          <div className="ar-main">
            <div className="ar-top">
              <div className="ar-top-left">
                <div className="ar-kicker">Analiz tamamlandi</div>
                <div className="ar-title">Urun sayfasi analizi hazir</div>
                <div className="ar-subtitle">
                  Sayfanin temel satis sinyalleri, SEO gorunumu ve iyilestirme
                  alanlari asagida ozetlenmistir.
                </div>

                {access?.plan && (
                  <div className="ar-plan-badge">
                    <span>Paket</span>
                    <span>{getPlanLabel(access.plan)}</span>
                  </div>
                )}

                {autoSaved && (
                  <div className="ar-save-badge">
                    <span>Kayit</span>
                    <span>Rapor gecmise kaydedildi</span>
                  </div>
                )}
              </div>

              <div className="ar-score">
                <div className="ar-score-stack">
                  <div
                    className="ar-score-ring"
                    style={{
                      color: overallTone.color,
                      background: overallTone.background,
                      borderColor: overallTone.border,
                      boxShadow: `0 0 0 1px ${overallTone.border}, 0 0 30px ${overallTone.glow}`,
                    }}
                  >
                    <div className="ar-score-value">{overallTone.text}</div>
                    <div className="ar-score-label">Genel skor</div>
                  </div>

                  <div className="ar-score-mini-grid">
                    <div className="ar-score-mini">
                      <div className="ar-score-mini-name">SEO</div>
                      <div
                        className="ar-score-mini-value"
                        style={{ color: seoTone.color }}
                      >
                        {seoTone.text}
                      </div>
                      <div className="ar-score-mini-label">{seoTone.label}</div>
                    </div>

                    <div className="ar-score-mini">
                      <div className="ar-score-mini-name">Donusum</div>
                      <div
                        className="ar-score-mini-value"
                        style={{ color: conversionTone.color }}
                      >
                        {conversionTone.text}
                      </div>
                        <div className="ar-score-mini-label">
                          {conversionTone.label}
                        </div>
                      </div>

                      <div className="ar-score-mini">
                        <div className="ar-score-mini-name">Veri</div>
                        <div
                          className="ar-score-mini-value"
                          style={{ color: completenessTone.color }}
                        >
                          {completenessTone.text}
                        </div>
                        <div className="ar-score-mini-label">
                          {completenessTone.label}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>

            <div className="ar-grid">
              <div className="ar-stat">
                <div className="ar-stat-label">Platform</div>
                <div className="ar-stat-value">
                  {result.platform || "Belirtilmedi"}
                </div>
              </div>

              <div className="ar-stat">
                <div className="ar-stat-label">Kategori</div>
                <div className="ar-stat-value">
                  {result.category || "Belirtilmedi"}
                </div>
              </div>

              <div className="ar-stat">
                <div className="ar-stat-label">Fiyat rekabeti</div>
                <div className="ar-stat-value">
                  {getPriceTone(result.priceCompetitiveness)}
                </div>
              </div>
            </div>

            <div className="ar-block">
              <div className="ar-block-title">Genel ozet</div>
              <div className="ar-summary">
                {result.summary?.trim()
                  ? result.summary
                  : "Bu analiz icin henuz ozet metni uretilmedi."}
              </div>
              {quickDiagnosis && (
                <div className="ar-diagnosis">{quickDiagnosis}</div>
              )}
              {competitorNarrative && (
                <div className="ar-diagnosis" style={{ marginTop: 12 }}>
                  Rekabet ozeti: {competitorNarrative}
                </div>
              )}
              {coverage?.confidence && (
                <div
                  className="ar-plan-badge"
                  style={{
                    marginTop: 14,
                    color: coverageTone.color,
                    borderColor: coverageTone.border,
                    background: coverageTone.background,
                  }}
                >
                  <span>Veri kapsami</span>
                  <span>{coverageTone.label}</span>
                </div>
              )}
            </div>

            {coverage?.confidence && (
              <div className="ar-block">
                <div className="ar-block-title">Analiz kapsami</div>
                <div className="ar-summary">
                  Bu rapor mevcut sayfada bulunan verilerle olusturuldu. Eksik alanlar
                  varsa ilgili konularda yorum sinirli tutulur.
                </div>
                <div className="ar-grid" style={{ marginTop: 14 }}>
                  <div className="ar-stat">
                    <div className="ar-stat-label">Kapsam seviyesi</div>
                    <div className="ar-stat-value">{coverageTone.label}</div>
                  </div>
                  <div className="ar-stat">
                    <div className="ar-stat-label">Bulunan alan</div>
                    <div className="ar-stat-value">{availableFields.length}</div>
                  </div>
                  <div className="ar-stat">
                    <div className="ar-stat-label">Eksik alan</div>
                    <div className="ar-stat-value">{missingFields.length}</div>
                  </div>
                </div>
                {(availableFields.length > 0 || missingFields.length > 0) && (
                  <div className="ar-quality-grid" style={{ marginTop: 14 }}>
                    {availableFields.length > 0 && (
                      <div className="ar-quality-card ar-quality-card--positive">
                        <div className="ar-quality-title">Bulunan alanlar</div>
                        <div className="ar-quality-detail">
                          {formatCoverageFields(availableFields, 8)}
                        </div>
                      </div>
                    )}
                    {missingFields.length > 0 && (
                      <div className="ar-quality-card ar-quality-card--neutral">
                        <div className="ar-quality-title">Eksik alanlar</div>
                        <div className="ar-quality-detail">
                          {formatCoverageFields(missingFields, 8)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="ar-block">
              <div className="ar-block-title">Kalite gorunumu</div>
              <div className="ar-quality-grid">
                {qualityCards.map((card) => (
                  <div
                    key={card.title}
                    className={`ar-quality-card ar-quality-card--${card.tone}`}
                  >
                    <div className="ar-quality-title">{card.title}</div>
                    <div className="ar-quality-value">{card.value}</div>
                    <div className="ar-quality-detail">{card.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            {(extracted.other_sellers_summary || competitorOffers.length > 0) && (
              <div className="ar-block">
                <div className="ar-block-title">Rakip teklifleri</div>

                <div
                  className="ar-diagnosis"
                  style={{
                    marginBottom: 14,
                    color:
                      cheaperCompetitorOffers.length > 0 ? "#FCA5A5" : "#86EFAC",
                    borderColor:
                      cheaperCompetitorOffers.length > 0
                        ? "rgba(248,113,113,0.22)"
                        : "rgba(74,222,128,0.22)",
                    background:
                      cheaperCompetitorOffers.length > 0
                        ? "rgba(248,113,113,0.08)"
                        : "rgba(74,222,128,0.08)",
                  }}
                >
                  {competitorHeadline}
                </div>

                {extracted.other_sellers_summary && (
                  <div className="ar-offer-summary-grid">
                    <div className="ar-offer-summary">
                      <div className="ar-offer-summary-label">En dusuk fiyat</div>
                      <div className="ar-offer-summary-value">
                        {formatCurrency(extracted.other_sellers_summary.min_price) || "-"}
                      </div>
                    </div>
                    <div className="ar-offer-summary">
                      <div className="ar-offer-summary-label">Ortalama fiyat</div>
                      <div className="ar-offer-summary-value">
                        {formatCurrency(extracted.other_sellers_summary.avg_price) || "-"}
                      </div>
                    </div>
                    <div className="ar-offer-summary">
                      <div className="ar-offer-summary-label">Daha ucuz rakip</div>
                      <div className="ar-offer-summary-value">
                        {typeof extracted.other_sellers_summary.cheaper_count === "number"
                          ? extracted.other_sellers_summary.cheaper_count
                          : "-"}
                      </div>
                    </div>
                    <div className="ar-offer-summary">
                      <div className="ar-offer-summary-label">En ucuz satici</div>
                      <div className="ar-offer-summary-value">
                        {extracted.other_sellers_summary.cheapest_seller_name || "-"}
                      </div>
                    </div>
                    <div className="ar-offer-summary ar-offer-summary--bad">
                      <div className="ar-offer-summary-label">Daha ucuz rakip</div>
                      <div className="ar-offer-summary-value">
                        {cheaperCompetitorOffers.length}
                      </div>
                    </div>
                    <div className="ar-offer-summary ar-offer-summary--mid">
                      <div className="ar-offer-summary-label">Ayni fiyat</div>
                      <div className="ar-offer-summary-value">
                        {samePriceCompetitorOffers.length}
                      </div>
                    </div>
                    <div className="ar-offer-summary ar-offer-summary--good">
                      <div className="ar-offer-summary-label">Daha pahali rakip</div>
                      <div className="ar-offer-summary-value">
                        {moreExpensiveCompetitorOffers.length}
                      </div>
                    </div>
                    <div
                      className={`ar-offer-summary ${
                        cheaperCompetitorOffers.length > 0
                          ? "ar-offer-summary--bad"
                          : "ar-offer-summary--good"
                      }`}
                    >
                      <div className="ar-offer-summary-label">En dusuk fark</div>
                      <div className="ar-offer-summary-value">
                        {cheapestCompetitorDelta != null
                          ? formatCurrency(Math.abs(cheapestCompetitorDelta)) || "-"
                          : "-"}
                      </div>
                    </div>
                  </div>
                )}

                {competitorOffers.length > 0 ? (
                  <div className="ar-offer-list">
                    {sortedCompetitorOffers.map((offer, index) => {
                        const ownPrice = ownNormalizedPrice;
                        const delta =
                          typeof ownPrice === "number" && typeof offer.price === "number"
                            ? offer.price - ownPrice
                            : null;
                        const deltaVisual = getDeltaVisual(delta);

                        return (
                          <div
                            key={`${offer.seller_name || "offer"}-${index}`}
                            className="ar-offer-item"
                            style={{ borderColor: deltaVisual.border }}
                          >
                            <div className="ar-offer-head">
                              <div>
                                <div className="ar-offer-name">
                                  {offer.seller_name || "Bilinmeyen satici"}
                                </div>
                                <div className="ar-offer-meta">
                                  {typeof offer.seller_score === "number"
                                    ? `${offer.seller_score.toLocaleString("tr-TR", {
                                        minimumFractionDigits: offer.seller_score % 1 === 0 ? 0 : 1,
                                        maximumFractionDigits: 1,
                                      })} puan`
                                    : "Puan verisi yok"}
                                </div>
                              </div>

                              <div
                                className="ar-offer-arrow"
                                style={{
                                  color: deltaVisual.color,
                                  background: deltaVisual.background,
                                  border: `1px solid ${deltaVisual.border}`,
                                }}
                              >
                                {deltaVisual.arrow}
                              </div>
                            </div>

                            <div>
                              <div className="ar-offer-price-main">
                                {formatCurrency(offer.price) || "-"}
                              </div>
                              <div
                                className="ar-offer-price-sub"
                                style={{ color: deltaVisual.color }}
                              >
                                {formatPriceDelta(delta)}
                              </div>
                            </div>

                            <div className="ar-offer-tags">
                              {offer.has_free_shipping && (
                                <span className="ar-offer-tag">Ucretsiz kargo</span>
                              )}
                              {offer.has_fast_delivery && (
                                <span className="ar-offer-tag">Hizli teslimat</span>
                              )}
                              {offer.is_official && (
                                <span className="ar-offer-tag">Resmi satici</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="ar-empty">
                    Rakip teklif ozeti hesaplandi ama liste detayi bulunamadi.
                  </div>
                )}
              </div>
            )}

            {reviewSnippets.length > 0 && (
              <div className="ar-block">
                <div className="ar-block-title">Yorum ornekleri</div>
                <div className="ar-offer-list">
                  {reviewSnippets.map((review, index) => (
                    <div
                      key={`${review.text || "review"}-${index}`}
                      className="ar-offer-item"
                    >
                      <div className="ar-offer-head">
                        <div className="ar-offer-name">
                          {typeof review.rating === "number"
                            ? `${review.rating} yildiz`
                            : "Yorum"}
                        </div>
                      </div>
                      <div className="ar-offer-meta">{review.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {qaSnippets.length > 0 && (
              <div className="ar-block">
                <div className="ar-block-title">Soru cevap ornekleri</div>
                <div className="ar-offer-list">
                  {qaSnippets.map((item, index) => (
                    <div
                      key={`${item.question || "qa"}-${index}`}
                      className="ar-offer-item"
                    >
                      <div className="ar-offer-head">
                        <div className="ar-offer-name">
                          {item.question || "Soru"}
                        </div>
                      </div>
                      <div className="ar-offer-meta">
                        {item.answer || "Henuz cevap verisi bulunamadi."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {derivedMetricCards.length > 0 && (
              <div className="ar-block">
                <div className="ar-block-title">Karar destek metrikleri</div>
                <div className="ar-metric-grid">
                  {derivedMetricCards.map((item) => (
                    <div
                      key={item.title}
                      className={`ar-metric-card ar-metric-card--${
                        getMetricLabelMeta(item.metric?.label).tone
                      }`}
                    >
                      <div className="ar-metric-name">{item.title}</div>
                      <div className="ar-metric-score">
                        {item.metric?.score != null ? `${item.metric.score}/100` : "-"}
                      </div>
                      <div className="ar-metric-label">
                        {getMetricLabelMeta(item.metric?.label).text}
                      </div>
                      <div className="ar-metric-evidence">
                        {item.metric?.evidence?.length
                          ? item.metric.evidence.slice(0, 2).join(" | ")
                          : "Bu metrik icin yeterli kanit yok."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {signalGroups.length > 0 && (
              <div className="ar-block">
                <div className="ar-block-title">Tespit edilen sinyaller</div>
                <div className="ar-signals">
                  {signalGroups.map((group) => (
                    <div key={group.title} className="ar-signal-group">
                      <div className="ar-signal-group-title">{group.title}</div>
                      <div className="ar-signal-group-list">
                        {group.items.map((item) => (
                          <div
                            key={item.label}
                            className={`ar-signal${
                              item.tone ? ` ar-signal--${item.tone}` : ""
                            }`}
                          >
                            <div className="ar-signal-label">{item.label}</div>
                            <div className="ar-signal-value">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {teaserItems.length > 0 && (
              <div className="ar-block">
                <div className="ar-block-title">Premium bolum onizlemeleri</div>
                <div className="ar-teaser-list">
                  {teaserItems.map((item, index) => (
                    <div
                      key={`${item.key || "teaser"}-${index}`}
                      className="ar-teaser"
                    >
                      <div className="ar-teaser-title">{getTeaserTitle(item.key)}</div>
                      <div className="ar-teaser-text">
                        {item.teaser || "Bu bolum ust paketlerde tam acilir."}
                      </div>
                      <div className="ar-teaser-cta">
                        Daha detayli icgoruler icin paketi yukselt
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lockedSections.length > 0 && (
              <div className="ar-block">
                <div className="ar-block-title">Kilitli premium alanlar</div>
                <div className="ar-lock-grid">
                  {lockedSections.slice(0, 3).map((sectionKey) => (
                    <div key={sectionKey} className="ar-lock-card">
                      <div className="ar-lock-kicker">Kilitli</div>
                      <div className="ar-lock-title">{getLockedSectionTitle(sectionKey)}</div>
                      <div className="ar-lock-text">
                        Bu bolum mevcut pakette sinirli. Ust pakette daha fazla
                        Trendyol icgorusu acilir.
                      </div>
                    </div>
                  ))}
                </div>

                <div className="ar-upgrade">
                  <div className="ar-upgrade-title">{upgradeCopy.title}</div>
                  <div className="ar-upgrade-text">{upgradeCopy.detail}</div>
                  <Link href={upgradeCopy.href} className="ar-upgrade-link">
                    {upgradeCopy.cta}
                  </Link>
                </div>
              </div>
            )}

            <div className="ar-block">
              <div className="ar-block-title">Iyilestirme onerileri</div>

              {suggestions.length > 0 ? (
                <div className="ar-list">
                  {suggestions.map((item, index) => (
                    <div
                      key={`${item.key || item.title || "suggestion"}-${index}`}
                      className={`ar-item ar-item--${getSuggestionVisual(item).tone}`}
                    >
                      <div className="ar-item-head">
                        <div className="ar-item-icon">
                          {getSuggestionVisual(item).icon}
                        </div>
                        <div className="ar-item-title">
                          {item.title || `Oneri ${index + 1}`}
                        </div>
                      </div>
                      <div className="ar-item-detail">
                        {item.detail || "Detay bilgisi bulunmuyor."}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ar-empty">
                  Bu analizde listelenecek oneri bulunamadi.
                </div>
              )}
            </div>

            <div className="ar-block">
              <div className="ar-block-title">Oncelikli aksiyonlar</div>

              {priorityActions.length > 0 ? (
                <div className="ar-list">
                  {priorityActions.map((item, index) => (
                    <div
                      key={`${item.title || "priority"}-${index}`}
                      className="ar-item"
                    >
                      <div className="ar-item-head">
                        <div className="ar-priority">
                          {item.priority ?? index + 1}
                        </div>
                        <div className="ar-item-title">
                          {item.title || `Aksiyon ${index + 1}`}
                        </div>
                      </div>
                      <div className="ar-item-detail">
                        {item.detail || "Detay bilgisi bulunmuyor."}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ar-empty">
                  Bu analizde oncelikli aksiyon listesi bulunamadi.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


