import { prisma } from "@/lib/prisma";
import type {
  AnalyzeExecutionProgress,
  AnalyzeExecutionSuccess,
} from "@/lib/analyze-execution";

export type AnalyzeJobStatus = "queued" | "running" | "completed" | "failed";

export type AnalyzeJobRecord = {
  id: string;
  requestId: string;
  url: string;
  status: AnalyzeJobStatus;
  userId?: string | null;
  guestId?: string | null;
  workerId?: string | null;
  attempts: number;
  startedAt?: number | null;
  finishedAt?: number | null;
  lockExpiresAt?: number | null;
  createdAt: number;
  updatedAt: number;
  progress: AnalyzeExecutionProgress;
  result: AnalyzeExecutionSuccess | null;
  error: {
    error: string;
    message: string;
    detail?: string;
    retryAfterSeconds?: number;
  } | null;
};

const JOB_TTL_MS = 1000 * 60 * 60 * 6;
const JOB_LOCK_MS = 1000 * 60 * 2;

function toJsonString(value: unknown) {
  if (value == null) return null;
  return JSON.stringify(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJsonColumn(value: unknown) {
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
}

function toRecord(row: {
  id: string;
  requestId: string;
  url: string;
  status: string;
  userId?: string | null;
  guestId?: string | null;
  workerId?: string | null;
  attempts?: number;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  lockExpiresAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  progress: unknown;
  result: unknown;
  error: unknown;
}): AnalyzeJobRecord {
  const progressValue = parseJsonColumn(row.progress);
  const resultValue = parseJsonColumn(row.result);
  const errorValue = parseJsonColumn(row.error);
  const progress =
    asRecord(progressValue) ??
    ({
      stage: "queued",
      step: 0,
      totalSteps: 6,
      label: "Analiz olusturuluyor",
      detail: "Is kaydi hazirlaniyor.",
      preview: null,
    } as AnalyzeExecutionProgress);

  return {
    id: row.id,
    requestId: row.requestId,
    url: row.url,
    status: row.status as AnalyzeJobStatus,
    userId: row.userId ?? null,
    guestId: row.guestId ?? null,
    workerId: row.workerId ?? null,
    attempts: typeof row.attempts === "number" ? row.attempts : 0,
    startedAt: row.startedAt ? new Date(row.startedAt).getTime() : null,
    finishedAt: row.finishedAt ? new Date(row.finishedAt).getTime() : null,
    lockExpiresAt: row.lockExpiresAt ? new Date(row.lockExpiresAt).getTime() : null,
    createdAt: new Date(row.createdAt).getTime(),
    updatedAt: new Date(row.updatedAt).getTime(),
    progress: progress as AnalyzeExecutionProgress,
    result: asRecord(resultValue) as AnalyzeExecutionSuccess | null,
    error: asRecord(errorValue) as AnalyzeJobRecord["error"],
  };
}

async function pruneJobs() {
  const cutoff = new Date(Date.now() - JOB_TTL_MS);
  await prisma.$executeRawUnsafe(
    `DELETE FROM "AnalyzeJob" WHERE "updatedAt" < ?`,
    cutoff.toISOString()
  );
}

export async function createAnalyzeJob(params: {
  id: string;
  requestId: string;
  url: string;
  userId?: string | null;
  guestId?: string | null;
}) {
  await pruneJobs();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "AnalyzeJob" ("id","requestId","url","status","userId","guestId","workerId","attempts","startedAt","finishedAt","lockExpiresAt","progress","result","error","createdAt","updatedAt")
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    params.id,
    params.requestId,
    params.url,
    "queued",
    params.userId ?? null,
    params.guestId ?? null,
    null,
    0,
    null,
    null,
    null,
    toJsonString({
      stage: "queued",
      step: 0,
      totalSteps: 6,
      label: "Analiz olusturuluyor",
      detail: "Is kaydi hazirlaniyor.",
      preview: null,
    }),
    null,
    null,
    new Date().toISOString(),
    new Date().toISOString()
  );

  return getAnalyzeJob(params.id);
}

export async function getAnalyzeJob(jobId: string) {
  await pruneJobs();
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      requestId: string;
      url: string;
      status: string;
      userId: string | null;
      guestId: string | null;
      workerId: string | null;
      attempts: number;
      startedAt: string | null;
      finishedAt: string | null;
      lockExpiresAt: string | null;
      createdAt: string;
      updatedAt: string;
      progress: unknown;
      result: unknown;
      error: unknown;
    }>
  >(`SELECT * FROM "AnalyzeJob" WHERE "id" = ? LIMIT 1`, jobId);
  const record = rows[0] ?? null;
  return record ? toRecord(record) : null;
}

export async function updateAnalyzeJobProgress(
  jobId: string,
  progress: AnalyzeExecutionProgress,
  options?: { workerId?: string | null }
) {
  const status = progress.stage === "completed" ? "completed" : "running";
  const nextLockExpiresAt = options?.workerId
    ? new Date(Date.now() + JOB_LOCK_MS).toISOString()
    : null;
  await prisma.$executeRawUnsafe(
    `UPDATE "AnalyzeJob" SET "status" = ?, "progress" = ?, "workerId" = COALESCE(?, "workerId"), "lockExpiresAt" = COALESCE(?, "lockExpiresAt"), "updatedAt" = ? WHERE "id" = ?`,
    status,
    toJsonString(progress),
    options?.workerId ?? null,
    nextLockExpiresAt,
    new Date().toISOString(),
    jobId
  );
  return getAnalyzeJob(jobId);
}

export async function completeAnalyzeJob(
  jobId: string,
  result: AnalyzeExecutionSuccess,
  progress: AnalyzeExecutionProgress
) {
  await prisma.$executeRawUnsafe(
    `UPDATE "AnalyzeJob" SET "status" = ?, "progress" = ?, "result" = ?, "error" = ?, "workerId" = ?, "finishedAt" = ?, "lockExpiresAt" = ?, "updatedAt" = ? WHERE "id" = ?`,
    "completed",
    toJsonString(progress),
    toJsonString(result),
    null,
    null,
    new Date().toISOString(),
    null,
    new Date().toISOString(),
    jobId
  );
  return getAnalyzeJob(jobId);
}

export async function failAnalyzeJob(
  jobId: string,
  error: AnalyzeJobRecord["error"]
) {
  await prisma.$executeRawUnsafe(
    `UPDATE "AnalyzeJob" SET "status" = ?, "error" = ?, "workerId" = ?, "finishedAt" = ?, "lockExpiresAt" = ?, "updatedAt" = ? WHERE "id" = ?`,
    "failed",
    toJsonString(error),
    null,
    new Date().toISOString(),
    null,
    new Date().toISOString(),
    jobId
  );
  return getAnalyzeJob(jobId);
}

export async function claimNextAnalyzeJob(workerId: string) {
  await pruneJobs();
  const now = new Date();
  const nowIso = now.toISOString();
  const nextLockIso = new Date(now.getTime() + JOB_LOCK_MS).toISOString();
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      requestId: string;
      url: string;
      status: string;
      userId: string | null;
      guestId: string | null;
      workerId: string | null;
      attempts: number;
      startedAt: string | null;
      finishedAt: string | null;
      lockExpiresAt: string | null;
      createdAt: string;
      updatedAt: string;
      progress: unknown;
      result: unknown;
      error: unknown;
    }>
  >(
    `SELECT * FROM "AnalyzeJob"
     WHERE ("status" = 'queued')
        OR ("status" = 'running' AND "lockExpiresAt" IS NOT NULL AND "lockExpiresAt" < ?)
     ORDER BY "createdAt" ASC
     LIMIT 1`,
    nowIso
  );
  const candidate = rows[0];
  if (!candidate) return null;

  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "AnalyzeJob"
     SET "status" = 'running',
         "workerId" = ?,
         "attempts" = COALESCE("attempts", 0) + 1,
         "startedAt" = COALESCE("startedAt", ?),
         "finishedAt" = NULL,
         "lockExpiresAt" = ?,
         "updatedAt" = ?
     WHERE "id" = ?
       AND (("status" = 'queued') OR ("status" = 'running' AND "lockExpiresAt" IS NOT NULL AND "lockExpiresAt" < ?))`,
    workerId,
    nowIso,
    nextLockIso,
    nowIso,
    candidate.id,
    nowIso
  );

  if (!updated) return null;
  return getAnalyzeJob(candidate.id);
}

export async function releaseAnalyzeJobLock(jobId: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "AnalyzeJob" SET "workerId" = NULL, "lockExpiresAt" = NULL, "updatedAt" = ? WHERE "id" = ?`,
    new Date().toISOString(),
    jobId
  );
}
