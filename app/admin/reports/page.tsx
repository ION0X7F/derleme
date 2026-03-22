import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { getPlanLabel } from "@/lib/plan-label";
import { prisma } from "@/lib/prisma";
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

export default async function AdminReportsPage() {
  await requireAdminSession();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [reports, totalReports, weeklyReports, guestReports, fallbackReports, lowScoreReports] =
    await Promise.all([
      prisma.report.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 40,
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
          guestId: true,
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
      prisma.report.count({
        where: {
          overallScore: {
            lt: 60,
          },
        },
      }),
    ]);

  return (
    <AdminShell
      currentPath="/admin/reports"
      title="Rapor ve analiz operasyonu"
      description="Tum rapor akislarini, kaynak durumlarini ve dikkat isteyen analizleri operasyon tablosunda izle."
      headerMeta={
        <>
          <span className="hero-point">{totalReports} toplam rapor</span>
          <span className="hero-point">{weeklyReports} / 7 gun</span>
          <span className={`hero-point ${fallbackReports > 0 ? "status-warn" : "status-good"}`}>
            Fallback: {fallbackReports}
          </span>
        </>
      }
    >
      <section className="surface app-card sb-stack-20">
        <div className="admin-stat-grid">
          {[
            { label: "Toplam rapor", value: totalReports, text: "Tum zamanlarda kaydedilen analizler." },
            { label: "Haftalik hacim", value: weeklyReports, text: "Son 7 gunde olusan rapor sayisi." },
            { label: "Guest akisi", value: guestReports, text: "Kayitsiz analiz akisi kaynakli raporlar." },
            { label: "Fallback", value: fallbackReports, text: "Sinirli veri ile olusan raporlar." },
            { label: "Dikkat kuyrugu", value: lowScoreReports, text: "Genel skoru dusuk kalan raporlar." },
          ].map((item) => (
            <article key={item.label} className="surface-soft admin-stat">
              <div className="admin-stat__label">{item.label}</div>
              <div className="admin-stat__value">{item.value}</div>
              <div className="admin-stat__text">{item.text}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface app-card sb-stack-16">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Rapor tablosu</h2>
            <p className="section-card__text">
              Platform, plan, AI tema ve veri kaynagi ayni satirda okunur.
            </p>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Rapor</th>
                <th>Sahip</th>
                <th>Kaynak</th>
                <th>Tema</th>
                <th>Plan</th>
                <th>Genel</th>
                <th>Tarih</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
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
                const owner = report.user?.email || "Guest";
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
                  <tr key={report.id}>
                    <td>
                      <strong>{title}</strong>
                      <div className="admin-table__subtext">
                        {(report.platform || "Platform") + " | " + (report.category || "Genel")}
                      </div>
                    </td>
                    <td>{owner}</td>
                    <td>
                      <span
                        className={`hero-point ${
                          report.dataSource === "fallback" ? "status-warn" : "status-good"
                        }`}
                      >
                        {report.dataSource || "real"}
                      </span>
                    </td>
                    <td>{getThemeLabel(analysisTrace?.primaryTheme)}</td>
                    <td>{plan}</td>
                    <td>{report.overallScore ?? "--"}</td>
                    <td>{new Date(report.createdAt).toLocaleString("tr-TR")}</td>
                    <td>
                      <Link href={`/report/${report.id}`} className="btn btn-secondary">
                        Ac
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
