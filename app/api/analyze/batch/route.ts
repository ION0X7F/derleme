import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { validateProductUrl } from "@/lib/url-validation";
import { runAnalysisPipeline, AnalysisPipelineError } from "@/lib/run-analysis";
import { resolveUserAnalysisContext } from "@/lib/analysis-user-context";
import type { AnalyzeLimitResult } from "@/lib/check-analyze-limit";
import { resolveUserAnalyzeUsageContext } from "@/lib/analyze-usage-context";
import {
  createBatchAnalyzeInternalError,
  createBatchAnalyzeLimitReached,
  createBatchAnalyzePipelineError,
  createBatchAnalyzeSuccess,
  createBatchAnalyzeThrottled,
  type BatchAnalyzeItemResult,
  summarizeBatchAnalyzeResults,
} from "@/lib/batch-analyze-result";
import {
  buildAnalyzeLimitReachedResponse,
} from "@/lib/analyze-error-response";
import { incrementAnalyzeUsage } from "@/lib/increment-analyze-usage";
import { beginAnalyzeRequestGuard } from "@/lib/analyze-request-guard";
import {
  logAnalyzeEvent,
  logAnalyzeLimitReached,
  logAnalyzeThrottled,
} from "@/lib/analysis-observability";
import { projectUsageAfterIncrement } from "@/lib/analyze-usage-snapshot";
import { createRequestId } from "@/lib/request-id";
import { dedupeUrlsByCanonical } from "@/lib/url-canonical";

type BatchAnalyzeBody = {
  urls?: unknown;
  mode?: "prepare" | "execute";
};

const MAX_BATCH_URLS = 20;
const MAX_EXECUTE_URLS = 3;

function toUniqueUrls(input: unknown) {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
    if (urls.length >= MAX_BATCH_URLS) break;
  }
  return urls;
}

export async function POST(req: Request) {
  const requestId = createRequestId("bat");
  const body = (await req.json().catch(() => ({}))) as BatchAnalyzeBody;
  const mode = body.mode === "execute" ? "execute" : "prepare";
  const rawUrls = toUniqueUrls(body.urls);

  if (rawUrls.length === 0) {
    return NextResponse.json(
      { requestId, error: "En az bir URL girin." },
      { status: 400 }
    );
  }

  const prepared = rawUrls.map((rawUrl) => {
    const validated = validateProductUrl(rawUrl, {
      allowedPlatforms: ["trendyol"],
      allowShortTrendyolLinks: false,
    });
    return {
      input: rawUrl,
      ok: validated.ok,
      normalizedUrl: validated.ok ? validated.normalizedUrl : null,
      platform: validated.ok ? validated.platform : null,
      reason: validated.ok ? null : validated.message,
    };
  });

  const validUrls = prepared
    .filter((item) => item.ok && item.normalizedUrl)
    .map((item) => item.normalizedUrl as string);
  const deduped = dedupeUrlsByCanonical(validUrls);
  const uniqueValidUrls = deduped.unique;

  if (mode === "prepare") {
    logAnalyzeEvent({
      stage: "batch_prepare",
      requestId,
      actor: "prepare:unknown",
      message: "Batch prepare tamamlandi",
      extra: {
        accepted: uniqueValidUrls.length,
        duplicatesCollapsed: deduped.duplicatesCollapsed,
        rejected: prepared.length - validUrls.length,
      },
    });
    return NextResponse.json({
      success: true,
      requestId,
      mode: "prepare",
      maxExecuteUrls: MAX_EXECUTE_URLS,
      accepted: uniqueValidUrls.length,
      acceptedBeforeDedup: validUrls.length,
      duplicatesCollapsed: deduped.duplicatesCollapsed,
      rejected: prepared.length - validUrls.length,
      items: prepared,
      note: "Batch execute temeli hazir. Simdilik kontrollu sekilde en fazla 3 URL execute edilir.",
    });
  }

  const session = await auth();

  if (!session?.user?.id) {
    logAnalyzeEvent({
      level: "warn",
      stage: "batch_execute_unauthorized",
      requestId,
      actor: "guest:unknown",
      message: "Oturumsuz batch execute denemesi",
    });
    return NextResponse.json(
      { requestId, error: "Batch execute icin giris yapmalisiniz." },
      { status: 401 }
    );
  }

  const executeUrls = uniqueValidUrls.slice(0, MAX_EXECUTE_URLS);
  if (executeUrls.length === 0) {
    return NextResponse.json(
      { requestId, error: "Execute icin gecerli URL bulunamadi." },
      { status: 400 }
    );
  }

  const userAnalysisContext = await resolveUserAnalysisContext({
    userId: session.user.id,
    email: session.user.email,
  });
  const unlimited = userAnalysisContext.unlimited;
  const userMonthlyLimit = userAnalysisContext.monthlyLimit;
  const accessPlan = userAnalysisContext.accessPlan;

  const results: BatchAnalyzeItemResult[] = [];
  const actor = `user:${session.user.id}`;
  let usageWindow = (
    await resolveUserAnalyzeUsageContext({
      userId: session.user.id,
      monthlyLimit: userMonthlyLimit,
      unlimited,
    })
  ).usageWindow;

  if (!usageWindow.allowed) {
    logAnalyzeLimitReached({
      requestId,
      actor,
      stage: "batch_execute_limit_reached",
      usage: usageWindow,
      message: "Batch execute limiti asildi",
    });
    return buildAnalyzeLimitReachedResponse({
      requestId,
      usage: usageWindow,
      actorType: "user",
    });
  }

  for (const url of executeUrls) {
    const guard = beginAnalyzeRequestGuard({ actor, url });
    if (!guard.allowed) {
      logAnalyzeThrottled({
        requestId,
        actor,
        url,
        stage: "batch_execute_throttled",
        reason: guard.reason,
        retryAfterSeconds: guard.retryAfterSeconds,
      });
      results.push(
        createBatchAnalyzeThrottled({
          url,
          reason: guard.reason,
        })
      );
      continue;
    }

    if (!unlimited && usageWindow.remaining <= 0) {
      results.push(
        createBatchAnalyzeLimitReached({
          url,
          reason: "Aylik analiz limiti bu batch icinde doldu.",
        })
      );
      continue;
    }

    try {
      logAnalyzeEvent({
        stage: "batch_execute_item_start",
        requestId,
        actor,
        url,
        message: "Batch item analyze basladi",
        extra: { accessPlan },
      });
      const pipeline = await runAnalysisPipeline({
        url,
        planContext: accessPlan,
        learningSourceType: "real",
      });
      if (!unlimited) {
        const incremented = await incrementAnalyzeUsage({
          type: "user",
          userId: session.user.id,
        });
        usageWindow = projectUsageAfterIncrement(
          usageWindow as AnalyzeLimitResult,
          incremented.used
        );
      }
      results.push(createBatchAnalyzeSuccess({
        url,
        overallScore: pipeline.analysis.overallScore,
        dataSource: pipeline.analysis.dataSource,
      }));
      logAnalyzeEvent({
        stage: "batch_execute_item_success",
        requestId,
        actor,
        url,
        message: "Batch item analyze tamamlandi",
        trace: pipeline.analysis.analysisTrace,
        extra: {
          overallScore: pipeline.analysis.overallScore,
          dataSource: pipeline.analysis.dataSource,
          runtimeMs: pipeline.diagnostics.totalMs,
        },
      });
    } catch (error) {
      if (error instanceof AnalysisPipelineError) {
        logAnalyzeEvent({
          level: "warn",
          stage: "batch_execute_item_pipeline_error",
          requestId,
          actor,
          url,
          message: error.message,
          extra: { code: error.code, detail: error.detail },
        });
        results.push(
          createBatchAnalyzePipelineError({
            url,
            code: error.code,
            message: error.message,
          })
        );
        continue;
      }
      logAnalyzeEvent({
        level: "error",
        stage: "batch_execute_item_unhandled_error",
        requestId,
        actor,
        url,
        message: "Batch item analizinde beklenmeyen hata",
        extra: { detail: error instanceof Error ? error.message : String(error) },
      });
      results.push(createBatchAnalyzeInternalError({ url }));
    } finally {
      guard.release();
    }
  }

  const statusSummary = summarizeBatchAnalyzeResults(results);

  logAnalyzeEvent({
    stage: "batch_execute_done",
    requestId,
    actor,
    message: "Batch execute tamamlandi",
    extra: {
      requested: rawUrls.length,
      validBeforeDedup: validUrls.length,
      duplicatesCollapsed: deduped.duplicatesCollapsed,
      executed: executeUrls.length,
      succeeded: statusSummary.succeeded,
      failed: statusSummary.failed,
      byStatus: statusSummary.byStatus,
    },
  });

  return NextResponse.json({
    success: true,
    requestId,
    mode: "execute",
    executedCount: executeUrls.length,
    statusSummary,
    results,
  });
}
