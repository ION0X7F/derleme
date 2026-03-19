"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/StateViews";
import { SavedReport } from "@/types";
import { getReadableReportTitle } from "@/lib/report-title";
import { getPriceCompetitivenessLabel } from "@/lib/price-competitiveness";
import {
  getCompetitorPressureLabel,
  getCompetitorSummaryLabel,
} from "@/lib/competitor-summary";

type Props = {
  reports: SavedReport[];
};

function getPlanBadge(plan?: string | null) {
  if (!plan) {
    return {
      label: "Paket yok",
      color: "var(--text-muted)",
      background: "color-mix(in srgb, var(--surface-soft) 100%, transparent)",
      border: "var(--line)",
    };
  }

  if (plan === "pro" || plan === "PREMIUM" || plan === "PRO") {
    return {
      label: "Pro",
      color: "var(--brand-strong)",
      background: "color-mix(in srgb, var(--brand) 10%, transparent)",
      border: "color-mix(in srgb, var(--brand) 24%, transparent)",
    };
  }

  if (plan === "enterprise" || plan === "ENTERPRISE") {
    return {
      label: "Enterprise",
      color: "#facc15",
      background: "rgba(250,204,21,0.10)",
      border: "rgba(250,204,21,0.18)",
    };
  }

  if (plan === "guest" || plan === "GUEST") {
    return {
      label: "Guest",
      color: "var(--accent)",
      background: "color-mix(in srgb, var(--accent) 10%, transparent)",
      border: "color-mix(in srgb, var(--accent) 24%, transparent)",
    };
  }

  return {
    label: "Free",
    color: "var(--text-soft)",
    background: "color-mix(in srgb, var(--surface-soft) 100%, transparent)",
    border: "var(--line)",
  };
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function getDomainLabel(url: string) {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    const parts = hostname.split(".");
    return parts[0]
      ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
      : "Platform";
  } catch {
    return "Platform";
  }
}

function getReadableTitle(report: SavedReport) {
  return getReadableReportTitle({
    url: report.url,
    extractedData:
      report.extractedData && typeof report.extractedData === "object"
        ? (report.extractedData as Record<string, unknown>)
        : null,
    fallback: "Analiz edilen urun",
  });
}

function buildSignalBadges(report: SavedReport) {
  const extracted = report.extractedData;
  if (!extracted) return [];

  const badges: string[] = [];

  if (extracted.has_free_shipping === true) {
    badges.push("Ucretsiz kargo");
  }

  if (extracted.has_return_info === true) {
    badges.push("Iade bilgisi");
  }

  if (extracted.has_shipping_info === true) {
    badges.push("Kargo bilgisi");
  }

  if (extracted.official_seller === true) {
    badges.push("Resmi satici");
  }

  if (Array.isArray(extracted.seller_badges) && extracted.seller_badges.length > 0) {
    badges.push(extracted.seller_badges[0]);
  }

  if (typeof extracted.seller_score === "number" && extracted.seller_score >= 8.5) {
    badges.push(
      `Satici puani ${extracted.seller_score.toLocaleString("tr-TR", {
        minimumFractionDigits: extracted.seller_score % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
      })}`
    );
  }

  if (typeof extracted.other_sellers_count === "number" && extracted.other_sellers_count >= 2) {
    badges.push(`${extracted.other_sellers_count} diger satici`);
  }

  if (
    extracted.other_sellers_summary &&
    typeof extracted.other_sellers_summary === "object"
  ) {
    const pressure = getCompetitorPressureLabel(extracted.other_sellers_summary);
    if (pressure) {
      badges.push(pressure);
    }
  }

  if (typeof extracted.campaign_label === "string" && extracted.campaign_label.trim()) {
    badges.push(extracted.campaign_label.trim());
  }

  return badges.slice(0, 4);
}

function getCoverageBadge(confidence?: "high" | "medium" | "low" | null) {
  if (confidence === "high") {
    return {
      label: "Yuksek kapsam",
      color: "var(--success)",
      background: "color-mix(in srgb, var(--success) 10%, transparent)",
      border: "color-mix(in srgb, var(--success) 24%, transparent)",
    };
  }

  if (confidence === "medium") {
    return {
      label: "Orta kapsam",
      color: "var(--warning)",
      background: "color-mix(in srgb, var(--warning) 10%, transparent)",
      border: "color-mix(in srgb, var(--warning) 24%, transparent)",
    };
  }

  return {
    label: "Sinirli kapsam",
    color: "var(--danger)",
    background: "color-mix(in srgb, var(--danger) 10%, transparent)",
    border: "color-mix(in srgb, var(--danger) 24%, transparent)",
  };
}

function getTone(score?: number | null, label = "Skor") {
  if (score == null) {
    return {
      text: `${label}: -`,
      color: "var(--warning)",
      background: "color-mix(in srgb, var(--warning) 10%, transparent)",
      border: "color-mix(in srgb, var(--warning) 24%, transparent)",
    };
  }

  if (score >= 80) {
    return {
      text: `${label}: ${score}/100`,
      color: "var(--success)",
      background: "color-mix(in srgb, var(--success) 10%, transparent)",
      border: "color-mix(in srgb, var(--success) 24%, transparent)",
    };
  }

  if (score >= 50) {
    return {
      text: `${label}: ${score}/100`,
      color: "var(--warning)",
      background: "color-mix(in srgb, var(--warning) 10%, transparent)",
      border: "color-mix(in srgb, var(--warning) 24%, transparent)",
    };
  }

  return {
    text: `${label}: ${score}/100`,
    color: "var(--danger)",
    background: "color-mix(in srgb, var(--danger) 10%, transparent)",
    border: "color-mix(in srgb, var(--danger) 24%, transparent)",
  };
}

function getScoreClass(score?: number | null) {
  if (typeof score !== "number") return "";
  if (score >= 80) return "status-good";
  if (score >= 50) return "status-warn";
  return "status-danger";
}

export default function ReportHistory({ reports }: Props) {
  if (!reports.length) {
    return <EmptyState message="Henuz kayitli rapor yok. Ilk Trendyol analizinden sonra kutuphanen burada olusacak." />;
  }

  return (
    <div className="library-grid">
      {reports.map((report) => {
        const title = getReadableTitle(report);
        const seo = getTone(report.seoScore, "SEO");
        const overall = getTone(report.overallScore, "Genel");
        const platformLabel = report.platform || getDomainLabel(report.url);
        const categoryLabel = report.category || "Genel";
        const planBadge = getPlanBadge(report.accessState?.plan);
        const lockedCount = report.accessState?.lockedSections?.length ?? 0;
        const signalBadges = buildSignalBadges(report);
        const coverageBadge = getCoverageBadge(report.coverage?.confidence);
        const completeness = getTone(report.dataCompletenessScore, "Veri");

        return (
          <article key={report.id} className="surface app-card surface-hover library-card">
            <div className="sb-stack-16">
              <div className="library-card__meta">
                <div className="sb-stack-8" style={{ minWidth: 0, flex: 1 }}>
                  <div className="eyebrow">Kayitli rapor</div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 22,
                      lineHeight: 1.45,
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {title}
                  </h3>
                  <p className="card-copy" style={{ margin: 0 }}>
                    {platformLabel} | {categoryLabel} | {formatDate(report.createdAt)}
                  </p>
                </div>

                <Link href={`/reports/${report.id}`} className="btn btn-primary">
                  Detayi Gor
                </Link>
              </div>

              <div className="library-card__metrics">
                <div className="library-card__metric">
                  <div className="library-card__metric-label">SEO</div>
                  <div className={`library-card__metric-value ${getScoreClass(report.seoScore)}`}>
                    {report.seoScore ?? "--"}
                  </div>
                  <div className="library-card__metric-text">
                    Kesif sinyal seviyesi
                  </div>
                </div>
                <div className="library-card__metric">
                  <div className="library-card__metric-label">Genel</div>
                  <div className={`library-card__metric-value ${getScoreClass(report.overallScore)}`}>
                    {report.overallScore ?? "--"}
                  </div>
                  <div className="library-card__metric-text">
                    Tek karar skoru
                  </div>
                </div>
                <div className="library-card__metric">
                  <div className="library-card__metric-label">Veri</div>
                  <div className={`library-card__metric-value ${getScoreClass(report.dataCompletenessScore)}`}>
                    {report.dataCompletenessScore ?? "--"}
                  </div>
                  <div className="library-card__metric-text">
                    Analiz guven seviyesi
                  </div>
                </div>
              </div>

              <div className="pill-row">
                {[
                  seo,
                  overall,
                  completeness,
                  {
                    text: `Paket: ${planBadge.label}`,
                    color: planBadge.color,
                    background: planBadge.background,
                    border: planBadge.border,
                  },
                  {
                    text: coverageBadge.label,
                    color: coverageBadge.color,
                    background: coverageBadge.background,
                    border: coverageBadge.border,
                  },
                ].map((item) => (
                  <span
                    key={item.text}
                    className="hero-point"
                    style={{
                      color: item.color,
                      background: item.background,
                      borderColor: item.border,
                    }}
                  >
                    {item.text}
                  </span>
                ))}

                {report.priceCompetitiveness && (
                  <span className="hero-point">
                    {getPriceCompetitivenessLabel(report.priceCompetitiveness)}
                  </span>
                )}

                {report.extractedData?.other_sellers_summary && (
                  <span className="hero-point">
                    {getCompetitorSummaryLabel(report.extractedData.other_sellers_summary)}
                  </span>
                )}

                {lockedCount > 0 && (
                  <span className="hero-point status-warn">
                    {lockedCount} kilitli bolum
                  </span>
                )}
              </div>

              {signalBadges.length > 0 && (
                <div className="pill-row">
                  {signalBadges.map((badge) => (
                    <span key={badge} className="hero-point">
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

