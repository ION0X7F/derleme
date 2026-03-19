import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LogoutButton from "@/app/components/LogoutButton";
import AppChrome from "@/components/layout/AppChrome";
import ReportHistory from "@/components/ReportHistory";
import { prisma } from "@/lib/prisma";
import { getUsageStatus } from "@/lib/usage-status";
import { getMonthlyPeriodKey } from "@/lib/usage";
import { SavedReport } from "@/types";

function getPlanView(planCode?: string | null, planName?: string | null) {
  if (planCode === "ENTERPRISE") {
    return {
      label: planName || "Enterprise",
      isPaid: true,
      note: "Yonetim ve premium karar katmani aktif",
    };
  }

  if (planCode === "PREMIUM") {
    return {
      label: planName || "Pro",
      isPaid: true,
      note: "Premium Trendyol raporlari aktif",
    };
  }

  return {
    label: planName || "Free",
    isPaid: false,
    note: "Temel Trendyol analizi aktif",
  };
}

function getPlanMatrix(monthlyLimit: number) {
  return [
    {
      feature: "Aylik analiz",
      free: `${monthlyLimit}`,
      pro: "100",
    },
    {
      feature: "Premium AI derinligi",
      free: "Sinirli",
      pro: "Tam acik",
    },
    {
      feature: "Export",
      free: "Kilitli",
      pro: "Acik",
    },
    {
      feature: "Premium aksiyon plani",
      free: "Teaser",
      pro: "Acik",
    },
  ];
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
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

  const recentReports = await prisma.report.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
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
    },
  });
  const typedRecentReports = recentReports as unknown as SavedReport[];

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

  const plan = user.subscription?.plan;
  const planView = getPlanView(plan?.code, plan?.name);
  const monthlyLimit = plan?.monthlyAnalysisLimit ?? 10;
  const used = usageRecord?.count ?? 0;
  const remaining = Math.max(monthlyLimit - used, 0);
  const renewalDate = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)
  );
  const usageStatus = getUsageStatus({
    used,
    limit: monthlyLimit,
    remaining,
    allowed: remaining > 0,
    type: "user",
    planLabel: planView.label,
  });
  const planMatrix = getPlanMatrix(monthlyLimit);

  return (
    <AppChrome
      currentPath="/dashboard"
      eyebrow="Dashboard"
      title={`Hos geldin, ${session.user.name || "kullanici"}`}
      description="Plan, kullanim, son raporlar ve hizli analiz aksiyonlari tek uygulama omurgasinda toplandi."
      navItems={[
        { href: "/dashboard", label: "Dashboard" },
        { href: "/analyze", label: "Yeni Analiz" },
        { href: "/", label: "Ana Sayfa" },
      ]}
      headerMeta={
        <>
          <span className="hero-point">Plan: {planView.label}</span>
          <span className="hero-point">Rapor: {reportCount}</span>
          <span className={`hero-point ${usageStatus.tone === "danger" ? "status-danger" : usageStatus.tone === "warn" ? "status-warn" : "status-good"}`}>
            {usageStatus.badge}
          </span>
        </>
      }
      actions={
        <>
          <Link href="/analyze" className="btn btn-primary">
            Yeni Analiz
          </Link>
          {!planView.isPaid && (
            <Link href="/fiyatlandirma" className="btn btn-secondary">
              Pro&apos;ya Gec
            </Link>
          )}
        </>
      }
      sidebarMeta={
        <>
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Paket</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {planView.label}
            </div>
            <p className="card-copy">{planView.note}</p>
          </div>

          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Rol</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {session.user.role || "USER"}
            </div>
            <p className="card-copy">
              {session.user.role === "ADMIN"
                ? "Yonetim katmani acik."
                : "Kisisel analiz paneli aktif."}
            </p>
          </div>
        </>
      }
      sidebarFooter={<LogoutButton />}
    >
      <section className="surface app-card sb-stack-20">
        <div className="section-grid-2">
          <div className="sb-stack-12">
            <h2 className="section-card__title" style={{ fontSize: 28 }}>
              Analiz haklarini, planini ve son raporlarini ayni yerden yonet.
            </h2>
            <p className="section-card__text">
              Dashboard, kullanicinin urunle asil bag kurdugu alan olarak kurgulandi.
              Hizli aksiyon, plan durumu ve rapor kutuphanesi ilk ekranda gorunur.
            </p>
          </div>

          <div className="surface-soft" style={{ padding: 18 }}>
            <div className="stat-card__label">Yenilenme</div>
            <div className="card-heading" style={{ fontSize: 22, marginBottom: 8 }}>
              {renewalDate.toLocaleDateString("tr-TR")}
            </div>
            <p className="card-copy">{usageStatus.detailMessage}</p>
          </div>
        </div>

        <div className="app-shell-kpis">
          <article className="app-shell-kpi">
            <div className="app-shell-kpi__label">Aktif plan</div>
            <div className="app-shell-kpi__value">{planView.label}</div>
            <div className="app-shell-kpi__text">{planView.note}</div>
          </article>
          <article className="app-shell-kpi">
            <div className="app-shell-kpi__label">Kalan analiz</div>
            <div className="app-shell-kpi__value">{remaining}</div>
            <div className="app-shell-kpi__text">Bu donemde yeni urunler icin kalan hak.</div>
          </article>
          <article className="app-shell-kpi">
            <div className="app-shell-kpi__label">Kutuphane durumu</div>
            <div className="app-shell-kpi__value">{reportCount}</div>
            <div className="app-shell-kpi__text">Kayitli rapor arsivi aktif durumda.</div>
          </article>
        </div>
      </section>

      <section className="stat-grid">
        <div className="surface stat-card">
          <div className="stat-card__label">Aylik Limit</div>
          <div className="stat-card__value">{monthlyLimit}</div>
          <div className="stat-card__text">Bu donemde kullanabilecegin toplam analiz.</div>
        </div>
        <div className="surface stat-card">
          <div className="stat-card__label">Kullanilan</div>
          <div className="stat-card__value">{used}</div>
          <div className="stat-card__text">Bu ay harcanan analiz hakki.</div>
        </div>
        <div className="surface stat-card">
          <div className="stat-card__label">Kalan</div>
          <div className="stat-card__value">{remaining}</div>
          <div className="stat-card__text">Yeni urunler icin kalan hak.</div>
        </div>
        <div className="surface stat-card">
          <div className="stat-card__label">Toplam Rapor</div>
          <div className="stat-card__value">{reportCount}</div>
          <div className="stat-card__text">Kayitli analiz kutuphanesindeki raporlar.</div>
        </div>
      </section>

      <div className="section-grid-2">
        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Kullanim durumu</h2>
              <p className="section-card__text">
                Kullanim yogunlugu, kalan analiz ve premium gecis ihtiyaci burada okunur.
              </p>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              height: 12,
              borderRadius: 999,
              background: "color-mix(in srgb, var(--surface-strong) 100%, transparent)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${usageStatus.percent}%`,
                height: "100%",
                borderRadius: 999,
                background:
                  usageStatus.tone === "danger"
                    ? "linear-gradient(90deg, var(--danger), color-mix(in srgb, var(--danger) 70%, white 30%))"
                    : usageStatus.tone === "warn"
                      ? "linear-gradient(90deg, var(--warning), color-mix(in srgb, var(--warning) 70%, white 30%))"
                      : "linear-gradient(90deg, var(--success), color-mix(in srgb, var(--success) 70%, white 30%))",
              }}
            />
          </div>

          <div className="pill-row">
            <span className="hero-point">%{usageStatus.percent} kullanim</span>
            <span
              className={`hero-point ${
                usageStatus.tone === "danger"
                  ? "status-danger"
                  : usageStatus.tone === "warn"
                    ? "status-warn"
                    : "status-good"
              }`}
            >
              {usageStatus.shortMessage}
            </span>
          </div>

          <div className="surface-soft" style={{ padding: 18 }}>
            <div className="card-copy">{usageStatus.detailMessage}</div>
            {!planView.isPaid && usageStatus.upgradeMessage && (
              <div className="alert alert-warning" style={{ marginTop: 14 }}>
                {usageStatus.upgradeMessage}
              </div>
            )}
          </div>
        </section>

        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Plan farklari</h2>
              <p className="section-card__text">
                Premium katmanda nelerin acildigini kullaniciyi yormadan gosteren ozet alan.
              </p>
            </div>
          </div>

          <div className="sb-stack-12">
            {planMatrix.map((item) => (
              <div
                key={item.feature}
                className="surface-soft"
                style={{
                  padding: 16,
                  display: "grid",
                  gridTemplateColumns: "1.1fr 0.8fr 0.8fr",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div className="card-copy" style={{ color: "var(--text)" }}>
                  {item.feature}
                </div>
                <div className="hero-point" style={{ justifyContent: "center" }}>
                  {item.free}
                </div>
                <div
                  className="hero-point status-good"
                  style={{
                    justifyContent: "center",
                    borderColor: "color-mix(in srgb, var(--brand) 22%, transparent)",
                  }}
                >
                  {item.pro}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="surface app-card sb-stack-16">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Son raporlar</h2>
            <p className="section-card__text">
              Kayitli rapor kutuphanen icinde son analizlerini hizli tarayabilirsin.
            </p>
          </div>
        </div>

        <ReportHistory reports={typedRecentReports} />
      </section>
    </AppChrome>
  );
}


