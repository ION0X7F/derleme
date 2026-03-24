import {
  sanitizeStoredReportForAccess,
  sanitizeStoredReportListItemForAccess,
} from "@/lib/report-access";
import { normalizePagination, parsePositiveInt } from "@/lib/pagination";
import { resolveReportHistoryLimit } from "@/lib/report-history-limit";
import { fetchReportListPage } from "@/lib/report-list-query";

const MAX_REPORT_TAKE = 100;

export type ReportListDetailMode = "compact" | "full";

export function resolveReportListDetailMode(req: Request): ReportListDetailMode {
  const url = new URL(req.url);
  return url.searchParams.get("detail") === "full" ? "full" : "compact";
}

export async function loadReportListForUser(params: {
  req: Request;
  userId: string;
}) {
  const url = new URL(params.req.url);
  const detailMode = resolveReportListDetailMode(params.req);
  const requestedTake = parsePositiveInt(url.searchParams.get("take"));
  const requestedCursor = parsePositiveInt(url.searchParams.get("cursor"));

  const historyLimit = await resolveReportHistoryLimit(params.userId);
  const { take, cursor } = normalizePagination({
    requestedTake,
    requestedCursor,
    historyLimit,
    maxTake: MAX_REPORT_TAKE,
  });

  const reports = await fetchReportListPage({
    userId: params.userId,
    take,
    cursor,
    mode: detailMode,
  });

  const sanitizedReports = reports.map((report) =>
    detailMode === "full"
      ? sanitizeStoredReportForAccess(report)
      : sanitizeStoredReportListItemForAccess(report)
  );

  return {
    detailMode,
    historyLimit,
    take,
    cursor,
    reports: sanitizedReports,
  };
}
