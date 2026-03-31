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

type LogExtra = {
  apiKey?: string;
  nested?: {
    token?: string;
    keep?: string;
  };
  list?: string[];
  huge?: string;
};

type WarnPayload = {
  stage?: string;
  message?: string;
  extra?: Record<string, unknown>;
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
      (payload.extra as LogExtra | undefined)?.apiKey === "[redacted]" &&
      (payload.extra as LogExtra | undefined)?.nested?.token === "[redacted]",
    detail: payload.extra,
  });

  checks.push({
    label: "array payload is clipped",
    passed:
      Array.isArray((payload.extra as LogExtra | undefined)?.list) &&
      ((payload.extra as LogExtra | undefined)?.list?.length ?? 0) === 10,
    detail: (payload.extra as LogExtra | undefined)?.list,
  });

  checks.push({
    label: "long strings are truncated",
    passed:
      typeof (payload.extra as LogExtra | undefined)?.huge === "string" &&
      ((payload.extra as LogExtra | undefined)?.huge?.length ?? 0) <= 243 &&
      ((payload.extra as LogExtra | undefined)?.huge?.endsWith("...") ?? false),
    detail: (payload.extra as LogExtra | undefined)?.huge,
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

  const limitCall = warnCalls[0] as [string, WarnPayload] | undefined;
  const throttleCall = warnCalls[1] as [string, WarnPayload] | undefined;
  const limitPayload = limitCall?.[1];
  const throttlePayload = throttleCall?.[1];

  checks.push({
    label: "logAnalyzeLimitReached writes expected warn payload",
    passed:
      limitCall?.[0] === "[analyze]" &&
      limitPayload?.stage === "limit_check" &&
      limitPayload?.extra?.used === 10 &&
      limitPayload?.extra?.limit === 10 &&
      limitPayload?.extra?.periodKey === "2026-03",
    detail: limitPayload,
  });

  checks.push({
    label: "logAnalyzeThrottled writes expected warn payload",
    passed:
      throttleCall?.[0] === "[analyze]" &&
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
