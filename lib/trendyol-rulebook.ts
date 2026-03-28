export type RuleConfidence = "high" | "medium" | "low";
export type RuleMergeMode = "additive" | "override_if_conflict" | "legacy_fallback";

export type SectionKey =
  | "shared"
  | "price_competition"
  | "content_seo"
  | "trust_reviews"
  | "demand_signals"
  | "actions";

export type NamedRule = {
  id: string;
  title: string;
  summary: string;
  confidence: RuleConfidence;
  mergeMode?: RuleMergeMode;
  sourceFile?: string;
  sourceUpdatedAt?: string;
};

export type ValuePolicy = {
  allowEstimatedLabels: boolean;
  forbidPretendingReal: boolean;
  preserveLegacyWhenMissing: boolean;
};

export type SharedRulebook = {
  nullMeansMissing: boolean;
  productVsSellerMustBeSeparated: boolean;
  singleVsMultiSellerMustBeSeparated: boolean;
  noHardJudgementWhenDataMissing: boolean;
  estimatedVocabulary: string[];
  forbiddenExactVocabulary: string[];
  valuePolicy: ValuePolicy;
};

export type PriceCompetitionRulebook = {
  sameProductVsSimilarMustBeSeparated: boolean;
  minMaxShouldUseOwnAndCompetitors: boolean;
  duplicateOwnProductBarsForbidden: boolean;
  freeShippingPlatformRule: string;
  anomalyPriceThreshold: number;
};

export type ContentSeoRulebook = {
  primarySignals: string[];
  secondarySignals: string[];
  metaDescriptionIsSecondary: boolean;
  descriptionLengthAloneIsInsufficient: boolean;
  descriptionRuleCriteria: string[];
};

export type TrustReviewsRulebook = {
  generalProductReviewScope: string[];
  sellerSpecificReviewScope: string[];
  noFakeRatingBreakdownWithoutData: boolean;
  noFakeMonthlyTrendWithoutData: boolean;
  recentReviewPresentation: {
    enabled: boolean;
    limit: number;
    truncateLength: number;
    ratingPrefixRequired: boolean;
  };
};

export type DemandSignalsRulebook = {
  directSignals: string[];
  supportingSignals: string[];
  commercialMomentumSignals: string[];
  balancers: string[];
  coreDemandFormula?: {
    favoriteWeight: number;
    reviewWeight: number;
    questionWeight: number;
    ratingWeight: number;
  };
  namingRules: string[];
};

export type ActionsRulebook = {
  requiredFields: string[];
  duplicateActionsForbidden: boolean;
  mustReferenceEvidence: boolean;
  mustExplainPriority: boolean;
  shouldAvoidOverclaimingImpact: boolean;
};

export type TrendyolRulebook = {
  shared: SharedRulebook;
  price_competition: PriceCompetitionRulebook;
  content_seo: ContentSeoRulebook;
  trust_reviews: TrustReviewsRulebook;
  demand_signals: DemandSignalsRulebook;
  actions: ActionsRulebook;
  explicitRules: Record<SectionKey, NamedRule[]>;
};

// Important:
// If a rule is not explicitly present here, current legacy behavior should remain in place.
// This file is a central contract for rules extracted from project notes; it is not a license
// to invent new strict behavior where the notes are silent.
//
// Rule resolution policy:
// 1. Newer notes do not automatically replace older notes.
// 2. If a newer rule is additive, it extends the older rule set.
// 3. Only directly conflicting rules should override older ones.
// 4. If conflict is unclear, preserve legacy behavior and do not invent strict new behavior.
export const TRENDYOL_RULEBOOK: TrendyolRulebook = {
  shared: {
    nullMeansMissing: true,
    productVsSellerMustBeSeparated: true,
    singleVsMultiSellerMustBeSeparated: true,
    noHardJudgementWhenDataMissing: true,
    estimatedVocabulary: ["tahmini", "sinyal", "potansiyel", "risk", "firsat"],
    forbiddenExactVocabulary: [
      "kesin satis adedi",
      "kesin donusum orani",
      "kesin goruntulenme hacmi",
      "kesin reklam performansi",
    ],
    valuePolicy: {
      allowEstimatedLabels: true,
      forbidPretendingReal: true,
      preserveLegacyWhenMissing: true,
    },
  },
  price_competition: {
    sameProductVsSimilarMustBeSeparated: true,
    minMaxShouldUseOwnAndCompetitors: true,
    duplicateOwnProductBarsForbidden: true,
    freeShippingPlatformRule: "Trendyol urun fiyati 350 TL ve uzerindeyse ucretsiz kargo kabul edilir.",
    anomalyPriceThreshold: 1.5,
  },
  content_seo: {
    primarySignals: [
      "baslik uyumu",
      "anahtar kelime uyumu",
      "urun/kategori uyumu",
      "aciklama yeterliligi",
      "gorsel yeterliligi",
      "teknik ozellik alani",
      "soru-cevap destegi",
    ],
    secondarySignals: ["meta description", "klasik HTML SEO etiketleri"],
    metaDescriptionIsSecondary: true,
    descriptionLengthAloneIsInsufficient: true,
    descriptionRuleCriteria: [
      "ozgunluk",
      "anahtar kelime arastirmasi",
      "fayda odakliligi",
      "okunabilirlik ve hiyerarsi",
      "teknik ozellikler",
      "meta veri optimizasyonu",
      "gorsel ve video",
      "sosyal kanit ve CTA",
      "ic linkleme",
    ],
  },
  trust_reviews: {
    generalProductReviewScope: [
      "urunun genel kabulu",
      "urun bazli guclu/zayif yonler",
      "aylik yorum akisi",
      "yildiz dagilimi",
      "urun bazli olumlu/olumsuz temalar",
    ],
    sellerSpecificReviewScope: [
      "paketleme",
      "hasar",
      "teslimat",
      "iade",
      "yanlis urun",
      "yanitsiz soru",
    ],
    noFakeRatingBreakdownWithoutData: true,
    noFakeMonthlyTrendWithoutData: true,
    recentReviewPresentation: {
      enabled: true,
      limit: 10,
      truncateLength: 140,
      ratingPrefixRequired: true,
    },
  },
  demand_signals: {
    directSignals: [
      "X gunde satildi",
      "X kisinin sepetinde",
      "X kisi favoriledi",
      "Son 24 saatte X kisi goruntuledi",
    ],
    supportingSignals: [
      "yorum sayisi",
      "yorum artis trendi",
      "urun puani",
      "soru sayisi",
      "saticiya gelen soru sayisi",
    ],
    commercialMomentumSignals: [
      "kupon",
      "tukeniyor",
      "hizli teslimat",
      "basarili satici",
      "cok satan rozeti",
      "ucretsiz kargo",
      "kampanya etiketi",
    ],
    balancers: [
      "satici puani",
      "iade bilgisi",
      "teslimat gucu",
      "kotu yorum orani",
      "satici ozel negatif sikayetler",
    ],
    coreDemandFormula: {
      favoriteWeight: 0.35,
      reviewWeight: 0.3,
      questionWeight: 0.15,
      ratingWeight: 0.2,
    },
    namingRules: [
      "Talep Sinyali",
      "Kategori Satis Tahmini",
      "Ticari Ivme",
      "Buyume Firsati",
      "Pazar Konumu",
    ],
  },
  actions: {
    requiredFields: [
      "baslik",
      "kisa aciklama",
      "dayanak veri",
      "neden oncelikli",
      "beklenen etki seviyesi",
    ],
    duplicateActionsForbidden: true,
    mustReferenceEvidence: true,
    mustExplainPriority: true,
    shouldAvoidOverclaimingImpact: true,
  },
  explicitRules: {
    shared: [
      {
        id: "shared-null-is-not-zero",
        title: "Null veri sifir degildir",
        summary: "Eksik veri ile gercek sifir deger ayni yorumlanamaz.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "shared-estimated-language",
        title: "Tahmini dil zorunlu",
        summary: "Tahmini metrikler kesin veri diliyle sunulamaz.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
    ],
    price_competition: [
      {
        id: "price-separate-same-vs-similar",
        title: "Ayni urun ve benzer urun ayrimi",
        summary: "Rakip kiyaslari ayni urun saticilari ile benzer urunleri karistirmamali.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "price-no-duplicate-own-bar",
        title: "Bu urun bari tekillestirilmeli",
        summary: "Urun hem min/max hem ayri urun bari olarak iki kez cizilmemeli.",
        confidence: "high",
        mergeMode: "additive",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "price-competitor-advantages-from-offer-signals",
        title: "Rakip avantajlari teklif sinyallerinden okunur",
        summary: "Rakip avantajlari karti kampanya, indirim, teslimat ve resmi satici gibi teklif sinyallerinden beslenmelidir.",
        confidence: "high",
        mergeMode: "additive",
        sourceFile: "GRAFIK_VERI_ESLESTIRME_NOTLARI.md",
        sourceUpdatedAt: "2026-03-25T18:15:34",
      },
    ],
    content_seo: [
      {
        id: "content-primary-keywords-algorithm-first",
        title: "Birincil anahtar kelimeler algoritma once",
        summary: "Birincil anahtar kelimeler AI zorunlulugu olmadan, algoritmik cikarim ve baslik fallback ile uretilmelidir.",
        confidence: "high",
        mergeMode: "additive",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "content-keyword-ranking-cache-first",
        title: "Anahtar kelime siralamasi cache ile korunur",
        summary: "Canli anahtar kelime siralamasi her yenilemede yeniden calistirilmaz; son bulunan sonuc once cache'den okunur.",
        confidence: "medium",
        mergeMode: "additive",
        sourceFile: "docs/trendyol-tab-rule-matrix.md",
        sourceUpdatedAt: "2026-03-26T00:37:00",
      },
      {
        id: "content-category-fit-from-title-and-keywords",
        title: "Kategori uyumu baslik ve kelime ortusmesiyle okunur",
        summary: "Urun kategori uyumu baslik, kategori ve anahtar kelime ortusmesiyle degerlendirilmelidir.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "content-meta-is-secondary",
        title: "Meta ikincil sinyal",
        summary: "Meta description Trendyol ici gorunurlukte birincil sinyal degildir.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_SKOR_MIMARISI_VE_VERI_STRATEJISI_RAPORU.md",
        sourceUpdatedAt: "2026-03-25T18:15:34",
      },
      {
        id: "content-description-length-not-enough",
        title: "Aciklama uzunlugu tek basina yeterli degil",
        summary: "Aciklama yeterliligi icerik kalitesi uzerinden okunmali.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_SKOR_MIMARISI_VE_VERI_STRATEJISI_RAPORU.md",
        sourceUpdatedAt: "2026-03-25T18:15:34",
      },
      {
        id: "content-radar-axes-are-rule-based",
        title: "Icerik radar eksenleri kural bazlidir",
        summary: "Icerik kalite radar eksenleri acik not yoksa mevcut rule-based eksenlerden beslenmeli ve legacy davranis korunmalidir.",
        confidence: "medium",
        mergeMode: "legacy_fallback",
        sourceFile: "docs/trendyol-tab-rule-matrix.md",
        sourceUpdatedAt: "2026-03-26T00:37:00",
      },
    ],
    trust_reviews: [
      {
        id: "trust-general-vs-seller-review-separation",
        title: "Urun yorumu ve satici yorumu ayrilmali",
        summary: "Cok saticili urunlerde genel urun puani satici operasyon puani gibi okunamaz.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "trust-no-fake-review-history",
        title: "Sahte yorum gecmisi yasak",
        summary: "Yildiz dagilimi veya aylik trend verisi yoksa uydurma chart cizilmez.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "trust-review-volume-is-direct-signal",
        title: "Yorum hacmi dogrudan sinyaldir",
        summary: "Yorum hacmi varsa dogrudan gercek veri olarak gosterilmeli ve sahte hacimle doldurulmamali.",
        confidence: "high",
        mergeMode: "additive",
        sourceFile: "GRAFIK_VERI_ESLESTIRME_NOTLARI.md",
        sourceUpdatedAt: "2026-03-25T18:15:34",
      },
      {
        id: "trust-recent-reviews-are-sampled",
        title: "Son yorumlar orneklenmis veri olarak okunur",
        summary: "Son yorumlar tum havuz degil, orneklenmis yorum listesi olarak sunulmalidir.",
        confidence: "high",
        mergeMode: "additive",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "trust-dimensions-must-label-proxies",
        title: "Guven boyutlari proxy eksenleri durust adlandirir",
        summary: "Guven boyutlari kartinda dogrudan veri ile proxy eksenler karistirilabilir; bu durumda alt metin ve etiketler bunu acikca belirtmelidir.",
        confidence: "medium",
        mergeMode: "additive",
        sourceFile: "docs/trendyol-tab-rule-matrix.md",
        sourceUpdatedAt: "2026-03-26T00:37:00",
      },
    ],
    demand_signals: [
      {
        id: "demand-core-four-signal-formula",
        title: "4 veri cekirdegi",
        summary: "Favori, yorum, soru ve puan talep cekirdegi olarak korunmali.",
        confidence: "medium",
        mergeMode: "additive",
        sourceFile: "TRENDYOL_SKOR_MIMARISI_VE_VERI_STRATEJISI_RAPORU.md",
        sourceUpdatedAt: "2026-03-25T18:15:34",
      },
      {
        id: "demand-direct-first-then-support",
        title: "Once dogrudan sinyal",
        summary: "Satis, sepet, favori ve goruntulenme varsa once onlar puanlanmali; yoksa destek sinyallerine dusulmeli.",
        confidence: "high",
        mergeMode: "additive",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "demand-market-position-is-relative",
        title: "Pazar konumu goreli okunur",
        summary: "Pazar konumu kesin pazar payi gibi degil, rakiplere gore goreli konum olarak sunulmalidir.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "demand-market-summary-needs-estimated-language",
        title: "Pazar genel degerlendirme tahmini dili korur",
        summary: "Talep ozetleri tahmini ve gercek sinyalleri karistirmadan, temkinli dille sunulmalidir.",
        confidence: "high",
        mergeMode: "additive",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "demand-growth-opportunity-is-gap-based",
        title: "Buyume firsati acik tabanli okunur",
        summary: "Buyume firsati karti icerik, teklif, guven ve ivme aciklarini birlikte okuyarak potansiyel farkini gostermelidir.",
        confidence: "medium",
        mergeMode: "additive",
        sourceFile: "TRENDYOL_SKOR_MIMARISI_VE_VERI_STRATEJISI_RAPORU.md",
        sourceUpdatedAt: "2026-03-25T18:15:34",
      },
      {
        id: "demand-market-interest-is-composite",
        title: "Pazar ilgisi birlesik sinyal olarak sunulur",
        summary: "Pazar ilgisi favori, yorum, soru ve goruntulenme sinyallerinin birlesik ozeti olarak sunulmalidir.",
        confidence: "medium",
        mergeMode: "additive",
        sourceFile: "docs/demand-capture-diagnosis.md",
        sourceUpdatedAt: "2026-03-25T18:15:34",
      },
      {
        id: "demand-funnel-is-estimated-not-real",
        title: "Ilgi satis hunisi tahmini akis olarak kalir",
        summary: "Ilgi-satis hunisi gercek funnel gibi sunulmaz; tahmini donusum akisi olarak durust dille gosterilir.",
        confidence: "medium",
        mergeMode: "additive",
        sourceFile: "docs/trendyol-tab-rule-matrix.md",
        sourceUpdatedAt: "2026-03-26T00:37:00",
      },
    ],
    actions: [
      {
        id: "actions-evidence-required",
        title: "Aksiyon dayanagi zorunlu",
        summary: "Her aksiyon somut veri dayanagi tasimali.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "actions-no-duplicate-rephrasing",
        title: "Ayni oneriyi tekrarlama",
        summary: "Farkli kelimelerle ayni aksiyon yeniden uretilmemeli.",
        confidence: "high",
        mergeMode: "override_if_conflict",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "actions-priority-matrix-is-relative",
        title: "Aksiyon oncelik matrisi goreli bir okumadir",
        summary: "Aksiyon oncelik matrisi kesin ROI yerine goreli etki ve uygulama kolayligi okumasi olarak sunulmalidir.",
        confidence: "medium",
        mergeMode: "additive",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
      {
        id: "actions-score-improvement-is-estimated",
        title: "Skor iyilesmesi tahmini kalmalidir",
        summary: "Aksiyon sonrasi skor artisi kesin sonuc gibi degil, tahmini iyilesme bandi olarak sunulmalidir.",
        confidence: "high",
        mergeMode: "additive",
        sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md",
        sourceUpdatedAt: "2026-03-25T23:54:18",
      },
    ],
  },
};

export function getRulebookSection(section: SectionKey) {
  return TRENDYOL_RULEBOOK[section];
}

export function getExplicitRules(section: SectionKey) {
  return TRENDYOL_RULEBOOK.explicitRules[section] ?? [];
}
