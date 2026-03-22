import Link from "next/link";
import AppChrome from "@/components/layout/AppChrome";
import ReportsExplorer from "@/components/ReportsExplorer";
import LogoutButton from "@/app/components/LogoutButton";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/server-auth";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { prepareSavedReportForClient } from "@/lib/report-access";
import type { SavedReport } from "@/types";

export default async function ReportsPage() {
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

  const historyLimit = user?.subscription?.plan?.reportsHistoryLimit ?? 5;

  const reports = await prisma.report.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: historyLimit > 0 ? historyLimit : 100,
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
  });

  const typedReports = reports.map((report) =>
    prepareSavedReportForClient(report)
  ) as SavedReport[];

  return (
    <AppChrome
      currentPath="/reports"
      eyebrow="Rapor Kutuphanesi"
      title="Kaydedilmis raporlar"
      description="Arama, filtre ve kart ritmiyle gecmis analizlerini premium bir arsiv deneyiminde tara."
      navItems={getWorkspaceNav({ includeAdmin: session.user.role === "ADMIN" })}
      actions={
        <>
          <Link href="/analyze" className="btn btn-primary">
            Yeni Analiz
          </Link>
          <Link href="/account" className="btn btn-secondary">
            Hesap
          </Link>
        </>
      }
      headerMeta={
        <>
          <span className="hero-point">{typedReports.length} rapor</span>
          {typeof historyLimit === "number" && (
            <span className="hero-point">Plan limiti: {historyLimit}</span>
          )}
        </>
      }
      sidebarMeta={
        <div className="sb-stack-12">
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Arsiv mantigi</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              En yeni rapor once
            </div>
            <p className="card-copy">
              Kutuphane hizli tarama icin en yeni kayitlari ustte gosterir, filtre ile daraltma yapabilirsin.
            </p>
          </div>

          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Kullanici modu</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {session.user.role === "ADMIN" ? "Admin + kullanici" : "Kisisel kutuphane"}
            </div>
            <p className="card-copy">
              Rapor detaylari ve premium bolum kilitleri kayit uzerinden korunur.
            </p>
          </div>
        </div>
      }
      sidebarFooter={<LogoutButton />}
    >
      <section className="surface app-card sb-stack-16">
        <ReportsExplorer reports={typedReports} historyLimit={historyLimit} />
      </section>
    </AppChrome>
  );
}
