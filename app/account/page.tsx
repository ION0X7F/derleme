import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/app/components/LogoutButton";
import ReportHistory from "@/components/ReportHistory";
import AppChrome from "@/components/layout/AppChrome";
import { campaignContent, getWorkspacePlanSummary } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { prepareSavedReportForClient } from "@/lib/report-access";
import { requireSessionUser } from "@/lib/server-auth";
import { getMonthlyPeriodKey } from "@/lib/usage";
import {
  getEffectivePlanVariantFromRecord,
  hasEntitledSubscription,
} from "@/lib/user-membership";
import { getUsageStatus } from "@/lib/usage-status";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import type { SavedReport } from "@/types";

function getNextRenewalDate() {
  return new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)
  );
}

export default async function AccountPage() {
  const session = await requireSessionUser();

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

  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const periodKey = getMonthlyPeriodKey();

  const [reportCount, monthlyReportCount, usageRecord, recentReports] = await Promise.all([
    prisma.report.count({
      where: { userId: user.id },
    }),
    prisma.report.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: monthAgo,
        },
      },
    }),
    prisma.userUsageRecord.findUnique({
      where: {
        userId_action_periodKey: {
          userId: user.id,
          action: "analyze",
          periodKey,
        },
      },
    }),
    prisma.report.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
      select: {
        id: true,
        url: true,
        platform: true,
        category: true,
        seoScore: true,
        dataCompletenessScore: true,
        conversionScore: true,
        overallScore: true,
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
    }),
  ]);

  const monthlyLimit = hasEntitledSubscription(user.subscription?.status)
    ? user.subscription?.plan?.monthlyAnalysisLimit ?? 10
    : 10;
  const used = usageRecord?.count ?? 0;
  const remaining = Math.max(monthlyLimit - used, 0);
  const currentPlanId = getEffectivePlanVariantFromRecord(user);
  const planDetails = getWorkspacePlanSummary(currentPlanId);
  const usageStatus = getUsageStatus({
    used,
    limit: monthlyLimit,
    remaining,
    allowed: remaining > 0,
    type: "user",
    planLabel: planDetails.label,
    planId: currentPlanId,
  });
  const renewalDate = getNextRenewalDate();
  const sanitizedReports = recentReports.map((report) =>
    prepareSavedReportForClient(report)
  ) as SavedReport[];
  const includeAdmin = session.user.role === "ADMIN";

  return (
    <AppChrome
      currentPath="/account"
      eyebrow="Account"
      title="Hesap ve plan merkezi"
      description="Profil, kullanim ritmi, plan seviyesi ve guvenlik katmanlarini tek premium hesap yuzeyinde yonet."
      navItems={getWorkspaceNav({ includeAdmin })}
      headerMeta={
        <>
          <span className="hero-point">Plan: {planDetails.label}</span>
          <span className={`hero-point ${planDetails.accent}`}>{usageStatus.badge}</span>
          <span className="hero-point">Son 30 gun: {monthlyReportCount} analiz</span>
        </>
      }
      actions={
        <>
          <Link href="/analyze" className="btn btn-primary">
            Yeni Analiz
          </Link>
          <Link href={planDetails.upgradeHref} className="btn btn-secondary">
            {planDetails.upgradeLabel}
          </Link>
        </>
      }
      sidebarMeta={
        <div className="sb-stack-12">
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Hesap rolu</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {session.user.role || "USER"}
            </div>
            <p className="card-copy">
              {includeAdmin
                ? "Hem kullanici hem admin ekranlarina erisimin var."
                : "Kisisel karar panelin bu hesap uzerinden ilerliyor."}
            </p>
          </div>

          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">{campaignContent.badge}</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {campaignContent.title}
            </div>
            <p className="card-copy">{campaignContent.detail}</p>
          </div>
        </div>
      }
      sidebarFooter={<LogoutButton />}
    >
      <section className="surface app-card sb-stack-20">
        <div className="account-grid">
          <article className="surface-soft account-panel">
            <div className="stat-card__label">Profil</div>
            <div className="card-heading" style={{ fontSize: 28, marginBottom: 8 }}>
              {user.name || "SellBoost kullanicisi"}
            </div>
            <p className="card-copy" style={{ marginBottom: 16 }}>
              {user.email}
            </p>

            <div className="account-list">
              <div className="account-list__item">
                <span className="account-list__label">Kayit tarihi</span>
                <strong>{new Date(user.createdAt).toLocaleDateString("tr-TR")}</strong>
              </div>
              <div className="account-list__item">
                <span className="account-list__label">Rol</span>
                <strong>{session.user.role || "USER"}</strong>
              </div>
              <div className="account-list__item">
                <span className="account-list__label">Toplam rapor</span>
                <strong>{reportCount}</strong>
              </div>
            </div>
          </article>

          <article className="surface-soft account-panel">
            <div className="stat-card__label">Plan seviyesi</div>
            <div className="card-heading" style={{ fontSize: 28, marginBottom: 8 }}>
              {planDetails.label}
            </div>
            <p className="card-copy" style={{ marginBottom: 16 }}>
              {planDetails.price}
            </p>
            <p className="card-copy">{planDetails.note}</p>

            <div className="pill-row" style={{ marginTop: 16 }}>
              {planDetails.badge && (
                <span className="hero-point">{planDetails.badge}</span>
              )}
              <span className="hero-point">{planDetails.billingLabelText}</span>
              <span className="hero-point">Kalan hak: {remaining}</span>
              <span className="hero-point">Aylik limit: {monthlyLimit}</span>
              <span className={`hero-point ${planDetails.accent}`}>{usageStatus.badge}</span>
            </div>
          </article>
        </div>
      </section>

      <div className="section-grid-2">
        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Kullanim ve yenilenme</h2>
              <p className="section-card__text">
                Kullanim ritmini, kalan kapasiteyi ve bir sonraki donem baslangicini
                tek yerde oku.
              </p>
            </div>
          </div>

          <div className="workspace-meter">
            <div className="workspace-meter__head">
              <span className="stat-card__label">Donem doluluk orani</span>
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

          <div className="workspace-kpi-grid">
            <article className="surface-soft workspace-kpi">
              <div className="workspace-kpi__label">Kullanilan</div>
              <div className="workspace-kpi__value">{used}</div>
              <div className="workspace-kpi__text">Bu donemde tuketilen analiz sayisi.</div>
            </article>
            <article className="surface-soft workspace-kpi">
              <div className="workspace-kpi__label">Kalan</div>
              <div className="workspace-kpi__value">{remaining}</div>
              <div className="workspace-kpi__text">Yeni raporlar icin aktif kapasite.</div>
            </article>
            <article className="surface-soft workspace-kpi">
              <div className="workspace-kpi__label">30 gun</div>
              <div className="workspace-kpi__value">{monthlyReportCount}</div>
              <div className="workspace-kpi__text">Son 30 gunde tamamlanan analizler.</div>
            </article>
            <article className="surface-soft workspace-kpi">
              <div className="workspace-kpi__label">Toplam kutuphane</div>
              <div className="workspace-kpi__value">{reportCount}</div>
              <div className="workspace-kpi__text">Kayitli rapor arsivinin toplam boyutu.</div>
            </article>
          </div>
        </section>

        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Guvenlik ve oturum</h2>
              <p className="section-card__text">
                Hesap erisimi, oturum davranisi ve sonraki adimlar tek blokta toplansin.
              </p>
            </div>
          </div>

          <div className="account-list">
            <div className="account-list__item">
              <span className="account-list__label">Oturum tipi</span>
              <strong>Kayitli kullanici</strong>
            </div>
            <div className="account-list__item">
              <span className="account-list__label">Plan davranisi</span>
              <strong>{planDetails.label}</strong>
            </div>
            <div className="account-list__item">
              <span className="account-list__label">Yenilenme</span>
              <strong>{renewalDate.toLocaleDateString("tr-TR")}</strong>
            </div>
          </div>

          {planDetails.suggestedUpgrade && (
            <div className="alert alert-warning">
              {planDetails.suggestedUpgrade.note}
            </div>
          )}

          <div className="workspace-action-grid">
            <Link href="/reports" className="workspace-action-card">
              <div className="workspace-action-card__title">Rapor kutuphanesi</div>
              <p className="workspace-action-card__text">
                Kayitli analizleri tekrar ac ve karar akisina kaldigin yerden devam et.
              </p>
            </Link>
            <Link href="/pricing" className="workspace-action-card">
              <div className="workspace-action-card__title">Planlari karsilastir</div>
              <p className="workspace-action-card__text">
                Free ve Pro arasindaki erisim farklarini net gor.
              </p>
            </Link>
          </div>
        </section>
      </div>

      <section className="surface app-card sb-stack-16">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Son hesap aktiviteleri</h2>
            <p className="section-card__text">
              Son raporlar, hesabin urun icinde nasil kullanildigini hizli okumaya yardim eder.
            </p>
          </div>
          <Link href="/reports" className="btn btn-secondary">
            Tumu
          </Link>
        </div>

        <ReportHistory reports={sanitizedReports} />
      </section>
    </AppChrome>
  );
}
