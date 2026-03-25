import type { ConsolidatedAnalysisInput, DataField } from "@/types/analysis";

export type AiEligibilityLevel = "high" | "medium" | "none";
export type AiDecisionMode = "skip" | "cautious" | "full";

type AiGuidance = {
  preferDeterministicSummary: boolean;
  allowNarrativeExpansion: boolean;
  allowStrengthWeaknessRewrite: boolean;
  allowScoreOverrides: boolean;
  maxSuggestions: number;
  coverageConfidence: "high" | "medium" | "low";
};

function hasUsableValue(field: DataField<string | number | boolean> | undefined) {
  return Boolean(field && field.value !== null);
}

function isCoreFieldStrictReady(field: DataField<string | number | boolean> | undefined) {
  return hasUsableValue(field) && (field?.confidence ?? 0) >= 0.45;
}

function isCoreFieldBorderlineReady(
  field: DataField<string | number | boolean> | undefined
) {
  if (!hasUsableValue(field) || !field) {
    return false;
  }

  if (field.confidence >= 0.4 && field.source !== "unknown") {
    return true;
  }

  return false;
}

export type AiEligibilityResult = {
  eligible: boolean;
  level: AiEligibilityLevel;
  mode: AiDecisionMode;
  score: number;
  reason: string;
  blockingFields: string[];
  criticalFieldsWithValue: number;
  criticalFieldsWithHighConfidence: number;
  guidance: AiGuidance;
};

const CRITICAL_FIELDS = [
  "title",
  "price",
  "brand",
  "reviewCount",
  "ratingValue",
  "imageCount",
  "sellerScore",
  "descriptionLength",
] as const satisfies ReadonlyArray<keyof ConsolidatedAnalysisInput>;

const FIELD_LABELS: Record<(typeof CRITICAL_FIELDS)[number], string> = {
  title: "baslik",
  price: "fiyat",
  brand: "marka",
  reviewCount: "yorum sayisi",
  ratingValue: "puan ortalamasi",
  imageCount: "gorsel sayisi",
  sellerScore: "satici puani",
  descriptionLength: "aciklama derinligi",
};

const SKIP_GUIDANCE: AiGuidance = {
  preferDeterministicSummary: true,
  allowNarrativeExpansion: false,
  allowStrengthWeaknessRewrite: false,
  allowScoreOverrides: false,
  maxSuggestions: 3,
  coverageConfidence: "low",
};

const CAUTIOUS_GUIDANCE: AiGuidance = {
  preferDeterministicSummary: true,
  allowNarrativeExpansion: false,
  allowStrengthWeaknessRewrite: false,
  allowScoreOverrides: false,
  maxSuggestions: 3,
  coverageConfidence: "medium",
};

const FULL_GUIDANCE: AiGuidance = {
  preferDeterministicSummary: false,
  allowNarrativeExpansion: true,
  allowStrengthWeaknessRewrite: true,
  allowScoreOverrides: true,
  maxSuggestions: 10,
  coverageConfidence: "high",
};

function calculateOverallConfidence(input: ConsolidatedAnalysisInput): number {
  const fields = Object.values(input).filter(
    (field): field is DataField<string | number | boolean> =>
      typeof field === "object" &&
      field !== null &&
      "confidence" in field &&
      !Array.isArray(field)
  );

  if (fields.length === 0) {
    return 0;
  }

  const totalConfidence = fields.reduce((acc, field) => acc + field.confidence, 0);
  return totalConfidence / fields.length;
}

function getCriticalField(
  input: ConsolidatedAnalysisInput,
  fieldName: keyof ConsolidatedAnalysisInput
) {
  return input[fieldName] as DataField<string | number | boolean> | undefined;
}

function getBlockingFields(input: ConsolidatedAnalysisInput) {
  return CRITICAL_FIELDS.filter((fieldName) => {
    const field = getCriticalField(input, fieldName);
    return !field || field.value === null || field.confidence < 0.5;
  }).map((fieldName) => FIELD_LABELS[fieldName]);
}

export function isAiAnalysisEligible(
  input: ConsolidatedAnalysisInput
): AiEligibilityResult {
  const overallScore = calculateOverallConfidence(input);
  const titleField = input.title;
  const priceField = input.price;
  const extractorStatus = input._raw.extractor_status ?? "fallback";

  const criticalFieldsWithHighConfidence = CRITICAL_FIELDS.filter((fieldName) => {
    const field = getCriticalField(input, fieldName);
    return field && field.value !== null && field.confidence >= 0.7;
  }).length;

  const criticalFieldsWithValue = CRITICAL_FIELDS.filter((fieldName) => {
    const field = getCriticalField(input, fieldName);
    return field && field.value !== null;
  }).length;

  const blockingFields = getBlockingFields(input);
  const strictCoreReady =
    isCoreFieldStrictReady(titleField) &&
    isCoreFieldStrictReady(priceField) &&
    (titleField?.confidence ?? 0) >= 0.5 &&
    (priceField?.confidence ?? 0) >= 0.5;
  const borderlineCoreReady =
    isCoreFieldBorderlineReady(titleField) &&
    isCoreFieldBorderlineReady(priceField) &&
    overallScore >= 0.66 &&
    criticalFieldsWithValue >= 6 &&
    criticalFieldsWithHighConfidence >= 4;

  if (extractorStatus === "blocked") {
    return {
      eligible: false,
      level: "none",
      mode: "skip",
      score: overallScore,
      reason:
        "AI devreye alinmadi: extractor kritik seviyede sinirli veri dondurdu (blocked).",
      blockingFields,
      criticalFieldsWithValue,
      criticalFieldsWithHighConfidence,
      guidance: SKIP_GUIDANCE,
    };
  }

  if (!strictCoreReady && !borderlineCoreReady) {
    return {
      eligible: false,
      level: "none",
      mode: "skip",
      score: overallScore,
      reason: "AI devreye alinmadi: baslik veya fiyat verisi yeterince guvenilir degil.",
      blockingFields,
      criticalFieldsWithValue,
      criticalFieldsWithHighConfidence,
      guidance: SKIP_GUIDANCE,
    };
  }

  if (criticalFieldsWithValue < 5) {
    return {
      eligible: false,
      level: "none",
      mode: "skip",
      score: overallScore,
      reason: `AI devreye alinmadi: kritik veri kapsami yetersiz (${criticalFieldsWithValue}/${CRITICAL_FIELDS.length}).`,
      blockingFields,
      criticalFieldsWithValue,
      criticalFieldsWithHighConfidence,
      guidance: SKIP_GUIDANCE,
    };
  }

  if (
    overallScore >= 0.74 &&
    criticalFieldsWithValue >= 7 &&
    criticalFieldsWithHighConfidence >= 5 &&
    blockingFields.length === 0 &&
    extractorStatus === "ok"
  ) {
    return {
      eligible: true,
      level: "high",
      mode: "full",
      score: overallScore,
      reason: "AI tam modda calisabilir: cekirdek veri kapsami ve guven seviyesi yeterli.",
      blockingFields,
      criticalFieldsWithValue,
      criticalFieldsWithHighConfidence,
      guidance: FULL_GUIDANCE,
    };
  }

  if (
    overallScore >= 0.6 &&
    criticalFieldsWithValue >= 6 &&
    criticalFieldsWithHighConfidence >= 3
  ) {
    return {
      eligible: true,
      level: "medium",
      mode: "cautious",
      score: overallScore,
      reason:
        borderlineCoreReady && !strictCoreReady
          ? "AI temkinli modda calisacak: baslik ve fiyat mevcut, ancak bu cekirdek alanlar sinirda guvenle dogrulandi."
          : "AI temkinli modda calisacak: cekirdek veri mevcut, ancak bazi kritik alanlar orta veya dusuk guvenli.",
      blockingFields,
      criticalFieldsWithValue,
      criticalFieldsWithHighConfidence,
      guidance: CAUTIOUS_GUIDANCE,
    };
  }

  return {
    eligible: false,
    level: "none",
    mode: "skip",
    score: overallScore,
    reason: `AI devreye alinmadi: genel guven skoru (${overallScore.toFixed(2)}) minimum esigin altinda.`,
    blockingFields,
    criticalFieldsWithValue,
    criticalFieldsWithHighConfidence,
    guidance: SKIP_GUIDANCE,
  };
}
