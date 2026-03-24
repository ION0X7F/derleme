import { normalizePagination, parsePositiveInt } from "../lib/pagination";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function run() {
  const checks: Check[] = [];

  checks.push({
    label: "parsePositiveInt parses valid value",
    passed: parsePositiveInt("12") === 12,
  });
  checks.push({
    label: "parsePositiveInt rejects zero",
    passed: parsePositiveInt("0") === null,
  });
  checks.push({
    label: "parsePositiveInt rejects negative",
    passed: parsePositiveInt("-3") === null,
  });
  checks.push({
    label: "parsePositiveInt rejects non-numeric",
    passed: parsePositiveInt("abc") === null,
  });

  const p1 = normalizePagination({
    requestedTake: null,
    requestedCursor: null,
    historyLimit: 5,
    maxTake: 100,
  });
  checks.push({
    label: "normalizePagination defaults to plan historyLimit",
    passed: p1.take === 5 && p1.cursor === 0,
    detail: p1,
  });

  const p2 = normalizePagination({
    requestedTake: 30,
    requestedCursor: 10,
    historyLimit: 20,
    maxTake: 100,
  });
  checks.push({
    label: "normalizePagination clamps by historyLimit",
    passed: p2.take === 20 && p2.cursor === 10,
    detail: p2,
  });

  const p3 = normalizePagination({
    requestedTake: 500,
    requestedCursor: 2,
    historyLimit: 0,
    maxTake: 100,
  });
  checks.push({
    label: "normalizePagination clamps by maxTake when history is unlimited",
    passed: p3.take === 100 && p3.cursor === 2,
    detail: p3,
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
