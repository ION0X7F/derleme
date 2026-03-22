"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AnalysisResultBox from "@/components/AnalysisResult";
import AppChrome from "@/components/layout/AppChrome";
import BackButton from "@/components/ui/BackButton";
import Badge from "@/components/ui/Badge";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { formatCoverageFields, getCoverageLabel } from "@/lib/coverage-utils";
import { getPlanLabel } from "@/lib/plan-label";
import { getPriceCompetitivenessLabel } from "@/lib/price-competitiveness";
import { getReadableReportTitle } from "@/lib/report-title";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { AnalysisResult, SavedReport } from "@/types";

function getReportTitle(report: SavedReport) {
  return getReadableReportTitle({
    url: report.url,
    extractedData:
      report.extractedData && typeof report.extractedData === "object"
        ? (report.extractedData as Record<string, unknown>)
        : null,
    fallback: "Kaydedilmis rapor",
  });
}

function getScoreTone(score?: number | null) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "Veri sinirli";
  }

  if (score >= 80) return "status-good";
  if (score >= 50) return "status-warn";
  return "status-danger";
}

function shapeAnalysisResult(report: SavedReport): AnalysisResult {
  const access = report.accessState
    ? {
        plan: report.accessState.plan ?? "free",
        lockedSections: report.accessState.lockedSections ?? [],
        teaserSections: report.accessState.teaserSections ?? [],
        maxFindings: report.accessState.maxFindings ?? 3,
        maxSuggestions: report.accessState.maxSuggestions ?? 3,
        maxPriorityActions: report.accessState.maxPriorityActions ?? 3,
      }
    : null;

  return {
    url: report.url,
    platform: report.platform,
    category: report.category,
    seoScore: report.seoScore,
    conversionScore: report.conversionScore ?? null,
    overallScore: report.overallScore ?? null,
    dataCompletenessScore: report.dataCompletenessScore ?? null,
    priceCompetitiveness: report.priceCompetitiveness,
    summary: report.summary,
    dataSource: report.dataSource,
    derivedMetrics: report.derivedMetrics ?? null,
    coverage: report.coverage ?? null,
    analysisTrace: report.analysisTrace ?? null,
    access,
    extractedData: report.extractedData,
    suggestions: report.suggestions ?? [],
    priorityActions: report.priorityActions ?? [],
    teaserSections:
      access?.teaserSections?.map((key) => ({
        key,
        teaser: "Bu premium bolum mevcut plan seviyesinde sinirli gorunur.",
      })) ?? null,
  };
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<SavedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setReport(data.report as SavedReport);
          return;
        }

        setError(data.error ?? "Rapor yuklenemedi.");
      })
      .catch(() => setError("Sunucuya ulasilamadi."));
  }, [id]);

  const reportTitle = report ? getReportTitle(report) : "Rapor merkezi";
  const accessPlan = report?.accessState?.plan
    ? getPlanLabel(report.accessState.plan)
    : null;
  const coverageLabel = report?.coverage?.confidence
    ? getCoverageLabel(report.coverage.confidence)
    : null;
  const shapedResult = useMemo(
    () => (report ? shapeAnalysisResult(report) : null),
    [report]
  );
  const isExportLocked =
    report?.accessState?.lockedSections?.includes("export") ?? false;

  return (
    <AppChrome
      currentPath={`/report/${id}`}
      eyebrow="Kaydedilmis rapor"
      title={reportTitle}
      description="Kaydedilen AI analizini premium karar paneli icinde tekrar ac, incele ve export akisina gec."
      navItems={getWorkspaceNav({ reportId: id })}
      headerMeta={
        <>
          {accessPlan && <span className="hero-point">{accessPlan}</span>}
          {coverageLabel && <span className="hero-point">{coverageLabel}</span>}
          {report?.priceCompetitiveness && (
            <span className="hero-point">
              {getPriceCompetitivenessLabel(report.priceCompetitiveness)}
            </span>
          )}
        </>
      }
      actions={
        <>
          <Link href="/analyze" className="btn btn-secondary">
            Yeni Analiz
          </Link>
          {report && !isExportLocked ? (
            <Link href={`/report/${report.id}/export`} className="btn btn-primary">
              PDF / Yazdir
            </Link>
          ) : (
            <Link href="/pricing" className="btn btn-primary">
              Premium Ac
            </Link>
          )}
        </>
      }
      sidebarMeta={
        <>
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Kayit bilgisi</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {report
                ? new Date(report.createdAt).toLocaleString("tr-TR")
                : "Hazirlaniyor"}
            </div>
            <p className="card-copy">
              {report?.dataSource
                ? `Veri kaynagi: ${report.dataSource}`
                : "Rapor verisi yuklenene kadar ust panel beklemede."}
            </p>
          </div>

          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Erisim seviyesi</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {accessPlan || "Plan bilgisi yok"}
            </div>
            <p className="card-copy">
              {coverageLabel
                ? `Analiz kapsami ${coverageLabel.toLowerCase()} seviyede toplandi.`
                : "Kapsam etiketi raporla birlikte gorunecek."}
            </p>
          </div>
        </>
      }
    >
      <div className="sb-stack-20">
        <BackButton onClick={() => router.back()} />

        {error && <ErrorState message={error} />}

        {!error && !report && (
          <LoadingState message="Kaydedilen analiz paneli yukleniyor..." />
        )}

        {report && shapedResult && (
          <>
            <section className="surface app-card sb-stack-20">
              <div className="section-card__header">
                <div>
                  <div className="eyebrow">Rapor ust bandi</div>
                  <h2 className="section-card__title" style={{ fontSize: 26 }}>
                    Kaydedilmis karar katmani
                  </h2>
                  <p className="section-card__text">
                    Bu ekran, tek seferlik sonucu degil; daha sonra geri donup
                    okunabilecek urunlestirilmis rapor deneyimini temsil eder.
                  </p>
                </div>

                <div className="pill-row">
                  {report.platform && <Badge>{report.platform}</Badge>}
                  {report.category && <Badge>{report.category}</Badge>}
                  {accessPlan && <Badge>{accessPlan}</Badge>}
                  {coverageLabel && <Badge>{coverageLabel}</Badge>}
                  {report.priceCompetitiveness && (
                    <Badge>{getPriceCompetitivenessLabel(report.priceCompetitiveness)}</Badge>
                  )}
                </div>
              </div>

              <div className="stat-grid">
                <article className="stat-card">
                  <div className="stat-card__label">SEO</div>
                  <div className={`stat-card__value ${getScoreTone(report.seoScore)}`}>
                    {report.seoScore ?? "--"}
                  </div>
                  <div className="stat-card__text">
                    Sayfanin kesif ve bulunurluk seviyesi.
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-card__label">Donusum</div>
                  <div
                    className={`stat-card__value ${getScoreTone(
                      report.conversionScore
                    )}`}
                  >
                    {report.conversionScore ?? "--"}
                  </div>
                  <div className="stat-card__text">
                    Ikna, teklif ve guven etkisinin toplami.
                  </div>
                </article>

                <article className="stat-card">
                  <div
                    className={`stat-card__value ${getScoreTone(report.overallScore)}`}
                  >
                    {report.overallScore ?? "--"}
                  </div>
                  <div className="stat-card__text">
                    Tum sinyallerin tek karar skorunda birlesmis gorunumu.
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-card__label">Veri butunlugu</div>
                  <div
                    className={`stat-card__value ${getScoreTone(
                      report.dataCompletenessScore
                    )}`}
                  >
                    {report.dataCompletenessScore ?? "--"}
                  </div>
                  <div className="stat-card__text">
                    Analizin ne kadar saglam veriye oturdugunu gosterir.
                  </div>
                </article>
              </div>

              <div className="section-grid-2">
                <article className="surface-soft feature-card">
                  <div className="stat-card__label">Kaynak URL</div>
                  <a
                    href={report.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mono"
                    style={{
                      color: "var(--brand-strong)",
                      lineHeight: 1.9,
                      textDecoration: "none",
                      wordBreak: "break-all",
                    }}
                  >
                    {report.url}
                  </a>
                </article>

                <article className="surface-soft feature-card">
                  <div className="stat-card__label">Kapsam ozeti</div>
                  <p className="card-copy">
                    {report.coverage?.availableFields?.length
                      ? `${report.coverage.availableFields.length} alan bulundu, ${
                          report.coverage.missingFields?.length ?? 0
                        } alan eksik kaldi.`
                      : "Bu rapor kapsami sinirli veriyle olusmus olabilir."}
                  </p>
                  {report.coverage?.availableFields?.length ? (
                    <p className="section-card__text" style={{ marginTop: 12 }}>
                      {formatCoverageFields(report.coverage.availableFields)}
                    </p>
                  ) : null}
                </article>
              </div>

              <div className="app-shell-kpis">
                <article className="app-shell-kpi">
                  <div className="app-shell-kpi__label">Durum</div>
                  <div className="app-shell-kpi__value">
                    {report.dataSource || "Kayitli"}
                  </div>
                  <div className="app-shell-kpi__text">
                    Kaydedilen rapor hangi kaynak katmanindan geldigini korur.
                  </div>
                </article>
                <article className="app-shell-kpi">
                  <div className="app-shell-kpi__label">Olusturma zamani</div>
                  <div className="app-shell-kpi__value">
                    {report
                      ? new Date(report.createdAt).toLocaleDateString("tr-TR")
                      : "--"}
                  </div>
                  <div className="app-shell-kpi__text">
                    Ekip ici takip ve rapor surekliligi icin sabit referans.
                  </div>
                </article>
                <article className="app-shell-kpi">
                  <div className="app-shell-kpi__label">Export</div>
                  <div className="app-shell-kpi__value">
                    {isExportLocked ? "Kilitli" : "Acik"}
                  </div>
                  <div className="app-shell-kpi__text">
                    Paylasim ve yazdirma akisinin mevcut erisim seviyesi.
                  </div>
                </article>
              </div>
            </section>

            <AnalysisResultBox result={shapedResult} />
          </>
        )}
      </div>
    </AppChrome>
  );
}
