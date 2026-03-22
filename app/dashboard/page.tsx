import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LogoutButton from "@/app/components/LogoutButton";
import * as DashboardCharts from "@/components/DashboardCharts";
import AppChrome from "@/components/layout/AppChrome";
import { parseAnalysisSummary } from "@/lib/analysis-summary";
import { campaignContent, getWorkspacePlanSummary } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { prepareSavedReportForClient } from "@/lib/report-access";
import { getReadableReportTitle } from "@/lib/report-title";
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
    delivery: "Teslimat",
    price: "Fiyat",
    trust: "Güven",
    content: "İçerik",
    visual: "Görsel",
    reviews: "Yorum",
    stock: "Stok",
    campaign: "Kampanya",
  };

  return map[theme || ""] || "Karışık";
}

function getThemeColor(theme?: string | null) {
  const map: Record<string, string> = {
    delivery: "#1E403A",
    price: "#205B73",
    trust: "#7AB8BF",
    content: "#BFB39B",
    visual: "#3A7380",
    reviews: "#568D95",
    stock: "#0D2226",
    campaign: "#6B807C",
  };

  return map[theme || ""] || "#7A8F94";
}

function getScoreTone(score?: number | null) {
  if (typeof score !== "number") return "status-warn";
  if (score >= 80) return "status-good";
  if (score >= 50) return "status-warn";
  return "status-danger";
}

function getNextRenewalDate() {
  return new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)
  );
}

function getReportTitle(report: SavedReport) {
  return getReadableReportTitle({
    url: report.url,
    extractedData:
      report.extractedData && typeof report.extractedData === "object"
        ? (report.extractedData as Record<string, unknown>)
        : null,
    fallback: "Kaydedilmiş rapor",
  });
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const reportCount = await prisma.report.count({
    where: { userId: session.user.id },
  });

  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const weeklyReportCount = await prisma.report.count({
    where: {
      userId: session.user.id,
      createdAt: {
        gte: lastWeek,
      },
    },
  });

  const recentReports = await prisma.report.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 8,
    select: {
      id: true,
      url: true,
      platform: true,
      category: true,
      seoScore: true,
      conversionScore: true,
      overallScore: true,
      dataCompletenessScore: true,
      priceCompetitiveness: true,
      summary: true,
      dataSource: true,
      createdAt: true,
      extractedData: true,
      derivedMetrics: true,
      coverage: true,
      accessState: true,
      suggestions: true,
      priorityActions: true,
      analysisTrace: true,
    },
  });

  const typedRecentReports = recentReports.map((report) =>
    prepareSavedReportForClient(report)
  ) as SavedReport[];

  const currentPlanId = getEffectivePlanVariantFromRecord(user);
  const planView = getWorkspacePlanSummary(currentPlanId);
  const monthlyLimit = hasEntitledSubscription(user.subscription?.status)
    ? user.subscription?.plan?.monthlyAnalysisLimit ?? 10
    : 10;
  const periodKey = getMonthlyPeriodKey();

  const usageRecord = await prisma.userUsageRecord.findUnique({
    where: {
      userId_action_periodKey: {
        userId: session.user.id,
        action: "analyze",
        periodKey,
      },
    },
  });

  const used = usageRecord?.count ?? 0;
  const remaining = Math.max(monthlyLimit - used, 0);
  const usageStatus = getUsageStatus({
    used,
    limit: monthlyLimit,
    remaining,
    allowed: remaining > 0,
    type: "user",
    planLabel: planView.label,
    planId: currentPlanId,
  });

  const renewalDate = getNextRenewalDate();
  const recentDiagnoses = typedRecentReports
    .map(
      (report) =>
        report.analysisTrace?.primaryDiagnosis ||
        parseAnalysisSummary(report.summary).criticalDiagnosis
    )
    .filter((item): item is string => !!item)
    .slice(0, 4);

  const primaryThemeMap = typedRecentReports.reduce<Record<string, number>>(
    (acc, report) => {
      const key = report.analysisTrace?.primaryTheme || "mixed";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  const topThemes = Object.entries(primaryThemeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const criticalCount = typedRecentReports.filter(
    (report) =>
      typeof report.overallScore === "number" && report.overallScore < 60
  ).length;

  const avgOverall =
    typedRecentReports.length > 0
      ? Math.round(
          typedRecentReports.reduce(
            (sum, report) => sum + (report.overallScore ?? 0),
            0
          ) / typedRecentReports.length
        )
      : 0;

  const highCoverageCount = typedRecentReports.filter(
    (report) => report.coverage?.confidence === "high"
  ).length;

  const includeAdmin = session.user.role === "ADMIN";
  const workspaceNav = getWorkspaceNav({ includeAdmin });
  const orderedReports = typedRecentReports.slice().reverse();

  return (
    <AppChrome
      currentPath="/dashboard"
      eyebrow="Workspace"
      title={`Hoş geldin, ${session.user.name || "kullanıcı"}`}
      description="Kullanım, son teşhisler ve ürün ritmi tek karar panelinde toplandı."
      navItems={workspaceNav}
      headerMeta={
        <>
          <span className="hero-point">Plan: {planView.label}</span>
          <span className="hero-point">Bu hafta: {weeklyReportCount} analiz</span>
          <span className="hero-point">Toplam: {reportCount} rapor</span>
          <span
            className={`hero-point ${
              usageStatus.tone === "danger"
                ? "status-danger"
                : usageStatus.tone === "warn"
                  ? "status-warn"
                  : "status-good"
            }`}
          >
            {usageStatus.badge}
          </span>
        </>
      }
      actions={
        <>
          <Link href="/analyze" className="btn btn-primary">
            Yeni Analiz
          </Link>
          <Link href="/reports" className="btn btn-secondary">
            Raporlar
          </Link>
        </>
      }
      sidebarMeta={
        <div className="sb-stack-12">
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Aktif plan</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {planView.label}
            </div>
            <p className="card-copy">{planView.note}</p>
          </div>

          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Kampanya notu</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {campaignContent.title}
            </div>
            <p className="card-copy">{campaignContent.detail}</p>
          </div>

          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Rol</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {session.user.role || "USER"}
            </div>
            <p className="card-copy">
              {includeAdmin
                ? "Admin ve kullanıcı yüzeyleri birlikte erişilebilir."
                : "Kişisel karar panelin bu hesapla yönetiliyor."}
            </p>
          </div>
        </div>
      }
      sidebarFooter={<LogoutButton />}
    >
      <section className="surface app-card sb-stack-20">
        <div className="workspace-hero">
          <div className="workspace-hero__content">
            <div className="eyebrow">Karar özeti</div>
            <h2 className="workspace-hero__title">
              Yeni rapor açmadan önce hangi ürünlerin dikkat istediğini bir bakışta gör.
            </h2>
            <p className="section-card__text">
              Dashboard artık dağınık kart yığını gibi değil; kullanım ritmini,
              tekrar eden sorun alanlarını ve en son raporları tek bir akışta okutur.
            </p>
          </div>

          <div className="workspace-meter">
            <div className="workspace-meter__head">
              <span className="stat-card__label">Dönem kullanımı</span>
              <span
                className={`workspace-meter__value ${
                  usageStatus.tone === "danger"
                    ? "status-danger"
                    : usageStatus.tone === "warn"
                      ? "status-warn"
                      : "status-good"
                }`}
              >
                %{usageStatus.percent}
              </span>
            </div>

            <div className="analysis-meter__track">
              <div
                className={
                  usageStatus.tone === "danger"
                    ? "analysis-meter__fill analysis-meter__fill--danger"
                    : usageStatus.tone === "warn"
                      ? "analysis-meter__fill analysis-meter__fill--warn"
                      : "analysis-meter__fill analysis-meter__fill--good"
                }
                style={{ width: `${usageStatus.percent}%` }}
              />
            </div>

            <div className="analysis-meter__caption">
              <span>{usageStatus.detailMessage}</span>
              <span>{renewalDate.toLocaleDateString("tr-TR")}</span>
            </div>
          </div>
        </div>

        <div className="workspace-kpi-grid">
          <article className="surface-soft workspace-kpi">
            <div className="workspace-kpi__label">Genel ortalama</div>
            <div className="workspace-kpi__value">{avgOverall || "--"}</div>
            <div className="workspace-kpi__text">
              Son raporların genel skor ortalaması.
            </div>
          </article>
          <article className="surface-soft workspace-kpi">
            <div className="workspace-kpi__label">Bu hafta</div>
            <div className="workspace-kpi__value">{weeklyReportCount}</div>
            <div className="workspace-kpi__text">
              Son 7 günde tamamlanan analiz sayısı.
            </div>
          </article>
          <article className="surface-soft workspace-kpi">
            <div className="workspace-kpi__label">Kritik ürün</div>
            <div className="workspace-kpi__value">{criticalCount}</div>
            <div className="workspace-kpi__text">
              Önce bakılması gereken düşük skorlu ürünler.
            </div>
          </article>
          <article className="surface-soft workspace-kpi">
            <div className="workspace-kpi__label">Kalan hak</div>
            <div className="workspace-kpi__value">{remaining}</div>
            <div className="workspace-kpi__text">
              Bu dönemde yeni analiz için kalan kapasite.
            </div>
          </article>
        </div>
      </section>

      <div className="section-grid-2">
        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Sorun alanları</h2>
              <p className="section-card__text">
                Son raporlarda en çok tekrar eden tema dağılımı.
              </p>
            </div>
          </div>

          {topThemes.length > 0 ? (
            <DashboardCharts.BarChart
              title="Sorun Alanları"
              labels={topThemes.map(([theme]) => getThemeLabel(theme))}
              values={topThemes.map(([, count]) => count)}
              colors={topThemes.map(([theme]) => getThemeColor(theme))}
            />
          ) : (
            <div className="state-card state-card--empty">
              <div className="state-card__icon">AI</div>
              <h3 className="state-card__title">Henüz veri yok</h3>
              <p className="state-card__text">
                İlk analizlerden sonra tema dağılımı burada görünecek.
              </p>
            </div>
          )}
        </section>

        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Skor dağılımı</h2>
              <p className="section-card__text">
                Son {typedRecentReports.length} raporda SEO, dönüşüm ve genel skor ritmi.
              </p>
            </div>
          </div>

          {typedRecentReports.length > 0 ? (
            <DashboardCharts.LineChart
              labels={orderedReports.map((_, index) => `R${index + 1}`)}
              datasets={[
                {
                  label: "SEO",
                  data: orderedReports.map((report) => report.seoScore ?? 0),
                  color: "#205B73",
                },
                {
                  label: "Dönüşüm",
                  data: orderedReports.map(
                    (report) => report.conversionScore ?? 0
                  ),
                  color: "#1E403A",
                },
                {
                  label: "Genel",
                  data: orderedReports.map((report) => report.overallScore ?? 0),
                  color: "#7AB8BF",
                },
              ]}
            />
          ) : (
            <div className="state-card state-card--empty">
              <div className="state-card__icon">SK</div>
              <h3 className="state-card__title">Skor akışı oluşmadı</h3>
              <p className="state-card__text">
                Skor trendi için en az bir rapor gerekiyor.
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="section-grid-2">
        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Son AI teşhisleri</h2>
              <p className="section-card__text">
                Tekrar eden darboğazları hızlıca oku ve önceliği belirle.
              </p>
            </div>
          </div>

          <div className="workspace-stack-list">
            {recentDiagnoses.length > 0 ? (
              recentDiagnoses.map((diagnosis, index) => (
                <article
                  key={`${diagnosis}-${index}`}
                  className="workspace-insight-card"
                >
                  <div className="workspace-insight-card__index">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <p className="card-copy" style={{ color: "var(--text)" }}>
                    {diagnosis}
                  </p>
                </article>
              ))
            ) : (
              <div className="state-card state-card--empty">
                <div className="state-card__icon">AI</div>
                <h3 className="state-card__title">Teşhis birikiyor</h3>
                <p className="state-card__text">
                  Yeni analizlerden sonra bu alan tekrar eden AI teşhislerini gösterecek.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Hızlı aksiyonlar</h2>
              <p className="section-card__text">
                Tek tıkla analiz başlat, arşive geç veya hesap yönetimine dön.
              </p>
            </div>
          </div>

          <div className="workspace-action-grid">
            <Link href="/analyze" className="workspace-action-card">
              <div className="workspace-action-card__title">Yeni analiz başlat</div>
              <p className="workspace-action-card__text">
                Trendyol ürün linkini gir ve rapora doğrudan geç.
              </p>
            </Link>
            <Link href="/reports" className="workspace-action-card">
              <div className="workspace-action-card__title">Rapor arşivi</div>
              <p className="workspace-action-card__text">
                Geçmiş raporlarını aç, filtrele ve yeniden incele.
              </p>
            </Link>
            <Link href="/account" className="workspace-action-card">
              <div className="workspace-action-card__title">Hesap ve plan</div>
              <p className="workspace-action-card__text">
                Plan seviyeni, kullanım durumunu ve yenilenme tarihini yönet.
              </p>
            </Link>
            {includeAdmin ? (
              <Link href="/admin" className="workspace-action-card">
                <div className="workspace-action-card__title">Admin merkezi</div>
                <p className="workspace-action-card__text">
                  Kullanıcı, plan ve sistem operasyon paneline geç.
                </p>
              </Link>
            ) : (
              <article className="workspace-action-card">
                <div className="workspace-action-card__title">Veri güveni</div>
                <p className="workspace-action-card__text">
                  Yüksek kapsamlı rapor oranı: {highCoverageCount}/
                  {typedRecentReports.length || 0}
                </p>
              </article>
            )}
          </div>
        </section>
      </div>

      <section className="surface app-card sb-stack-16">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Son raporlar</h2>
            <p className="section-card__text">
              Son analizler burada kompakt bir akış halinde tutulur; tam arşiv için
              raporlar sayfasına geçebilirsin.
            </p>
          </div>
          <Link href="/reports" className="btn btn-secondary">
            Tümünü Gör
          </Link>
        </div>

        {typedRecentReports.length > 0 ? (
          <div className="dashboard-report-list">
            {typedRecentReports.slice(0, 5).map((report) => (
              <article key={report.id} className="dashboard-report-row">
                <div className="dashboard-report-row__main">
                  <div className="dashboard-report-row__title">
                    {getReportTitle(report)}
                  </div>
                  <div className="dashboard-report-row__meta">
                    {(report.platform || "Trendyol") +
                      " • " +
                      (report.category || "Genel") +
                      " • " +
                      new Date(report.createdAt).toLocaleDateString("tr-TR")}
                  </div>
                </div>

                <div className="dashboard-report-row__metrics">
                  <span className={`hero-point ${getScoreTone(report.seoScore)}`}>
                    SEO {report.seoScore ?? "--"}
                  </span>
                  <span
                    className={`hero-point ${getScoreTone(report.conversionScore)}`}
                  >
                    Dönüşüm {report.conversionScore ?? "--"}
                  </span>
                  <span
                    className={`hero-point ${getScoreTone(report.overallScore)}`}
                  >
                    Genel {report.overallScore ?? "--"}
                  </span>
                  <Link href={`/reports/${report.id}`} className="btn btn-secondary">
                    Aç
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="state-card state-card--empty">
            <div className="state-card__icon">RP</div>
            <h3 className="state-card__title">Henüz rapor yok</h3>
            <p className="state-card__text">
              İlk analizi yaptığında raporların bu akışta görünmeye başlayacak.
            </p>
            <Link href="/analyze" className="btn btn-primary">
              Analiz Başlat
            </Link>
          </div>
        )}
      </section>
    </AppChrome>
  );
}
