import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserAnalysisContext } from "@/lib/analysis-user-context";
import { runAnalysisPipeline, AnalysisPipelineError } from "@/lib/run-analysis";
import { resolveUserAnalyzeUsageContext } from "@/lib/analyze-usage-context";
import {
  buildAnalyzeLimitReachedResponse,
  buildAnalyzeThrottledResponse,
} from "@/lib/analyze-error-response";
import { incrementAnalyzeUsage } from "@/lib/increment-analyze-usage";
import { attachReportVersionMeta, readReportVersionMeta } from "@/lib/report-versioning";
import { beginAnalyzeRequestGuard } from "@/lib/analyze-request-guard";
import {
  logAnalyzeEvent,
  logAnalyzeLimitReached,
  logAnalyzeThrottled,
} from "@/lib/analysis-observability";
import { createRequestId } from "@/lib/request-id";
import { buildAnalysisDecisionSummary } from "@/lib/analysis-decision-summary";
import {
  createReanalyzeReport,
  fetchReportReanalyzeBaseForUser,
} from "@/lib/report-detail-query";
import type { AnalysisTrace } from "@/types/analysis";

function toDbJson<T>(value: T) {
  return value as T & object;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = createRequestId("rean");
  const session = await auth();

  if (!session?.user?.id) {
    logAnalyzeEvent({
      level: "warn",
      stage: "reanalyze_unauthorized",
      requestId,
      actor: "unknown",
      message: "Oturum olmadan reanalyze denendi",
    });
    return NextResponse.json({ requestId, error: "Yetkisiz erisim." }, { status: 401 });
  }

  const { id } = await params;
  const baseReport = await fetchReportReanalyzeBaseForUser({
    id,
    userId: session.user.id,
  });

  if (!baseReport) {
    logAnalyzeEvent({
      level: "warn",
      stage: "reanalyze_not_found",
      requestId,
      actor: `user:${session.user.id}`,
      message: "Kullaniciya ait olmayan rapor icin reanalyze denemesi",
      extra: { reportId: id },
    });
    return NextResponse.json({ requestId, error: "Rapor bulunamadi." }, { status: 404 });
  }

  const userAnalysisContext = await resolveUserAnalysisContext({
    userId: session.user.id,
    email: session.user.email,
  });
  const unlimited = userAnalysisContext.unlimited;
  const userMonthlyLimit = userAnalysisContext.monthlyLimit;
  const accessPlan = userAnalysisContext.accessPlan;
  const access = userAnalysisContext.access;
  const actor = `user:${session.user.id}`;

  if (access.lockedSections.includes("reanalysis")) {
    logAnalyzeEvent({
      level: "warn",
      stage: "reanalyze_locked",
      requestId,
      actor,
      url: baseReport.url,
      message: "Plan seviyesinde reanalyze kilitli",
      extra: { planCode: userAnalysisContext.planCode, accessPlan },
    });
    return NextResponse.json(
      {
        requestId,
        error: "REANALYZE_LOCKED",
        message: "Mevcut plan seviyesinde yeniden analiz kilitli.",
      },
      { status: 403 }
    );
  }

  if (!unlimited) {
    const limitInfo = (
      await resolveUserAnalyzeUsageContext({
        userId: session.user.id,
        monthlyLimit: userMonthlyLimit,
        unlimited,
      })
    ).usageWindow;
    if (!limitInfo.allowed) {
      logAnalyzeLimitReached({
        requestId,
        actor,
        url: baseReport.url,
        stage: "reanalyze_limit_reached",
        usage: limitInfo,
        message: "Yeniden analiz limiti asildi",
      });
      return buildAnalyzeLimitReachedResponse({
        requestId,
        usage: limitInfo,
        actorType: "user",
      });
    }
  }

  const guard = beginAnalyzeRequestGuard({
    actor,
    url: baseReport.url,
  });

  if (!guard.allowed) {
    logAnalyzeThrottled({
      requestId,
      actor,
      url: baseReport.url,
      stage: "reanalyze_throttled",
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
    stage: "reanalyze_start",
    requestId,
    actor,
    url: baseReport.url,
    message: "Yeniden analiz basladi",
    extra: { reportId: baseReport.id, accessPlan, unlimited },
  });

  try {
    const pipeline = await runAnalysisPipeline({
      url: baseReport.url,
      planContext: accessPlan,
      learningSourceType: "real",
    });
    const { analysis, category, platform, learningStatus, missingDataReport, diagnostics } = pipeline;
    const decisionSummary = buildAnalysisDecisionSummary({
      analysisTrace: analysis.analysisTrace,
      dataSource: analysis.dataSource,
    });

    const baseVersion = readReportVersionMeta(baseReport.accessState);
    const rootReportId = baseVersion.rootReportId || baseReport.id;
    const generation = baseVersion.generation + 1;

    const saved = await createReanalyzeReport({
      data: {
        userId: session.user.id,
        url: baseReport.url,
        platform,
        category,
        seoScore: analysis.seoScore,
        dataCompletenessScore: analysis.dataCompletenessScore,
        conversionScore: analysis.conversionScore,
        overallScore: analysis.overallScore,
        priceCompetitiveness: analysis.priceCompetitiveness,
        summary: analysis.summary,
        dataSource: analysis.dataSource,
        extractedData: toDbJson(analysis.extractedData),
        derivedMetrics: toDbJson(analysis.derivedMetrics),
        coverage: toDbJson(analysis.decisionSupportPacket.coverage),
        accessState: toDbJson(
          attachReportVersionMeta({
            accessState: access as unknown as Record<string, unknown>,
            previousReportId: baseReport.id,
            rootReportId,
            generation,
            trigger: "reanalyze",
          })
        ),
        suggestions: toDbJson(analysis.suggestions),
        priorityActions: toDbJson(analysis.priorityActions),
        analysisTrace: analysis.analysisTrace ? toDbJson(analysis.analysisTrace) : null,
      } as any,
    });

    if (!unlimited) {
      await incrementAnalyzeUsage({ type: "user", userId: session.user.id });
    }

    const previousOverall = typeof baseReport.overallScore === "number" ? baseReport.overallScore : null;
    const currentOverall = typeof saved.overallScore === "number" ? saved.overallScore : null;

    logAnalyzeEvent({
      stage: "reanalyze_success",
      requestId,
      actor,
      url: baseReport.url,
      message: "Yeniden analiz basariyla tamamlandi",
      trace: (saved.analysisTrace as AnalysisTrace | null) ?? null,
      extra: {
        previousReportId: baseReport.id,
        currentReportId: saved.id,
        previousOverall,
        currentOverall,
        decisionSummary,
        runtimeMs: diagnostics.totalMs,
      },
    });

    const reportPreview = {
      id: saved.id,
      url: saved.url,
      overallScore: saved.overallScore,
      createdAt: saved.createdAt,
    };

    return NextResponse.json({
      success: true,
      requestId,
      reportId: saved.id,
      url: saved.url,
      comparison: {
        previousReportId: baseReport.id,
        currentReportId: saved.id,
        previousOverall,
        currentOverall,
        deltaOverall:
          previousOverall != null && currentOverall != null
            ? currentOverall - previousOverall
            : null,
        generation,
      },
      learningStatus,
      missingDataReport,
      diagnostics,
      decisionSummary,
      report: reportPreview,
    });
  } catch (error) {
    if (error instanceof AnalysisPipelineError) {
      logAnalyzeEvent({
        level: "warn",
        stage: "reanalyze_pipeline_error",
        requestId,
        actor,
        url: baseReport.url,
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
      stage: "reanalyze_unhandled_error",
      requestId,
      actor,
      url: baseReport.url,
      message: "Yeniden analizde beklenmeyen hata olustu",
      extra: { detail: error instanceof Error ? error.message : String(error) },
    });
    console.error("[reports/reanalyze] POST error:", error);
    return NextResponse.json(
      { requestId, error: "Yeniden analiz basarisiz oldu." },
      { status: 500 }
    );
  } finally {
    guard.release();
  }
}
