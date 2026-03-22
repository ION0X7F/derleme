import type { ConsolidatedAnalysisInput, DataField } from "@/types/analysis";

export type AiEligibilityLevel = "high" | "medium" | "none";

export type AiEligibilityResult = {
  eligible: boolean;
  level: AiEligibilityLevel;
  score: number;
  reason: string;
};

const CRITICAL_FIELDS: Array<keyof ConsolidatedAnalysisInput> = [
  "title",
  "price",
  "brand",
  "reviewCount",
  "ratingValue",
  "imageCount",
  "sellerScore",
  "descriptionLength",
];

/**
 * Calculates the overall confidence score of the consolidated input data.
 * This score is a weighted average of the confidence of all fields.
 * @param input The consolidated analysis input.
 * @returns A confidence score between 0 and 1.
 */
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

  const totalConfidence = fields.reduce(
    (acc, field) => acc + field.confidence,
    0
  );
  return totalConfidence / fields.length;
}

/**
 * Determines whether the AI analysis should be run based on the quality
 * and completeness of the input data.
 *
 * @param input The consolidated analysis input data.
 * @returns An object containing the eligibility status, level, score, and reason.
 */
export function isAiAnalysisEligible(
  input: ConsolidatedAnalysisInput
): AiEligibilityResult {
  const overallScore = calculateOverallConfidence(input);

  const criticalFieldsWithHighConfidence = CRITICAL_FIELDS.filter(
    (fieldName) => {
        const field = input[fieldName] as DataField<string | number | boolean> | undefined;
        return field && field.confidence >= 0.7;
    }
  ).length;

  const criticalFieldsWithValue = CRITICAL_FIELDS.filter(
    (fieldName) => {
        const field = input[fieldName] as DataField<string | number | boolean> | undefined;
        return field && field.value !== null;
    }
  ).length;

  if (input.price.confidence < 0.4 || input.title.confidence < 0.4) {
    return {
      eligible: false,
      level: "none",
      score: overallScore,
      reason: "AI analysis skipped: Title and Price are critical fields with very low confidence.",
    };
  }

  if (criticalFieldsWithValue < 5) {
     return {
      eligible: false,
      level: "none",
      score: overallScore,
      reason: `AI analysis skipped: Not enough critical fields available (${criticalFieldsWithValue}/${CRITICAL_FIELDS.length}).`,
    };
  }

  if (overallScore >= 0.7 && criticalFieldsWithHighConfidence >= 4) {
    return {
      eligible: true,
      level: "high",
      score: overallScore,
      reason: "High data confidence. AI analysis is fully eligible.",
    };
  }

  if (overallScore >= 0.55 && criticalFieldsWithHighConfidence >= 2) {
    return {
      eligible: true,
      level: "medium",
      score: overallScore,
      reason: "Medium data confidence. AI analysis will run with caution.",
    };
  }

  return {
    eligible: false,
    level: "none",
    score: overallScore,
    reason: `AI analysis skipped: Overall data confidence score (${overallScore.toFixed(2)}) is below the minimum threshold.`,
  };
}
