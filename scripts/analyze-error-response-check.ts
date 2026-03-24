import {
  buildAnalyzeLimitReachedResponse,
  buildAnalyzeThrottledResponse,
} from "../lib/analyze-error-response";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

async function run() {
  const checks: Check[] = [];

  const guestLimitResponse = buildAnalyzeLimitReachedResponse({
    requestId: "req_1",
    actorType: "guest",
    usage: {
      allowed: false,
      used: 3,
      limit: 3,
      remaining: 0,
      periodKey: "2026-03",
      periodType: "monthly",
    },
  });
  const guestBody = await guestLimitResponse.json();
  checks.push({
    label: "guest limit response keeps 429 and guest-specific message",
    passed:
      guestLimitResponse.status === 429 &&
      guestBody?.error === "LIMIT_REACHED" &&
      typeof guestBody?.message === "string" &&
      guestBody.message.includes("Guest analiz limitine ulastiniz"),
    detail: guestBody,
  });

  const userLimitResponse = buildAnalyzeLimitReachedResponse({
    requestId: "req_2",
    actorType: "user",
    usage: {
      allowed: false,
      used: 10,
      limit: 10,
      remaining: 0,
      periodKey: "2026-03",
      periodType: "monthly",
    },
  });
  const userBody = await userLimitResponse.json();
  checks.push({
    label: "user limit response keeps monthly message",
    passed:
      userLimitResponse.status === 429 &&
      userBody?.error === "LIMIT_REACHED" &&
      userBody?.message === "Aylik analiz limitine ulastiniz.",
    detail: userBody,
  });

  const throttledResponse = buildAnalyzeThrottledResponse({
    requestId: "req_3",
    reason: "too fast",
    retryAfterSeconds: 12,
  });
  const throttledBody = await throttledResponse.json();
  checks.push({
    label: "throttled response includes retryAfterSeconds",
    passed:
      throttledResponse.status === 429 &&
      throttledBody?.error === "ANALYZE_THROTTLED" &&
      throttledBody?.retryAfterSeconds === 12,
    detail: throttledBody,
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
