type AccessNarrativeParams = {
  plan?: string | null;
  lockedSections?: string[] | null;
  dataCompletenessScore?: number | null;
  coverageConfidence?: "high" | "medium" | "low" | null;
};

type AccessNarrativeTextParams = AccessNarrativeParams & {
  diagnosis?: string | null;
  summary?: string | null;
};

type AccessNarrativeRecipeParams = AccessNarrativeParams & {
  items?: string[] | null;
};

const MISSING_DATA_PATTERNS = [
  "veri yetersizligi nedeniyle",
  "analiz disi birakildi",
  "sinirli kapsama sahip",
];

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function includesMissingDataCopy(value?: string | null) {
  const text = normalizeText(value).toLowerCase();

  return text.length > 0
    ? MISSING_DATA_PATTERNS.some((pattern) => text.includes(pattern))
    : false;
}

function isLimitedAccessPlan(plan?: string | null) {
  return plan === "guest" || plan === "free";
}

export function shouldMaskMissingDataCopy(params: AccessNarrativeParams) {
  if (!isLimitedAccessPlan(params.plan)) {
    return false;
  }

  if ((params.lockedSections?.length ?? 0) === 0) {
    return false;
  }

  if (params.coverageConfidence === "low") {
    return false;
  }

  if (
    typeof params.dataCompletenessScore === "number" &&
    params.dataCompletenessScore < 70
  ) {
    return false;
  }

  return true;
}

function getLimitedAccessCopy(plan?: string | null) {
  if (plan === "guest") {
    return {
      diagnosis:
        "Bu ilk gorunum misafir erisimi icin sade tutuldu. Tam raporda rekabet, teklif ve detayli aksiyon sirasi acilir.",
      dataCollision:
        "Bu ekranda hizli bir on teshis gosteriliyor. Hesapta daha fazla karar katmani ve daha derin yorum acilir.",
      recipe: [
        "Hesap acarak tam AI raporunu gor.",
        "Rekabet ve teklif baskisini detayli karsilastir.",
        "Oncelikli aksiyon sirasini tam raporda incele.",
      ],
    };
  }

  return {
    diagnosis:
      "Bu gorunum mevcut plan seviyesine gore sade tutuldu. Tam raporda rekabet katmani ve genis aksiyon sirasi acilir.",
    dataCollision:
      "Ilk karar sinyalleri acik, ancak daha derin teklif ve rekabet katmanlari ust pakette gorunur.",
    recipe: [
      "Ust pakette tam AI raporunu ac.",
      "Teklif ve rekabet sinyallerini detayli oku.",
      "Aksiyon onceligini tam raporda netlestir.",
    ],
  };
}

export function getAccessAwareDiagnosisText(
  params: AccessNarrativeTextParams
) {
  const baseText = normalizeText(params.diagnosis) || normalizeText(params.summary);

  if (
    shouldMaskMissingDataCopy(params) &&
    includesMissingDataCopy(baseText)
  ) {
    return getLimitedAccessCopy(params.plan).diagnosis;
  }

  return baseText || null;
}

export function getAccessAwareDataCollisionText(
  params: AccessNarrativeTextParams
) {
  const baseText = normalizeText(params.diagnosis) || normalizeText(params.summary);

  if (
    shouldMaskMissingDataCopy(params) &&
    (!baseText || includesMissingDataCopy(baseText))
  ) {
    return getLimitedAccessCopy(params.plan).dataCollision;
  }

  return baseText || null;
}

export function getAccessAwareRecipeItems(
  params: AccessNarrativeRecipeParams
) {
  const visibleItems = (params.items ?? []).filter(
    (item) => !includesMissingDataCopy(item)
  );

  if (visibleItems.length > 0) {
    return visibleItems;
  }

  if (shouldMaskMissingDataCopy(params)) {
    return getLimitedAccessCopy(params.plan).recipe;
  }

  return params.items ?? [];
}

export function shouldHideBlockedByDataNotice(params: AccessNarrativeParams) {
  return shouldMaskMissingDataCopy(params);
}

export function shouldHideCoverageSignalsForAccess(
  params: AccessNarrativeParams
) {
  return shouldMaskMissingDataCopy(params);
}
