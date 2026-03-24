import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

const TARGETS = [
  "app/api/analyze/route.ts",
  "app/api/analyze/batch/route.ts",
  "lib/usage-route-response.ts",
  "app/api/reports/route.ts",
  "app/api/reports/list/route.ts",
  "app/api/reports/[id]/route.ts",
  "app/api/reports/[id]/export/route.ts",
  "app/api/reports/[id]/reanalyze/route.ts",
  "app/api/reports/save/route.ts",
];

function run() {
  const checks: Check[] = [];

  for (const relativePath of TARGETS) {
    const fullPath = resolve(process.cwd(), relativePath);
    const source = readFileSync(fullPath, "utf8");
    const hasRequestIdInJson = /NextResponse\.json\(\s*\{[\s\S]*?\brequestId\b[\s\S]*?\}/m.test(
      source
    );

    checks.push({
      label: `${relativePath} includes requestId in response body`,
      passed: hasRequestIdInJson,
      detail: hasRequestIdInJson ? "ok" : "requestId not found in NextResponse.json payload",
    });
  }

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
