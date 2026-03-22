"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import SiteHeader from "@/components/layout/SiteHeader";

const highlights = [
  {
    value: "AI",
    label: "Stratejik teşhis",
    text: "Veriyi sade değil, karar verdiren bir akışta yorumlar.",
  },
  {
    value: "Pro",
    label: "Premium rapor hissi",
    text: "Rapor geçmişi, karar paneli ve premium ekran dili ile gelir.",
  },
  {
    value: "TR",
    label: "Trendyol odağı",
    text: "Pazar yeri davranışını ürün, teklif ve güven sinyallerinden okur.",
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/dashboard`
        : "/dashboard";

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error || result?.ok === false) {
      setError("E-posta veya şifre hatalı.");
      return;
    }

    window.location.href = callbackUrl;
  }

  return (
    <div className="sb-shell">
      <SiteHeader />

      <main className="auth-shell">
        <div className="sb-container auth-grid">
          <section className="surface auth-panel sb-stack-20">
            <div className="eyebrow">Tekrar hoş geldin</div>
            <div className="sb-stack-16">
              <h1 className="section-title">SellBoost AI paneline güvenli giriş yap.</h1>
              <p className="section-text">
                Kayıtlı raporlarına, analiz kütüphanene ve premium karar paneline
                kaldığın yerden devam et.
              </p>
            </div>

            <div className="auth-panel__hero sb-stack-12">
              <div className="stat-card__label">Canlı yüzey</div>
              <div className="card-heading" style={{ fontSize: 20, marginBottom: 0 }}>
                Kayıtlı analizler, premium karar dili ve rapor merkezi tek girişte açılır.
              </div>
              <p className="card-copy">
                Giriş ekranı yalnızca form değil; ürüne dönüş hissi veren ilk temas
                noktası olarak kurgulandı.
              </p>
            </div>

            <div className="auth-panel__stats">
              {highlights.map((item) => (
                <div key={item.label} className="auth-panel__stat">
                  <div className="auth-panel__value">{item.value}</div>
                  <div className="card-heading" style={{ fontSize: 15, marginBottom: 8 }}>
                    {item.label}
                  </div>
                  <p className="card-copy">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface auth-form-card sb-stack-20">
            <div className="sb-stack-12">
              <div className="eyebrow">Giriş Yap</div>
              <div>
                <h2 className="card-heading" style={{ fontSize: 30, marginBottom: 10 }}>
                  Hesabına bağlan
                </h2>
                <p className="card-copy">
                  Dashboard, rapor detayları ve kayıtlı Trendyol analizlerin burada seni
                  bekliyor.
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="auth-form">
              <label className="form-label">
                <span>E-posta</span>
                <input
                  type="email"
                  placeholder="ornek@markan.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input"
                  autoComplete="email"
                />
              </label>

              <label className="form-label">
                <span>Şifre</span>
                <input
                  type="password"
                  placeholder="Şifreni gir"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input"
                  autoComplete="current-password"
                />
                <span className="field-hint">
                  Şifre sıfırlama akışına uygun alan hazır; şimdilik mevcut kimlik
                  doğrulama ile devam ediyor.
                </span>
              </label>

              <div className="auth-benefit-list">
                <div className="auth-benefit">Güvenli oturum ve kayıtlı rapor erişimi</div>
                <div className="auth-benefit">
                  Dashboard ve analiz kütüphanesine doğrudan geçiş
                </div>
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-actions">
                <Link href="/" className="text-link">
                  Ana sayfaya dön
                </Link>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner" />
                      <span>Giriş yapılıyor</span>
                    </>
                  ) : (
                    "Giriş Yap"
                  )}
                </button>
              </div>
            </form>

            <div className="subtle-divider" />

            <p className="text-caption">
              Hesabın yok mu?{" "}
              <Link href="/register" className="text-link" style={{ padding: 0, minHeight: 0 }}>
                Kayıt ol
              </Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
