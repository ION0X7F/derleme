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
  const route = read("app/api/reports/save/route.ts");
  const query = read("lib/report-detail-query.ts");

  const checks: Check[] = [
    {
      label: "report save route uses shared createSavedReport helper",
      passed:
        route.includes('from "@/lib/report-detail-query"') &&
        route.includes("createSavedReport") &&
        route.includes("createSavedReport({"),
    },
    {
      label: "report save route no longer imports prisma directly",
      passed: !route.includes('from "@/lib/prisma"'),
    },
    {
      label: "shared query module defines createSavedReport",
      passed:
        query.includes("createSavedReport") &&
        query.includes("Prisma.ReportCreateInput") &&
        query.includes("prisma.report.create"),
    },
    {
      label: "report save route enforces trendyol-only strict URL validation",
      passed:
        route.includes("validateProductUrl(rawUrl, {") &&
        route.includes('allowedPlatforms: ["trendyol"]') &&
        route.includes("allowShortTrendyolLinks: false"),
    },
    {
      label: "report save route validates optional platform hint against URL platform",
      passed:
        route.includes("body.platform") &&
        route.includes("normalizedPlatform") &&
        route.includes("URL ile uyusmuyor"),
    },
    {
      label: "report save route validates score fields in 0-100 range",
      passed:
        route.includes("parseNullableScore(") &&
        route.includes("0-100 araliginda olmali"),
    },
    {
      label: "report save route normalizes nullable text fields with max lengths",
      passed:
        route.includes("parseNullableText(") &&
        route.includes('parseNullableText(body.category, "category", 120)') &&
        route.includes('parseNullableText(body.summary, "summary", 2_500)') &&
        route.includes('parseNullableText(') &&
        route.includes('"dataSource"') &&
        route.includes('"priceCompetitiveness"') &&
        route.includes("en fazla"),
    },
    {
      label: "report save route validates suggestions and priorityActions arrays",
      passed:
        route.includes("parseStringArray(") &&
        route.includes('body.suggestions') &&
        route.includes('body.priorityActions') &&
        route.includes("maxItems") &&
        route.includes("240 karakter"),
    },
    {
      label: "report save route enforces JSON payload size limits",
      passed:
        route.includes("ensureJsonPayloadSize(") &&
        route.includes('"extractedData"') &&
        route.includes("150_000") &&
        route.includes('"analysisTrace"') &&
        route.includes("200_000"),
    },
    {
      label: "report save route returns 400 for invalid JSON body",
      passed:
        route.includes("Gecersiz istek govdesi.") &&
        route.includes("Array.isArray(body)") &&
        route.includes("status: 400"),
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
