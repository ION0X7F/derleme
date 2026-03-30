"use client";

import { useEffect, useMemo, useState } from "react";

type AdminTab = "dashboard" | "users" | "notifications";

type DashboardResponse = {
  metrics: {
    totalUsers: number;
    usersLast30Days: number;
    activeSubscriptions: number;
    reportsLast30Days: number;
    reportsLast7Days: number;
    unreadNotificationReceipts: number;
  };
  latestUpgrades: Array<{
    userId: string;
    variant: string | null;
    updatedAt: string;
    user: {
      email: string | null;
      name: string | null;
    } | null;
  }>;
  latestReports: Array<{
    id: string;
    url: string;
    overallScore: number | null;
    createdAt: string;
    user: {
      email: string | null;
      name: string | null;
    } | null;
  }>;
};

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  role: string;
  planCode: string;
  planId: "FREE" | "PRO_MONTHLY" | "PRO_YEARLY" | "TEAM";
  subscriptionStatus: string | null;
  createdAt: string;
  reportCount: number;
  lastReportAt: string | null;
  unreadNotificationCount: number;
};

type UsersResponse = {
  users: AdminUser[];
};

type AdminNotification = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ALERT";
  targetScope: "ALL_USERS" | "SINGLE_USER";
  targetUserId: string | null;
  createdAt: string;
  sender: {
    id: string;
    email: string | null;
    name: string | null;
  } | null;
  deliveryCount: number;
};

type NotificationsResponse = {
  notifications: AdminNotification[];
};

const planOptions: Array<{
  id: "FREE" | "PRO_MONTHLY" | "PRO_YEARLY" | "TEAM";
  label: string;
}> = [
  { id: "FREE", label: "Free" },
  { id: "PRO_MONTHLY", label: "Pro Aylik" },
  { id: "PRO_YEARLY", label: "Pro Yillik" },
  { id: "TEAM", label: "Team" },
];

const notificationTypeOptions = ["INFO", "SUCCESS", "WARNING", "ALERT"] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return value;
  }
}

function getDisplayName(user: Pick<AdminUser, "name" | "username" | "email">) {
  return user.name || user.username || user.email;
}

export default function AdminConsole() {
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [planDraftByUserId, setPlanDraftByUserId] = useState<
    Record<string, AdminUser["planId"]>
  >({});
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [composeTarget, setComposeTarget] = useState<"all" | "user">("all");
  const [composeUserId, setComposeUserId] = useState("");
  const [composeType, setComposeType] =
    useState<(typeof notificationTypeOptions)[number]>("INFO");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composeStatus, setComposeStatus] = useState<string | null>(null);

  const usersById = useMemo(() => {
    const map = new Map<string, AdminUser>();
    for (const item of users) map.set(item.id, item);
    return map;
  }, [users]);

  async function fetchDashboard() {
    const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Dashboard verisi alinamadi.");
    }
    const payload = (await res.json()) as DashboardResponse;
    setDashboard(payload);
  }

  async function fetchUsers(query = "") {
    const url = new URL("/api/admin/users", window.location.origin);
    if (query.trim()) {
      url.searchParams.set("q", query.trim());
    }
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Kullanici listesi alinamadi.");
    }
    const payload = (await res.json()) as UsersResponse;
    setUsers(payload.users);
    setPlanDraftByUserId((prev) => {
      const next = { ...prev };
      for (const user of payload.users) {
        if (!next[user.id]) {
          next[user.id] = user.planId;
        }
      }
      return next;
    });
  }

  async function fetchNotifications() {
    const res = await fetch("/api/admin/notifications", { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Bildirim listesi alinamadi.");
    }
    const payload = (await res.json()) as NotificationsResponse;
    setNotifications(payload.notifications);
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchDashboard(), fetchUsers(searchQuery), fetchNotifications()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Beklenmeyen hata.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, []);

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await fetchUsers(searchQuery);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Arama basarisiz.");
    } finally {
      setLoading(false);
    }
  }

  async function updateUserPlan(userId: string) {
    const nextPlanId = planDraftByUserId[userId];
    if (!nextPlanId) return;

    setUpdatingUserId(userId);
    setComposeStatus(null);

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/subscription`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ planId: nextPlanId }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Plan guncellenemedi.");
      }

      await Promise.all([fetchUsers(searchQuery), fetchDashboard()]);
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Plan guncelleme hatasi."
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function sendNotification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setComposeStatus(null);
    const title = composeTitle.trim();
    const message = composeMessage.trim();

    if (!title || !message) {
      setComposeStatus("Baslik ve mesaj zorunlu.");
      return;
    }

    if (composeTarget === "user" && !composeUserId) {
      setComposeStatus("Tekil bildirim icin kullanici sec.");
      return;
    }

    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title,
          message,
          type: composeType,
          target: composeTarget,
          userId: composeTarget === "user" ? composeUserId : undefined,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(payload?.error || "Bildirim gonderilemedi.");
      }

      setComposeTitle("");
      setComposeMessage("");
      setComposeStatus(`Gonderildi (${payload?.recipientCount ?? 0} alici).`);
      await Promise.all([fetchNotifications(), fetchUsers(searchQuery), fetchDashboard()]);
    } catch (sendError) {
      setComposeStatus(
        sendError instanceof Error ? sendError.message : "Bildirim gonderilemedi."
      );
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(232,77,77,.16), transparent 32%), #080a10",
        color: "#eef2ff",
        padding: "24px 20px 40px",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".14em",
                color: "#ff9a9a",
                marginBottom: 8,
                fontWeight: 800,
              }}
            >
              SellBoost Admin Console
            </div>
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.06 }}>Canli Operasyon Paneli</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              loadAll().catch(() => undefined);
            }}
            style={{
              height: 40,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.04)",
              color: "#fff",
              padding: "0 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Yenile
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {(["dashboard", "users", "notifications"] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
              style={{
                height: 36,
                borderRadius: 999,
                padding: "0 14px",
                border:
                  tab === tabKey
                    ? "1px solid rgba(232,77,77,.7)"
                    : "1px solid rgba(255,255,255,.14)",
                background:
                  tab === tabKey ? "rgba(232,77,77,.22)" : "rgba(255,255,255,.03)",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {tabKey === "dashboard"
                ? "Dashboard"
                : tabKey === "users"
                  ? "Kullanicilar"
                  : "Bildirimler"}
            </button>
          ))}
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(239,68,68,.35)",
              background: "rgba(239,68,68,.12)",
              color: "#ffcaca",
            }}
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div
            style={{
              padding: "30px 18px",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 16,
              background: "rgba(11,13,20,.86)",
            }}
          >
            Veriler yukleniyor...
          </div>
        ) : null}

        {!loading && tab === "dashboard" && dashboard ? (
          <section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {[
                ["Toplam Kullanici", dashboard.metrics.totalUsers],
                ["Son 30 Gun Yeni", dashboard.metrics.usersLast30Days],
                ["Aktif Abonelik", dashboard.metrics.activeSubscriptions],
                ["30 Gun Rapor", dashboard.metrics.reportsLast30Days],
                ["7 Gun Rapor", dashboard.metrics.reportsLast7Days],
                ["Okunmamis Bildirim", dashboard.metrics.unreadNotificationReceipts],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  style={{
                    border: "1px solid rgba(255,255,255,.1)",
                    borderRadius: 14,
                    background: "rgba(11,13,20,.86)",
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: "#8f99b4",
                      marginBottom: 8,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{String(value)}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))",
                gap: 12,
              }}
            >
              <div
                style={{
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 14,
                  background: "rgba(11,13,20,.86)",
                  padding: 14,
                }}
              >
                <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Son Plan Gecisleri</h2>
                <div style={{ display: "grid", gap: 8 }}>
                  {dashboard.latestUpgrades.length === 0 ? (
                    <div style={{ color: "#97a2bf" }}>Kayit yok.</div>
                  ) : (
                    dashboard.latestUpgrades.map((item) => (
                      <div
                        key={`${item.userId}-${item.updatedAt}`}
                        style={{
                          border: "1px solid rgba(255,255,255,.08)",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "rgba(255,255,255,.02)",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {item.user?.name || item.user?.email || item.userId}
                        </div>
                        <div style={{ color: "#9ba5c0", fontSize: 13 }}>
                          {item.variant || "-"} · {formatDate(item.updatedAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 14,
                  background: "rgba(11,13,20,.86)",
                  padding: 14,
                }}
              >
                <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Son Raporlar</h2>
                <div style={{ display: "grid", gap: 8 }}>
                  {dashboard.latestReports.length === 0 ? (
                    <div style={{ color: "#97a2bf" }}>Kayit yok.</div>
                  ) : (
                    dashboard.latestReports.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          border: "1px solid rgba(255,255,255,.08)",
                          borderRadius: 10,
                          padding: "10px 12px",
                          background: "rgba(255,255,255,.02)",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {item.user?.name || item.user?.email || "Guest"}
                        </div>
                        <div
                          style={{
                            color: "#9ba5c0",
                            fontSize: 12,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.url}
                        </div>
                        <div style={{ color: "#9ba5c0", fontSize: 13 }}>
                          Skor: {item.overallScore ?? "-"} · {formatDate(item.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && tab === "users" ? (
          <section>
            <form
              onSubmit={handleSearchSubmit}
              style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
            >
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Isim, e-posta, kullanici adi ara..."
                style={{
                  height: 38,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,.14)",
                  background: "rgba(255,255,255,.04)",
                  color: "#fff",
                  padding: "0 12px",
                  minWidth: 280,
                }}
              />
              <button
                type="submit"
                style={{
                  height: 38,
                  borderRadius: 10,
                  border: "1px solid rgba(79,127,255,.45)",
                  background: "rgba(79,127,255,.2)",
                  color: "#fff",
                  fontWeight: 700,
                  padding: "0 14px",
                  cursor: "pointer",
                }}
              >
                Ara
              </button>
            </form>

            <div
              style={{
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 14,
                background: "rgba(11,13,20,.86)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
                  gap: 10,
                  padding: "10px 12px",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  color: "#8f99b4",
                  borderBottom: "1px solid rgba(255,255,255,.08)",
                }}
              >
                <div>Kullanici</div>
                <div>Plan</div>
                <div>Abonelik</div>
                <div>Rapor</div>
                <div>Bildirim</div>
                <div>Islem</div>
              </div>
              {users.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{getDisplayName(user)}</div>
                    <div style={{ fontSize: 12, color: "#96a1bc" }}>{user.email}</div>
                  </div>
                  <div>
                    <select
                      value={planDraftByUserId[user.id] || user.planId}
                      onChange={(event) => {
                        const value = event.target.value as AdminUser["planId"];
                        setPlanDraftByUserId((prev) => ({ ...prev, [user.id]: value }));
                      }}
                      style={{
                        width: "100%",
                        height: 32,
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,.14)",
                        background: "rgba(255,255,255,.05)",
                        color: "#fff",
                        padding: "0 8px",
                      }}
                    >
                      {planOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ color: "#97a2bf", fontSize: 13 }}>
                    {user.subscriptionStatus || "-"}
                  </div>
                  <div style={{ color: "#97a2bf", fontSize: 13 }}>
                    {user.reportCount}
                    <div style={{ fontSize: 11, color: "#73809f" }}>
                      {formatDate(user.lastReportAt)}
                    </div>
                  </div>
                  <div style={{ color: "#97a2bf", fontSize: 13 }}>
                    {user.unreadNotificationCount}
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={updatingUserId === user.id}
                      onClick={() => updateUserPlan(user.id)}
                      style={{
                        width: "100%",
                        height: 32,
                        borderRadius: 8,
                        border: "1px solid rgba(232,77,77,.45)",
                        background: "rgba(232,77,77,.2)",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                        opacity: updatingUserId === user.id ? 0.7 : 1,
                      }}
                    >
                      {updatingUserId === user.id ? "Guncelleniyor" : "Plani Kaydet"}
                    </button>
                  </div>
                </div>
              ))}
              {users.length === 0 ? (
                <div style={{ padding: 14, color: "#9ba5c0" }}>Kullanici bulunamadi.</div>
              ) : null}
            </div>
          </section>
        ) : null}

        {!loading && tab === "notifications" ? (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(300px,420px) minmax(0,1fr)",
              gap: 12,
            }}
          >
            <form
              onSubmit={sendNotification}
              style={{
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 14,
                background: "rgba(11,13,20,.86)",
                padding: 14,
                display: "grid",
                gap: 10,
                alignContent: "start",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18 }}>Yeni Bildirim</h2>

              <div>
                <div style={{ fontSize: 12, marginBottom: 6, color: "#9da8c3" }}>Hedef</div>
                <select
                  value={composeTarget}
                  onChange={(event) =>
                    setComposeTarget(event.target.value === "user" ? "user" : "all")
                  }
                  style={{
                    width: "100%",
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.14)",
                    background: "rgba(255,255,255,.05)",
                    color: "#fff",
                    padding: "0 8px",
                  }}
                >
                  <option value="all">Tum kullanicilar</option>
                  <option value="user">Tek kullanici</option>
                </select>
              </div>

              {composeTarget === "user" ? (
                <div>
                  <div style={{ fontSize: 12, marginBottom: 6, color: "#9da8c3" }}>
                    Kullanici
                  </div>
                  <select
                    value={composeUserId}
                    onChange={(event) => setComposeUserId(event.target.value)}
                    style={{
                      width: "100%",
                      height: 36,
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.05)",
                      color: "#fff",
                      padding: "0 8px",
                    }}
                  >
                    <option value="">Kullanici sec</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {getDisplayName(user)} · {user.email}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <div style={{ fontSize: 12, marginBottom: 6, color: "#9da8c3" }}>Tip</div>
                <select
                  value={composeType}
                  onChange={(event) =>
                    setComposeType(
                      event.target.value as (typeof notificationTypeOptions)[number]
                    )
                  }
                  style={{
                    width: "100%",
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.14)",
                    background: "rgba(255,255,255,.05)",
                    color: "#fff",
                    padding: "0 8px",
                  }}
                >
                  {notificationTypeOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <input
                value={composeTitle}
                onChange={(event) => setComposeTitle(event.target.value)}
                placeholder="Baslik"
                style={{
                  height: 38,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,.14)",
                  background: "rgba(255,255,255,.05)",
                  color: "#fff",
                  padding: "0 10px",
                }}
              />
              <textarea
                value={composeMessage}
                onChange={(event) => setComposeMessage(event.target.value)}
                placeholder="Mesaj"
                style={{
                  minHeight: 110,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,.14)",
                  background: "rgba(255,255,255,.05)",
                  color: "#fff",
                  padding: "10px",
                  resize: "vertical",
                }}
              />
              <button
                type="submit"
                style={{
                  height: 38,
                  borderRadius: 8,
                  border: "1px solid rgba(232,77,77,.45)",
                  background: "rgba(232,77,77,.2)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Bildirim Gonder
              </button>
              {composeStatus ? (
                <div style={{ color: "#b8c5e6", fontSize: 13 }}>{composeStatus}</div>
              ) : null}
            </form>

            <div
              style={{
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 14,
                background: "rgba(11,13,20,.86)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid rgba(255,255,255,.08)",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                Gonderilen Bildirimler
              </div>
              <div style={{ display: "grid" }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 14, color: "#9ba5c0" }}>Bildirim yok.</div>
                ) : (
                  notifications.map((item) => {
                    const targetUser =
                      item.targetUserId && usersById.has(item.targetUserId)
                        ? usersById.get(item.targetUserId)
                        : null;
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid rgba(255,255,255,.08)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <strong>{item.title}</strong>
                          <span
                            style={{
                              fontSize: 11,
                              letterSpacing: ".08em",
                              textTransform: "uppercase",
                              color: "#ffb1b1",
                              border: "1px solid rgba(255,120,120,.3)",
                              borderRadius: 999,
                              padding: "2px 8px",
                            }}
                          >
                            {item.type}
                          </span>
                        </div>
                        <div style={{ color: "#a4afc9", marginTop: 4 }}>{item.message}</div>
                        <div style={{ color: "#8f9ab5", marginTop: 6, fontSize: 12 }}>
                          {item.targetScope === "ALL_USERS"
                            ? `Tum kullanicilar · Alici: ${item.deliveryCount}`
                            : `Tek kullanici · ${
                                targetUser
                                  ? `${getDisplayName(targetUser)} (${targetUser.email})`
                                  : item.targetUserId || "-"
                              }`}{" "}
                          · {formatDate(item.createdAt)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
