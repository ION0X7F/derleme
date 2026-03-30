import { buildAnalysisAccessState } from "@/lib/analysis-access";
import { sanitizeAnalysisTraceForAccess } from "@/lib/analysis-trace";
import { beginAnalyzeRequestGuard } from "@/lib/analyze-request-guard";
import {
  logAnalyzeEvent,
  logAnalyzeLimitReached,
  logAnalyzeThrottled,
} from "@/lib/analysis-observability";
import { attachReportVersionMeta } from "@/lib/report-versioning";
import {
  resolveGuestAnalyzeUsageContext,
  resolveUserAnalyzeUsageContext,
} from "@/lib/analyze-usage-context";
import type { AnalyzeLimitResult } from "@/lib/check-analyze-limit";
import { consumeAnalyzeUsageIfAllowed } from "@/lib/increment-analyze-usage";
import { projectUsageAfterIncrement } from "@/lib/analyze-usage-snapshot";
import { buildAnalysisDecisionSummary } from "@/lib/analysis-decision-summary";
import { recordLearningArtifacts } from "@/lib/learning-engine";
import { buildStoredAnalysisPayload } from "@/lib/report-storage";
import {
  AnalysisPipelineError,
  runAnalysisPipeline,
} from "@/lib/run-analysis";
import {
  createAnalyzeReport,
  createAnalyzeReportWithUsageTransaction,
} from "@/lib/report-detail-query";
import { resolveUserAnalysisContext } from "@/lib/analysis-user-context";
import type {
  AnalysisAccessState,
  AnalysisSectionLock,
  BuildAnalysisResult,
  ExtractedProductFields,
} from "@/types/analysis";

function trimArray<T>(items: T[], limit: number) {
  return items.slice(0, limit);
}

function toDbJson<T>(value: T) {
  return value as T & object;
}

function buildTeasers(
  lockedSections: AnalysisSectionLock[],
  analysis: BuildAnalysisResult
) {
  const extracted = analysis.extractedData;

  const map: Partial<Record<AnalysisSectionLock, string>> = {
    advancedOfferAnalysis:
      typeof extracted.other_sellers_count === "number" &&
      extracted.other_sellers_count >= 4 &&
      extracted.has_free_shipping !== true &&
      typeof extracted.discount_rate !== "number"
        ? "Yuksek rekabet gorunurken belirgin teklif avantaji zayif; premium raporda fiyat, kargo ve kampanya baskisi daha derin okunur."
        : typeof extracted.discount_rate === "number" ||
            extracted.has_free_shipping ||
            typeof extracted.shipping_days === "number"
          ? "Mevcut teklif sinyalleri premium raporda fiyat, indirim ve teslimat etkisiyle birlikte daha derin yorumlanir."
          : "Fiyat, indirim ve teslimat avantajlari premium raporda daha derin yorumlanir.",
    competitorAnalysis:
      typeof extracted.other_sellers_count === "number" && extracted.other_sellers_count > 0
        ? extracted.other_sellers_count >= 4
          ? `Bu urunde gorunen ${extracted.other_sellers_count} diger satici rekabet baskisini artiriyor; premium raporda ayrisma ve teklif gucu daha derin okunur.`
          : `Bu urunde gorunen ${extracted.other_sellers_count} diger satici icin rekabet ve ayrisma analizi ust paketlerde acilir.`
        : "Rakip ve other sellers analizi daha ust paketlerde acilabilir.",
    premiumActionPlan:
      analysis.suggestions.length > 0
        ? `Bu urun icin tespit edilen ${analysis.suggestions.length} aksiyon sinyali premium raporda oncelik sirasina gore acilir.`
        : "Onceliklendirilmis premium aksiyon plani ust paketlerde tam gorunur.",
    export: "Rapor disa aktarma ozelligi ust paketlerde acilir.",
    history: "Daha genis rapor gecmisi ust paketlerde acilir.",
    reanalysis: "Yeniden analiz ve tekrar calistirma ust paketlerde acilir.",
  };

  return lockedSections.map((key) => ({
    key,
    teaser: map[key] || "Bu bolum ust paketlerde acilir.",
  }));
}

function shapeExtractedDataForAccess(
  extracted: ExtractedProductFields,
  access: AnalysisAccessState,
  category: string
) {
  const base = {
    ...extracted,
    category,
  };

  if (access.plan === "guest") {
    return {
      ...base,
      original_price: null,
      discount_rate: null,
      question_count: null,
      shipping_days: null,
      delivery_type: null,
      official_seller: undefined,
      has_campaign: undefined,
      campaign_label: null,
      seller_badges: null,
      seller_score: null,
      follower_count: null,
      other_sellers_count: null,
      other_seller_offers: null,
      other_sellers_summary: null,
    };
  }

  if (access.plan === "free") {
    return {
      ...base,
      delivery_type: null,
      official_seller: undefined,
      has_campaign: undefined,
      campaign_label: null,
      seller_badges: null,
      seller_score: null,
      follower_count: null,
      other_sellers_count: null,
      other_seller_offers: null,
      other_sellers_summary: null,
    };
  }

  return base;
}

function shapeAnalysisForAccess(
  analysis: BuildAnalysisResult,
  access: AnalysisAccessState,
  category: string
) {
  const strengths = trimArray(analysis.strengths, access.maxFindings);
  const weaknesses = trimArray(analysis.weaknesses, access.maxFindings);
  const suggestions = trimArray(analysis.suggestions, access.maxSuggestions);
  const priorityActions = trimArray(
    analysis.priorityActions,
    access.maxPriorityActions
  );

  return {
    url: undefined,
    platform: analysis.extractedData.platform || "trendyol",
    category,
    seoScore: analysis.seoScore,
    dataCompletenessScore: analysis.dataCompletenessScore,
    conversionScore: analysis.conversionScore,
    overallScore: analysis.overallScore,
    priceCompetitiveness:
      access.plan === "guest" ? null : analysis.priceCompetitiveness,
    summary: analysis.summary,
    dataSource: analysis.dataSource,
    derivedMetrics:
      access.plan === "guest"
        ? null
        : access.plan === "free"
          ? {
              productQuality: analysis.derivedMetrics.productQuality,
              sellerTrust: analysis.derivedMetrics.sellerTrust,
              marketPosition: analysis.derivedMetrics.marketPosition,
            }
          : analysis.derivedMetrics,
    trendyolScorecard:
      access.plan === "guest" ? null : analysis.trendyolScorecard ?? null,
    categoryAverages:
      access.plan === "guest" ? null : analysis.categoryAverages ?? null,
    reviewAnalysis:
      access.plan === "guest" ? null : analysis.extractedData.review_analysis ?? null,
    coverage:
      access.plan === "guest"
        ? {
            availableFields: [],
            missingFields: [],
            confidence: analysis.decisionSupportPacket.coverage.confidence,
          }
        : access.plan === "free"
          ? {
              availableFields:
                analysis.decisionSupportPacket.coverage.availableFields.slice(0, 8),
              missingFields:
                analysis.decisionSupportPacket.coverage.missingFields.slice(0, 6),
              confidence: analysis.decisionSupportPacket.coverage.confidence,
            }
          : analysis.decisionSupportPacket.coverage,
    extractedData: shapeExtractedDataForAccess(
      analysis.extractedData,
      access,
      category
    ),
    analysisTrace: sanitizeAnalysisTraceForAccess(analysis.analysisTrace, access.plan),
    analysisVisuals: analysis.analysisVisuals ?? null,
    marketOverview:
      access.plan === "guest" ? null : analysis.marketOverview ?? null,
    marketComparison:
      access.plan === "guest" ? null : analysis.marketComparison ?? null,
    aiCommentary:
      access.plan === "guest"
        ? null
        : analysis.aiCommentary ?? {
            mode: "deterministic",
            summary: analysis.summary,
          },
    strengths,
    weaknesses,
    suggestions,
    priorityActions,
    access,
    teaserSections: buildTeasers(access.teaserSections, analysis),
  };
}

export type AnalyzeExecutionProgress = {
  stage:
    | "queued"
    | "fetch"
    | "extract"
    | "reviews"
    | "deterministic"
    | "ai"
    | "finalize"
    | "completed";
  step: number;
  totalSteps: number;
  label: string;
  detail?: string;
  preview?: Record<string, unknown> | null;
};

export type AnalyzeExecutionParams = {
  requestId: string;
  url: string;
  sessionUserId?: string | null;
  sessionUserEmail?: string | null;
  guestId?: string | null;
  onProgress?: (update: AnalyzeExecutionProgress) => void;
};

export type AnalyzeExecutionSuccess = {
  success: true;
  requestId: string;
  result: Record<string, unknown>;
  report: {
    id: string;
    url: string;
    overallScore: number | null;
    createdAt: Date;
  } | null;
  reportId: string | null;
  usage: {
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
    periodKey: string;
    periodType: string;
  };
  autoSaved: boolean;
};

function emitProgress(
  onProgress: AnalyzeExecutionParams["onProgress"],
  update: AnalyzeExecutionProgress
) {
  if (!onProgress) return;
  onProgress(update);
}

export async function executeAnalyzeUrl(
  params: AnalyzeExecutionParams
): Promise<AnalyzeExecutionSuccess> {
  const {
    requestId,
    url,
    sessionUserId = null,
    sessionUserEmail = null,
    guestId = null,
    onProgress,
  } = params;

  const userAnalysisContext = sessionUserId
    ? await resolveUserAnalysisContext({
        userId: sessionUserId,
        email: sessionUserEmail,
      })
    : null;
  const unlimited = userAnalysisContext?.unlimited ?? false;
  const userMonthlyLimit = userAnalysisContext?.monthlyLimit ?? 10;
  const accessPlan = userAnalysisContext?.accessPlan ?? "guest";
  const access = userAnalysisContext?.access ?? buildAnalysisAccessState("guest");

  const usageContext = sessionUserId
    ? await resolveUserAnalyzeUsageContext({
        userId: sessionUserId,
        monthlyLimit: userMonthlyLimit,
        unlimited,
      })
    : await resolveGuestAnalyzeUsageContext(guestId ?? undefined);
  const usageTarget = usageContext.usageTarget;
  const limitInfo = usageContext.usageWindow;
  const actor = usageContext.actor;

  if (!limitInfo.allowed) {
    logAnalyzeLimitReached({
      requestId,
      actor,
      url,
      stage: "limit_check",
      usage: limitInfo,
    });
    const limitError = new Error("ANALYZE_LIMIT_REACHED");
    limitError.name = "AnalyzeLimitReachedError";
    (limitError as Error & { payload?: AnalyzeLimitResult }).payload = limitInfo;
    throw limitError;
  }

  const guard = beginAnalyzeRequestGuard({ actor, url });
  if (!guard.allowed) {
    logAnalyzeThrottled({
      requestId,
      actor,
      url,
      stage: "abuse_guard",
      reason: guard.reason,
      retryAfterSeconds: guard.retryAfterSeconds,
    });
    const throttledError = new Error("ANALYZE_THROTTLED");
    throttledError.name = "AnalyzeThrottledError";
    (
      throttledError as Error & {
        retryAfterSeconds?: number;
        reason?: string;
      }
    ).retryAfterSeconds = guard.retryAfterSeconds;
    (throttledError as Error & { reason?: string }).reason = guard.reason;
    throw throttledError;
  }

  emitProgress(onProgress, {
    stage: "queued",
    step: 1,
    totalSteps: 6,
    label: "Analiz kuyruga alindi",
    detail: "URL dogrulandi, veri toplama basliyor.",
  });

  logAnalyzeEvent({
    stage: "pipeline_start",
    requestId,
    actor,
    url,
    message: "Analyze pipeline basladi",
    extra: { accessPlan, unlimited },
  });

  try {
    const pipeline = await runAnalysisPipeline({
      url,
      planContext: accessPlan,
      learningSourceType: "real",
      onProgress: (update) => {
        emitProgress(onProgress, update);
      },
    });

    emitProgress(onProgress, {
      stage: "finalize",
      step: 5,
      totalSteps: 6,
      label: "Rapor sonuclari hazirlaniyor",
      detail: "Skorlar, ozet ve aksiyon listesi son kez toparlaniyor.",
      preview: {
        category: pipeline.category,
        overallScore: pipeline.analysis.overallScore,
        seoScore: pipeline.analysis.seoScore,
      },
    });

    const {
      analysis,
      category,
      platform,
      learningStatus,
      missingDataReport,
      diagnostics,
    } = pipeline;
    const shapedResult = shapeAnalysisForAccess(analysis, access, category);
    const decisionSummary = buildAnalysisDecisionSummary({
      analysisTrace: shapedResult.analysisTrace,
      dataSource: shapedResult.dataSource,
    });

    const buildLimitReachedError = (payload: AnalyzeLimitResult) => {
      const limitError = new Error("ANALYZE_LIMIT_REACHED");
      limitError.name = "AnalyzeLimitReachedError";
      (limitError as Error & { payload?: AnalyzeLimitResult }).payload = payload;
      return limitError;
    };

    let savedReport: Awaited<ReturnType<typeof createAnalyzeReport>> | null = null;
    const storedPayload = buildStoredAnalysisPayload(analysis);
    const reportCreateData =
      usageTarget.type === "user"
        ? ({
            guestId: null,
            userId: usageTarget.userId,
            url,
            platform,
            category,
            seoScore: shapedResult.seoScore,
            dataCompletenessScore: shapedResult.dataCompletenessScore,
            conversionScore: shapedResult.conversionScore,
            overallScore: shapedResult.overallScore,
            priceCompetitiveness: shapedResult.priceCompetitiveness,
            summary: shapedResult.summary,
            dataSource: shapedResult.dataSource,
            extractedData: toDbJson(storedPayload.extractedData),
            derivedMetrics:
              storedPayload.derivedMetrics === null
                ? null
                : toDbJson(storedPayload.derivedMetrics),
            coverage:
              shapedResult.coverage === null
                ? null
                : toDbJson(shapedResult.coverage),
            accessState: toDbJson(
              attachReportVersionMeta({
                accessState: access as unknown as Record<string, unknown>,
                previousReportId: null,
                rootReportId: null,
                generation: 0,
                trigger: "analyze",
              })
            ),
            suggestions: toDbJson(shapedResult.suggestions),
            priorityActions: toDbJson(shapedResult.priorityActions),
            analysisTrace:
              shapedResult.analysisTrace === null
                ? null
                : toDbJson(shapedResult.analysisTrace),
          } as const)
        : null;

    let updatedUsage = limitInfo;
    if (!unlimited && usageTarget.type === "user" && reportCreateData) {
      const persisted = await createAnalyzeReportWithUsageTransaction({
        data: reportCreateData as never,
        consume: async (tx) => {
        const usage = await consumeAnalyzeUsageIfAllowed({
          type: "user",
          userId: usageTarget.userId,
          limit: limitInfo.limit,
          client: tx,
        });

        if (!usage.allowed) {
          throw buildLimitReachedError(usage);
        }

          return usage;
        },
      });

      updatedUsage = projectUsageAfterIncrement(
        limitInfo as AnalyzeLimitResult,
        persisted.usage.used
      );
      savedReport = persisted.report;
    } else if (!unlimited && usageTarget.type === "guest") {
      const consumed = await consumeAnalyzeUsageIfAllowed({
        type: "guest",
        guestId: usageTarget.guestId,
        limit: limitInfo.limit,
      });

      if (!consumed.allowed) {
        throw buildLimitReachedError(consumed);
      }

      updatedUsage = projectUsageAfterIncrement(
        limitInfo as AnalyzeLimitResult,
        consumed.used
      );
    } else if (usageTarget.type === "user" && reportCreateData) {
      savedReport = await createAnalyzeReport({
        data: reportCreateData as never,
      });
    }

    try {
      await recordLearningArtifacts({
        reportId: savedReport?.id ?? null,
        platform,
        category,
        extracted: analysis.extractedData,
        summary: analysis.summary,
        overallScore: analysis.overallScore,
        sourceType: "real",
        missingDataReport,
        learningStatus,
      });
    } catch (learningError) {
      console.error("Learning memory update failed:", learningError);
    }

    const reportPreview = savedReport
      ? {
          id: savedReport.id,
          url: savedReport.url,
          overallScore: savedReport.overallScore,
          createdAt: savedReport.createdAt,
        }
      : null;

    logAnalyzeEvent({
      stage: "pipeline_success",
      requestId,
      actor,
      url,
      message: "Analyze pipeline basariyla tamamlandi",
      trace: shapedResult.analysisTrace,
      extra: {
        autoSaved: usageTarget.type === "user",
        overallScore: shapedResult.overallScore,
        dataSource: shapedResult.dataSource,
        decisionSummary,
        runtimeMs: diagnostics.totalMs,
      },
    });

    const successPayload: AnalyzeExecutionSuccess = {
      success: true,
      requestId,
      result: {
        ...shapedResult,
        missingDataReport,
        learningStatus,
        diagnostics,
        url,
        decisionSummary,
      },
      report: reportPreview,
      reportId: reportPreview?.id ?? null,
      usage: updatedUsage,
      autoSaved: usageTarget.type === "user",
    };

    emitProgress(onProgress, {
      stage: "completed",
      step: 6,
      totalSteps: 6,
      label: "Analiz tamamlandi",
      detail: "Rapor artik acilmaya hazir.",
      preview: {
        category,
        overallScore: shapedResult.overallScore,
        seoScore: shapedResult.seoScore,
        priorityAction:
          shapedResult.priorityActions?.[0]?.title ??
          shapedResult.suggestions?.[0]?.title ??
          null,
      },
    });

    return successPayload;
  } catch (error) {
    if (error instanceof AnalysisPipelineError) {
      logAnalyzeEvent({
        level: "warn",
        stage: "pipeline_error",
        requestId,
        actor,
        url,
        message: error.message,
        extra: { code: error.code, detail: error.detail },
      });
    } else {
      logAnalyzeEvent({
        level: "error",
        stage: "pipeline_unhandled_error",
        requestId,
        actor,
        url,
        message: "Pipeline icinde beklenmeyen hata olustu",
        extra: {
          detail: error instanceof Error ? error.message : String(error),
        },
      });
    }
    throw error;
  } finally {
    guard.release();
  }
}
