import { analyzeWithAi } from "@/lib/ai-analysis";
import { evaluateAnalysisContract } from "@/lib/analysis-contract";
import { buildAnalysisTrace } from "@/lib/analysis-trace";
import {
  isAiAnalysisEligible,
  type AiEligibilityResult,
} from "@/lib/ai-eligibility";
import {
  calculateHealthScore,
  getHealthStatusLabel,
} from "@/lib/extractors/health";
import { enrichTrendyolScorecardWithAi } from "@/lib/trendyol-scorecard";
import type {
  AnalysisContractResult,
} from "@/lib/analysis-contract";
import type {
  BuildAnalysisResult,
  ConsolidatedAnalysisInput,
  ExtractedFieldMetadata,
  ExtractorHealthReport,
  LearningContext,
  MissingDataReport,
  NormalizedFieldMetadata,
} from "@/types/analysis";
import type { DebugTraceHandle } from "@/lib/debug-observability";
import { emitDebugTrace, traceEvent } from "@/lib/debug-observability";
import {
  buildCategoryAverages,
  hasText,
  resolvePriorityActions,
  shouldUseAiScore,
} from "@/lib/run-analysis-helpers";

type ProgressUpdate = {
  stage: "ai";
  step: number;
  totalSteps: number;
  label: string;
  detail?: string;
  preview?: Record<string, unknown> | null;
};

const CRITICAL_FIELDS = [
  "title",
  "h1",
  "brand",
  "product_name",
  "normalized_price",
  "image_count",
  "description_length",
  "seller_name",
  "rating_value",
  "review_count",
  "shipping_days",
  "stock_status",
];

export function attachDeterministicMetadata(params: {
  analysis: BuildAnalysisResult;
  fieldMetadata: Record<string, ExtractedFieldMetadata>;
  normalizedFieldMetadata?: Record<string, NormalizedFieldMetadata>;
  extractorHealth: ExtractorHealthReport;
}) {
  const { analysis, fieldMetadata, normalizedFieldMetadata, extractorHealth } = params;
  analysis._fieldMetadata = fieldMetadata;
  analysis._normalizedFieldMetadata = normalizedFieldMetadata;
  analysis.extractorHealth = extractorHealth;
  analysis.debugTrace = null;
}

export function logExtractorHealth(params: {
  extractorHealth: ExtractorHealthReport;
}) {
  if (process.env.NODE_ENV !== "development") return;

  const { extractorHealth } = params;
  const healthScore = calculateHealthScore(extractorHealth);
  const healthStatus = getHealthStatusLabel(healthScore);
  console.log(
    `[Extraction Health] Platform: ${extractorHealth.platformDetected}, Score: ${healthScore}/100 (${healthStatus}), Critical: ${extractorHealth.criticalFieldsFound}/${CRITICAL_FIELDS.length}`
  );
}

export async function enrichAnalysisForDelivery(params: {
  analysis: BuildAnalysisResult;
  consolidatedInput: ConsolidatedAnalysisInput;
  url: string;
  learningContext: LearningContext;
  missingDataReport: MissingDataReport;
  debugTrace: DebugTraceHandle;
  emitProgress: (update: ProgressUpdate) => void;
}) {
  const {
    analysis,
    consolidatedInput,
    url,
    learningContext,
    missingDataReport,
    debugTrace,
    emitProgress,
  } = params;

  analysis.categoryAverages = buildCategoryAverages(learningContext);

  if (analysis.trendyolScorecard) {
    analysis.trendyolScorecard = await enrichTrendyolScorecardWithAi({
      extracted: analysis.extractedData,
      scorecard: analysis.trendyolScorecard,
    });
    analysis.seoScore = analysis.trendyolScorecard.searchVisibility.score;
    analysis.conversionScore = analysis.trendyolScorecard.conversionPotential.score;
    analysis.overallScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          analysis.trendyolScorecard.overall.score * 0.65 +
            analysis.dataCompletenessScore * 0.2 +
            analysis.trendyolScorecard.conversionPotential.score * 0.15
        )
      )
    );
  }

  const aiEligibility = isAiAnalysisEligible(consolidatedInput);
  const contract = evaluateAnalysisContract({
    input: consolidatedInput,
    aiEligibility,
  });

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[AI Eligibility] ${aiEligibility.reason} | contract: ${contract.aiDecision.reason}`
    );
  }

  const aiResult = await runAiEnrichment({
    analysis,
    consolidatedInput,
    url,
    learningContext,
    missingDataReport,
    aiEligibility,
    contract,
    debugTrace,
    emitProgress,
  });

  analysis.analysisTrace = buildAnalysisTrace({
    mode: aiResult ? "ai_enriched" : "deterministic",
    aiDecision: {
      eligible: aiEligibility.eligible,
      executed: aiResult !== null,
      mode: contract.aiDecision.mode,
      reason: contract.aiDecision.reason,
      blockingFields:
        contract.blockingFields.length > 0
          ? contract.blockingFields
          : aiEligibility.blockingFields,
      coverageTier: contract.coverageTier,
    },
    summary: analysis.summary,
    suggestions: analysis.suggestions,
    packet: analysis.decisionSupportPacket,
    extracted: analysis.extractedData,
    derivedMetrics: analysis.derivedMetrics,
    seoScore: analysis.seoScore,
    conversionScore: analysis.conversionScore,
    overallScore: analysis.overallScore,
    learningContext,
    missingDataReport,
  });
  analysis.debugTrace = emitDebugTrace(debugTrace, "SellBoostInternalTrace");

  return {
    aiResult,
    aiEligibility,
    contract,
    aiMs: aiResult?.__meta?.aiMs ?? 0,
  };
}

async function runAiEnrichment(params: {
  analysis: BuildAnalysisResult;
  consolidatedInput: ConsolidatedAnalysisInput;
  url: string;
  learningContext: LearningContext;
  missingDataReport: MissingDataReport;
  aiEligibility: AiEligibilityResult;
  contract: AnalysisContractResult;
  debugTrace: DebugTraceHandle;
  emitProgress: (update: ProgressUpdate) => void;
}) {
  const {
    analysis,
    consolidatedInput,
    url,
    learningContext,
    missingDataReport,
    aiEligibility,
    contract,
    debugTrace,
    emitProgress,
  } = params;

  if (!contract.aiDecision.executed) {
    return null;
  }

  emitProgress({
    stage: "ai",
    step: 5,
    totalSteps: 6,
    label: "AI yorumu uretiliyor",
    detail: "Deterministik bulgular aciklamaya ve aksiyon diline donusuyor.",
    preview: {
      mode: contract.aiDecision.mode,
      confidence: contract.confidence,
    },
  });

  const aiStartedAt = Date.now();
  const aiResult = await analyzeWithAi({
    consolidatedInput,
    packet: {
      ...analysis.decisionSupportPacket,
      coverage: {
        ...analysis.decisionSupportPacket.coverage,
        confidence: contract.confidence,
      },
    },
    extracted: analysis.extractedData,
    url,
    learningContext,
    missingDataReport,
    baseline: {
      summary: analysis.summary,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      suggestions: analysis.suggestions,
      seo_score: analysis.seoScore,
      conversion_score: analysis.conversionScore,
      overall_score: analysis.overallScore,
    },
    eligibility: aiEligibility,
  });
  const aiMs = Date.now() - aiStartedAt;

  if (!aiResult) {
    return null;
  }

  traceEvent(debugTrace, {
    stage: "analysis",
    code: "ai_analysis_completed",
    message: "AI enrichment calisti.",
    meta: {
      aiMs,
      eligible: aiEligibility.eligible,
      contractMode: contract.aiDecision.mode,
    },
  });

  if (aiEligibility.guidance.allowNarrativeExpansion && hasText(aiResult.summary)) {
    analysis.summary = aiResult.summary;
  }

  if (
    aiEligibility.guidance.allowStrengthWeaknessRewrite &&
    aiResult.strengths.length > 0
  ) {
    analysis.strengths = aiResult.strengths;
  }

  if (
    aiEligibility.guidance.allowStrengthWeaknessRewrite &&
    aiResult.weaknesses.length > 0
  ) {
    analysis.weaknesses = aiResult.weaknesses;
  }

  if (aiResult.suggestions.length > 0) {
    analysis.suggestions = aiResult.suggestions.slice(
      0,
      aiEligibility.guidance.maxSuggestions
    );
  }

  analysis.priorityActions = resolvePriorityActions({
    extractedData: analysis.extractedData,
    derivedMetrics: analysis.derivedMetrics,
    suggestions: analysis.suggestions,
    marketComparison: consolidatedInput.marketComparison,
  });

  if (
    aiEligibility.guidance.allowScoreOverrides &&
    shouldUseAiScore(aiResult.seo_score, analysis.seoScore)
  ) {
    analysis.seoScore = aiResult.seo_score;
  }

  if (
    aiEligibility.guidance.allowScoreOverrides &&
    shouldUseAiScore(aiResult.conversion_score, analysis.conversionScore)
  ) {
    analysis.conversionScore = aiResult.conversion_score;
  }

  if (
    aiEligibility.guidance.allowScoreOverrides &&
    shouldUseAiScore(aiResult.overall_score, analysis.overallScore)
  ) {
    analysis.overallScore = aiResult.overall_score;
  }

  analysis.aiCommentary = {
    mode: "ai_enriched",
    summary: analysis.summary,
  };

  return {
    ...aiResult,
    __meta: {
      aiMs,
    },
  };
}
