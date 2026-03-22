"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { parseAnalysisSummary } from "@/lib/analysis-summary";
import { getCoverageLabel } from "@/lib/coverage-utils";
import { getPlanLabel } from "@/lib/plan-label";
import { getPriceCompetitivenessLabel } from "@/lib/price-competitiveness";
import { getReadableReportTitle } from "@/lib/report-title";
import { SavedReport } from "@/types";

function getReportTitle(report: SavedReport) {
  return getReadableReportTitle({
    url: report.url,
    extractedData:
      report.extractedData && typeof report.extractedData === "object"
        ? (report.extractedData as Record<string, unknown>)
        : null,
    fallback: "SellBoost AI raporu",
  });
}

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function formatPriceDelta(delta?: number | null) {
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
    return "Ayni fiyat";
  }

  const abs = formatCurrency(Math.abs(delta));
  if (!abs) return null;
  return delta < 0 ? `${abs} daha ucuz` : `${abs} daha pahali`;
}

function formatTraceThemeLabel(value?: SavedReport["analysisTrace"] extends infer T
  ? T extends { primaryTheme?: infer Theme }
    ? Theme
    : never
  : never) {
  switch (value) {
    case "stock":
      return "Stok bariyeri";
    case "price":
      return "Fiyat baskisi";
    case "delivery":
      return "Teslimat bariyeri";
    case "content":
      return "Icerik iknasi";
    case "visual":
      return "Gorsel vitrin";
    case "trust":
      return "Guven bariyeri";
    case "reviews":
      return "Yorum surtunmesi";
    case "faq":
      return "Soru-cevap bariyeri";
    case "campaign":
      return "Kampanya farki";
    case "mixed":
      return "Karma tema";
    default:
      return null;
  }
}

function formatTraceModeLabel(value?: SavedReport["analysisTrace"] extends infer T
  ? T extends { mode?: infer Mode }
    ? Mode
    : never
  : never) {
  if (value === "ai_enriched") return "AI destekli";
  if (value === "deterministic") return "Deterministik";
  return null;
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "170px 1fr",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid rgba(15,23,42,0.08)",
      }}
    >
      <div
        style={{
          color: "#475467",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ color: "#101828", fontSize: 14, lineHeight: 1.8 }}>{value}</div>
    </div>
  );
}

function PaperSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 24,
        padding: 24,
        background: "#FFFFFF",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          color: "#101828",
          fontSize: 22,
          lineHeight: 1.08,
          letterSpacing: "-0.04em",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function ReportExportPage() {
  const { id } = useParams<{ id: string }>();
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

  if (error) {
    return (
      <div className="sb-shell">
        <main className="sb-page">
          <div className="sb-container">
            <div className="state-card state-card--error">
              <div className="state-card__icon">ERR</div>
              <h1 className="state-card__title">Export hazirlanamadi</h1>
              <p className="state-card__text">{error}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="sb-shell">
        <main className="sb-page">
          <div className="sb-container">
            <div className="state-card state-card--loading">
              <div className="state-card__icon">
                <div className="spinner" />
              </div>
              <h1 className="state-card__title">Export dosyasi hazirlaniyor</h1>
              <p className="state-card__text">PDF gorunumu olusturuluyor.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const lockedSections = report.accessState?.lockedSections ?? [];
  if (lockedSections.includes("export")) {
    return (
      <div className="sb-shell">
        <main className="sb-page">
          <div className="sb-container">
            <div className="state-card state-card--empty">
              <div className="state-card__icon">PRO</div>
              <h1 className="state-card__title">Export kilitli</h1>
              <p className="state-card__text">
                Bu raporun yazdirma ve PDF gorunumu mevcut plan seviyesinde kapali.
              </p>
              <div className="inline-actions">
                <Link href="/dashboard" className="btn btn-secondary">
                  Dashboard&apos;a Don
                </Link>
                <Link href="/pricing" className="btn btn-primary">
                  Premium Ac
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const reportTitle = getReportTitle(report);
  const extracted = (report.extractedData ?? {}) as NonNullable<
    SavedReport["extractedData"]
  >;
  const parsedSummary = parseAnalysisSummary(report.summary);
  const analysisTrace = report.analysisTrace ?? null;

  return (
    <>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: #ffffff !important;
          }

          .print-paper {
            box-shadow: none !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div className="sb-shell">
        <main className="sb-page">
          <div className="sb-container sb-stack-20">
            <div className="surface app-card no-print">
              <div className="section-card__header">
                <div>
                  <div className="eyebrow">Export merkezi</div>
                  <h1 className="section-card__title" style={{ fontSize: 28 }}>
                    Yazdirilabilir rapor dosyasi
                  </h1>
                  <p className="section-card__text">
                    Ekip ici paylasim ve PDF ciktilari icin sade ama premium rapor duzeni.
                  </p>
                </div>

                <div className="inline-actions">
                  <button onClick={() => window.print()} className="btn btn-primary">
                    Yazdir / PDF
                  </button>
                  <Link href={`/report/${report.id}`} className="btn btn-secondary">
                    Raporu Ac
                  </Link>
                </div>
              </div>
            </div>

            <article
              className="print-paper"
              style={{
                maxWidth: 1040,
                margin: "0 auto",
                borderRadius: 32,
                background: "#F8FAFC",
                border: "1px solid rgba(148,163,184,0.18)",
                boxShadow: "0 28px 80px rgba(2,6,23,0.24)",
                padding: 28,
              }}
            >
              <section
                style={{
                  padding: 28,
                  borderRadius: 28,
                  background:
                    "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))",
                  color: "#F8FAFC",
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ maxWidth: 720 }}>
                    <div
                      style={{
                        color: "#CBD5E1",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        marginBottom: 12,
                      }}
                    >
                      SellBoost AI report dossier
                    </div>
                    <h1
                      style={{
                        margin: 0,
                        fontSize: "clamp(32px, 5vw, 48px)",
                        lineHeight: 1.02,
                        letterSpacing: "-0.06em",
                      }}
                    >
                      {reportTitle}
                    </h1>
                    <p
                      style={{
                        margin: "14px 0 0",
                        color: "#CBD5E1",
                        fontSize: 15,
                        lineHeight: 1.9,
                      }}
                    >
                      Kaydedilen analiz, karar verme ve sunum ihtiyaci icin rapor
                      dosyasina donusturuldu.
                    </p>
                  </div>

                  <div style={{ display: "grid", gap: 10, minWidth: 220 }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 999,
                        background: "rgba(148,163,184,0.14)",
                        border: "1px solid rgba(148,163,184,0.18)",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {new Date(report.createdAt).toLocaleString("tr-TR")}
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 999,
                        background: "rgba(148,163,184,0.14)",
                        border: "1px solid rgba(148,163,184,0.18)",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {report.dataSource || "Veri kaynagi belirtilmedi"}
                    </div>
                  </div>
                </div>
              </section>

              <div className="stat-grid" style={{ marginBottom: 24 }}>
                {[
                  ["SEO", report.seoScore],
                  ["Donusum", report.conversionScore],
                  ["Genel skor", report.overallScore],
                  ["Veri butunlugu", report.dataCompletenessScore],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: 18,
                      borderRadius: 20,
                      border: "1px solid rgba(15,23,42,0.08)",
                      background: "#FFFFFF",
                    }}
                  >
                    <div className="stat-card__label" style={{ color: "#667085" }}>
                      {label}
                    </div>
                    <div
                      style={{
                        color: "#101828",
                        fontSize: 34,
                        fontWeight: 800,
                        letterSpacing: "-0.06em",
                      }}
                    >
                      {typeof value === "number" ? value : "--"}
                    </div>
                  </div>
                ))}
              </div>

              <div className="section-grid-2">
                <PaperSection title="Yonetici ozeti">
                  <Row label="URL" value={report.url} />
                  <Row label="Platform" value={report.platform} />
                  <Row label="Kategori" value={report.category} />
                  <Row
                    label="Plan"
                    value={
                      report.accessState?.plan
                        ? getPlanLabel(report.accessState.plan)
                        : null
                    }
                  />
                  <Row
                    label="Kapsam"
                    value={
                      report.coverage?.confidence
                        ? getCoverageLabel(report.coverage.confidence)
                        : null
                    }
                  />
                  <Row
                    label="Fiyat rekabeti"
                    value={getPriceCompetitivenessLabel(report.priceCompetitiveness)}
                  />
                </PaperSection>

                <PaperSection title="Cekilen ana veriler">
                  <Row
                    label="Baslik"
                    value={typeof extracted.title === "string" ? extracted.title : null}
                  />
                  <Row
                    label="Fiyat"
                    value={typeof extracted.price === "string" ? extracted.price : null}
                  />
                  <Row
                    label="Normalize fiyat"
                    value={formatCurrency(extracted.normalized_price)}
                  />
                  <Row
                    label="Eski fiyat"
                    value={formatCurrency(extracted.original_price)}
                  />
                  <Row
                    label="Satici"
                    value={
                      typeof extracted.seller_name === "string"
                        ? extracted.seller_name
                        : null
                    }
                  />
                  <Row
                    label="Satici puani"
                    value={
                      typeof extracted.seller_score === "number"
                        ? String(extracted.seller_score)
                        : null
                    }
                  />
                  <Row
                    label="Yorum"
                    value={
                      typeof extracted.review_count === "number"
                        ? `${extracted.review_count} yorum`
                        : null
                    }
                  />
                  <Row
                    label="Yildiz dagilimi"
                    value={
                      extracted.rating_breakdown
                        ? [
                            extracted.rating_breakdown.five_star != null
                              ? `5* ${extracted.rating_breakdown.five_star}`
                              : null,
                            extracted.rating_breakdown.four_star != null
                              ? `4* ${extracted.rating_breakdown.four_star}`
                              : null,
                            extracted.rating_breakdown.three_star != null
                              ? `3* ${extracted.rating_breakdown.three_star}`
                              : null,
                            extracted.rating_breakdown.two_star != null
                              ? `2* ${extracted.rating_breakdown.two_star}`
                              : null,
                            extracted.rating_breakdown.one_star != null
                              ? `1* ${extracted.rating_breakdown.one_star}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : null
                    }
                  />
                </PaperSection>
              </div>

              {(parsedSummary.hasStructuredSummary || parsedSummary.raw) && (
                <PaperSection title="Karar ozeti">
                  {parsedSummary.hasStructuredSummary ? (
                    <div style={{ display: "grid", gap: 14 }}>
                      {parsedSummary.criticalDiagnosis && (
                        <div>
                          <div className="stat-card__label">Kritik teshis</div>
                          <p className="card-copy" style={{ color: "#475467" }}>
                            {parsedSummary.criticalDiagnosis}
                          </p>
                        </div>
                      )}

                      {parsedSummary.dataCollision && (
                        <div>
                          <div className="stat-card__label">Veri carpistirma</div>
                          <p className="card-copy" style={{ color: "#475467" }}>
                            {parsedSummary.dataCollision}
                          </p>
                        </div>
                      )}

                      {parsedSummary.strategicRecipe.length > 0 && (
                        <div>
                          <div className="stat-card__label">Stratejik recete</div>
                          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                            {parsedSummary.strategicRecipe.map((item, index) => (
                              <div key={`${item}-${index}`} className="card-copy" style={{ color: "#475467" }}>
                                {index + 1}. {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {parsedSummary.systemLearning && (
                        <div>
                          <div className="stat-card__label">Sistem ogrenisi</div>
                          <p className="card-copy" style={{ color: "#475467" }}>
                            {parsedSummary.systemLearning}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="card-copy" style={{ color: "#475467" }}>
                      {parsedSummary.raw}
                    </p>
                  )}
                </PaperSection>
              )}

              {analysisTrace && (
                <PaperSection title="Karar izi">
                  <Row
                    label="Karar modu"
                    value={formatTraceModeLabel(analysisTrace.mode)}
                  />
                  <Row
                    label="Ana tema"
                    value={formatTraceThemeLabel(analysisTrace.primaryTheme)}
                  />
                  <Row label="Ana teshis" value={analysisTrace.primaryDiagnosis} />
                  <Row
                    label="Kapsam guveni"
                    value={analysisTrace.confidence}
                  />

                  {analysisTrace.topSignals?.length ? (
                    <div style={{ marginTop: 16 }}>
                      <div className="stat-card__label">Tetikleyici sinyaller</div>
                      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                        {analysisTrace.topSignals.map((item, index) => (
                          <div
                            key={`${item.key || item.label || "signal"}-${index}`}
                            className="card-copy"
                            style={{ color: "#475467" }}
                          >
                            {item.label}: {item.detail}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {analysisTrace.recommendedFocus?.length ? (
                    <div style={{ marginTop: 16 }}>
                      <div className="stat-card__label">Odak rotasi</div>
                      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                        {analysisTrace.recommendedFocus.map((item, index) => (
                          <div
                            key={`${item}-${index}`}
                            className="card-copy"
                            style={{ color: "#475467" }}
                          >
                            {index + 1}. {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {analysisTrace.decisionFlow?.length ? (
                    <div style={{ marginTop: 16 }}>
                      <div className="stat-card__label">Karar akisi</div>
                      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                        {analysisTrace.decisionFlow.map((item, index) => (
                          <div
                            key={`${item.key || item.title || "flow"}-${index}`}
                            className="card-copy"
                            style={{ color: "#475467" }}
                          >
                            {item.title}: {item.detail}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </PaperSection>
              )}

              {(report.priorityActions?.length || report.suggestions?.length) && (
                <div className="section-grid-2" style={{ marginTop: 18 }}>
                  {report.priorityActions?.length ? (
                    <PaperSection title="Oncelikli aksiyonlar">
                      <div style={{ display: "grid", gap: 12 }}>
                        {report.priorityActions.map((item) => (
                          <div
                            key={`${item.priority}-${item.title}`}
                            style={{
                              border: "1px solid rgba(15,23,42,0.08)",
                              borderRadius: 18,
                              padding: 16,
                              background: "#FFFFFF",
                            }}
                          >
                            <div className="stat-card__label" style={{ color: "#F97316" }}>
                              Oncelik {item.priority}
                            </div>
                            <div className="card-heading" style={{ color: "#101828" }}>
                              {item.title}
                            </div>
                            <p className="card-copy" style={{ color: "#475467" }}>
                              {item.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </PaperSection>
                  ) : null}

                  {report.suggestions?.length ? (
                    <PaperSection title="AI onerileri">
                      <div style={{ display: "grid", gap: 12 }}>
                        {report.suggestions.map((item) => (
                          <div
                            key={`${item.title}-${item.detail}`}
                            style={{
                              border: "1px solid rgba(15,23,42,0.08)",
                              borderRadius: 18,
                              padding: 16,
                              background: "#FFFFFF",
                            }}
                          >
                            <div className="card-heading" style={{ color: "#101828" }}>
                              {item.title}
                            </div>
                            <p className="card-copy" style={{ color: "#475467" }}>
                              {item.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </PaperSection>
                  ) : null}
                </div>
              )}

              {extracted.other_seller_offers?.length ? (
                <div style={{ marginTop: 18 }}>
                  <PaperSection title="Rakip teklifleri">
                    <div className="section-grid-2">
                      {extracted.other_seller_offers.slice(0, 8).map((offer, index) => {
                        const ownPrice =
                          typeof extracted.normalized_price === "number"
                            ? extracted.normalized_price
                            : null;
                        const delta =
                          ownPrice != null && typeof offer.price === "number"
                            ? offer.price - ownPrice
                            : null;
                        const tone =
                          delta == null || delta === 0
                            ? {
                                color: "#c26b00",
                                background: "rgba(194,107,0,0.08)",
                                border: "rgba(194,107,0,0.18)",
                                arrow: "->",
                              }
                            : delta < 0
                              ? {
                                  color: "#157f4c",
                                  background: "rgba(21,127,76,0.08)",
                                  border: "rgba(21,127,76,0.18)",
                                  arrow: "v",
                                }
                              : {
                                  color: "#b42318",
                                  background: "rgba(180,35,24,0.08)",
                                  border: "rgba(180,35,24,0.18)",
                                  arrow: "^",
                                };

                        return (
                          <div
                            key={`${offer.seller_name}-${index}`}
                            style={{
                              border: "1px solid rgba(15,23,42,0.08)",
                              borderRadius: 18,
                              padding: 16,
                              background: "#FFFFFF",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 10,
                                marginBottom: 10,
                              }}
                            >
                              <div>
                                <div className="card-heading" style={{ color: "#101828" }}>
                                  {offer.seller_name || "Satici"}
                                </div>
                                <p className="card-copy" style={{ color: "#475467" }}>
                                  {[
                                    typeof offer.seller_score === "number"
                                      ? `${offer.seller_score} puan`
                                      : null,
                                    offer.has_fast_delivery ? "Hizli teslimat" : null,
                                    offer.has_free_shipping ? "Ucretsiz kargo" : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" | ") || "Ek teklif sinyali sinirli"}
                                </p>
                              </div>

                              <div
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 999,
                                  background: tone.background,
                                  color: tone.color,
                                  border: `1px solid ${tone.border}`,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {tone.arrow} {formatPriceDelta(delta)}
                              </div>
                            </div>

                            <div
                              style={{
                                color: "#101828",
                                fontSize: 26,
                                fontWeight: 800,
                                letterSpacing: "-0.04em",
                              }}
                            >
                              {formatCurrency(offer.price) || "Fiyat yok"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </PaperSection>
                </div>
              ) : null}
            </article>
          </div>
        </main>
      </div>
    </>
  );
}
