import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = {
  label: string;
  passed: boolean;
};

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function run() {
  const route = read("app/api/analyze/jobs/route.ts");
  const createJobIndex = route.indexOf("createAnalyzeJob({");
  const usageContextIndex = route.indexOf("const usageContext =");
  const limitResponseIndex = route.indexOf("buildAnalyzeLimitReachedResponse({");
  const guardIndex = route.indexOf("const guard = checkAnalyzeRequestGuard({");
  const checks: Check[] = [
    {
      label: "jobs route resolves usage context before queue insert",
      passed:
        route.includes("resolveUserAnalyzeUsageContext") &&
        route.includes("resolveGuestAnalyzeUsageContext") &&
        usageContextIndex !== -1 &&
        createJobIndex !== -1 &&
        usageContextIndex < createJobIndex,
    },
    {
      label: "jobs route returns limit response before queue insert",
      passed:
        route.includes("buildAnalyzeLimitReachedResponse") &&
        limitResponseIndex !== -1 &&
        createJobIndex !== -1 &&
        limitResponseIndex < createJobIndex,
    },
    {
      label: "jobs route checks abuse guard before queue insert",
      passed:
        route.includes("checkAnalyzeRequestGuard") &&
        guardIndex !== -1 &&
        createJobIndex !== -1 &&
        guardIndex < createJobIndex,
    },
    {
      label: "jobs route returns throttled response when guard blocks",
      passed:
        route.includes("buildAnalyzeThrottledResponse") &&
        route.includes("if (!guard.allowed)"),
    },
  ];

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
