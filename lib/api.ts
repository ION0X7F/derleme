import { AnalysisResult, SavedReport } from "@/types";

type FetchReportsResult = {
  reports: SavedReport[];
  historyLimit: number | null;
};

export async function analyzeUrl(url: string): Promise<AnalysisResult> {
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

  return data.result;
}

export async function fetchReports(): Promise<FetchReportsResult> {
  const res = await fetch("/api/reports", {
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
    };
  }

  if (data && typeof data === "object" && Array.isArray(data.reports)) {
    return {
      reports: data.reports as SavedReport[],
      historyLimit:
        typeof data.historyLimit === "number" ? data.historyLimit : null,
    };
  }

  return {
    reports: [],
    historyLimit: null,
  };
}
