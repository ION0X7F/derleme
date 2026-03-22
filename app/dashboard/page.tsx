import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LogoutButton from "@/app/components/LogoutButton";
import AppChrome from "@/components/layout/AppChrome";
import * as DashboardCharts from "@/components/DashboardCharts";
import ReportHistory from "@/components/ReportHistory";
import { parseAnalysisSummary } from "@/lib/analysis-summary";
import { campaignContent, getWorkspacePlanSummary } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { prepareSavedReportForClient } from "@/lib/report-access";
import {
  getEffectivePlanVariantFromRecord,
  hasEntitledSubscription,
} from "@/lib/user-membership";
import { getMonthlyPeriodKey } from "@/lib/usage";
import { getUsageStatus } from "@/lib/usage-status";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import type { SavedReport } from "@/types";

function getThemeLabel(theme?: string | null) {
  const map: Record<string, string> = {
    delivery: "Teslimat", price: "Fiyat", trust: "Güven",
    content: "İçerik", visual: "Görsel", reviews: "Yorum",
    stock: "Stok", campaign: "Kampanya",
  };
  return map[theme || ""] || "Karışık";
}

function getThemeColor(theme?: string | null) {
  const map: Record<string, string> = {
    delivery: "#0d6efd", price: "#f28705", trust: "#267365",
    content: "#6f42c1", visual: "#d63384", reviews: "#20c997",
    stock: "#dc3545", campaign: "#fd7e14",
  };
  return map[theme || ""] || "#6c757d";
}

function getScoreColor(score: number) {
  if (score >= 70) return "#20c997";
  if (score >= 50) return "#ffc107";
  return "#dc3545";
}

function getNextRenewalDate() {
  return new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: { include: { plan: true } } },
  });
  if (!user) redirect("/login");

  const reportCount = await prisma.report.count({ where: { userId: session.user.id } });
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const weeklyReportCount = await prisma.report.count({
    where: { userId: session.user.id, createdAt: { gte: lastWeek } },
  });

  const recentReports = await prisma.report.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true, url: true, platform: true, category: true,
      seoScore: true, conversionScore: true, overallScore: true,
      dataCompletenessScore: true, priceCompetitiveness: true,
      summary: true, dataSource: true, createdAt: true,
      extractedData: true, derivedMetrics: true, coverage: true,
      accessState: true, suggestions: true, priorityActions: true,
      analysisTrace: true,
    },
  });

  const typedRecentReports = recentReports.map((r) =>
    prepareSavedReportForClient(r)
  ) as SavedReport[];

  const currentPlanId = getEffectivePlanVariantFromRecord(user);
  const planView = getWorkspacePlanSummary(currentPlanId);
  const monthlyLimit = hasEntitledSubscription(user.subscription?.status)
    ? user.subscription?.plan?.monthlyAnalysisLimit ?? 10
    : 10;
  const periodKey = getMonthlyPeriodKey();
  const usageRecord = await prisma.userUsageRecord.findUnique({
    where: { userId_action_periodKey: { userId: session.user.id, action: "analyze", periodKey } },
  });

  const used = usageRecord?.count ?? 0;
  const remaining = Math.max(monthlyLimit - used, 0);
  const usageStatus = getUsageStatus({
    used, limit: monthlyLimit, remaining,
    allowed: remaining > 0, type: "user", planLabel: planView.label, planId: currentPlanId,
  });

  const renewalDate = getNextRenewalDate();

  const recentDiagnoses = typedRecentReports
    .map((r) => r.analysisTrace?.primaryDiagnosis || parseAnalysisSummary(r.summary).criticalDiagnosis)
    .filter((d): d is string => !!d)
    .slice(0, 3);

  const primaryThemeMap = typedRecentReports.reduce<Record<string, number>>((acc, r) => {
    const key = r.analysisTrace?.primaryTheme || "mixed";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topThemes = Object.entries(primaryThemeMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const criticalCount = typedRecentReports.filter(
    (r) => typeof r.overallScore === "number" && r.overallScore < 60
  ).length;

  const avgOverall = typedRecentReports.length > 0
    ? Math.round(typedRecentReports.reduce((s, r) => s + (r.overallScore ?? 0), 0) / typedRecentReports.length)
    : 0;

  const highCoverageCount = typedRecentReports.filter(
    (r) => r.coverage?.confidence === "high"
  ).length;

  const includeAdmin = session.user.role === "ADMIN";
  const workspaceNav = getWorkspaceNav({ includeAdmin });

  const kpiCards = [
    {
      label: "Toplam Rapor",
      value: reportCount,
      sub: "Tüm zamanlar",
      icon: "📊",
      color: "#0d6efd",
    },
    {
      label: "Bu Hafta",
      value: weeklyReportCount,
      sub: "Son 7 gün",
      icon: "📈",
      color: "#20c997",
    },
    {
      label: "Ort. Skor",
      value: avgOverall || "--",
      sub: "Genel analiz puanı",
      icon: "⭐",
      color: "#ffc107",
    },
    {
      label: "Kritik Ürün",
      value: criticalCount,
      sub: "Skor < 60",
      icon: "⚠️",
      color: "#dc3545",
    },
    {
      label: "Kalan Hak",
      value: remaining,
      sub: `/ ${monthlyLimit} aylık`,
      icon: "🎯",
      color: "#6f42c1",
    },
  ];

  return (
    <AppChrome
      currentPath="/dashboard"
      eyebrow="Workspace"
      title={`Hoş geldin, ${session.user.name || "kullanıcı"}`}
      description="AI destekli ürün analiz paneli"
      navItems={workspaceNav}
      headerMeta={
        <>
          <span className="hero-point">Plan: {planView.label}</span>
          <span className="hero-point">Bu hafta: {weeklyReportCount} analiz</span>
          <span className={`hero-point ${usageStatus.tone === "danger" ? "status-danger" : usageStatus.tone === "warn" ? "status-warn" : "status-good"}`}>
            {usageStatus.badge}
          </span>
        </>
      }
      actions={
        <>
          <Link href="/analyze" className="btn btn-primary">+ Yeni Analiz</Link>
          <Link href="/reports" className="btn btn-secondary">Arşiv</Link>
        </>
      }
      sidebarMeta={
        <div className="sb-stack-12">
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Aktif plan</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>{planView.label}</div>
            <p className="card-copy">{planView.note}</p>
          </div>
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Rol</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>{session.user.role || "USER"}</div>
            <p className="card-copy">{includeAdmin ? "Admin paneli erişilebilir." : "Kişisel panel aktif."}</p>
          </div>
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">{campaignContent.badge}</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>{campaignContent.title}</div>
            <p className="card-copy">{campaignContent.detail}</p>
          </div>
        </div>
      }
      sidebarFooter={<LogoutButton />}
    >
      {/* ── WELCOME BANNER ── */}
      <div className="dash-welcome">
        <div>
          <h2 className="dash-welcome__title">
            Hoş geldin, {session.user.name?.split(" ")[0] || "Kullanıcı"}! 👋
          </h2>
          <p className="dash-welcome__sub">
            {planView.label} planındasın · Bugün ne analiz edelim?
          </p>
          <div className="dash-welcome__stats">
            <div className="dash-welcome__stat">
              <span className="dash-welcome__stat-val">{reportCount}</span>
              <span className="dash-welcome__stat-label">Toplam Rapor</span>
            </div>
            <div className="dash-welcome__stat">
              <span className="dash-welcome__stat-val">{weeklyReportCount}</span>
              <span className="dash-welcome__stat-label">Bu Hafta</span>
            </div>
            <div className="dash-welcome__stat">
              <span className="dash-welcome__stat-val">{remaining}/{monthlyLimit}</span>
              <span className="dash-welcome__stat-label">Kalan Hak</span>
            </div>
          </div>
        </div>
        <div className="dash-welcome__img" aria-hidden>🚀</div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="dash-kpi-grid">
        {kpiCards.map((k) => (
          <div key={k.label} className="dash-kpi">
            <div className="dash-kpi__icon" style={{
              background: `color-mix(in srgb, ${k.color} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${k.color} 22%, transparent)`,
            }}>
              {k.icon}
            </div>
            <div className="dash-kpi__body">
              <div className="dash-kpi__label">{k.label}</div>
              <div className="dash-kpi__value" style={{ color: k.color }}>{k.value}</div>
              <div className="dash-kpi__sub">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="dash-grid-3-1">

        {/* Tema Dağılımı Bar Chart */}
        <div className="dash-chart-card">
          <div className="dash-section-header">
            <div className="dash-section-header__left">
              <h3 className="dash-chart-title">Sorun Alanları Dağılımı</h3>
              <p className="dash-chart-sub">Son raporlarda tekrar eden ana tema kategorileri</p>
            </div>
          </div>
          {topThemes.length > 0 ? (
            <div className="dash-bar-list">
              {topThemes.map(([theme, count]) => {
                const pct = Math.round((count / (typedRecentReports.length || 1)) * 100);
                return (
                  <div key={theme} className="dash-bar-item">
                    <div className="dash-bar-top">
                      <span className="dash-bar-label">{getThemeLabel(theme)}</span>
                      <span className="dash-bar-val">{count} rapor ({pct}%)</span>
                    </div>
                    <div className="dash-bar-track">
                      <div
                        className="dash-bar-fill"
                        style={{ width: `${pct}%`, background: getThemeColor(theme) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="state-card state-card--empty">
              <div className="state-card__icon">📊</div>
              <p className="state-card__text">Analiz yapıldıkça tema dağılımı oluşacak.</p>
            </div>
          )}
        </div>

        {/* Kullanım Durumu */}
        <div className="dash-chart-card">
          <h3 className="dash-chart-title">Kullanım Durumu</h3>
          <p className="dash-chart-sub">{renewalDate.toLocaleDateString("tr-TR")} yenilenme</p>

          <div className="dash-usage">
            <div className="dash-usage__ring">
              <svg className="dash-usage__svg" viewBox="0 0 88 88">
                <circle className="dash-usage__track" cx="44" cy="44" r="36" />
                <circle
                  className="dash-usage__fill"
                  cx="44" cy="44" r="36"
                  stroke={usageStatus.tone === "danger" ? "#dc3545" : usageStatus.tone === "warn" ? "#ffc107" : "#20c997"}
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - usageStatus.percent / 100)}`}
                />
              </svg>
              <div className="dash-usage__center" style={{
                color: usageStatus.tone === "danger" ? "#dc3545" : usageStatus.tone === "warn" ? "#ffc107" : "#20c997"
              }}>
                %{usageStatus.percent}
              </div>
            </div>
            <div className="dash-usage__info">
              <p className="dash-usage__title">{used} / {monthlyLimit} kullanıldı</p>
              <p className="dash-usage__detail">{usageStatus.detailMessage}</p>
              <p className="dash-usage__renewal">Yenilenme: {renewalDate.toLocaleDateString("tr-TR")}</p>
            </div>
          </div>

          {planView.suggestedUpgrade && (
            <div style={{ marginTop: 16 }}>
              <Link href={planView.upgradeHref} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                {planView.upgradeLabel}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── AI TEŞHİSLER + HIZLI AKSİYON ── */}
      <div className="dash-grid-2">

        {/* Son AI Teşhisler */}
        <div className="dash-chart-card">
          <div className="dash-section-header">
            <div className="dash-section-header__left">
              <h3 className="dash-chart-title">Son AI Teşhisleri</h3>
              <p className="dash-chart-sub">Raporlarda öne çıkan kritik sorunlar</p>
            </div>
          </div>
          {recentDiagnoses.length > 0 ? (
            <div className="dash-diagnosis-list">
              {recentDiagnoses.map((d, i) => (
                <div key={i} className="dash-diagnosis-item">
                  <span className="dash-diagnosis-num">{String(i + 1).padStart(2, "0")}</span>
                  <p className="dash-diagnosis-text">{d}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="state-card state-card--empty">
              <div className="state-card__icon">AI</div>
              <p className="state-card__text">Yeni analizlerden sonra teşhisler burada görünecek.</p>
            </div>
          )}
        </div>

        {/* Hızlı Aksiyon */}
        <div className="dash-chart-card">
          <div className="dash-section-header">
            <div className="dash-section-header__left">
              <h3 className="dash-chart-title">Hızlı Aksiyon</h3>
              <p className="dash-chart-sub">Sık kullanılan işlemler</p>
            </div>
          </div>
          <div className="dash-action-grid">
            <Link href="/analyze" className="dash-action-item">
              <div className="dash-action-icon">🔍</div>
              <div className="dash-action-body">
                <div className="dash-action-title">Yeni Analiz</div>
                <div className="dash-action-sub">Trendyol URL gir</div>
              </div>
            </Link>
            <Link href="/reports" className="dash-action-item">
              <div className="dash-action-icon">📋</div>
              <div className="dash-action-body">
                <div className="dash-action-title">Rapor Arşivi</div>
                <div className="dash-action-sub">Geçmiş raporlar</div>
              </div>
            </Link>
            <Link href="/account" className="dash-action-item">
              <div className="dash-action-icon">⚙️</div>
              <div className="dash-action-body">
                <div className="dash-action-title">Hesap Ayarları</div>
                <div className="dash-action-sub">Plan ve profil</div>
              </div>
            </Link>
            {includeAdmin ? (
              <Link href="/admin" className="dash-action-item">
                <div className="dash-action-icon">🛡️</div>
                <div className="dash-action-body">
                  <div className="dash-action-title">Admin Panel</div>
                  <div className="dash-action-sub">Yönetim merkezi</div>
                </div>
              </Link>
            ) : planView.suggestedUpgrade ? (
              <Link href={planView.upgradeHref} className="dash-action-item">
                <div className="dash-action-icon">👑</div>
                <div className="dash-action-body">
                  <div className="dash-action-title">{planView.upgradeLabel}</div>
                  <div className="dash-action-sub">{planView.suggestedUpgrade.note}</div>
                </div>
              </Link>
            ) : (
              <Link href="/account" className="dash-action-item">
                <div className="dash-action-icon">⚙️</div>
                <div className="dash-action-body">
                  <div className="dash-action-title">Plan Detayı</div>
                  <div className="dash-action-sub">Mevcut plan ve limitler</div>
                </div>
              </Link>
            )}
          </div>

          {/* Veri güveni */}
          <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "color-mix(in srgb, var(--surface-soft) 60%, transparent)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Veri Güveni</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{highCoverageCount}/{typedRecentReports.length || 0}</span>
            </div>
            <div className="dash-bar-track">
              <div className="dash-bar-fill" style={{
                width: typedRecentReports.length > 0 ? `${Math.round((highCoverageCount / typedRecentReports.length) * 100)}%` : "0%",
                background: "#20c997"
              }} />
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Yüksek kapsamlı rapor oranı — AI yorumları daha güvenilir.
            </p>
          </div>
        </div>
      </div>

      {/* ── GRAFİKLER ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "var(--dm-card-bg, #fff)", border: "1px solid var(--dm-border, #e2e8f0)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Sorun Alanları</h3>
            <span style={{ fontSize: 12, color: "var(--dm-text-soft, #718096)" }}>Son raporlar</span>
          </div>
          <DashboardCharts.BarChart
            title="Sorun Alanları"
            labels={topThemes.map(([t]) => getThemeLabel(t))}
            values={topThemes.map(([, c]) => c)}
            colors={topThemes.map(([t]) => getThemeColor(t))}
          />
        </div>

        <div style={{ background: "var(--dm-card-bg, #fff)", border: "1px solid var(--dm-border, #e2e8f0)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Skor Dağılımı</h3>
            <span style={{ fontSize: 12, color: "var(--dm-text-soft, #718096)" }}>Son {typedRecentReports.length} rapor</span>
          </div>
          <DashboardCharts.LineChart
            labels={typedRecentReports.slice().reverse().map((_, i) => `R${i + 1}`)}
            datasets={[
              { label: "SEO", data: typedRecentReports.slice().reverse().map((r) => r.seoScore ?? 0), color: "#0d6efd" },
              { label: "Dönüşüm", data: typedRecentReports.slice().reverse().map((r) => r.conversionScore ?? 0), color: "#20c997" },
              { label: "Genel", data: typedRecentReports.slice().reverse().map((r) => r.overallScore ?? 0), color: "#f28705" },
            ]}
          />
        </div>
      </div>

      {/* ── SON RAPORLAR TABLOSU ── */}
      <div className="dash-chart-card">
        <div className="dash-section-header">
          <div className="dash-section-header__left">
            <h3 className="dash-chart-title">Son Raporlar</h3>
            <p className="dash-chart-sub">En son analiz edilen ürünler</p>
          </div>
          <Link href="/reports" className="btn btn-secondary">Tümünü Gör</Link>
        </div>

        {typedRecentReports.length > 0 ? (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Ürün URL</th>
                  <th>Platform</th>
                  <th>SEO</th>
                  <th>Dönüşüm</th>
                  <th>Genel</th>
                  <th>Tarih</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {typedRecentReports.slice(0, 6).map((report) => {
                  const overall = report.overallScore ?? 0;
                  const seo = report.seoScore ?? 0;
                  const conv = report.conversionScore ?? 0;
                  return (
                    <tr key={report.id}>
                      <td>
                        <div className="dash-table-url" title={report.url}>
                          🔗 {report.url}
                        </div>
                      </td>
                      <td>
                        {report.platform && (
                          <span className="dash-platform-tag">{report.platform}</span>
                        )}
                      </td>
                      <td>
                        <span className="dash-score-pill" style={{
                          background: `color-mix(in srgb, ${getScoreColor(seo)} 12%, transparent)`,
                          color: getScoreColor(seo),
                          border: `1px solid color-mix(in srgb, ${getScoreColor(seo)} 25%, transparent)`,
                        }}>
                          {seo || "--"}
                        </span>
                      </td>
                      <td>
                        <span className="dash-score-pill" style={{
                          background: `color-mix(in srgb, ${getScoreColor(conv)} 12%, transparent)`,
                          color: getScoreColor(conv),
                          border: `1px solid color-mix(in srgb, ${getScoreColor(conv)} 25%, transparent)`,
                        }}>
                          {conv || "--"}
                        </span>
                      </td>
                      <td>
                        <span className="dash-score-pill" style={{
                          background: `color-mix(in srgb, ${getScoreColor(overall)} 12%, transparent)`,
                          color: getScoreColor(overall),
                          border: `1px solid color-mix(in srgb, ${getScoreColor(overall)} 25%, transparent)`,
                          fontWeight: 800,
                        }}>
                          {overall || "--"}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-faint)", fontSize: 12, whiteSpace: "nowrap" }}>
                        {new Date(report.createdAt).toLocaleDateString("tr-TR")}
                      </td>
                      <td>
                        <Link href={`/reports/${report.id}`} className="dash-table-link">
                          Detay →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state-card state-card--empty">
            <div className="state-card__icon">📊</div>
            <h3 className="state-card__title">Henüz rapor yok</h3>
            <p className="state-card__text">İlk analizini yap, raporlar burada görünsün.</p>
            <Link href="/analyze" className="btn btn-primary">Analiz Başlat</Link>
          </div>
        )}
      </div>
    </AppChrome>
  );
}
