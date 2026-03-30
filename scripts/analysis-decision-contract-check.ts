import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function hasPattern(filePath: string, pattern: RegExp) {
  const content = readFileSync(resolve(process.cwd(), filePath), "utf8");
  return pattern.test(content);
}

function run() {
  const checks: Check[] = [];

  checks.push({
    label: "analyze route includes decisionSummary in result payload",
    passed: hasPattern(
      "lib/analyze-execution.ts",
      /result:\s*\{[\s\S]*decisionSummary/m
    ),
  });

  checks.push({
    label: "reanalyze route includes decisionSummary in response payload",
    passed: hasPattern(
      "app/api/reports/[id]/reanalyze/route.ts",
      /decisionSummary,\s*\n\s*report:/m
    ),
  });

  checks.push({
    label: "reanalyze success log includes decisionSummary",
    passed: hasPattern(
      "app/api/reports/[id]/reanalyze/route.ts",
      /extra:\s*\{[\s\S]*decisionSummary/m
    ),
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
