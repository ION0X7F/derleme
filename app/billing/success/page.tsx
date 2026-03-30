"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RefreshState = "pending" | "success" | "timeout" | "error";

export default function BillingSuccessPage() {
  const [state, setState] = useState<RefreshState>("pending");

  useEffect(() => {
    let cancelled = false;

    async function refreshPlan() {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const response = await fetch("/api/auth/refresh-plan", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
          });

          const payload = await response.json().catch(() => null);
          const plan = String(payload?.plan || payload?.session?.user?.plan || "")
            .trim()
            .toUpperCase();

          if (response.ok && plan === "PREMIUM") {
            if (!cancelled) {
              setState("success");
            }
            return;
          }
        } catch {
          // Webhook may still be processing, try again briefly.
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      if (!cancelled) {
        setState("timeout");
      }
    }

    refreshPlan().catch(() => {
      if (!cancelled) {
        setState("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const copy =
    state === "success"
      ? "Odeme onaylandi ve hesabin premium plana gecirildi."
      : state === "timeout"
        ? "Odeme tamamlandi. Plan guncellemesi biraz gecikiyor olabilir; hesap sayfasini yenileyince gorunmelidir."
        : state === "error"
          ? "Odeme tamamlandi ancak plan yenileme kontrolu sirasinda gecici bir hata olustu."
          : "Odeme onayini bekliyoruz. Planin otomatik olarak hesabina isleniyor.";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px",
        background:
          "radial-gradient(circle at top, rgba(79,127,255,.16), transparent 28%), #09090e",
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
            color: "#00d4a8",
            marginBottom: 12,
          }}
        >
          Odeme Basarili
        </div>
        <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "0 0 14px" }}>
          Premium gecis isleniyor
        </h1>
        <p style={{ margin: "0 0 24px", color: "#b9c2d8", lineHeight: 1.7 }}>
          {copy}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/account"
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
            Hesaba Don
          </Link>
          <Link
            href="/reports"
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
            Raporlara Git
          </Link>
        </div>
      </div>
    </main>
  );
}
