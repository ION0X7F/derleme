import { analyzeWithAi } from "@/lib/ai-analysis";
import { buildAnalysisTrace } from "@/lib/analysis-trace";
import { buildAnalysis, buildPriorityActions } from "@/lib/build-analysis";
import { detectCategory } from "@/lib/detect-category";
import {
  buildExtractorHealthReport,
  calculateHealthScore,
  getHealthStatusLabel,
} from "@/lib/extractors/health";
import { extractFieldsWithFallback } from "@/lib/extractors";
import { mergeExtractedFieldsWithMetadata } from "@/lib/extractors/merge-extracted-fields";
import { fetchPageHtml } from "@/lib/fetch-page-html";
import { fetchTrendyolApi } from "@/lib/fetch-trendyol-api";
import { isAiAnalysisEligible } from "@/lib/ai-eligibility";
import { getLearningContext } from "@/lib/learning-engine";
import {
  completeMissingFieldsWithMetadata,
  getLearningStatus,
} from "@/lib/missing-data";
import { prepareAnalysisInput } from "./prepare-analysis-input";
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

  const trendyolApiData = params.url
    .toLocaleLowerCase("tr-TR")
    .includes("trendyol.com")
    ? await fetchTrendyolApi(params.url)
    : null;

  // Adım 1: Veri Çıkarma, Birleştirme ve Zenginleştirme
  // Bu blok, HTML'den ve (varsa) API'den gelen verileri birleştirerek nihai "extracted" nesnesini oluşturur.
  // Öncelik sırası (API > Platform HTML > Genel HTML) bu adımların içindeki fonksiyonlarda yönetilir.
  const {
    extracted,
    fieldMetadata,
    report: missingDataReport,
  } = (() => {
    // Önce sadece HTML'den veri çıkarılır (platforma özel ve genel olarak).
    const htmlExtraction = extractFieldsWithFallback({
      url: params.url,
      html,
    });

    // Sonra, HTML'den çıkan ham veri birleştirilir.
    const {
      merged: mergedWithHtml,
      fieldMetadata: initialMetadata,
    } = mergeExtractedFieldsWithMetadata({
      genericFields: htmlExtraction.genericFields,
      platformFields: htmlExtraction.platformFields,
      platform: htmlExtraction.platform,
    });

    const finalExtractionResult = (() => {
      // API verisinden gelen güvenilir alanları, HTML'den gelenlerin üzerine yazarak önceliklendir.
      // Bu, `completeMissingFieldsWithMetadata` fonksiyonunun belirsiz davranışını azaltır.
      if (trendyolApiData) {
        const apiSeller = trendyolApiData.seller;
        if (apiSeller) {
          mergedWithHtml.seller_score =
            apiSeller.seller_score ?? mergedWithHtml.seller_score;
          mergedWithHtml.seller_name =
            apiSeller.seller_name ?? mergedWithHtml.seller_name;
          mergedWithHtml.official_seller =
            apiSeller.is_official ?? mergedWithHtml.official_seller;
          mergedWithHtml.has_free_shipping =
            apiSeller.has_free_shipping ?? mergedWithHtml.has_free_shipping;
          mergedWithHtml.listing_id =
            apiSeller.listing_id ?? mergedWithHtml.listing_id;
          mergedWithHtml.merchant_id =
            apiSeller.merchant_id ?? mergedWithHtml.merchant_id;
        }
      }

      // Son olarak, birleştirilmiş veri API'den gelen bilgilerle zenginleştirilir ve eksik alanlar tamamlanır.
      return completeMissingFieldsWithMetadata(
        {
          platform: htmlExtraction.platform,
          extracted: mergedWithHtml,
          genericFields: htmlExtraction.genericFields,
          platformFields: htmlExtraction.platformFields,
          trendyolApiData,
        },
        initialMetadata
      );
    })();

    return {
      extracted: finalExtractionResult.extracted,
      fieldMetadata: finalExtractionResult.fieldMetadata,
      report: finalExtractionResult.report,
    };
  })();

  // Adım 1.5: Veri Konsolidasyon Katmanı
  const consolidatedInput = prepareAnalysisInput(extracted, fieldMetadata);

  // Adım 2: Extractor Sağlık Raporu Oluşturma
  const extractorHealth = buildExtractorHealthReport({
    platformDetected: extracted.platform || "unknown",
    fieldMetadata,
    apiCallAttempted: trendyolApiData !== null,
    apiCallSucceeded:
      trendyolApiData !== null && Object.keys(trendyolApiData).length > 0,
    errors: missingDataReport.unresolvedReasons
      .filter((r) => r.priority === "critical")
      .map((r) => ({ field: r.field, error: r.reason })),
  });

  const learningStatus = getLearningStatus({
    extracted,
    report: missingDataReport,
    sourceType: params.learningSourceType ?? "real",
  });
  const platform = extracted.platform ?? null;
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
    consolidatedInput,
    extracted: {
      ...extracted,
      category: extracted.category || category,
    },
    planContext: params.planContext ?? "pro",
  });

  // Phase 1: Attach metadata to analysis result
  analysis._fieldMetadata = fieldMetadata;
  analysis.extractorHealth = extractorHealth;

  // Log health score (for debugging)
  if (process.env.NODE_ENV === "development") {
    const healthScore = calculateHealthScore(extractorHealth);
    const healthStatus = getHealthStatusLabel(healthScore);
    console.log(
      `[Extraction Health] Platform: ${extractorHealth.platformDetected}, Score: ${healthScore}/100 (${healthStatus}), Critical: ${extractorHealth.criticalFieldsFound}/${CRITICAL_FIELDS.length}`
    );
  }

  const learningContext = await getLearningContext({
    platform,
    category: extracted.category || category,
    brand: extracted.brand,
    extracted: analysis.extractedData,
    includeSynthetic: params.includeSyntheticLearning,
  });

  let aiResult = null;
  const aiEligibility = isAiAnalysisEligible(consolidatedInput);

  if (process.env.NODE_ENV === "development") {
    console.log(`[AI Eligibility] ${aiEligibility.reason}`);
  }

  // AI, veri kalitesine göre çalıştırılır.
  // Bu, AI'ın eksik veya zayıf veriyle hatalı yorumlar üretmesini engeller.
  if (aiEligibility.eligible) {
        aiResult = await analyzeWithAi({
      consolidatedInput,
      packet: {
        ...analysis.decisionSupportPacket,
        // Update packet's confidence to reflect the new, more accurate score
        coverage: {
          ...analysis.decisionSupportPacket.coverage,
          confidence: aiEligibility.level === 'high' ? 'high' : 'medium',
        }
      },
      extracted: analysis.extractedData,
      url: params.url,
      learningContext,
      missingDataReport: missingDataReport,
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
  }

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
    missingDataReport: missingDataReport,
  });

  return {
    platform,
    category,
    analysis,
    learningContext,
    learningStatus,
    missingDataReport: missingDataReport,
  };
}
