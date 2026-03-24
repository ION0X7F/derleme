import {
  buildAnalyzeLogPayload,
  logAnalyzeLimitReached,
  logAnalyzeThrottled,
} from "../lib/analysis-observability";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function run() {
  const checks: Check[] = [];

  const payload = buildAnalyzeLogPayload({
    stage: "test_stage",
    requestId: "req_test_1",
    actor: "user:1",
    url: "https://www.trendyol.com/brand/product-p-123?utm=abc",
    message: "test",
    extra: {
      apiKey: "secret-value",
      nested: {
        token: "abc",
        keep: "ok",
      },
      list: Array.from({ length: 12 }, (_, i) => `v${i}`),
      huge: "x".repeat(400),
    },
  });

  checks.push({
    label: "url is redacted to origin+path",
    passed: payload.url === "https://www.trendyol.com/brand/product-p-123",
    detail: payload.url,
  });

  checks.push({
    label: "sensitive keys are redacted",
    passed:
      (payload.extra as any)?.apiKey === "[redacted]" &&
      (payload.extra as any)?.nested?.token === "[redacted]",
    detail: payload.extra,
  });

  checks.push({
    label: "array payload is clipped",
    passed: Array.isArray((payload.extra as any)?.list) && (payload.extra as any).list.length === 10,
    detail: (payload.extra as any)?.list,
  });

  checks.push({
    label: "long strings are truncated",
    passed:
      typeof (payload.extra as any)?.huge === "string" &&
      (payload.extra as any).huge.length <= 243 &&
      (payload.extra as any).huge.endsWith("..."),
    detail: (payload.extra as any)?.huge,
  });

  const warnCalls: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args);
  };

  try {
    logAnalyzeLimitReached({
      requestId: "req_limit",
      actor: "user:1",
      url: "https://www.trendyol.com/a/b-p-1?utm=x",
      stage: "limit_check",
      usage: { used: 10, limit: 10, periodKey: "2026-03" },
    });
    logAnalyzeThrottled({
      requestId: "req_throttle",
      actor: "user:1",
      url: "https://www.trendyol.com/a/b-p-1?utm=x",
      stage: "abuse_guard",
      reason: "too fast",
      retryAfterSeconds: 12,
    });
  } finally {
    console.warn = originalWarn;
  }

  const limitPayload = (warnCalls[0] as any[])?.[1];
  const throttlePayload = (warnCalls[1] as any[])?.[1];

  checks.push({
    label: "logAnalyzeLimitReached writes expected warn payload",
    passed:
      (warnCalls[0] as any[])?.[0] === "[analyze]" &&
      limitPayload?.stage === "limit_check" &&
      limitPayload?.extra?.used === 10 &&
      limitPayload?.extra?.limit === 10 &&
      limitPayload?.extra?.periodKey === "2026-03",
    detail: limitPayload,
  });

  checks.push({
    label: "logAnalyzeThrottled writes expected warn payload",
    passed:
      (warnCalls[1] as any[])?.[0] === "[analyze]" &&
      throttlePayload?.stage === "abuse_guard" &&
      throttlePayload?.message === "too fast" &&
      throttlePayload?.extra?.retryAfterSeconds === 12,
    detail: throttlePayload,
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
