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
  const detailRoute = read("app/api/reports/[id]/route.ts");
  const exportRoute = read("app/api/reports/[id]/export/route.ts");

  const checks: Check[] = [
    {
      label: "report detail query defines REPORT_DETAIL_SELECT",
      passed: detailQuery.includes("export const REPORT_DETAIL_SELECT ="),
    },
    {
      label: "report detail query uses select in fetch helper",
      passed:
        detailQuery.includes("fetchReportDetailForUser") &&
        detailQuery.includes("select: REPORT_DETAIL_SELECT"),
    },
    {
      label: "report detail route uses shared fetch helper",
      passed:
        detailRoute.includes('from "@/lib/report-detail-query"') &&
        detailRoute.includes("fetchReportDetailForUser({"),
    },
    {
      label: "report export route uses shared fetch helper",
      passed:
        exportRoute.includes('from "@/lib/report-detail-query"') &&
        exportRoute.includes("fetchReportExportForUser({"),
    },
    {
      label: "report detail query defines dedicated export select",
      passed:
        detailQuery.includes("export const REPORT_EXPORT_SELECT =") &&
        detailQuery.includes("select: REPORT_EXPORT_SELECT"),
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
