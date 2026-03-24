export type BatchAnalyzeItemStatus =
  | "ok"
  | "analyze_throttled"
  | "limit_reached"
  | "pipeline_error"
  | "internal_error";

export type BatchAnalyzeItemResult = {
  url: string;
  ok: boolean;
  status: BatchAnalyzeItemStatus;
  decisionReason: string;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  overallScore?: number | null;
  dataSource?: string | null;
};

export type BatchAnalyzeStatusSummary = {
  total: number;
  succeeded: number;
  failed: number;
  byStatus: Record<BatchAnalyzeItemStatus, number>;
};

export function createBatchAnalyzeSuccess(params: {
  url: string;
  overallScore: number | null;
  dataSource: string | null;
}): BatchAnalyzeItemResult {
  return {
    url: params.url,
    ok: true,
    status: "ok",
    decisionReason: "analysis_completed",
    overallScore: params.overallScore,
    dataSource: params.dataSource,
  };
}

export function createBatchAnalyzeThrottled(params: {
  url: string;
  reason?: string;
}): BatchAnalyzeItemResult {
  return {
    url: params.url,
    ok: false,
    status: "analyze_throttled",
    decisionReason: "guard_throttled",
    error: "ANALYZE_THROTTLED",
    errorCode: "ANALYZE_THROTTLED",
    errorMessage:
      params.reason ?? "Ayni URL icin cok hizli tekrar analyze cagrisi algilandi.",
  };
}

export function createBatchAnalyzeLimitReached(params: {
  url: string;
  reason?: string;
}): BatchAnalyzeItemResult {
  return {
    url: params.url,
    ok: false,
    status: "limit_reached",
    decisionReason: "usage_limit_reached",
    error: "LIMIT_REACHED",
    errorCode: "LIMIT_REACHED",
    errorMessage: params.reason ?? "Aylik analiz limiti bu batch icinde doldu.",
  };
}

export function createBatchAnalyzePipelineError(params: {
  url: string;
  code: string;
  message: string;
}): BatchAnalyzeItemResult {
  return {
    url: params.url,
    ok: false,
    status: "pipeline_error",
    decisionReason: "pipeline_failed",
    error: `${params.code}: ${params.message}`,
    errorCode: params.code,
    errorMessage: params.message,
  };
}

export function createBatchAnalyzeInternalError(params: {
  url: string;
}): BatchAnalyzeItemResult {
  return {
    url: params.url,
    ok: false,
    status: "internal_error",
    decisionReason: "unhandled_exception",
    error: "INTERNAL_ERROR",
    errorCode: "INTERNAL_ERROR",
    errorMessage: "Batch item analizinde beklenmeyen hata olustu.",
  };
}

export function summarizeBatchAnalyzeResults(
  results: BatchAnalyzeItemResult[]
): BatchAnalyzeStatusSummary {
  const byStatus: Record<BatchAnalyzeItemStatus, number> = {
    ok: 0,
    analyze_throttled: 0,
    limit_reached: 0,
    pipeline_error: 0,
    internal_error: 0,
  };

  for (const item of results) {
    byStatus[item.status] += 1;
  }

  const succeeded = byStatus.ok;
  const total = results.length;

  return {
    total,
    succeeded,
    failed: total - succeeded,
    byStatus,
  };
}
