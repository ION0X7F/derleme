import { NextResponse } from "next/server";
import { getAnalyzeJob } from "@/lib/analyze-jobs";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = await getAnalyzeJob(id);

  if (!job) {
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
