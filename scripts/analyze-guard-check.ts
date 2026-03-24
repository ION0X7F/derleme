import { beginAnalyzeRequestGuard } from "../lib/analyze-request-guard";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function run() {
  const checks: Check[] = [];

  const first = beginAnalyzeRequestGuard({
    actor: "user:test-1",
    url: "https://www.trendyol.com/marka/urun-p-1",
  });
  checks.push({
    label: "first request for actor+url is allowed",
    passed: first.allowed === true,
    detail: first,
  });

  const second = beginAnalyzeRequestGuard({
    actor: "user:test-1",
    url: "https://www.trendyol.com/marka/urun-p-1",
  });
  checks.push({
    label: "immediate second request for same actor+url is throttled",
    passed:
      second.allowed === false &&
      typeof second.retryAfterSeconds === "number" &&
      second.retryAfterSeconds >= 1,
    detail: second,
  });

  const sameProductDifferentQuery = beginAnalyzeRequestGuard({
    actor: "user:test-1",
    url: "https://www.trendyol.com/marka/urun-p-1?boutiqueId=12&merchantId=34",
  });
  checks.push({
    label: "same actor+product with different query is throttled",
    passed:
      sameProductDifferentQuery.allowed === false &&
      typeof sameProductDifferentQuery.retryAfterSeconds === "number" &&
      sameProductDifferentQuery.retryAfterSeconds >= 1,
    detail: sameProductDifferentQuery,
  });

  const differentUrl = beginAnalyzeRequestGuard({
    actor: "user:test-1",
    url: "https://www.trendyol.com/marka/urun-p-2",
  });
  checks.push({
    label: "same actor with different url is allowed",
    passed: differentUrl.allowed === true,
    detail: differentUrl,
  });

  const differentActor = beginAnalyzeRequestGuard({
    actor: "user:test-2",
    url: "https://www.trendyol.com/marka/urun-p-1",
  });
  checks.push({
    label: "different actor with same url is allowed",
    passed: differentActor.allowed === true,
    detail: differentActor,
  });

  if (first.allowed) first.release();
  if (differentUrl.allowed) differentUrl.release();
  if (differentActor.allowed) differentActor.release();

  const afterRelease = beginAnalyzeRequestGuard({
    actor: "user:test-1",
    url: "https://www.trendyol.com/marka/urun-p-1",
  });
  checks.push({
    label: "after release still applies cooldown throttle",
    passed: afterRelease.allowed === false,
    detail: afterRelease,
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
