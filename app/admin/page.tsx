import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { prisma } from "@/lib/prisma";
import { getPlanLabel } from "@/lib/plan-label";
import { getReadableReportTitle } from "@/lib/report-title";
import { requireAdminSession } from "@/lib/server-auth";

function getThemeLabel(theme?: string | null) {
  switch (theme) {
    case "delivery":
      return "Teslimat";
    case "price":
      return "Fiyat";
    case "trust":
      return "Guven";
    case "content":
      return "Icerik";
    case "visual":
      return "Gorsel";
    case "reviews":
      return "Yorum";
    case "stock":
      return "Stok";
    case "campaign":
      return "Kampanya";
    default:
      return "Karisik";
  }
}

function formatPercent(value: number) {
  return `%${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default async function AdminOverviewPage() {
  await requireAdminSession();

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [
    totalUsers,
    premiumUsers,
    adminUsers,
    totalReports,
    reportsLastWeek,
    guestReports,
    fallbackReports,
    activeReportRows,
    recentReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        OR: [
          { plan: "PREMIUM" },
          {
            subscription: {
              is: {
                plan: {
                  code: "PREMIUM",
                },
              },
            },
          },
        ],
      },
    }),
    prisma.user.count({
      where: {
        role: "ADMIN",
      },
    }),
    prisma.report.count(),
    prisma.report.count({
      where: {
        createdAt: {
          gte: weekAgo,
        },
      },
    }),
    prisma.report.count({
      where: {
        guestId: {
          not: null,
        },
      },
    }),
    prisma.report.count({
      where: {
        dataSource: "fallback",
      },
    }),
    prisma.report.findMany({
      where: {
        userId: {
          not: null,
        },
        createdAt: {
          gte: monthAgo,
        },
      },
      select: {
        userId: true,
      },
    }),
    prisma.report.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        url: true,
        platform: true,
        category: true,
        overallScore: true,
        dataSource: true,
        createdAt: true,
        accessState: true,
        analysisTrace: true,
        extractedData: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const activeUsers = new Set(
    activeReportRows
      .map((row) => row.userId)
      .filter((value): value is string => typeof value === "string")
  ).size;
  const paidRatio = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0;
  const guestRatio = totalReports > 0 ? Math.round((guestReports / totalReports) * 100) : 0;
  const fallbackRate =
    totalReports > 0 ? Math.round((fallbackReports / totalReports) * 100) : 0;

  const themeMap = recentReports.reduce<Record<string, number>>((acc, report) => {
    const analysisTrace = (report.analysisTrace ?? null) as {
      primaryTheme?: string | null;
    } | null;
    const theme = analysisTrace?.primaryTheme || "mixed";
    acc[theme] = (acc[theme] || 0) + 1;
    return acc;
  }, {});

  const topThemes = Object.entries(themeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <AdminShell
      currentPath="/admin"
      title="Admin genel bakis"
      description="Kullanici, analiz, plan ve sistem akislarini tek operasyon panelinde hizli tara."
      headerMeta={
        <>
          <span className="hero-point">{totalUsers} kullanici</span>
          <span className="hero-point">{reportsLastWeek} analiz / 7 gun</span>
          <span className={`hero-point ${fallbackRate > 35 ? "status-warn" : "status-good"}`}>
            Fallback: {formatPercent(fallbackRate)}
          </span>
        </>
      }
      actions={
        <>
          <Link href="/admin/users" className="btn btn-primary">
            Kullanicilar
          </Link>
          <Link href="/admin/reports" className="btn btn-secondary">
            Raporlar
          </Link>
        </>
      }
    >
      <section className="surface app-card sb-stack-20">
        <div className="admin-stat-grid">
          {[
            {
              label: "Toplam kullanici",
              value: totalUsers,
              text: "Platformda hesap olusturan toplam kullanici sayisi.",
            },
            {
              label: "Aktif kullanici",
              value: activeUsers,
              text: "Son 30 gunde rapor ureten benzersiz kullanicilar.",
            },
            {
              label: "Toplam analiz",
              value: totalReports,
              text: "Tum guest ve kayitli rapor akislarinin toplami.",
            },
            {
              label: "Ucretli oran",
              value: formatPercent(paidRatio),
              text: "Premium seviyede kalan kullanicilarin toplam orani.",
            },
            {
              label: "Guest kullanimi",
              value: formatPercent(guestRatio),
              text: "Tum analizler icinde guest akisinin payi.",
            },
            {
              label: "Admin sayisi",
              value: adminUsers,
              text: "Operasyon paneline erisebilen yonetici sayisi.",
            },
          ].map((item) => (
            <article key={item.label} className="surface-soft admin-stat">
              <div className="admin-stat__label">{item.label}</div>
              <div className="admin-stat__value">{item.value}</div>
              <div className="admin-stat__text">{item.text}</div>
            </article>
          ))}
        </div>
      </section>

      <div className="section-grid-2">
        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Operasyon akisleri</h2>
              <p className="section-card__text">
                En cok kullanilan yonetim alanlarina hizli gecis icin moduler kartlar.
              </p>
            </div>
          </div>

          <div className="admin-quick-grid">
            <Link href="/admin/users" className="workspace-action-card">
              <div className="workspace-action-card__title">Kullanici yonetimi</div>
              <p className="workspace-action-card__text">
                Plan, aktivite ve rol rozetleriyle kullanici bazli operasyon.
              </p>
            </Link>
            <Link href="/admin/plans" className="workspace-action-card">
              <div className="workspace-action-card__title">Plan ve kampanya</div>
              <p className="workspace-action-card__text">
                Ticari paketler, kampanya gorunurlugu ve runtime plan tablosu.
              </p>
            </Link>
            <Link href="/admin/reports" className="workspace-action-card">
              <div className="workspace-action-card__title">Rapor operasyonu</div>
              <p className="workspace-action-card__text">
                Son analiz akislari, fallback durumlari ve dikkat kuyrugu.
              </p>
            </Link>
            <Link href="/admin/system" className="workspace-action-card">
              <div className="workspace-action-card__title">Sistem durumu</div>
              <p className="workspace-action-card__text">
                Ogrenme bellegi, benchmark katmani ve sistem sagligi.
              </p>
            </Link>
          </div>
        </section>

        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Tema yogunlugu</h2>
              <p className="section-card__text">
                Son analizlerde hangi darbozagin daha sik tekrar ettigini hizli oku.
              </p>
            </div>
          </div>

          <div className="workspace-signal-grid">
            {topThemes.length > 0 ? (
              topThemes.map(([theme, count]) => (
                <article key={theme} className="workspace-signal-card">
                  <div className="workspace-signal-card__value">{count}</div>
                  <div className="workspace-signal-card__title">{getThemeLabel(theme)}</div>
                  <div className="workspace-signal-card__text">
                    Son operasyon akisinda tekrar eden odak temasi
                  </div>
                </article>
              ))
            ) : (
              <article className="workspace-signal-card">
                <div className="workspace-signal-card__value">0</div>
                <div className="workspace-signal-card__title">Tema yok</div>
                <div className="workspace-signal-card__text">
                  Yeterli rapor geldikce bu alan dolacak.
                </div>
              </article>
            )}
          </div>
        </section>
      </div>

      <section className="surface app-card sb-stack-16">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Son analiz akisi</h2>
            <p className="section-card__text">
              En son raporlar, kullanici ve guest akislarini ayni satirda gosterir.
            </p>
          </div>
        </div>

        <div className="admin-stream">
          {recentReports.map((report) => {
            const analysisTrace = (report.analysisTrace ?? null) as {
              primaryTheme?: string | null;
            } | null;
            const title = getReadableReportTitle({
              url: report.url,
              extractedData:
                report.extractedData && typeof report.extractedData === "object"
                  ? (report.extractedData as Record<string, unknown>)
                  : null,
              fallback: "Kayitli rapor",
            });
            const plan =
              report.accessState &&
              typeof report.accessState === "object" &&
              "plan" in report.accessState &&
              typeof report.accessState.plan === "string"
                ? getPlanLabel(report.accessState.plan)
                : report.user
                  ? "Free"
                  : "Guest";

            return (
              <article key={report.id} className="admin-stream__item">
                <div className="admin-stream__main">
                  <div className="admin-stream__title">{title}</div>
                  <div className="admin-stream__meta">
                    {(report.user?.name || report.user?.email || "Guest kullanici") +
                      " | " +
                      (report.platform || "Platform belirsiz") +
                      " | " +
                      new Date(report.createdAt).toLocaleString("tr-TR")}
                  </div>
                </div>

                <div className="pill-row">
                  <span className="hero-point">{plan}</span>
                  <span className="hero-point">{getThemeLabel(analysisTrace?.primaryTheme)}</span>
                  <span
                    className={`hero-point ${
                      report.dataSource === "fallback" ? "status-warn" : "status-good"
                    }`}
                  >
                    {report.dataSource || "real"}
                  </span>
                  <span className="hero-point">Genel: {report.overallScore ?? "--"}</span>
                  <Link href={`/report/${report.id}`} className="btn btn-secondary">
                    Ac
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
}
