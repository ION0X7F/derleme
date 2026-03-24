import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function run() {
  const content = read("app/api/analyze/route.ts");
  const reanalyzeContent = read("app/api/reports/[id]/reanalyze/route.ts");
  const checks: Check[] = [];

  checks.push({
    label: "analyze route builds a slim reportPreview payload",
    passed:
      /const reportPreview = savedReport[\s\S]*id:\s*savedReport\.id[\s\S]*overallScore:\s*savedReport\.overallScore/m.test(
        content
      ),
  });

  checks.push({
    label: "analyze route returns report preview instead of full db record",
    passed: /report:\s*reportPreview/m.test(content),
  });

  checks.push({
    label: "analyze route returns top-level reportId for lightweight consumers",
    passed: /reportId:\s*reportPreview\?\.id\s*\?\?\s*null/m.test(content),
  });

  checks.push({
    label: "analyze route uses shared create helper instead of direct prisma import",
    passed:
      content.includes('from "@/lib/report-detail-query"') &&
      content.includes("createAnalyzeReport") &&
      content.includes("createAnalyzeReport({") &&
      !content.includes('from "@/lib/prisma"'),
  });
  checks.push({
    label: "analyze route returns 400 INVALID_REQUEST_BODY for malformed body",
    passed:
      content.includes("INVALID_REQUEST_BODY") &&
      content.includes("Gecersiz istek govdesi.") &&
      content.includes("Array.isArray(body)"),
  });

  checks.push({
    label: "reanalyze route builds a slim reportPreview payload",
    passed:
      /const reportPreview = \{[\s\S]*id:\s*saved\.id[\s\S]*overallScore:\s*saved\.overallScore/m.test(
        reanalyzeContent
      ),
  });

  checks.push({
    label: "reanalyze route returns report preview instead of full report body",
    passed: /report:\s*reportPreview/m.test(reanalyzeContent),
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
