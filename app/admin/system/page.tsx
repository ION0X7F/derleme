import AdminShell from "@/components/admin/AdminShell";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/server-auth";

function getHealthTone(value: number, warnAt: number, goodAt: number) {
  if (value >= goodAt) return "status-good";
  if (value >= warnAt) return "status-warn";
  return "status-danger";
}

export default async function AdminSystemPage() {
  await requireAdminSession();

  const recentReports = await prisma.report.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    select: {
      dataSource: true,
      coverage: true,
      analysisTrace: true,
    },
  });

  const [
    totalPlans,
    activeSubscriptions,
    learningMemories,
    benchmarks,
    learnedRules,
    userUsageRecords,
    guestUsageRecords,
  ] = await Promise.all([
    prisma.plan.count(),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
      },
    }),
    prisma.learningMemory.count(),
    prisma.categoryBenchmark.count(),
    prisma.learnedRule.count(),
    prisma.userUsageRecord.count(),
    prisma.guestUsageRecord.count(),
  ]);

  const sampleCount = recentReports.length || 1;
  const fallbackRate = Math.round(
    (recentReports.filter((report) => report.dataSource === "fallback").length / sampleCount) * 100
  );
  const traceCoverage = Math.round(
    (recentReports.filter((report) => Boolean(report.analysisTrace)).length / sampleCount) * 100
  );
  const highCoverage = Math.round(
    (
      recentReports.filter(
        (report) =>
          ((report.coverage ?? null) as { confidence?: string | null } | null)
            ?.confidence === "high"
      ).length / sampleCount
    ) * 100
  );

  const systemCards = [
    {
      title: "Extractor hizi",
      value: `${100 - fallbackRate}%`,
      text: "Gercek veriyle tamamlanan son rapor orani.",
      tone: getHealthTone(100 - fallbackRate, 60, 80),
    },
    {
      title: "Karar izi kapsami",
      value: `${traceCoverage}%`,
      text: "Analysis trace tasiyan son rapor orani.",
      tone: getHealthTone(traceCoverage, 50, 75),
    },
    {
      title: "Yuksek kapsam",
      value: `${highCoverage}%`,
      text: "Confidence seviyesi yuksek kalan raporlar.",
      tone: getHealthTone(highCoverage, 45, 70),
    },
    {
      title: "Ogrenme tabani",
      value: learningMemories,
      text: "Bellege alinmis ogrenme kayitlari.",
      tone: getHealthTone(learningMemories, 20, 50),
    },
  ];

  return (
    <AdminShell
      currentPath="/admin/system"
      title="Sistem durumu"
      description="Ogrenme motoru, benchmark tabani, kullanim kayitlari ve operasyonel saglik panellerini izle."
      headerMeta={
        <>
          <span className="hero-point">{totalPlans} plan kaydi</span>
          <span className="hero-point">{activeSubscriptions} aktif abonelik</span>
          <span className="hero-point">{benchmarks} benchmark</span>
        </>
      }
    >
      <section className="surface app-card sb-stack-20">
        <div className="admin-stat-grid">
          {[
            { label: "Plan kaydi", value: totalPlans, text: "Runtime tarafinda tanimli planlar." },
            { label: "Aktif abonelik", value: activeSubscriptions, text: "Aktif subscription durumundaki kayitlar." },
            { label: "Ogrenme bellegi", value: learningMemories, text: "Kayitli analizlerden gelen memory havuzu." },
            { label: "Benchmark", value: benchmarks, text: "Kategori bazli benchmark kayitlari." },
            { label: "Kural havuzu", value: learnedRules, text: "Ogrenilmis kural kayitlari." },
            { label: "Kullanim kayitlari", value: userUsageRecords + guestUsageRecords, text: "User ve guest usage kayitlarinin toplami." },
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
              <h2 className="section-card__title">Saglik kartlari</h2>
              <p className="section-card__text">
                Sistem sagligini sayi kalabaligi yerine yorumlanmis kartlarla oku.
              </p>
            </div>
          </div>

          <div className="admin-system-grid">
            {systemCards.map((card) => (
              <article key={card.title} className="surface-soft admin-note">
                <div className="pill-row" style={{ marginBottom: 10 }}>
                  <span className={`hero-point ${card.tone}`}>{card.title}</span>
                </div>
                <div className="card-heading" style={{ fontSize: 28, marginBottom: 8 }}>
                  {card.value}
                </div>
                <p className="card-copy">{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Danger zone</h2>
              <p className="section-card__text">
                Kritik operasyonlar sade ama urunlesmis bir panel diliyle ayrilsin.
              </p>
            </div>
          </div>

          <article className="surface-soft admin-note">
            <div className="pill-row" style={{ marginBottom: 10 }}>
              <span className="hero-point status-danger">Bakim modu</span>
            </div>
            Sistem durdurma, kampanya kapatma veya kritik erisim degisikligi gibi islemler
            bu alanda daha dikkatli bir farkli dil ile toplanir.
          </article>

          <article className="surface-soft admin-note">
            <div className="pill-row" style={{ marginBottom: 10 }}>
              <span className="hero-point status-warn">Yetki kontrolu</span>
            </div>
            Admin yetkisi olmayan oturumlar bu yuzeye estetik ama net bir erisim devami
            akisi ile yonlendirilmelidir.
          </article>
        </section>
      </div>
    </AdminShell>
  );
}
