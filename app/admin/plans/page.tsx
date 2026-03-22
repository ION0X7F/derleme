import { PlanCode, SubscriptionStatus } from "@prisma/client";
import AdminShell from "@/components/admin/AdminShell";
import PricingCards from "@/components/marketing/PricingCards";
import {
  buildPricingPlans,
  campaignContent,
  getPlanDefinitions,
  pricingMatrix,
} from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/server-auth";

export default async function AdminPlansPage() {
  await requireAdminSession();
  const pricingPlans = buildPricingPlans();
  const planCatalog = getPlanDefinitions();

  const [runtimePlans, totalUsers, premiumUsers, activeSubscriptions] = await Promise.all([
    prisma.plan.findMany({
      orderBy: {
        priceMonthly: "asc",
      },
    }),
    prisma.user.count(),
    prisma.user.count({
      where: {
        OR: [
          {
            subscription: {
              is: {
                status: {
                  in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
                },
                plan: {
                  code: PlanCode.PREMIUM,
                },
              },
            },
          },
          {
            subscription: {
              is: null,
            },
            plan: PlanCode.PREMIUM,
          },
        ],
      },
    }),
    prisma.subscription.count({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
    }),
  ]);

  return (
    <AdminShell
      currentPath="/admin/plans"
      title="Planlar ve abonelikler"
      description="Ticari paket yuzeyi ile runtime plan kayitlarini ayni yonetim katmaninda birlikte gor."
      headerMeta={
        <>
          <span className="hero-point">{runtimePlans.length} runtime plan</span>
          <span className="hero-point">{premiumUsers} premium kullanici</span>
          <span className="hero-point">{activeSubscriptions} aktif abonelik</span>
        </>
      }
    >
      <section className="surface app-card sb-stack-20">
        <div className="admin-stat-grid">
          {[
            { label: "Toplam kullanici", value: totalUsers, text: "Tum hesaplar icindeki plan tabani." },
            { label: "Premium taban", value: premiumUsers, text: "Ucretli kullanim davranisi." },
            { label: "Aktif abonelik", value: activeSubscriptions, text: "Subscription kaydinda aktif kalanlar." },
            { label: "Kampanya durumu", value: "15 gun", text: "Pro kampanyasi gorunur ve hazir." },
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
            <h2 className="section-card__title">Ticari paket gorunumu</h2>
            <p className="section-card__text">
              Free, Pro, Pro Yillik ve Team yuzeyi ayni urun ailesinde premium bir fiyatlama diliyle sunulur.
            </p>
          </div>
        </div>

        <PricingCards plans={pricingPlans} />
      </section>

      <section className="surface app-card sb-stack-16">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Karsilastirma matrisi</h2>
            <p className="section-card__text">
              Kullaniciya giden deger farki, admin tarafinda da sade bir tabloyla korunur.
            </p>
          </div>
        </div>

        <div className="pricing-matrix">
          <div className="pricing-matrix__header">
            <div>Ozellik</div>
            <div>Ucretsiz</div>
            <div>Pro</div>
            <div>Pro Yillik</div>
            <div>Team</div>
          </div>

          {pricingMatrix.map((row) => (
            <div key={row.feature} className="pricing-matrix__row">
              <div className="pricing-matrix__feature">{row.feature}</div>
              <div className="pricing-matrix__cell">{row.free}</div>
              <div className="pricing-matrix__cell pricing-matrix__cell--featured">
                {row.pro}
              </div>
              <div className="pricing-matrix__cell">{row.yearly}</div>
              <div className="pricing-matrix__cell">{row.team}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface app-card sb-stack-16">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Plan katalogu</h2>
            <p className="section-card__text">
              Merkezi plan sozlugu; fiyat, badge, kullanim hissi ve one cikan ozelliklerle admin tarafinda da tek tablodan okunur.
            </p>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Fiyat</th>
                <th>Badge</th>
                <th>Kullanim</th>
                <th>Ozellikler</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {planCatalog.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <strong>{plan.displayName}</strong>
                    <div className="admin-table__subtext">{plan.shortDescription}</div>
                  </td>
                  <td>{`${plan.priceLabel} ${plan.billingLabel}`}</td>
                  <td>{plan.badge || plan.campaignLabel || "-"}</td>
                  <td>{plan.usageLimits.analysis}</td>
                  <td>{plan.featureList.slice(0, 3).join(" / ")}</td>
                  <td>
                    <span
                      className={`hero-point ${
                        plan.isRecommended || plan.isPopular
                          ? "status-good"
                          : "status-warn"
                      }`}
                    >
                      {plan.isRecommended
                        ? "Onerilen"
                        : plan.isPopular
                          ? "Ana urun"
                          : "Aktif katalog"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="section-grid-2">
        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Runtime plan tablosu</h2>
              <p className="section-card__text">
                Veritabaninda aktif olan sistem planlari, limit ve ozellik alanlariyla birlikte gorunur.
              </p>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Limit</th>
                  <th>Gecmis</th>
                  <th>Export</th>
                  <th>AI</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {runtimePlans.map((plan) => (
                  <tr key={plan.id}>
                    <td>
                      <strong>{plan.name}</strong>
                      <div className="admin-table__subtext">{plan.code}</div>
                    </td>
                    <td>{plan.monthlyAnalysisLimit}</td>
                    <td>{plan.reportsHistoryLimit ?? "Sinirsiz"}</td>
                    <td>{plan.canExportReports ? "Acik" : "Kilitli"}</td>
                    <td>{plan.canUseAdvancedAi ? "Gelismis" : "Temel"}</td>
                    <td>
                      <span className={`hero-point ${plan.isActive ? "status-good" : "status-warn"}`}>
                        {plan.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Kampanya ve notlar</h2>
              <p className="section-card__text">
                Fiyatlandirma sayfasi, register ekrani ve admin gorunumu ayni kampanya dilini paylasir.
              </p>
            </div>
          </div>

          <article className="surface-soft admin-note">
            <strong>{campaignContent.title}</strong>
            <p className="card-copy" style={{ marginTop: 8 }}>
              {campaignContent.detail}
            </p>
          </article>

          <article className="surface-soft admin-note">
            Free ve Pro planlari runtime seviyesinde aktif olarak yonetiliyor.
            Premium atama artik admin kullanici tablosundan canli guncellenebiliyor; Pro Yillik
            ve Team ise simdilik sunum katmaninda konumlandiriliyor.
          </article>
        </section>
      </div>
    </AdminShell>
  );
}
