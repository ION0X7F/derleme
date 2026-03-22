"use client";

import { useMemo, useState } from "react";
import ReportHistory from "@/components/ReportHistory";
import { EmptyState } from "@/components/ui/StateViews";
import { getReadableReportTitle } from "@/lib/report-title";
import type { SavedReport } from "@/types";

type Props = {
  reports: SavedReport[];
  historyLimit?: number | null;
};

function getSearchableText(report: SavedReport) {
  return [
    getReadableReportTitle({
      url: report.url,
      extractedData:
        report.extractedData && typeof report.extractedData === "object"
          ? (report.extractedData as Record<string, unknown>)
          : null,
      fallback: "Kayitli rapor",
    }),
    report.url,
    report.platform,
    report.category,
    report.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

export default function ReportsExplorer({ reports, historyLimit }: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "high" | "attention">("all");

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    return reports.filter((report) => {
      if (normalizedQuery && !getSearchableText(report).includes(normalizedQuery)) {
        return false;
      }

      if (mode === "high") {
        return typeof report.overallScore === "number" && report.overallScore >= 80;
      }

      if (mode === "attention") {
        return typeof report.overallScore === "number" && report.overallScore < 60;
      }

      return true;
    });
  }, [mode, query, reports]);

  return (
    <div className="sb-stack-16">
      <div className="reports-toolbar">
        <label className="form-label">
          <span>Rapor ara</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input"
            placeholder="Urun adi, kategori, URL veya ozet ile ara"
          />
        </label>

        <label className="form-label">
          <span>Gorunum</span>
          <select
            className="select"
            value={mode}
            onChange={(event) => setMode(event.target.value as "all" | "high" | "attention")}
          >
            <option value="all">Tum raporlar</option>
            <option value="high">Yuksek skorlular</option>
            <option value="attention">Aksiyon gerekenler</option>
          </select>
        </label>
      </div>

      <div className="pill-row">
        <span className="hero-point">{filteredReports.length} rapor gorunuyor</span>
        {typeof historyLimit === "number" && (
          <span className="hero-point">Plan limiti: son {historyLimit} rapor</span>
        )}
      </div>

      {filteredReports.length === 0 ? (
        <EmptyState message="Aradigin filtrede rapor bulunamadi. Farkli bir anahtar kelime veya gorunum secmeyi dene." />
      ) : (
        <ReportHistory reports={filteredReports} />
      )}
    </div>
  );
}
