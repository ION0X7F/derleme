import { buildAnalysis } from "@/lib/build-analysis";
import { detectCategory } from "@/lib/detect-category";
import {
  buildExtractorHealthReport,
} from "@/lib/extractors/health";
import { fetchPageHtml } from "@/lib/fetch-page-html";
import { fetchTrendyolApi } from "@/lib/fetch-trendyol-api";
import { createDebugTrace, traceEvent } from "@/lib/debug-observability";
import { getLearningContext } from "@/lib/learning-engine";
import {
  enrichTrendyolReviewSignals,
  executeExtractionPhase,
} from "@/lib/run-analysis-extraction";
import {
  attachDeterministicMetadata,
  enrichAnalysisForDelivery,
  logExtractorHealth,
} from "@/lib/run-analysis-finalize";
import { getLearningStatus } from "@/lib/missing-data";
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
  onProgress?: (update: {
    stage:
      | "fetch"
      | "extract"
      | "reviews"
      | "deterministic"
      | "ai";
    step: number;
    totalSteps: number;
    label: string;
    detail?: string;
    preview?: Record<string, unknown> | null;
  }) => void;
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

export async function runAnalysisPipeline(
  params: RunAnalysisPipelineParams
): Promise<AnalysisPipelineResult> {
  const emitProgress = (update: NonNullable<RunAnalysisPipelineParams["onProgress"]> extends (arg: infer T) => void ? T : never) => {
    if (params.onProgress) {
      params.onProgress(update);
    }
  };
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

  emitProgress({
    stage: "fetch",
    step: 1,
    totalSteps: 6,
    label: "Sayfa verisi toplanıyor",
    detail: "HTML ve Trendyol kaynaklari ayni anda okunuyor.",
    preview: null,
  });

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
  } = await executeExtractionPhase({
    url: params.url,
    html,
    isTrendyol,
    trendyolApiData,
    debugTrace,
  });
  extractionMs = Date.now() - extractionStartedAt;
  emitProgress({
    stage: "extract",
    step: 2,
    totalSteps: 6,
    label: "Temel sinyaller ayiklandi",
    detail: "Baslik, fiyat, seller ve listing verisi normalize edildi.",
    preview: {
      platform: extracted.platform ?? null,
      category: extracted.category ?? null,
      price: extracted.normalized_price ?? null,
      imageCount: extracted.image_count ?? null,
      dataSource: extracted.extractor_status ?? null,
    },
  });

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
    emitProgress({
      stage: "reviews",
      step: 3,
      totalSteps: 6,
      label: "Yorum ve satici katmani taraniyor",
      detail: "Review analizi ve satici takip verileri toparlaniyor.",
      preview: {
        sellerName: extracted.seller_name ?? null,
        merchantId: extracted.merchant_id ?? null,
      },
    });
    const reviewStartedAt = Date.now();
    try {
      await enrichTrendyolReviewSignals({
        url: params.url,
        extracted,
        fieldMetadata,
        debugTrace,
      });
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
  emitProgress({
    stage: "deterministic",
    step: 4,
    totalSteps: 6,
    label: "Deterministik skorlar hesaplandi",
    detail: "SEO, donusum ve genel skor ilk kez olustu.",
    preview: {
      overallScore: analysis.overallScore,
      seoScore: analysis.seoScore,
      conversionScore: analysis.conversionScore,
    },
  });
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

  attachDeterministicMetadata({
    analysis,
    fieldMetadata,
    normalizedFieldMetadata: consolidatedInput._fieldMetadata,
    extractorHealth,
  });
  logExtractorHealth({
    extractorHealth,
  });

  const learningContext = await getLearningContext({
    platform,
    category: extracted.category || category,
    brand: extracted.brand,
    extracted: analysis.extractedData,
    includeSynthetic: params.includeSyntheticLearning,
  });

  const finalizeResult = await enrichAnalysisForDelivery({
    analysis,
    consolidatedInput,
    url: params.url,
    learningContext,
    missingDataReport,
    debugTrace,
    emitProgress,
  });
  aiMs = finalizeResult.aiMs;

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
