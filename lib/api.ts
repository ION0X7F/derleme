import { AnalysisResult, SavedReport } from "@/types";

type FetchReportsResult = {
  reports: SavedReport[];
  historyLimit: number | null;
  paging?: {
    cursor: number;
    take: number;
    nextCursor: number | null;
  } | null;
  requestId?: string | null;
};

type FetchReportsOptions = {
  detail?: "compact" | "full";
};

export type AnalyzeUrlResponse = {
  result: AnalysisResult;
  requestId?: string | null;
  reportId?: string | null;
  report?: {
    id: string;
    url: string;
    overallScore: number | null;
    createdAt: string;
  } | null;
  usage?: {
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
    periodKey: string;
    periodType: string;
  } | null;
  autoSaved?: boolean;
};

export type ReportTimelineEntry = {
  id: string;
  createdAt: string;
  overallScore: number | null;
  dataSource: string | null;
  generation: number;
  trigger: string | null;
  previousReportId: string | null;
  rootReportId: string | null;
  isCurrent: boolean;
};

export type FetchReportDetailResponse = {
  report: SavedReport;
  timeline: ReportTimelineEntry[];
  requestId?: string | null;
};

export async function analyzeUrl(url: string): Promise<AnalyzeUrlResponse> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.detail || data.message || data.error || "Analiz basarisiz."
    );
  }

  return {
    result: data.result,
    requestId: data.requestId ?? null,
    reportId: data.reportId ?? null,
    report: data.report ?? null,
    usage: data.usage ?? null,
    autoSaved: data.autoSaved ?? false,
  };
}

export async function fetchReports(
  options?: FetchReportsOptions
): Promise<FetchReportsResult> {
  const detail = options?.detail === "full" ? "full" : "compact";

  const res = await fetch(`/api/reports?detail=${detail}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.detail || data.message || data.error || "Raporlar yuklenemedi."
    );
  }

  if (Array.isArray(data)) {
    return {
      reports: data,
      historyLimit: null,
      paging: null,
      requestId: null,
    };
  }

  if (data && typeof data === "object" && Array.isArray(data.reports)) {
    return {
      reports: data.reports as SavedReport[],
      historyLimit:
        typeof data.historyLimit === "number" ? data.historyLimit : null,
      paging:
        data.paging && typeof data.paging === "object"
          ? {
              cursor:
                typeof data.paging.cursor === "number" ? data.paging.cursor : 0,
              take: typeof data.paging.take === "number" ? data.paging.take : 0,
              nextCursor:
                typeof data.paging.nextCursor === "number"
                  ? data.paging.nextCursor
                  : null,
            }
          : null,
      requestId:
        typeof data.requestId === "string" ? data.requestId : null,
    };
  }

  return {
    reports: [],
    historyLimit: null,
    paging: null,
    requestId: null,
  };
}

export async function fetchReportDetail(id: string): Promise<FetchReportDetailResponse> {
  const res = await fetch(`/api/reports/${id}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.detail || data.message || data.error || "Rapor detayi yuklenemedi."
    );
  }

  return {
    report: data.report as SavedReport,
    timeline: Array.isArray(data.timeline)
      ? (data.timeline as ReportTimelineEntry[])
      : [],
    requestId: typeof data.requestId === "string" ? data.requestId : null,
  };
}
