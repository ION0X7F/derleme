import { randomUUID } from "crypto";
import { executeAnalyzeUrl } from "@/lib/analyze-execution";
import {
  claimNextAnalyzeJob,
  completeAnalyzeJob,
  failAnalyzeJob,
  updateAnalyzeJobProgress,
} from "@/lib/analyze-jobs";
import { AnalysisPipelineError } from "@/lib/run-analysis";

const WORKER_ID = `analyze-worker:${randomUUID()}`;
const POLL_INTERVAL_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processSingleJob() {
  const job = await claimNextAnalyzeJob(WORKER_ID);
  if (!job) return false;

  console.log(
    `[analyze-worker] claimed ${job.id} (${job.url}) attempt=${job.attempts}`
  );

  if (!job.userId && !job.guestId) {
    await failAnalyzeJob(job.id, {
      error: "JOB_CONTEXT_MISSING",
      message:
        "Bu job icin userId/guestId baglami bulunamadi. Yeni bir analiz olusturun.",
    });
    console.warn(`[analyze-worker] context missing ${job.id}`);
    return true;
  }

  try {
    const result = await executeAnalyzeUrl({
      requestId: job.requestId,
      url: job.url,
      sessionUserId: job.userId ?? null,
      guestId: job.guestId ?? null,
      onProgress: (progress) => {
        void updateAnalyzeJobProgress(job.id, progress, { workerId: WORKER_ID });
      },
    });

    await completeAnalyzeJob(job.id, result, {
      stage: "completed",
      step: 6,
      totalSteps: 6,
      label: "Analiz tamamlandi",
      detail: "Rapor acilmaya hazir.",
      preview: {
        reportId: result.reportId,
        overallScore:
          typeof result.result.overallScore === "number"
            ? result.result.overallScore
            : null,
      },
    });

    console.log(`[analyze-worker] completed ${job.id}`);
    return true;
  } catch (error) {
    if (error instanceof AnalysisPipelineError) {
      await failAnalyzeJob(job.id, {
        error: error.code,
        message: error.message,
        detail: error.detail,
      });
      console.warn(`[analyze-worker] pipeline error ${job.id}: ${error.code}`);
      return true;
    }

    if (error instanceof Error && error.name === "AnalyzeLimitReachedError") {
      await failAnalyzeJob(job.id, {
        error: "ANALYZE_LIMIT_REACHED",
        message: "Analiz limiti doldu.",
      });
      console.warn(`[analyze-worker] limit reached ${job.id}`);
      return true;
    }

    if (error instanceof Error && error.name === "AnalyzeThrottledError") {
      const throttled = error as Error & {
        retryAfterSeconds?: number;
        reason?: string;
      };
      await failAnalyzeJob(job.id, {
        error: "ANALYZE_THROTTLED",
        message:
          throttled.reason || "Ayni URL icin tekrar deneme siniri asildi.",
        retryAfterSeconds: throttled.retryAfterSeconds ?? 15,
      });
      console.warn(`[analyze-worker] throttled ${job.id}`);
      return true;
    }

    await failAnalyzeJob(job.id, {
      error: "INTERNAL_SERVER_ERROR",
      message: "Analiz sirasinda bir hata olustu.",
      detail: error instanceof Error ? error.message : String(error),
    });
    console.error(`[analyze-worker] unhandled error ${job.id}`, error);
    return true;
  }
}

async function main() {
  const runOnce = process.argv.includes("--once");

  console.log(
    `[analyze-worker] started workerId=${WORKER_ID} mode=${runOnce ? "once" : "loop"}`
  );

  if (runOnce) {
    const handled = await processSingleJob();
    console.log(`[analyze-worker] exiting handled=${handled}`);
    return;
  }

  while (true) {
    const handled = await processSingleJob();
    if (!handled) {
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

main().catch((error) => {
  console.error("[analyze-worker] fatal", error);
  process.exit(1);
});
