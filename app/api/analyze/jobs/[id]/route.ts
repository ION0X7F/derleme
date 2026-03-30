import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { failAnalyzeJob, getAnalyzeJob } from "@/lib/analyze-jobs";
import { getGuestId } from "@/lib/guest";

export const runtime = "nodejs";

const STALE_QUEUED_JOB_MS = 30_000;
const STALE_RUNNING_JOB_MS = 180_000;

async function hasActiveAnalyzeWorker(now: number) {
  const nowIso = new Date(now).toISOString();
  const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) as count
     FROM "AnalyzeJob"
     WHERE "status" = 'running'
       AND "workerId" IS NOT NULL
       AND "lockExpiresAt" IS NOT NULL
       AND "lockExpiresAt" >= ?`,
    nowIso
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

async function resolveStaleJob(id: string) {
  const job = await getAnalyzeJob(id);
  if (!job) return null;

  const now = Date.now();
  const staleQueuedWithoutClaim =
    job.status === "queued" &&
    !job.workerId &&
    now - job.createdAt > STALE_QUEUED_JOB_MS;
  const queuedWithoutWorker =
    staleQueuedWithoutClaim && !(await hasActiveAnalyzeWorker(now));
  const runningButAbandoned =
    job.status === "running" &&
    job.lockExpiresAt != null &&
    job.lockExpiresAt < now &&
    now - job.updatedAt > STALE_RUNNING_JOB_MS;

  if (!queuedWithoutWorker && !runningButAbandoned) {
    return job;
  }

  await failAnalyzeJob(job.id, {
    error: queuedWithoutWorker
      ? "ANALYZE_WORKER_UNAVAILABLE"
      : "ANALYZE_JOB_STALLED",
    message: queuedWithoutWorker
      ? "Analiz isleme alinmadi. Analyze worker su anda aktif gorunmuyor."
      : "Analiz isi yarida kaldi. Worker baglantisi kesilmis olabilir.",
    detail: queuedWithoutWorker
      ? "Gelisim ortaminda anasayfa analizleri icin `npm run dev:full` veya ayri olarak `npm run worker:analyze` calismali."
      : "Is yeniden denenebilir; gerekirse analyze worker yeniden baslatilmalidir.",
  });

  return getAnalyzeJob(id);
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = await resolveStaleJob(id);

  if (!job) {
    return NextResponse.json(
      {
        error: "JOB_NOT_FOUND",
        message: "Analiz isi bulunamadi.",
      },
      { status: 404 }
    );
  }

  const session = await auth();
  const guestId = session?.user?.id ? null : await getGuestId();
  const isOwner =
    (session?.user?.id && job.userId === session.user.id) ||
    (!session?.user?.id && !!guestId && job.guestId === guestId);

  if (!isOwner) {
    return NextResponse.json(
      {
        error: "JOB_NOT_FOUND",
        message: "Analiz isi bulunamadi.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: job.status === "completed",
    jobId: job.id,
    requestId: job.requestId,
    status: job.status,
    url: job.url,
    progress: job.progress,
    result: job.result?.result ?? null,
    report: job.result?.report ?? null,
    reportId: job.result?.reportId ?? null,
    usage: job.result?.usage ?? null,
    autoSaved: job.result?.autoSaved ?? false,
    error: job.error?.error ?? null,
    message: job.error?.message ?? null,
    detail: job.error?.detail ?? null,
    retryAfterSeconds: job.error?.retryAfterSeconds ?? null,
  });
}
