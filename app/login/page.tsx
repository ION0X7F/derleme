"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import SiteHeader from "@/components/layout/SiteHeader";

const highlights = [
  {
    value: "AI",
    label: "Stratejik teshis",
    text: "Veriyi sade degil, karar verdiren bir akista yorumlar.",
  },
  {
    value: "Pro",
    label: "Premium rapor hissi",
    text: "Rapor gecmisi, karar paneli ve premium ekran dili ile gelir.",
  },
  {
    value: "TR",
    label: "Trendyol odagi",
    text: "Pazar yeri davranisini urun, teklif ve guven sinyallerinden okur.",
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setLoading(false);

    if (result?.error) {
      setError("Email veya sifre hatali.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="sb-shell">
      <SiteHeader />

      <main className="auth-shell">
        <div className="sb-container auth-grid">
          <section className="surface auth-panel sb-stack-20">
            <div className="eyebrow">Tekrar hos geldin</div>
            <div className="sb-stack-16">
              <h1 className="section-title">SellBoost AI paneline guvenli giris yap.</h1>
              <p className="section-text">
                Kayitli raporlarina, analiz kutuphanene ve premium karar paneline
                kaldigin yerden devam et.
              </p>
            </div>

            <div className="auth-panel__hero sb-stack-12">
              <div className="stat-card__label">Canli yuzey</div>
              <div className="card-heading" style={{ fontSize: 20, marginBottom: 0 }}>
                Kayitli analizler, premium karar dili ve rapor merkezi tek giriste acilir.
              </div>
              <p className="card-copy">
                Auth ekrani sadece form degil; urune donus hissi veren ilk temas noktasi
                olarak kurgulandi.
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
              <div className="eyebrow">Giris Yap</div>
              <div>
                <h2 className="card-heading" style={{ fontSize: 30, marginBottom: 10 }}>
                  Hesabina baglan
                </h2>
                <p className="card-copy">
                  Dashboard, rapor detaylari ve kayitli Trendyol analizlerin burada seni bekliyor.
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="auth-form">
              <label className="form-label">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="ornek@markan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  autoComplete="email"
                />
              </label>

              <label className="form-label">
                <span>Sifre</span>
                <input
                  type="password"
                  placeholder="Sifreni gir"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  autoComplete="current-password"
                />
                <span className="field-hint">
                  Sifre unutma akisina hazir yer ayrildi; simdilik mevcut kimlik dogrulamasi ile devam eder.
                </span>
              </label>

              <div className="auth-benefit-list">
                <div className="auth-benefit">Guvenli oturum ve kayitli rapor erisimi</div>
                <div className="auth-benefit">Dashboard ve analiz kutuphanesine dogrudan gecis</div>
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-actions">
                <Link href="/" className="text-link">
                  Ana sayfaya don
                </Link>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner" />
                      <span>Giris yapiliyor</span>
                    </>
                  ) : (
                    "Giris Yap"
                  )}
                </button>
              </div>
            </form>

            <div className="subtle-divider" />

            <p className="text-caption">
              Hesabin yok mu?{" "}
              <Link href="/register" className="text-link" style={{ padding: 0, minHeight: 0 }}>
                Kayit ol
              </Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
