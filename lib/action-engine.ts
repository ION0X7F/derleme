import type {
  AnalysisSuggestion,
  DerivedMetrics,
  ExtractedProductFields,
  MarketComparisonInsights,
  PriorityAction,
} from "@/types/analysis";

type RuleActionDraft = Omit<PriorityAction, "priority"> & {
  key: string;
  weight: number;
  title: string;
  detail: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
}

function pushUniqueAction(
  actions: RuleActionDraft[],
  next: RuleActionDraft | null
) {
  if (!next) return;
  if (actions.some((item) => item.key === next.key)) return;
  actions.push(next);
}

function buildKeywordAction(
  extracted: ExtractedProductFields,
  metrics: DerivedMetrics
) {
  const title = String(
    extracted.title || extracted.product_name || extracted.h1 || ""
  ).trim();
  const titleLength = title.length;
  const weakTitle =
    metrics.productQuality.label === "weak" ||
    titleLength < 55 ||
    titleLength > 150;

  if (!weakTitle) return null;

  return {
    key: "rule-title-keyword-alignment",
    source: "rule" as const,
    severity: "high" as const,
    weight: 96,
    title: "Baslik ve anahtar kelime uyumunu guclendir",
    detail:
      "Baslik urun tipini ve arama niyetini yeterince net tasimiyor. Ilk bolumde ana urun ifadesini netlestirip marka/varyant bilgisini ikinci plana alin.",
    change:
      "Basligi ana urun tipiyle baslat; birincil sorguyu ilk bolumde dogal bicimde gecir ve gereksiz varyant kalabaligini azalt.",
    evidence: hasText(title)
      ? `Mevcut baslik ${titleLength} karakter. Urun tipi ve arama niyeti daha net tasinirse ilk bakis anlasilabilirligi guclenir.`
      : "Baslik sinyali zayif veya eksik. Arama niyetini tasiyan net bir urun basligi gorunmuyor.",
    outcome:
      "Beklenen sonuc: Arama gorunurlugu ve ilk tiklama kalitesi birlikte iyilesir; kullanici urunun ne sundugunu daha hizli anlar.",
    ruleIds: ["actions-evidence-required"],
  };
}

function buildImageAction(extracted: ExtractedProductFields) {
  const imageCount =
    typeof extracted.image_count === "number" ? extracted.image_count : null;
  if (imageCount != null && imageCount >= 6) return null;

  return {
    key: "rule-image-benchmark-gap",
    source: "rule" as const,
    severity: "high" as const,
    weight: 91,
    title: "Gorsel setini kategori seviyesine cikar",
    detail:
      "Gorsel derinligi yetersiz oldugunda kullanici urunun farkini, boyutunu ve kullanim baglamini hizlica kavrayamaz.",
    change:
      "Kapak, detay, kullanim senaryosu, yakin plan ve olcu algisi veren ek gorsellerle ilk 6-8 gorsellik bir set kur.",
    evidence:
      imageCount != null
        ? `Mevcut gorsel sayisi ${imageCount}. Bu seviye karar ani icin sinirli kaliyor ve urunun anlatim yuku basliga biniyor.`
        : "Gorsel sayisi sinyali zayif. Urunun gorsel derinligi karar icin yeterince guclu gorunmuyor.",
    outcome:
      "Beklenen sonuc: Kullanici urun detayini daha hizli kavrar; gorsel guven ve donusum potansiyeli birlikte yukselir.",
    ruleIds: ["actions-evidence-required"],
  };
}

function buildDescriptionAction(extracted: ExtractedProductFields) {
  const descriptionLength =
    typeof extracted.description_length === "number"
      ? extracted.description_length
      : null;
  if (descriptionLength != null && descriptionLength >= 500) return null;

  return {
    key: "rule-description-depth-gap",
    source: "rule" as const,
    severity: "high" as const,
    weight: 89,
    title: "Aciklamayi satis odakli derinlestir",
    detail:
      "Aciklama kisa kaldiginda urunun faydasi, kullanim senaryosu ve teknik netligi kullaniciya yeterince tasinmaz.",
    change:
      "Ilk paragrafta urunu net tanimla; ardindan one cikan faydalar, kullanim senaryosu ve karar verdiren teknik ayrintilari ekle.",
    evidence:
      descriptionLength != null
        ? `Aciklama uzunlugu ${formatNumber(descriptionLength)} karakter. Bu seviye urunun farkini ve kullanim degerini tasimakta sinirli kalabilir.`
        : "Aciklama sinyali zayif veya eksik. Urunun faydasini anlatan guclu bir icerik derinligi gorunmuyor.",
    outcome:
      "Beklenen sonuc: Kullanici urunun farkini ve kullanim alanini daha net gorur; hem SEO hem donusum tarafinda birlikte iyilesme olusur.",
    ruleIds: ["actions-evidence-required"],
  };
}

function buildTrustAction(
  extracted: ExtractedProductFields,
  metrics: DerivedMetrics
) {
  const sellerScore =
    typeof extracted.seller_score === "number" ? extracted.seller_score : null;
  const ratingValue =
    typeof extracted.rating_value === "number" ? extracted.rating_value : null;
  const weakTrust =
    metrics.sellerTrust.label === "weak" ||
    (sellerScore != null && sellerScore < 8.5) ||
    (ratingValue != null && ratingValue < 4.3);

  if (!weakTrust) return null;

  const evidenceParts = [
    sellerScore != null ? `Satici puani ${formatNumber(sellerScore, 1)}/10` : null,
    ratingValue != null ? `urun puani ${formatNumber(ratingValue, 1)}` : null,
    extracted.has_return_info === false ? "iade bilgisi zayif" : null,
  ].filter(Boolean);

  return {
    key: "rule-trust-signal-gap",
    source: "rule" as const,
    severity: "high" as const,
    weight: 87,
    title: "Guven sinyallerini gorunur hale getir",
    detail:
      "Kullanici saticiya ve deneyime hizli guvenemediginde teklif avantaji olsa bile donusum frene basar.",
    change:
      "Teslimat, iade, satici puani ve guven veren hizmet detaylarini urun sayfasinda daha gorunur ve somut bir dille one cikar.",
    evidence:
      evidenceParts.length > 0
        ? `${evidenceParts.join(", ")}. Bu sinyaller zayif kaldiginda ilk siparis bariyeri buyur.`
        : "Satici guveni sinyalleri guclu gorunmuyor. Operasyonel netlik ve guven isaretleri daha gorunur tasinmali.",
    outcome:
      "Beklenen sonuc: Kullanici saticiya daha hizli guvenir; ozellikle ilk siparis bariyeri ve iade kaygisi azalir.",
    ruleIds: ["actions-evidence-required"],
  };
}

function buildPriceAction(
  extracted: ExtractedProductFields,
  metrics: DerivedMetrics,
  market?: MarketComparisonInsights | null
) {
  const weakPrice =
    metrics.marketPosition.label === "weak" ||
    market?.primaryIssue === "price" ||
    market?.primaryIssue === "listing";
  if (!weakPrice) return null;

  const currentPrice =
    typeof extracted.normalized_price === "number"
      ? `${formatNumber(extracted.normalized_price)} TL`
      : null;
  const cheaperCount =
    typeof extracted.other_sellers_summary?.cheaper_count === "number"
      ? extracted.other_sellers_summary.cheaper_count
      : null;
  const evidenceParts = [
    currentPrice ? `mevcut fiyat ${currentPrice}` : null,
    cheaperCount != null && cheaperCount > 0
      ? `${cheaperCount} daha ucuz rakip satici gorunuyor`
      : null,
    extracted.has_free_shipping ? null : "ucretsiz kargo avantaji net degil",
  ].filter(Boolean);

  return {
    key: "rule-price-offer-pressure",
    source: "rule" as const,
    severity: "medium" as const,
    weight: 84,
    title: "Fiyat ve teklif algisini guclendir",
    detail:
      "Teklif farki ilk bakista net gorunmuyorsa kullanici urunu rakiplerle ayni sepete koyar ve fiyat baskisi artar.",
    change:
      "Fiyat, kupon, kargo ve teslimat avantajini ilk ekranda daha net paketle; fiyat yuksekse gerekcesini gorunur yap.",
    evidence:
      evidenceParts.length > 0
        ? `${evidenceParts.join(", ")}. Teklif dili yeterince gorunur degilse kullanici deger farkini okuyamaz.`
        : "Pazar konumu zayif gorunuyor. Fiyat ve teslimat avantaji kullaniciya ilk bakista net gecmiyor.",
    outcome:
      "Beklenen sonuc: Teklif daha net algilanir; fiyat yuksekse gerekce, avantaj varsa gorunurluk kazanir ve talep daha kolay tetiklenir.",
    ruleIds: ["actions-evidence-required"],
  };
}

function buildSuggestionBackedAction(
  suggestion: AnalysisSuggestion,
  index: number
): RuleActionDraft {
  const weight = clamp(
    suggestion.severity === "high"
      ? 82 - index * 4
      : suggestion.severity === "medium"
      ? 72 - index * 4
      : 60 - index * 3,
    52,
    86
  );

  return {
    key: suggestion.key,
    source: "rule",
    severity: suggestion.severity,
    weight,
    title: suggestion.title,
    detail: suggestion.detail,
    evidence: suggestion.detail,
    ruleIds: ["actions-evidence-required", "actions-no-duplicate-rephrasing"],
  };
}

export function buildRuleBasedActions(params: {
  extracted: ExtractedProductFields;
  metrics: DerivedMetrics;
  suggestions: AnalysisSuggestion[];
  market?: MarketComparisonInsights | null;
}): PriorityAction[] {
  const { extracted, metrics, suggestions, market } = params;
  const drafts: RuleActionDraft[] = [];

  pushUniqueAction(drafts, buildKeywordAction(extracted, metrics));
  pushUniqueAction(drafts, buildImageAction(extracted));
  pushUniqueAction(drafts, buildDescriptionAction(extracted));
  pushUniqueAction(drafts, buildTrustAction(extracted, metrics));
  pushUniqueAction(drafts, buildPriceAction(extracted, metrics, market));

  suggestions.slice(0, 6).forEach((suggestion, index) => {
    pushUniqueAction(drafts, buildSuggestionBackedAction(suggestion, index));
  });

  return drafts
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      priority: index + 1,
    }));
}
