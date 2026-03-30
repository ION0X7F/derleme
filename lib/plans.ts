export type RuntimePlanCode = "FREE" | "PREMIUM";
export type PersistedPlanVariant =
  | "FREE"
  | "PRO_MONTHLY"
  | "PRO_YEARLY"
  | "TEAM";

export const APP_PLAN_IDS = [
  "FREE",
  "PRO_MONTHLY",
  "PRO_YEARLY",
  "TEAM",
] as const;

export type AppPlanId = (typeof APP_PLAN_IDS)[number];

export const APP_PLAN_FEATURE_KEYS = [
  "limitedPreview",
  "fullAiAnalysis",
  "advancedRecommendations",
  "titleDescriptionFaqSuggestions",
  "competitorAnalysis",
  "detailedDashboard",
  "extendedHistory",
  "higherUsageLimit",
  "teamCapacity",
] as const;

export type AppPlanFeatureKey = (typeof APP_PLAN_FEATURE_KEYS)[number];

export type PlanAccent = "brand" | "accent" | "success" | "neutral";

export type PricingCardPlan = {
  key: string;
  name: string;
  price: string;
  billing: string;
  subtitle: string;
  description: string;
  features: string[];
  badge?: string;
  featured?: boolean;
  accent?: PlanAccent;
  ctaHref: string;
  ctaLabel: string;
};

export type PricingMatrixRow = {
  feature: string;
  free: string;
  pro: string;
  yearly: string;
  team: string;
};

export type CampaignContent = {
  badge: string;
  title: string;
  detail: string;
  ctaLabel: string;
  ctaHref: string;
  highlightedOffer: string;
  campaignLabel: string;
  campaignDescription: string;
  isLimitedOffer: boolean;
};

type PlanDefinition = {
  id: AppPlanId;
  slug: string;
  runtimePlanCode: RuntimePlanCode;
  displayName: string;
  shortDescription: string;
  description: string;
  subtitle: string;
  priceLabel: string;
  billingLabel: string;
  billingType: "free" | "monthly" | "yearly";
  badge?: string;
  accent: PlanAccent;
  isPopular?: boolean;
  isRecommended?: boolean;
  isPaid: boolean;
  featureFlags: Record<AppPlanFeatureKey, boolean>;
  featureList: string[];
  usageLimits: {
    analysis: string;
    history: string;
    dashboard: string;
    competitorDepth: string;
    teamCapacity: string;
  };
  comparisonLabels: {
    aiDepth: string;
    usage: string;
    dashboard: string;
    competitor: string;
    history: string;
  };
  cta: {
    guestLabel: string;
    guestHref: string;
    signedInLabel: string;
    signedInHref: string;
  };
  workspace: {
    accent: "status-good" | "status-warn";
    note: string;
  };
  campaignLabel?: string;
  campaignDescription?: string;
  isLimitedOffer?: boolean;
};

type PricingPlanBuilderParams = {
  currentPlanId?: AppPlanId | null;
  isAuthenticated?: boolean;
};

const PLAN_DEFINITIONS: Record<AppPlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    slug: "free",
    runtimePlanCode: "FREE",
    displayName: "Ucretsiz",
    shortDescription: "Deneme ve onizleme katmani.",
    description:
      "Sistemi denemek, ilk teshisi gormek ve AI karar deneyimini tanimak isteyenler icin hafif giris paketi.",
    subtitle: "Sistemi test etmek isteyenler icin deneme katmani",
    priceLabel: "0 TL",
    billingLabel: "/ ay",
    billingType: "free",
    accent: "neutral",
    isPaid: false,
    featureFlags: {
      limitedPreview: true,
      fullAiAnalysis: false,
      advancedRecommendations: false,
      titleDescriptionFaqSuggestions: false,
      competitorAnalysis: false,
      detailedDashboard: false,
      extendedHistory: false,
      higherUsageLimit: false,
      teamCapacity: false,
    },
    featureList: [
      "Sinirli analiz hakki",
      "Temel skor gorunumu",
      "Sinirli analiz onizlemesi",
      "Tam AI yorumunun bir kismi kilitli",
      "Rapor gecmisi sinirli",
      "Gelismis rekabet detaylari sinirli",
    ],
    usageLimits: {
      analysis: "Sinirli",
      history: "Sinirli gecmis",
      dashboard: "Temel gorunum",
      competitorDepth: "Onizleme seviyesi",
      teamCapacity: "Yok",
    },
    comparisonLabels: {
      aiDepth: "Onizleme",
      usage: "Sinirli",
      dashboard: "Temel",
      competitor: "Sinirli",
      history: "Sinirli",
    },
    cta: {
      guestLabel: "Ucretsiz Basla",
      guestHref: "/register",
      signedInLabel: "Mevcut Plan",
      signedInHref: "/account",
    },
    workspace: {
      accent: "status-warn",
      note: "Temel analiz ve onizleme acik. Tam AI yorumu ve rekabet katmani ust planda genisler.",
    },
  },
  PRO_MONTHLY: {
    id: "PRO_MONTHLY",
    slug: "pro-monthly",
    runtimePlanCode: "PREMIUM",
    displayName: "Pro Aylik",
    shortDescription: "Tam analiz ve ana urun paketi.",
    description:
      "SellBoost'un ana urun paketi. Tam AI analiz, gelismis urun teshisi ve detayli karar ekranlari bu katmanda acilir.",
    subtitle: "Ana urun paketi ve tam karar paneli",
    priceLabel: "399 TL",
    billingLabel: "/ ay",
    billingType: "monthly",
    badge: "Ana urun",
    accent: "brand",
    isPopular: true,
    isPaid: true,
    featureFlags: {
      limitedPreview: true,
      fullAiAnalysis: true,
      advancedRecommendations: true,
      titleDescriptionFaqSuggestions: true,
      competitorAnalysis: true,
      detailedDashboard: true,
      extendedHistory: true,
      higherUsageLimit: true,
      teamCapacity: false,
    },
    featureList: [
      "Tam AI analiz",
      "Gelismis urun teshisi",
      "Baslik, aciklama ve SSS onerileri",
      "Rakip fiyat ve teklif analizi",
      "Detayli dashboard erisimi",
      "Rapor gecmisi",
      "Gelismis tahmin ve aksiyon ekranlari",
      "Daha yuksek kullanim limiti",
    ],
    usageLimits: {
      analysis: "Daha yuksek limit",
      history: "Genis rapor gecmisi",
      dashboard: "Detayli dashboard",
      competitorDepth: "Tam rakip katmani",
      teamCapacity: "Kisisel / bireysel",
    },
    comparisonLabels: {
      aiDepth: "Tam",
      usage: "Yuksek",
      dashboard: "Detayli",
      competitor: "Tam",
      history: "Genis",
    },
    cta: {
      guestLabel: "Pro'ya Gec",
      guestHref: "/register",
      signedInLabel: "Pro'yu Ac",
      signedInHref: "/account",
    },
    workspace: {
      accent: "status-good",
      note: "Tam AI analiz, rekabet katmani, export ve premium aksiyon ekranlari aktif.",
    },
    campaignLabel: "Sinirli kampanya",
    campaignDescription:
      "Ilk 15 gun Pro uyelik ozel kampanya ile daha hizli test edilebilir.",
    isLimitedOffer: true,
  },
  PRO_YEARLY: {
    id: "PRO_YEARLY",
    slug: "pro-yearly",
    runtimePlanCode: "PREMIUM",
    displayName: "Pro Yillik",
    shortDescription: "Pro'nun en avantajli odeme modeli.",
    description:
      "Pro katmaninin tum yeteneklerini daha avantajli fiyatla sunan, uzun vadeli kullanim icin tasarlanmis yillik model.",
    subtitle: "Pro'nun en avantajli odeme modeli",
    priceLabel: "3.990 TL",
    billingLabel: "/ yil",
    billingType: "yearly",
    badge: "En avantajli",
    accent: "success",
    isRecommended: true,
    isPaid: true,
    featureFlags: {
      limitedPreview: true,
      fullAiAnalysis: true,
      advancedRecommendations: true,
      titleDescriptionFaqSuggestions: true,
      competitorAnalysis: true,
      detailedDashboard: true,
      extendedHistory: true,
      higherUsageLimit: true,
      teamCapacity: false,
    },
    featureList: [
      "Pro'nun tum ozellikleri",
      "Yillik fiyat avantaji",
      "Uzun vadeli deger modeli",
      "Tam AI analiz ve dashboard erisimi",
      "Rapor kutuphanesi ve aksiyon ekranlari",
    ],
    usageLimits: {
      analysis: "Yuksek limit",
      history: "Genis rapor gecmisi",
      dashboard: "Detayli dashboard",
      competitorDepth: "Tam rakip katmani",
      teamCapacity: "Kisisel / bireysel",
    },
    comparisonLabels: {
      aiDepth: "Tam",
      usage: "Yuksek",
      dashboard: "Detayli",
      competitor: "Tam",
      history: "Genis",
    },
    cta: {
      guestLabel: "Yillik Avantaji Sec",
      guestHref: "/register",
      signedInLabel: "Yillik Avantaja Gec",
      signedInHref: "/account",
    },
    workspace: {
      accent: "status-good",
      note: "Pro'nun tum karar katmanlari acik. Yillik model en avantajli fiyat hissini sunar.",
    },
    campaignLabel: "En avantajli odeme",
    campaignDescription:
      "Ayni premium karar deneyimini daha avantajli toplam maliyetle sabitler.",
  },
  TEAM: {
    id: "TEAM",
    slug: "team",
    runtimePlanCode: "PREMIUM",
    displayName: "Ekip / Ajans",
    shortDescription: "Yuksek kapasite ve cok urun akisi.",
    description:
      "Cok urun yoneten ekipler, ajanslar ve operasyonel takip ihtiyaci olan yapilar icin daha kurumsal kullanim hissi sunar.",
    subtitle: "Ajanslar ve cok urun yoneten ekipler icin",
    priceLabel: "1.290 TL",
    billingLabel: "/ ay",
    billingType: "monthly",
    badge: "Ekip kapasitesi",
    accent: "accent",
    isPaid: true,
    featureFlags: {
      limitedPreview: true,
      fullAiAnalysis: true,
      advancedRecommendations: true,
      titleDescriptionFaqSuggestions: true,
      competitorAnalysis: true,
      detailedDashboard: true,
      extendedHistory: true,
      higherUsageLimit: true,
      teamCapacity: true,
    },
    featureList: [
      "Pro'nun tum gelismis analiz mantigi",
      "Daha yuksek kullanim kapasitesi",
      "Cok urun akislarina daha uygun yapi",
      "Ajans ve ekip kullanimina uygun karar duzeni",
      "Daha kurumsal kullanim hissi",
    ],
    usageLimits: {
      analysis: "Cok yuksek limit",
      history: "Genis rapor gecmisi",
      dashboard: "Detayli dashboard",
      competitorDepth: "Tam rakip katmani",
      teamCapacity: "Ekip / ajans odakli",
    },
    comparisonLabels: {
      aiDepth: "Tam + ekip",
      usage: "Cok yuksek",
      dashboard: "Kurumsal",
      competitor: "Tam",
      history: "Ekip odakli",
    },
    cta: {
      guestLabel: "Ekip Paketi Sor",
      guestHref: "/iletisim",
      signedInLabel: "Ekip Gecisi Sor",
      signedInHref: "/iletisim",
    },
    workspace: {
      accent: "status-good",
      note: "Tam premium analiz mantigi korunur; yuksek kapasite ve cok urun akisi icin daha uygun konumlanir.",
    },
  },
};

const PRICING_PLAN_ORDER: AppPlanId[] = [
  "FREE",
  "PRO_MONTHLY",
  "PRO_YEARLY",
  "TEAM",
];

const FEATURE_LABELS: Record<AppPlanFeatureKey, string> = {
  limitedPreview: "Sinirli analiz onizlemesi",
  fullAiAnalysis: "Tam AI analiz",
  advancedRecommendations: "Gelismis aksiyon ve tavsiye katmani",
  titleDescriptionFaqSuggestions: "Baslik / aciklama / SSS onerileri",
  competitorAnalysis: "Rakip fiyat ve teklif analizi",
  detailedDashboard: "Detayli dashboard erisimi",
  extendedHistory: "Rapor gecmisi",
  higherUsageLimit: "Daha yuksek kullanim limiti",
  teamCapacity: "Ekip / ajans kapasitesi",
};

function formatPlanCta(params: {
  planId: AppPlanId;
  currentPlanId?: AppPlanId | null;
  isAuthenticated?: boolean;
}) {
  const plan = PLAN_DEFINITIONS[params.planId];

  if (params.currentPlanId === params.planId) {
    return {
      href: "/account",
      label: "Mevcut plan",
    };
  }

  if (params.currentPlanId === "FREE" && params.planId === "PRO_MONTHLY") {
    return {
      href: buildCheckoutPlanHref("PRO_MONTHLY"),
      label: "Pro'ya Gec",
    };
  }

  if (params.currentPlanId === "PRO_MONTHLY" && params.planId === "PRO_YEARLY") {
    return {
      href: buildCheckoutPlanHref("PRO_YEARLY"),
      label: "Yillik Avantaja Gec",
    };
  }

  if (params.currentPlanId && params.planId === "FREE") {
    return {
      href: "/account",
      label: "Karsilastir",
    };
  }

  if (params.isAuthenticated) {
    return {
      href: isPaidPlanId(params.planId)
        ? buildCheckoutPlanHref(params.planId)
        : plan.cta.signedInHref,
      label: plan.cta.signedInLabel,
    };
  }

  return {
    href: isPaidPlanId(params.planId)
      ? buildRegisterPlanHref(params.planId)
      : plan.cta.guestHref,
    label: plan.cta.guestLabel,
  };
}

export const campaignContent: CampaignContent = {
  badge: "Sinirli kampanya",
  title: "Ilk 15 gun Pro uyelik ozel kampanya ile acik.",
  detail:
    "Karar panelinin tum derinligini hizli test etmek isteyen ekipler icin kontrollu, premium bir gecis teklifi.",
  ctaLabel: "Kampanyayi Gor",
  ctaHref: "/pricing",
  highlightedOffer: "Pro Aylik",
  campaignLabel: "Sinirli kampanya",
  campaignDescription:
    "Pro Aylik paketi ilk karar surecini hizlandirmak icin sinirli sureli bir gecis teklifiyle desteklenir.",
  isLimitedOffer: true,
};

export function isAppPlanId(value?: string | null): value is AppPlanId {
  return APP_PLAN_IDS.includes(value as AppPlanId);
}

export function isPaidPlanId(planId?: AppPlanId | null) {
  return !!planId && PLAN_DEFINITIONS[planId].isPaid;
}

export function buildRegisterPlanHref(planId: AppPlanId) {
  if (planId === "FREE") return "/register";
  return `/register?plan=${encodeURIComponent(planId)}`;
}

export function buildCheckoutPlanHref(planId: AppPlanId) {
  if (planId === "FREE") return "/register";
  return `/checkout?plan=${encodeURIComponent(planId)}`;
}

export function getPlanDefinition(planId: AppPlanId) {
  return PLAN_DEFINITIONS[planId];
}

export function getPlanDefinitions() {
  return PRICING_PLAN_ORDER.map((planId) => PLAN_DEFINITIONS[planId]);
}

export function getPlanFeatureLabels() {
  return FEATURE_LABELS;
}

export function getRuntimePlanCodeForPlanId(planId: AppPlanId) {
  return PLAN_DEFINITIONS[planId].runtimePlanCode;
}

export function resolveAppPlanId(params: {
  planCode?: string | null;
  planVariant?: PersistedPlanVariant | string | null;
  planName?: string | null;
}): AppPlanId {
  if (isAppPlanId(params.planVariant ?? null)) {
    return params.planVariant as AppPlanId;
  }

  const name = (params.planName || "").toLowerCase();

  if (name.includes("yillik") || name.includes("year")) {
    return "PRO_YEARLY";
  }

  if (name.includes("team") || name.includes("ekip") || name.includes("ajans")) {
    return "TEAM";
  }

  if (params.planCode === "PREMIUM" || params.planCode === "pro") {
    return "PRO_MONTHLY";
  }

  return "FREE";
}

export function getPlanDisplayName(planId: AppPlanId) {
  return PLAN_DEFINITIONS[planId].displayName;
}

export function getPlanPriceLabel(planId: AppPlanId) {
  const plan = PLAN_DEFINITIONS[planId];
  return `${plan.priceLabel} ${plan.billingLabel}`.trim();
}

export function getSuggestedUpgradePlanId(
  planId?: AppPlanId | null
): AppPlanId | null {
  if (planId === "FREE") return "PRO_MONTHLY";
  if (planId === "PRO_MONTHLY") return "PRO_YEARLY";
  return null;
}

export function getSuggestedUpgradeCopy(planId?: AppPlanId | null) {
  const targetId = getSuggestedUpgradePlanId(planId);

  if (!targetId) {
    return null;
  }

  if (planId === "FREE") {
    return {
      targetId,
      ctaLabel: "Pro'ya Gec",
      href: "/pricing",
      note: "Tam analiz, rekabet katmani ve detayli dashboard icin Pro Aylik onerilir.",
    };
  }

  return {
    targetId,
    ctaLabel: "Yillik Avantaja Gec",
    href: "/pricing",
    note: "Ayni premium deneyimi daha avantajli odeme modeliyle sabitlemek icin Pro Yillik onerilir.",
  };
}

export function getWorkspacePlanSummary(planId: AppPlanId) {
  const plan = PLAN_DEFINITIONS[planId];
  const suggestedUpgrade = getSuggestedUpgradeCopy(planId);
  const billingLabelText =
    plan.billingType === "yearly"
      ? "Yillik"
      : plan.billingType === "monthly"
        ? "Aylik"
        : "Deneme";

  return {
    id: plan.id,
    label: plan.displayName,
    shortDescription: plan.shortDescription,
    note: plan.workspace.note,
    price: getPlanPriceLabel(plan.id),
    badge: plan.badge ?? null,
    accent: plan.workspace.accent,
    billingType: plan.billingType,
    billingLabelText,
    isPaid: plan.isPaid,
    campaignLabel: plan.campaignLabel ?? null,
    campaignDescription: plan.campaignDescription ?? null,
    upgradeHref: suggestedUpgrade?.href ?? "/reports",
    upgradeLabel: suggestedUpgrade?.ctaLabel ?? "Raporlara Git",
    suggestedUpgrade,
  };
}

export function buildPricingPlans(
  params: PricingPlanBuilderParams = {}
): PricingCardPlan[] {
  return PRICING_PLAN_ORDER.map((planId) => {
    const plan = PLAN_DEFINITIONS[planId];
    const cta = formatPlanCta({
      planId,
      currentPlanId: params.currentPlanId,
      isAuthenticated: params.isAuthenticated,
    });

    return {
      key: plan.slug,
      name: plan.displayName,
      price: plan.priceLabel,
      billing: plan.billingLabel,
      subtitle: plan.subtitle,
      description: plan.description,
      features: plan.featureList,
      badge:
        params.currentPlanId === planId
          ? "Mevcut plan"
          : plan.badge,
      featured: plan.isPopular || plan.isRecommended,
      accent: plan.accent,
      ctaHref: cta.href,
      ctaLabel: cta.label,
    };
  });
}

export const pricingPlans = buildPricingPlans();

export const pricingMatrix: PricingMatrixRow[] = [
  {
    feature: "Analiz hakki",
    free: PLAN_DEFINITIONS.FREE.comparisonLabels.usage,
    pro: PLAN_DEFINITIONS.PRO_MONTHLY.comparisonLabels.usage,
    yearly: PLAN_DEFINITIONS.PRO_YEARLY.comparisonLabels.usage,
    team: PLAN_DEFINITIONS.TEAM.comparisonLabels.usage,
  },
  {
    feature: "AI yorumlama derinligi",
    free: PLAN_DEFINITIONS.FREE.comparisonLabels.aiDepth,
    pro: PLAN_DEFINITIONS.PRO_MONTHLY.comparisonLabels.aiDepth,
    yearly: PLAN_DEFINITIONS.PRO_YEARLY.comparisonLabels.aiDepth,
    team: PLAN_DEFINITIONS.TEAM.comparisonLabels.aiDepth,
  },
  {
    feature: "Dashboard ve karar ekranlari",
    free: PLAN_DEFINITIONS.FREE.comparisonLabels.dashboard,
    pro: PLAN_DEFINITIONS.PRO_MONTHLY.comparisonLabels.dashboard,
    yearly: PLAN_DEFINITIONS.PRO_YEARLY.comparisonLabels.dashboard,
    team: PLAN_DEFINITIONS.TEAM.comparisonLabels.dashboard,
  },
  {
    feature: "Rakip ve teklif katmani",
    free: PLAN_DEFINITIONS.FREE.comparisonLabels.competitor,
    pro: PLAN_DEFINITIONS.PRO_MONTHLY.comparisonLabels.competitor,
    yearly: PLAN_DEFINITIONS.PRO_YEARLY.comparisonLabels.competitor,
    team: PLAN_DEFINITIONS.TEAM.comparisonLabels.competitor,
  },
  {
    feature: "Rapor gecmisi",
    free: PLAN_DEFINITIONS.FREE.comparisonLabels.history,
    pro: PLAN_DEFINITIONS.PRO_MONTHLY.comparisonLabels.history,
    yearly: PLAN_DEFINITIONS.PRO_YEARLY.comparisonLabels.history,
    team: PLAN_DEFINITIONS.TEAM.comparisonLabels.history,
  },
];
