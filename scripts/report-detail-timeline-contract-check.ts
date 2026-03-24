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
  const reportDetailRoute = read("app/api/reports/[id]/route.ts");
  const exportPage = read("app/reports/[id]/export/page.tsx");
  const detailQuery = read("lib/report-detail-query.ts");

  const checks: Check[] = [
    {
      label: "report detail route supports timeline query switch",
      passed:
        reportDetailRoute.includes('searchParams.get("timeline") !== "0"') &&
        reportDetailRoute.includes("const includeTimeline"),
    },
    {
      label: "report detail route conditionally executes timeline query",
      passed:
        reportDetailRoute.includes("const relatedReports = includeTimeline") &&
        reportDetailRoute.includes("fetchReportTimelineForUser({") &&
        reportDetailRoute.includes(": [];"),
    },
    {
      label: "report detail route only includes timeline field when requested",
      passed:
        reportDetailRoute.includes("if (includeTimeline)") &&
        reportDetailRoute.includes("responsePayload.timeline ="),
    },
    {
      label: "report export page requests detail without timeline",
      passed: exportPage.includes("`/api/reports/${id}?timeline=0`"),
    },
    {
      label: "report detail query defines dedicated timeline select/helper",
      passed:
        detailQuery.includes("REPORT_TIMELINE_SELECT") &&
        detailQuery.includes("fetchReportTimelineForUser"),
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
