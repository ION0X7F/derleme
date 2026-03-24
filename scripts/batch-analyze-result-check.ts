import {
  createBatchAnalyzeInternalError,
  createBatchAnalyzeLimitReached,
  createBatchAnalyzePipelineError,
  createBatchAnalyzeSuccess,
  createBatchAnalyzeThrottled,
  summarizeBatchAnalyzeResults,
} from "../lib/batch-analyze-result";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function run() {
  const checks: Check[] = [];

  const success = createBatchAnalyzeSuccess({
    url: "https://www.trendyol.com/a/b-p-1",
    overallScore: 82,
    dataSource: "platform",
  });
  checks.push({
    label: "success result shape is stable",
    passed:
      success.ok === true &&
      success.status === "ok" &&
      success.decisionReason === "analysis_completed" &&
      success.overallScore === 82 &&
      success.dataSource === "platform",
    detail: success,
  });

  const throttled = createBatchAnalyzeThrottled({
    url: "https://www.trendyol.com/a/b-p-2",
    reason: "throttle active",
  });
  checks.push({
    label: "throttled result exposes deterministic error code",
    passed:
      throttled.ok === false &&
      throttled.status === "analyze_throttled" &&
      throttled.errorCode === "ANALYZE_THROTTLED" &&
      throttled.decisionReason === "guard_throttled" &&
      throttled.errorMessage === "throttle active",
    detail: throttled,
  });

  const limit = createBatchAnalyzeLimitReached({
    url: "https://www.trendyol.com/a/b-p-3",
    reason: "limit exhausted",
  });
  checks.push({
    label: "limit reached result exposes deterministic error code",
    passed:
      limit.ok === false &&
      limit.status === "limit_reached" &&
      limit.errorCode === "LIMIT_REACHED" &&
      limit.decisionReason === "usage_limit_reached" &&
      limit.errorMessage === "limit exhausted",
    detail: limit,
  });

  const pipeline = createBatchAnalyzePipelineError({
    url: "https://www.trendyol.com/a/b-p-4",
    code: "FETCH_FAILED",
    message: "Sayfa alinamadi",
  });
  checks.push({
    label: "pipeline error keeps source code/message",
    passed:
      pipeline.ok === false &&
      pipeline.status === "pipeline_error" &&
      pipeline.errorCode === "FETCH_FAILED" &&
      pipeline.decisionReason === "pipeline_failed" &&
      pipeline.errorMessage === "Sayfa alinamadi",
    detail: pipeline,
  });

  const internal = createBatchAnalyzeInternalError({
    url: "https://www.trendyol.com/a/b-p-5",
  });
  checks.push({
    label: "internal error is explicit and stable",
    passed:
      internal.ok === false &&
      internal.status === "internal_error" &&
      internal.decisionReason === "unhandled_exception" &&
      internal.errorCode === "INTERNAL_ERROR",
    detail: internal,
  });

  const summary = summarizeBatchAnalyzeResults([
    success,
    throttled,
    limit,
    pipeline,
    internal,
    createBatchAnalyzeSuccess({
      url: "https://www.trendyol.com/a/b-p-6",
      overallScore: 75,
      dataSource: "platform",
    }),
  ]);

  checks.push({
    label: "summary counts are deterministic by status",
    passed:
      summary.total === 6 &&
      summary.succeeded === 2 &&
      summary.failed === 4 &&
      summary.byStatus.ok === 2 &&
      summary.byStatus.analyze_throttled === 1 &&
      summary.byStatus.limit_reached === 1 &&
      summary.byStatus.pipeline_error === 1 &&
      summary.byStatus.internal_error === 1,
    detail: summary,
  });

  const failed = checks.filter((item) => !item.passed);

  console.log(
    JSON.stringify(
      {
        total: checks.length,
        passed: checks.length - failed.length,
        failed: failed.length,
        checks,
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

run();
