import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = {
  label: string;
  passed: boolean;
};

function checkFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function run() {
  const checks: Check[] = [];
  const reportsRoute = checkFile("app/api/reports/route.ts");
  const reportsListRoute = checkFile("app/api/reports/list/route.ts");
  const reportListService = checkFile("lib/report-list-service.ts");

  checks.push({
    label: "reports route uses shared list service helper",
    passed:
      reportsRoute.includes('from "@/lib/report-list-service"') &&
      reportsRoute.includes("loadReportListForUser({"),
  });
  checks.push({
    label: "reports/list route uses shared list service helper",
    passed:
      reportsListRoute.includes('from "@/lib/report-list-service"') &&
      reportsListRoute.includes("loadReportListForUser({"),
  });
  checks.push({
    label: "reports route unauthorized response is explicit 401 with requestId",
    passed:
      reportsRoute.includes("error: \"UNAUTHORIZED\"") &&
      reportsRoute.includes("status: 401") &&
      reportsRoute.includes("requestId"),
  });
  checks.push({
    label: "shared list service parses detail mode from query",
    passed: reportListService.includes('url.searchParams.get("detail") === "full"'),
  });
  checks.push({
    label: "shared list service supports compact and full sanitization branches",
    passed:
      reportListService.includes("sanitizeStoredReportForAccess(report)") &&
      reportListService.includes("sanitizeStoredReportListItemForAccess(report)") &&
      reportListService.includes("mode: detailMode"),
  });
  const reportListQuery = checkFile("lib/report-list-query.ts");
  checks.push({
    label: "report list query uses compact/full select sets by mode",
    passed:
      reportListQuery.includes("REPORT_LIST_COMPACT_SELECT") &&
      reportListQuery.includes("REPORT_LIST_FULL_SELECT") &&
      reportListQuery.includes('params.mode === "full"'),
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
