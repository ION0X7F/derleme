import type { SectionKey } from "@/lib/trendyol-rulebook";

export type RuleCoverageItem = {
  tab: string;
  card: string;
  section: SectionKey;
  explicitRuleIds: string[];
  coverageLevel: "explicit" | "partial" | "legacy";
  priority?: "high" | "medium" | "low";
  notes?: string[];
};

// Important:
// This is a visibility layer, not a new rule source.
// If a card has no explicit rule ids here, legacy behavior may still apply.
export const TRENDYOL_RULE_COVERAGE: RuleCoverageItem[] = [
  {
    tab: "Fiyat & Rakip",
    card: "Fiyat Konumu",
    section: "price_competition",
    explicitRuleIds: ["price-separate-same-vs-similar"],
    coverageLevel: "explicit",
    priority: "high",
    notes: ["Ayni urun ve diger saticilar karismamali."],
  },
  {
    tab: "Fiyat & Rakip",
    card: "Rakip Fiyat Dagilimi",
    section: "price_competition",
    explicitRuleIds: ["price-no-duplicate-own-bar"],
    coverageLevel: "explicit",
    priority: "high",
    notes: ["Bu urun min/max ile iki kez cizilmemeli."],
  },
  {
    tab: "Fiyat & Rakip",
    card: "Kampanya Donusum Senaryosu",
    section: "price_competition",
    explicitRuleIds: [],
    coverageLevel: "legacy",
    priority: "medium",
    notes: ["Tahmini kart olarak kaliyor; acik explicit kural zayif."],
  },
  {
    tab: "Fiyat & Rakip",
    card: "Rakip Avantajlari",
    section: "price_competition",
    explicitRuleIds: ["price-competitor-advantages-from-offer-signals"],
    coverageLevel: "explicit",
    priority: "medium",
    notes: ["Teklif bazli kampanya, indirim ve teslimat sinyalleriyle okunur."],
  },
  {
    tab: "Icerik & SEO",
    card: "Birincil Anahtar Kelimeler",
    section: "content_seo",
    explicitRuleIds: ["content-primary-keywords-algorithm-first"],
    coverageLevel: "explicit",
    priority: "medium",
    notes: ["Algoritmik cikarim, AI zorunlu degil."],
  },
  {
    tab: "Icerik & SEO",
    card: "Anahtar Kelime Siralamasi",
    section: "content_seo",
    explicitRuleIds: ["content-keyword-ranking-cache-first"],
    coverageLevel: "explicit",
    priority: "low",
    notes: ["Canli kontrol sonucu cache ile korunur."],
  },
  {
    tab: "Icerik & SEO",
    card: "Urun / Kategori Uyumu",
    section: "content_seo",
    explicitRuleIds: ["content-category-fit-from-title-and-keywords"],
    coverageLevel: "explicit",
    priority: "high",
    notes: ["Baslik, kategori ve anahtar kelime ortusmesiyle okunur."],
  },
  {
    tab: "Icerik & SEO",
    card: "Aciklama Yeterliligi",
    section: "content_seo",
    explicitRuleIds: ["content-meta-is-secondary", "content-description-length-not-enough"],
    coverageLevel: "explicit",
    priority: "high",
    notes: ["Meta ikincil sinyal, uzunluk tek basina yeterli degil."],
  },
  {
    tab: "Icerik & SEO",
    card: "Icerik Kalite Radar",
    section: "content_seo",
    explicitRuleIds: ["content-radar-axes-are-rule-based"],
    coverageLevel: "explicit",
    priority: "low",
    notes: ["Eksenler rule-based; not yoksa legacy davranis korunur."],
  },
  {
    tab: "Guven & Yorum",
    card: "Urun Puani",
    section: "trust_reviews",
    explicitRuleIds: ["trust-general-vs-seller-review-separation"],
    coverageLevel: "explicit",
    priority: "high",
  },
  {
    tab: "Guven & Yorum",
    card: "Yorum Hacmi",
    section: "trust_reviews",
    explicitRuleIds: ["trust-review-volume-is-direct-signal"],
    coverageLevel: "explicit",
    priority: "medium",
    notes: ["Dogrudan gercek veri olarak okunur."],
  },
  {
    tab: "Guven & Yorum",
    card: "Yorum Dagilimi",
    section: "trust_reviews",
    explicitRuleIds: ["trust-no-fake-review-history"],
    coverageLevel: "explicit",
    priority: "high",
  },
  {
    tab: "Guven & Yorum",
    card: "Aylik Yorum Trendi",
    section: "trust_reviews",
    explicitRuleIds: ["trust-no-fake-review-history"],
    coverageLevel: "explicit",
    priority: "high",
  },
  {
    tab: "Guven & Yorum",
    card: "Guven Boyutlari",
    section: "trust_reviews",
    explicitRuleIds: ["trust-dimensions-must-label-proxies"],
    coverageLevel: "explicit",
    priority: "medium",
    notes: ["Proxy eksenler durust adlandirilmali."],
  },
  {
    tab: "Guven & Yorum",
    card: "Son 10 Yorum",
    section: "trust_reviews",
    explicitRuleIds: ["trust-recent-reviews-are-sampled"],
    coverageLevel: "explicit",
    priority: "medium",
    notes: ["Orneklenmis veri olarak okunur."],
  },
  {
    tab: "Talep Sinyalleri",
    card: "Talep Sinyali",
    section: "demand_signals",
    explicitRuleIds: ["demand-core-four-signal-formula", "demand-direct-first-then-support"],
    coverageLevel: "explicit",
    priority: "high",
  },
  {
    tab: "Talep Sinyalleri",
    card: "Tahmini Aylik Satis Hacmi",
    section: "demand_signals",
    explicitRuleIds: ["demand-direct-first-then-support"],
    coverageLevel: "explicit",
    priority: "high",
    notes: ["Tahmini metrik, gercek satis gibi sunulmaz."],
  },
  {
    tab: "Talep Sinyalleri",
    card: "Pazar Konumu",
    section: "demand_signals",
    explicitRuleIds: ["demand-market-position-is-relative"],
    coverageLevel: "explicit",
    priority: "high",
    notes: ["Kesin pazar payi gibi okunmaz."],
  },
  {
    tab: "Talep Sinyalleri",
    card: "Buyume Firsati",
    section: "demand_signals",
    explicitRuleIds: ["demand-growth-opportunity-is-gap-based"],
    coverageLevel: "explicit",
    priority: "medium",
    notes: ["Turetilmis firsat metriği, explicit rule id henuz yok."],
  },
  {
    tab: "Talep Sinyalleri",
    card: "Pazar Ilgisi",
    section: "demand_signals",
    explicitRuleIds: ["demand-market-interest-is-composite"],
    coverageLevel: "explicit",
    priority: "medium",
    notes: ["Favori, yorum, soru ve goruntulenme birlikte okunur."],
  },
  {
    tab: "Talep Sinyalleri",
    card: "Tahmini Ilgi -> Satis Akisi",
    section: "demand_signals",
    explicitRuleIds: ["demand-funnel-is-estimated-not-real"],
    coverageLevel: "explicit",
    priority: "low",
    notes: ["Gercek funnel degil, tahmini akis."],
  },
  {
    tab: "Talep Sinyalleri",
    card: "Pazar Genel Degerlendirme",
    section: "demand_signals",
    explicitRuleIds: ["demand-market-summary-needs-estimated-language"],
    coverageLevel: "explicit",
    priority: "medium",
    notes: ["Tahmini ve gercek dil ayrimi uygulanıyor."],
  },
  {
    tab: "Aksiyonlar",
    card: "Oncelikli Aksiyon Listesi",
    section: "actions",
    explicitRuleIds: ["actions-evidence-required", "actions-no-duplicate-rephrasing"],
    coverageLevel: "explicit",
    priority: "high",
  },
  {
    tab: "Aksiyonlar",
    card: "Aksiyon Oncelik Matrisi",
    section: "actions",
    explicitRuleIds: ["actions-priority-matrix-is-relative"],
    coverageLevel: "explicit",
    priority: "medium",
    notes: ["Kesin ROI degil, goreli etki ve uygulama kolayligi okumasi."],
  },
  {
    tab: "Aksiyonlar",
    card: "Tahmini Skor Iyilesmesi",
    section: "actions",
    explicitRuleIds: ["actions-score-improvement-is-estimated"],
    coverageLevel: "explicit",
    priority: "medium",
    notes: ["Kesin sonuc degil, tahmini iyilesme bandi."],
  },
];

export function summarizeRuleCoverage() {
  const summary = {
    total: TRENDYOL_RULE_COVERAGE.length,
    explicit: 0,
    partial: 0,
    legacy: 0,
  };

  for (const item of TRENDYOL_RULE_COVERAGE) {
    summary[item.coverageLevel] += 1;
  }

  return summary;
}

export function getCoverageGaps() {
  return {
    partial: TRENDYOL_RULE_COVERAGE.filter((item) => item.coverageLevel === "partial"),
    legacy: TRENDYOL_RULE_COVERAGE.filter((item) => item.coverageLevel === "legacy"),
  };
}

export function getRecommendedCoverageWork() {
  const priorityRank = { high: 1, medium: 2, low: 3 } as const;
  return TRENDYOL_RULE_COVERAGE
    .filter((item) => item.coverageLevel !== "explicit")
    .sort((a, b) => {
      const aRank = priorityRank[a.priority ?? "medium"];
      const bRank = priorityRank[b.priority ?? "medium"];
      if (aRank !== bRank) return aRank - bRank;
      if (a.tab !== b.tab) return a.tab.localeCompare(b.tab, "tr");
      return a.card.localeCompare(b.card, "tr");
    });
}
