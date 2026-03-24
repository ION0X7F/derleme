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
  const detailQuery = read("lib/report-detail-query.ts");
  const reanalyzeRoute = read("app/api/reports/[id]/reanalyze/route.ts");

  const checks: Check[] = [
    {
      label: "reanalyze base select is explicitly defined",
      passed: detailQuery.includes("export const REPORT_REANALYZE_BASE_SELECT ="),
    },
    {
      label: "reanalyze base helper uses dedicated select",
      passed:
        detailQuery.includes("fetchReportReanalyzeBaseForUser") &&
        detailQuery.includes("select: REPORT_REANALYZE_BASE_SELECT"),
    },
    {
      label: "reanalyze route uses shared base fetch helper",
      passed:
        reanalyzeRoute.includes('from "@/lib/report-detail-query"') &&
        reanalyzeRoute.includes("fetchReportReanalyzeBaseForUser({"),
    },
    {
      label: "reanalyze route uses shared create helper",
      passed:
        reanalyzeRoute.includes("createReanalyzeReport") &&
        reanalyzeRoute.includes("createReanalyzeReport({"),
    },
    {
      label: "reanalyze route no longer directly imports prisma",
      passed: !reanalyzeRoute.includes('from "@/lib/prisma"'),
    },
    {
      label: "reanalyze create helper uses prisma in shared query module",
      passed:
        detailQuery.includes("createReanalyzeReport") &&
        detailQuery.includes("prisma.report.create"),
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
