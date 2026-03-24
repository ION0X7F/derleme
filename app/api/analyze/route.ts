import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAnalysisAccessState } from "@/lib/analysis-access";
import { resolveUserAnalysisContext } from "@/lib/analysis-user-context";
import type { AnalyzeLimitResult } from "@/lib/check-analyze-limit";
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
import {
  buildAnalyzeLimitReachedResponse,
  buildAnalyzeThrottledResponse,
} from "@/lib/analyze-error-response";
import { incrementAnalyzeUsage } from "@/lib/increment-analyze-usage";
import { createRequestId } from "@/lib/request-id";
import {
  projectUsageAfterIncrement,
} from "@/lib/analyze-usage-snapshot";
import { buildAnalysisDecisionSummary } from "@/lib/analysis-decision-summary";
import { recordLearningArtifacts } from "@/lib/learning-engine";
import { buildStoredAnalysisPayload } from "@/lib/report-storage";
import {
  AnalysisPipelineError,
  runAnalysisPipeline,
} from "@/lib/run-analysis";
import { validateProductUrl } from "@/lib/url-validation";
import { createAnalyzeReport } from "@/lib/report-detail-query";
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

export async function POST(req: Request) {
  const requestId = createRequestId("req");
  try {
    const session = await auth();
    let body: { url?: unknown };
    try {
      body = (await req.json()) as { url?: unknown };
    } catch {
      return NextResponse.json(
        {
          requestId,
          error: "INVALID_REQUEST_BODY",
          message: "Gecersiz istek govdesi.",
        },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        {
          requestId,
          error: "INVALID_REQUEST_BODY",
          message: "Gecersiz istek govdesi.",
        },
        { status: 400 }
      );
    }

    const rawUrl = typeof body?.url === "string" ? body.url : "";
    const validatedUrl = validateProductUrl(rawUrl, {
      allowedPlatforms: ["trendyol"],
      allowShortTrendyolLinks: false,
    });

    if (!validatedUrl.ok) {
      logAnalyzeEvent({
        level: "warn",
        stage: "url_validation",
        requestId,
        actor: session?.user?.id ? `user:${session.user.id}` : "guest:unknown",
        url: rawUrl,
        message: validatedUrl.message,
        extra: { code: validatedUrl.code },
      });
      return NextResponse.json(
        {
          requestId,
          error: validatedUrl.code,
          message: validatedUrl.message,
        },
        { status: 400 }
      );
    }

    const url = validatedUrl.normalizedUrl;
    
    const userAnalysisContext = session?.user?.id
      ? await resolveUserAnalysisContext({
          userId: session.user.id,
          email: session.user.email,
        })
      : null;
    const unlimited = userAnalysisContext?.unlimited ?? false;
    const userMonthlyLimit = userAnalysisContext?.monthlyLimit ?? 10;
    const accessPlan = userAnalysisContext?.accessPlan ?? "guest";
    const access = userAnalysisContext?.access ?? buildAnalysisAccessState("guest");

    const usageContext = session?.user?.id
      ? await resolveUserAnalyzeUsageContext({
          userId: session.user.id,
          monthlyLimit: userMonthlyLimit,
          unlimited,
        })
      : await resolveGuestAnalyzeUsageContext();
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
      return buildAnalyzeLimitReachedResponse({
        requestId,
        usage: limitInfo,
        actorType: usageTarget.type,
      });
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
      return buildAnalyzeThrottledResponse({
        requestId,
        reason: guard.reason,
        retryAfterSeconds: guard.retryAfterSeconds,
      });
    }

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
      });

      const {
        analysis,
        category,
        platform,
        learningStatus,
        missingDataReport,
        diagnostics,
      } =
        pipeline;
      const shapedResult = shapeAnalysisForAccess(analysis, access, category);
      const decisionSummary = buildAnalysisDecisionSummary({
        analysisTrace: shapedResult.analysisTrace,
        dataSource: shapedResult.dataSource,
      });

      let savedReport: Awaited<ReturnType<typeof createAnalyzeReport>> | null =
        null;
      const storedPayload = buildStoredAnalysisPayload(analysis);

      if (usageTarget.type === "user") {
        savedReport = await createAnalyzeReport({
          data: {
            guestId: null,
            user: {
              connect: {
                id: usageTarget.userId,
              },
            },
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
          } as any,
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

      let updatedUsage = limitInfo;
      if (!unlimited) {
        const incremented = await incrementAnalyzeUsage(usageTarget);
        updatedUsage = projectUsageAfterIncrement(
          limitInfo as AnalyzeLimitResult,
          incremented.used
        );
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

      return NextResponse.json(
        {
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
        }
      );
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
        return NextResponse.json(
          {
            requestId,
            error: error.code,
            message: error.message,
            detail: error.detail,
          },
          { status: 400 }
        );
      }

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
      throw error;
    } finally {
      guard.release();
    }
  } catch (error) {
    logAnalyzeEvent({
      level: "error",
      stage: "analyze_handler_error",
      requestId,
      actor: "unknown",
      message: "Analyze handler hata verdi",
      extra: { detail: error instanceof Error ? error.message : String(error) },
    });
    console.error("Analyze POST error:", error);
    return NextResponse.json(
      {
        requestId,
        error: "INTERNAL_SERVER_ERROR",
        message: "Analiz sirasinda bir hata olustu.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
