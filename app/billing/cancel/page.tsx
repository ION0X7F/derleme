import Link from "next/link";
import { getPlanDisplayName, isAppPlanId } from "@/lib/plans";

type Props = {
  searchParams?: Promise<{
    plan?: string;
    reason?: string;
  }>;
};

function getReasonCopy(reason?: string) {
  if (reason === "missing-price") {
    return "Bu plan icin Stripe fiyat tanimi bulunamadi. Ortam degiskenlerini kontrol et.";
  }

  if (reason === "invalid-plan") {
    return "Gecersiz plan secimi alindi. Lutfen pricing ekranindan tekrar dene.";
  }

  if (reason === "session-url") {
    return "Checkout oturumu olustu ama yonlendirme URL'i alinamadi. Tekrar dene.";
  }

  return "Odeme akisi tamamlanmadi. Hazir oldugunda ayni plani tekrar baslatabilirsin.";
}

export default async function BillingCancelPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : undefined;
  const rawPlan = String(params?.plan || "").trim().toUpperCase();
  const planLabel = isAppPlanId(rawPlan) ? getPlanDisplayName(rawPlan) : null;
  const reason = String(params?.reason || "").trim().toLowerCase();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px",
        background:
          "radial-gradient(circle at top, rgba(79,127,255,.12), transparent 28%), #09090e",
        color: "#f7f8fb",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          padding: 32,
          borderRadius: 24,
          background: "rgba(17,19,28,.94)",
          border: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 24px 60px rgba(0,0,0,.28)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "#ffb4b4",
            marginBottom: 12,
          }}
        >
          Odeme Tamamlanmadi
        </div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "0 0 14px" }}>
          Akis durduruldu
        </h1>
        <p style={{ margin: "0 0 16px", color: "#b9c2d8", lineHeight: 1.7 }}>
          {getReasonCopy(reason)}
        </p>
        {planLabel ? (
          <p style={{ margin: "0 0 24px", color: "#dce4f6" }}>
            Secilen plan: <strong>{planLabel}</strong>
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href={isAppPlanId(rawPlan) && rawPlan !== "FREE" ? `/checkout?plan=${rawPlan}` : "/pricing"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 46,
              padding: "0 18px",
              borderRadius: 999,
              background: "#4f7fff",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Tekrar Dene
          </Link>
          <Link
            href="/pricing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 46,
              padding: "0 18px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.12)",
              color: "#dce4f6",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Pricing&apos;e Don
          </Link>
        </div>
      </div>
    </main>
  );
}
