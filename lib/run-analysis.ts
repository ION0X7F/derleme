import { analyzeWithAi } from "@/lib/ai-analysis";
import { evaluateAnalysisContract } from "@/lib/analysis-contract";
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
import { createDebugTrace, emitDebugTrace, traceEvent } from "@/lib/debug-observability";
import { getLearningContext } from "@/lib/learning-engine";
import { fetchTrendyolReviewAnalysis } from "@/lib/trendyol-review-analysis";
import { enrichTrendyolScorecardWithAi } from "@/lib/trendyol-scorecard";
import {
  completeMissingFieldsWithMetadata,
  getLearningStatus,
} from "@/lib/missing-data";
import { prepareAnalysisInput } from "./prepare-analysis-input";
import type {
  AccessPlan,
  BuildAnalysisResult,
  CategoryAverages,
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
  diagnostics: {
    totalMs: number;
    fetchHtmlMs: number;
    fetchApiMs: number;
    extractionMs: number;
    reviewAnalysisMs: number;
    deterministicMs: number;
    aiMs: number;
  };
};

function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
}

function shouldUseAiScore(aiScore: number, fallbackScore: number) {
  if (!Number.isFinite(aiScore)) return false;
  if (aiScore <= 0 && fallbackScore > 0) return false;
  return true;
}

function buildAiPriorityActionsFromSuggestions(
  suggestions: Array<{ title: string; detail: string }> | null | undefined
) {
  if (!Array.isArray(suggestions)) return [];

  return suggestions
    .filter(
      (item): item is { title: string; detail: string } =>
        !!item &&
        typeof item.title === "string" &&
        item.title.trim().length > 0 &&
        typeof item.detail === "string" &&
        item.detail.trim().length > 0
    )
    .slice(0, 10)
    .map((item, index) => ({
      priority: index + 1,
      title: item.title.trim(),
      detail: item.detail.trim(),
    }));
}

function buildCategoryAverages(
  learningContext: LearningContext | null | undefined
): CategoryAverages | null {
  const benchmark = learningContext?.benchmark;
  if (!benchmark || benchmark.sampleSize <= 0) return null;

  return {
    source: "learning_benchmark",
    sampleSize: benchmark.sampleSize,
    imageCount: benchmark.avgImageCount,
    descriptionLength: benchmark.avgDescriptionLength,
    ratingValue: benchmark.avgRatingValue,
    sellerScore: benchmark.avgSellerScore,
    price: benchmark.avgPrice,
    reviewCount: benchmark.avgReviewCount,
    favoriteCount: benchmark.avgFavoriteCount,
    shippingDays: benchmark.avgShippingDays,
    otherSellersCount: benchmark.avgOtherSellersCount,
    freeShippingRate: benchmark.freeShippingRate,
    fastDeliveryRate: benchmark.fastDeliveryRate,
    hasVideoRate: benchmark.hasVideoRate,
    officialSellerRate: benchmark.officialSellerRate,
  };
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
  const pipelineStartedAt = Date.now();
  const isTrendyol = params.url.toLocaleLowerCase("tr-TR").includes("trendyol.com");
  const debugTrace = createDebugTrace({
    pipeline: "run-analysis",
    url: params.url,
    platform: isTrendyol ? "trendyol" : null,
  });
  let html = "";
  let fetchHtmlMs = 0;
  let fetchApiMs = 0;
  let extractionMs = 0;
  let reviewAnalysisMs = 0;
  let deterministicMs = 0;
  let aiMs = 0;

  const htmlFetchStartedAt = Date.now();
  const htmlPromise = fetchPageHtml(params.url);
  const apiFetchStartedAt = Date.now();
  const trendyolApiPromise = isTrendyol
    ? fetchTrendyolApi(params.url).finally(() => {
        fetchApiMs = Date.now() - apiFetchStartedAt;
      })
    : Promise.resolve(null);

  let trendyolApiData: Awaited<ReturnType<typeof fetchTrendyolApi>> = null;

  try {
    [html, trendyolApiData] = await Promise.all([htmlPromise, trendyolApiPromise]);
    fetchHtmlMs = Date.now() - htmlFetchStartedAt;
    traceEvent(debugTrace, {
      stage: "fetch",
      code: "fetch_html_success",
      message: "HTML fetch tamamlandi.",
      meta: {
        fetchHtmlMs,
        htmlLength: html.length,
      },
    });
    traceEvent(debugTrace, {
      stage: "fetch",
      code: "fetch_api_summary",
      message: isTrendyol
        ? "Trendyol API denemesi tamamlandi."
        : "Platform API adimi atlandi.",
      meta: {
        isTrendyol,
        fetchApiMs,
        apiSellerFound: Boolean(trendyolApiData?.seller),
        otherSellerCount: trendyolApiData?.other_sellers?.length ?? 0,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fetchHtmlMs = Date.now() - htmlFetchStartedAt;
    traceEvent(debugTrace, {
      stage: "fetch",
      level: "warn",
      code: "fetch_failed",
      message: "Fetch asamasi basarisiz oldu.",
      meta: {
        fetchHtmlMs,
        detail,
      },
    });
    throw new AnalysisPipelineError(
      "FETCH_FAILED",
      "Sayfa icerigi alinamadi. URL'yi kontrol edin.",
      detail
    );
  }

  if (!html || html.trim().length === 0) {
    traceEvent(debugTrace, {
      stage: "fetch",
      level: "warn",
      code: "empty_html",
      message: "HTML bos geldi.",
    });
    throw new AnalysisPipelineError(
      "EMPTY_HTML",
      "Sayfa icerigi alinamadi."
    );
  }

  if (!isTrendyol) {
    fetchApiMs = 0;
  }

  // Adım 1: Veri Çıkarma, Birleştirme ve Zenginleştirme
  // Bu blok, HTML'den ve (varsa) API'den gelen verileri birleştirerek nihai "extracted" nesnesini oluşturur.
  // Öncelik sırası (API > Platform HTML > Genel HTML) bu adımların içindeki fonksiyonlarda yönetilir.
  const extractionStartedAt = Date.now();
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
      trace: debugTrace,
    });

    const finalExtractionResult = (() => {
      // API verisinden gelen güvenilir alanları, HTML'den gelenlerin üzerine yazarak önceliklendir.
      // Bu, `completeMissingFieldsWithMetadata` fonksiyonunun belirsiz davranışını azaltır.
      if (trendyolApiData) {
        const apiSeller = trendyolApiData.seller;
        if (apiSeller) {
          const applyApiField = <K extends keyof typeof mergedWithHtml>(
            key: K,
            apiValue: (typeof mergedWithHtml)[K]
          ) => {
            if (apiValue == null) return;
            mergedWithHtml[key] = apiValue;
            initialMetadata[String(key)] = {
              source: "api",
              confidence: "high",
              timestamp: Date.now(),
              reason: "trendyol api seller payload",
            };
          };

          applyApiField("seller_score", apiSeller.seller_score);
          applyApiField("seller_name", apiSeller.seller_name);
          applyApiField("official_seller", apiSeller.is_official);
          applyApiField("has_free_shipping", apiSeller.has_free_shipping);
          applyApiField("listing_id", apiSeller.listing_id);
          applyApiField("merchant_id", apiSeller.merchant_id);
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
        initialMetadata,
        debugTrace
      );
    })();

    return {
      extracted: finalExtractionResult.extracted,
      fieldMetadata: finalExtractionResult.fieldMetadata,
      report: finalExtractionResult.report,
    };
  })();
  extractionMs = Date.now() - extractionStartedAt;

  // Adım 1.5: Veri Konsolidasyon Katmanı
  traceEvent(debugTrace, {
    stage: "parse",
    code: "extraction_summary",
    message: "Extraction ve eksik alan tamamlama asamalari tamamlandi.",
    meta: {
      extractionMs,
      reviewAnalysisMs,
      extractorStatus: extracted.extractor_status,
      filledFields: missingDataReport.filledFields.length,
      strengthenedFields: missingDataReport.strengthenedFields.length,
      unresolvedCriticalFields: missingDataReport.unresolvedCriticalFields,
    },
  });
  const consolidatedInput = prepareAnalysisInput(extracted, fieldMetadata, debugTrace);

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

  if (isTrendyol) {
    const reviewStartedAt = Date.now();
    try {
      const reviewAnalysis = await fetchTrendyolReviewAnalysis({
        url: params.url,
        merchantId: extracted.merchant_id ?? null,
        sellerName: extracted.seller_name ?? null,
        otherSellersCount: extracted.other_sellers_count ?? null,
      });

      if (reviewAnalysis) {
        extracted.review_analysis = reviewAnalysis;
        extracted.review_records = reviewAnalysis.general?.recent_reviews ?? null;
        extracted.rating_value =
          extracted.rating_value ?? reviewAnalysis.general?.average_rating ?? null;
        extracted.review_count =
          extracted.review_count ?? reviewAnalysis.general?.total_comment_count ?? null;
        extracted.rating_breakdown =
          extracted.rating_breakdown ?? reviewAnalysis.general?.rating_breakdown ?? null;
        extracted.review_summary =
          extracted.review_summary ?? reviewAnalysis.general?.review_summary ?? null;
        extracted.review_themes =
          extracted.review_themes ?? reviewAnalysis.general?.review_themes ?? null;
        extracted.top_positive_review_hits =
          extracted.top_positive_review_hits ??
          reviewAnalysis.general?.top_positive_review_hits ??
          null;
        extracted.top_negative_review_hits =
          extracted.top_negative_review_hits ??
          reviewAnalysis.general?.top_negative_review_hits ??
          null;
        if (!extracted.review_snippets && reviewAnalysis.general?.recent_reviews?.length) {
          extracted.review_snippets = reviewAnalysis.general.recent_reviews
            .slice(0, 8)
            .map((review) => ({
              rating: review.rating,
              text: review.text,
            }));
        }
      }
    } catch (error) {
      traceEvent(debugTrace, {
        stage: "parse",
        level: "warn",
        code: "review_analysis_failed",
        message: "Trendyol review analysis ek adimi basarisiz oldu.",
        meta: {
          detail: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      reviewAnalysisMs = Date.now() - reviewStartedAt;
    }
  }

  const deterministicStartedAt = Date.now();
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
  deterministicMs = Date.now() - deterministicStartedAt;
  traceEvent(debugTrace, {
    stage: "analysis",
    code: "build_analysis_completed",
    message: "Deterministic analysis tamamlandi.",
    meta: {
      deterministicMs,
      overallScore: analysis.overallScore,
      seoScore: analysis.seoScore,
      conversionScore: analysis.conversionScore,
      comparisonMode: consolidatedInput.marketComparison?.comparisonMode ?? null,
    },
  });

  // Phase 1: Attach metadata to analysis result
  analysis._fieldMetadata = fieldMetadata;
  analysis._normalizedFieldMetadata = consolidatedInput._fieldMetadata;
  analysis.extractorHealth = extractorHealth;
  analysis.debugTrace = null;

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
            analysis.conversionScore * 0.15
        )
      )
    );
  }

  let aiResult: Awaited<ReturnType<typeof analyzeWithAi>> = null;
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

  // AI, veri kalitesine göre çalıştırılır.
  // Bu, AI'ın eksik veya zayıf veriyle hatalı yorumlar üretmesini engeller.
  const shouldRunAi = contract.aiDecision.executed;

  if (shouldRunAi) {
    const aiStartedAt = Date.now();
    aiResult = await analyzeWithAi({
      consolidatedInput,
      packet: {
        ...analysis.decisionSupportPacket,
        coverage: {
          ...analysis.decisionSupportPacket.coverage,
          confidence: contract.confidence,
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
    aiMs = Date.now() - aiStartedAt;
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
  }

  if (aiResult) {
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

    const aiPriorityActions = buildAiPriorityActionsFromSuggestions(
      analysis.suggestions
    );

    analysis.priorityActions =
      aiPriorityActions.length > 0
        ? aiPriorityActions
        : buildPriorityActions(
            analysis.extractedData,
            analysis.derivedMetrics,
            analysis.suggestions,
            consolidatedInput.marketComparison
          );

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
  }

  if (analysis.trendyolScorecard) {
    analysis.seoScore = analysis.trendyolScorecard.searchVisibility.score;
    analysis.conversionScore = analysis.trendyolScorecard.conversionPotential.score;
    analysis.overallScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          analysis.trendyolScorecard.overall.score * 0.65 +
            analysis.dataCompletenessScore * 0.2 +
            analysis.conversionScore * 0.15
        )
      )
    );
  }

  analysis.analysisTrace = buildAnalysisTrace({
    mode: aiResult ? "ai_enriched" : "deterministic",
    aiDecision: {
      eligible: aiEligibility.eligible,
      executed: shouldRunAi,
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
    missingDataReport: missingDataReport,
  });
  analysis.debugTrace = emitDebugTrace(debugTrace, "SellBoostInternalTrace");

  return {
    platform,
    category,
    analysis,
    learningContext,
    learningStatus,
    missingDataReport: missingDataReport,
    diagnostics: {
      totalMs: Date.now() - pipelineStartedAt,
      fetchHtmlMs,
      fetchApiMs,
      extractionMs,
      reviewAnalysisMs,
      deterministicMs,
      aiMs,
    },
  };
}
