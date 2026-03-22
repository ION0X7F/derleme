import { analyzeWithAi } from "@/lib/ai-analysis";
import { buildAnalysisTrace } from "@/lib/analysis-trace";
import { buildAnalysis, buildPriorityActions } from "@/lib/build-analysis";
import { detectCategory } from "@/lib/detect-category";
import { extractFieldsWithFallback } from "@/lib/extractors";
import { fetchPageHtml } from "@/lib/fetch-page-html";
import { fetchTrendyolApi } from "@/lib/fetch-trendyol-api";
import { getLearningContext } from "@/lib/learning-engine";
import { completeMissingFields, getLearningStatus } from "@/lib/missing-data";
import type {
  AccessPlan,
  BuildAnalysisResult,
  LearningContext,
  LearningStatus,
  MissingDataReport,
} from "@/types/analysis";

export class AnalysisPipelineError extends Error {
  code: "FETCH_FAILED" | "EMPTY_HTML";
  detail?: string;

  constructor(
    code: "FETCH_FAILED" | "EMPTY_HTML",
    message: string,
    detail?: string
  ) {
    super(message);
    this.name = "AnalysisPipelineError";
    this.code = code;
    this.detail = detail;
  }
}

type RunAnalysisPipelineParams = {
  url: string;
  planContext?: AccessPlan;
  learningSourceType?: "real" | "synthetic";
  includeSyntheticLearning?: boolean;
};

export type AnalysisPipelineResult = {
  platform: string | null;
  category: string;
  analysis: BuildAnalysisResult;
  learningContext: LearningContext;
  learningStatus: LearningStatus;
  missingDataReport: MissingDataReport;
};

function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
}

function shouldUseAiScore(aiScore: number, fallbackScore: number) {
  if (!Number.isFinite(aiScore)) return false;
  if (aiScore <= 0 && fallbackScore > 0) return false;
  return true;
}

export async function runAnalysisPipeline(
  params: RunAnalysisPipelineParams
): Promise<AnalysisPipelineResult> {
  let html = "";

  try {
    html = await fetchPageHtml(params.url);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new AnalysisPipelineError(
      "FETCH_FAILED",
      "Sayfa icerigi alinamadi. URL'yi kontrol edin.",
      detail
    );
  }

  if (!html || html.trim().length === 0) {
    throw new AnalysisPipelineError(
      "EMPTY_HTML",
      "Sayfa icerigi alinamadi."
    );
  }

  const trendyolApiData = params.url.toLocaleLowerCase("tr-TR").includes("trendyol.com")
    ? await fetchTrendyolApi(params.url)
    : null;

  const extraction = extractFieldsWithFallback({
    url: params.url,
    html,
  });

  const completion = completeMissingFields({
    platform: extraction.platform,
    extracted: extraction.mergedFields,
    genericFields: extraction.genericFields,
    platformFields: extraction.platformFields,
    trendyolApiData,
  });

  const extracted = completion.extracted;
  const learningStatus = getLearningStatus({
    extracted,
    report: completion.report,
    sourceType: params.learningSourceType ?? "real",
  });
  const platform = extraction.platform;
  const category =
    extracted.category ||
    detectCategory({
      url: params.url,
      title: extracted.title,
      h1: extracted.h1,
      brand: extracted.brand,
      product_name: extracted.product_name,
    }) ||
    "General";

  const analysis = buildAnalysis({
    platform,
    url: params.url,
    extracted: {
      ...extracted,
      category: extracted.category || category,
    },
    planContext: params.planContext ?? "pro",
  });

  const learningContext = await getLearningContext({
    platform,
    category: extracted.category || category,
    brand: extracted.brand,
    extracted: analysis.extractedData,
    includeSynthetic: params.includeSyntheticLearning,
  });

  analysis.analysisTrace = buildAnalysisTrace({
    mode: "deterministic",
    summary: analysis.summary,
    suggestions: analysis.suggestions,
    packet: analysis.decisionSupportPacket,
    extracted: analysis.extractedData,
    derivedMetrics: analysis.derivedMetrics,
    seoScore: analysis.seoScore,
    conversionScore: analysis.conversionScore,
    overallScore: analysis.overallScore,
    learningContext,
    missingDataReport: completion.report,
  });

  const aiResult = await analyzeWithAi({
    packet: analysis.decisionSupportPacket,
    extracted: analysis.extractedData,
    url: params.url,
    learningContext,
    missingDataReport: completion.report,
    baseline: {
      summary: analysis.summary,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      suggestions: analysis.suggestions,
      seo_score: analysis.seoScore,
      conversion_score: analysis.conversionScore,
      overall_score: analysis.overallScore,
    },
  });

  if (aiResult) {
    if (hasText(aiResult.summary)) {
      analysis.summary = aiResult.summary;
    }

    if (aiResult.strengths.length > 0) {
      analysis.strengths = aiResult.strengths;
    }

    if (aiResult.weaknesses.length > 0) {
      analysis.weaknesses = aiResult.weaknesses;
    }

    if (aiResult.suggestions.length > 0) {
      analysis.suggestions = aiResult.suggestions;
    }

    analysis.priorityActions = buildPriorityActions(
      analysis.extractedData,
      analysis.derivedMetrics,
      analysis.suggestions
    );

    if (shouldUseAiScore(aiResult.seo_score, analysis.seoScore)) {
      analysis.seoScore = aiResult.seo_score;
    }

    if (shouldUseAiScore(aiResult.conversion_score, analysis.conversionScore)) {
      analysis.conversionScore = aiResult.conversion_score;
    }

    if (shouldUseAiScore(aiResult.overall_score, analysis.overallScore)) {
      analysis.overallScore = aiResult.overall_score;
    }
  }

  analysis.analysisTrace = buildAnalysisTrace({
    mode: aiResult ? "ai_enriched" : "deterministic",
    summary: analysis.summary,
    suggestions: analysis.suggestions,
    packet: analysis.decisionSupportPacket,
    extracted: analysis.extractedData,
    derivedMetrics: analysis.derivedMetrics,
    seoScore: analysis.seoScore,
    conversionScore: analysis.conversionScore,
    overallScore: analysis.overallScore,
    learningContext,
    missingDataReport: completion.report,
  });

  return {
    platform,
    category,
    analysis,
    learningContext,
    learningStatus,
    missingDataReport: completion.report,
  };
}
