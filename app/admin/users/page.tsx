import { PlanCode, SubscriptionStatus } from "@prisma/client";
import AdminShell from "@/components/admin/AdminShell";
import UserPlanForm from "@/components/admin/UserPlanForm";
import { getPlanDisplayName } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/server-auth";
import {
  getEffectivePlanVariantFromRecord,
  getMembershipStatusLabel,
} from "@/lib/user-membership";

function getUserStatus(lastActive?: Date | null) {
  if (!lastActive) {
    return {
      label: "Pasif",
      tone: "status-warn",
    };
  }

  const diff = Date.now() - lastActive.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days <= 7) {
    return { label: "Aktif", tone: "status-good" };
  }

  if (days <= 30) {
    return { label: "Takip", tone: "status-warn" };
  }

  return { label: "Uyuyan", tone: "status-danger" };
}

export default async function AdminUsersPage() {
  await requireAdminSession();

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [users, totalUsers, premiumUsers, newUsers, adminUsers] = await Promise.all([
    prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        reports: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            createdAt: true,
          },
        },
        _count: {
          select: {
            reports: true,
          },
        },
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
    prisma.user.count({
      where: {
        createdAt: {
          gte: monthAgo,
        },
      },
    }),
    prisma.user.count({
      where: {
        role: "ADMIN",
      },
    }),
  ]);

  return (
    <AdminShell
      currentPath="/admin/users"
      title="Kullanici yonetimi"
      description="Kullanicilar, plan seviyesi, analiz hacmi ve son aktivite ritmi tek operasyon tablosunda toplansin."
      headerMeta={
        <>
          <span className="hero-point">{totalUsers} toplam kullanici</span>
          <span className="hero-point">{premiumUsers} premium</span>
          <span className="hero-point">{newUsers} yeni / 30 gun</span>
        </>
      }
    >
      <section className="surface app-card sb-stack-20">
        <div className="admin-stat-grid">
          {[
            { label: "Toplam kullanici", value: totalUsers, text: "Kayitli tum hesaplar." },
            { label: "Premium kullanici", value: premiumUsers, text: "Ucretli plan kullanan hesaplar." },
            { label: "Yeni kayit", value: newUsers, text: "Son 30 gundeki yeni hesaplar." },
            { label: "Admin rolu", value: adminUsers, text: "Yonetim paneline erisen ekip sayisi." },
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
            <h2 className="section-card__title">Kullanici tablosu</h2>
            <p className="section-card__text">
              Rol, plan, analiz hacmi ve aktivite rozetleri tek bakista okunur.
            </p>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kullanici</th>
                <th>Rol</th>
                <th>Plan</th>
                <th>Analiz</th>
                <th>Son aktif</th>
                <th>Kayit</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const effectivePlanId = getEffectivePlanVariantFromRecord(user);
                const planLabel = getPlanDisplayName(effectivePlanId);
                const lastActive = user.reports[0]?.createdAt ?? null;
                const status = getUserStatus(lastActive);
                const subscriptionStatusLabel = getMembershipStatusLabel(
                  user.subscription?.status
                );

                return (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name || "Isimsiz kullanici"}</strong>
                      <div className="admin-table__subtext">{user.email}</div>
                    </td>
                    <td>
                      <div className="pill-row">
                        <span className="hero-point">{user.role}</span>
                      </div>
                    </td>
                    <td>
                      <UserPlanForm
                        userId={user.id}
                        currentPlanId={effectivePlanId}
                        currentPlanLabel={planLabel}
                        subscriptionStatusLabel={subscriptionStatusLabel}
                      />
                    </td>
                    <td>{user._count.reports}</td>
                    <td>
                      {lastActive
                        ? new Date(lastActive).toLocaleString("tr-TR")
                        : "Henuz analiz yok"}
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString("tr-TR")}</td>
                    <td>
                      <span className={`hero-point ${status.tone}`}>{status.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="section-grid-2">
        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Operasyon notlari</h2>
              <p className="section-card__text">
                Plan atama, hesap durumu ve rol rozetleri icin tasarlanan kontrol alanlari.
              </p>
            </div>
          </div>

          <div className="admin-quick-grid">
            {[
              "Plan degisimi ve manuel atama akisi artik kullanici tablosunda canli calisiyor.",
              "Pasife alma ve tekrar aktife alma isaretleri operasyon diliyle ayrisiyor.",
              "Admin rozetleri ve hesap sagligi durumlari tek satirda okunuyor.",
              "Analiz limiti ve son aktivite birlikte gosterilerek destek hizi artiyor.",
            ].map((item) => (
              <article key={item} className="surface-soft admin-note">
                {item}
              </article>
            ))}
          </div>
        </section>

        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Hizli ozet</h2>
              <p className="section-card__text">
                Premium ve yeni kayit akislarini operasyon kararina hizli cevir.
              </p>
            </div>
          </div>

          <div className="workspace-signal-grid">
            <article className="workspace-signal-card">
              <div className="workspace-signal-card__value">{premiumUsers}</div>
              <div className="workspace-signal-card__title">Premium taban</div>
              <div className="workspace-signal-card__text">
                Ucretli planda kalan kullanici sayisi
              </div>
            </article>
            <article className="workspace-signal-card">
              <div className="workspace-signal-card__value">{newUsers}</div>
              <div className="workspace-signal-card__title">Yeni kayit</div>
              <div className="workspace-signal-card__text">
                Son 30 gunde sisteme giren yeni hesaplar
              </div>
            </article>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
