import type { AiEligibilityResult } from "@/lib/ai-eligibility";
import type { ConsolidatedAnalysisInput, DataField } from "@/types/analysis";

export type AnalysisCoverageTier = "strong" | "medium" | "weak";

export type AnalysisContractResult = {
  coverageTier: AnalysisCoverageTier;
  confidence: "high" | "medium" | "low";
  coreFieldsWithValue: number;
  coreFieldsReliable: number;
  blockingFields: string[];
  aiDecision: {
    executed: boolean;
    mode: "skip" | "cautious" | "full";
    reason: string;
  };
};

const CORE_FIELDS = [
  "title",
  "price",
  "brand",
  "imageCount",
  "descriptionLength",
  "sellerScore",
  "reviewCount",
  "ratingValue",
] as const satisfies ReadonlyArray<keyof ConsolidatedAnalysisInput>;

const CORE_FIELD_LABELS: Record<(typeof CORE_FIELDS)[number], string> = {
  title: "title",
  price: "price",
  brand: "brand",
  imageCount: "image_count",
  descriptionLength: "description_length",
  sellerScore: "seller_score",
  reviewCount: "review_count",
  ratingValue: "rating_value",
};

function isUsable(field: DataField<string | number | boolean> | undefined) {
  return Boolean(field && field.value !== null);
}

function isReliable(field: DataField<string | number | boolean> | undefined) {
  return Boolean(field && field.value !== null && field.confidence >= 0.65);
}

function toCoverageTier(params: {
  coreFieldsWithValue: number;
  coreFieldsReliable: number;
  extractorStatus: string;
}): AnalysisCoverageTier {
  if (params.extractorStatus === "blocked") {
    return "weak";
  }

  if (params.coreFieldsWithValue >= 6 && params.coreFieldsReliable >= 4) {
    return "strong";
  }

  if (params.coreFieldsWithValue >= 4 && params.coreFieldsReliable >= 2) {
    return "medium";
  }

  return "weak";
}

export function evaluateAnalysisContract(params: {
  input: ConsolidatedAnalysisInput;
  aiEligibility: AiEligibilityResult;
}): AnalysisContractResult {
  const extractorStatus = params.input._raw.extractor_status ?? "fallback";
  const coreFieldsWithValue = CORE_FIELDS.filter((fieldName) =>
    isUsable(
      params.input[fieldName] as DataField<string | number | boolean> | undefined
    )
  ).length;
  const coreFieldsReliable = CORE_FIELDS.filter((fieldName) =>
    isReliable(
      params.input[fieldName] as DataField<string | number | boolean> | undefined
    )
  ).length;
  const coverageTier = toCoverageTier({
    coreFieldsWithValue,
    coreFieldsReliable,
    extractorStatus,
  });
  const confidence =
    coverageTier === "strong"
      ? "high"
      : coverageTier === "medium"
        ? "medium"
        : "low";

  const blockingFields = CORE_FIELDS.filter((fieldName) => {
    const field = params.input[fieldName] as
      | DataField<string | number | boolean>
      | undefined;
    return !field || field.value === null || field.confidence < 0.5;
  }).map((fieldName) => CORE_FIELD_LABELS[fieldName]);

  if (!params.aiEligibility.eligible) {
    return {
      coverageTier,
      confidence,
      coreFieldsWithValue,
      coreFieldsReliable,
      blockingFields,
      aiDecision: {
        executed: false,
        mode: "skip",
        reason: params.aiEligibility.reason,
      },
    };
  }

  if (coverageTier === "weak") {
    return {
      coverageTier,
      confidence,
      coreFieldsWithValue,
      coreFieldsReliable,
      blockingFields,
      aiDecision: {
        executed: false,
        mode: "skip",
        reason:
          "AI atlandi: cekirdek veri kapsami zayif, deterministic katman guvenlik modu kullanildi.",
      },
    };
  }

  if (params.aiEligibility.mode === "cautious" || coverageTier === "medium") {
    return {
      coverageTier,
      confidence,
      coreFieldsWithValue,
      coreFieldsReliable,
      blockingFields,
      aiDecision: {
        executed: true,
        mode: "cautious",
        reason:
          "AI temkinli modda: cekirdek veri mevcut ancak bazi alanlar orta guven seviyesinde.",
      },
    };
  }

  return {
    coverageTier,
    confidence,
    coreFieldsWithValue,
    coreFieldsReliable,
    blockingFields,
    aiDecision: {
      executed: true,
      mode: "full",
      reason: "AI tam modda: cekirdek veri kapsami ve guven seviyesi yeterli.",
    },
  };
}
