"use client";

import Link from "next/link";
import { useState } from "react";
import SiteHeader from "@/components/layout/SiteHeader";

const benefits = [
  "Kayitli dashboard ve rapor gecmisi",
  "Daha fazla analiz hakki",
  "Trendyol odakli premium UI deneyimi",
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Bir hata olustu.");
        return;
      }

      setMessage("Kayit basarili. Simdi giris yapabilirsin.");
      setForm({
        name: "",
        email: "",
        password: "",
      });
    } catch {
      setError("Sunucu hatasi olustu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sb-shell">
      <SiteHeader />

      <main className="auth-shell">
        <div className="sb-container auth-grid">
          <section className="surface auth-panel sb-stack-20">
            <div className="eyebrow">Onboarding baslangici</div>
            <div className="sb-stack-16">
              <h1 className="section-title">SellBoost AI ile urun kararlarini merkezilestir.</h1>
              <p className="section-text">
                Kayit oldugunda dashboard, rapor kutuphanesi ve plan bazli analiz akisi ayni premium arayuzde acilir.
              </p>
            </div>

            <div className="auth-panel__hero sb-stack-12">
              <div className="stat-card__label">Hizli baslangic</div>
              <div className="card-heading" style={{ fontSize: 20, marginBottom: 0 }}>
                Ilk kayitla birlikte daha ciddi, daha guven veren bir analiz paneline girersin.
              </div>
              <p className="card-copy">
                Bu ekran onboarding baslangici gibi davranir; form kadar urun degerini de hissettirir.
              </p>
            </div>

            <div className="surface-soft" style={{ padding: 18 }}>
              <div className="card-heading" style={{ fontSize: 18, marginBottom: 8 }}>
                Ucretsiz baslangic
              </div>
              <p className="card-copy" style={{ marginBottom: 14 }}>
                Ilk asamada temel kullanimla basla; ihtiyac buyudukce daha derin premium analiz katmanina gec.
              </p>
              <div className="sb-stack-12">
                {benefits.map((benefit) => (
                  <div key={benefit} className="hero-point">
                    {benefit}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="surface auth-form-card sb-stack-20">
            <div className="sb-stack-12">
              <div className="eyebrow">Kayit Ol</div>
              <div>
                <h2 className="card-heading" style={{ fontSize: 30, marginBottom: 10 }}>
                  Hesabini olustur
                </h2>
                <p className="card-copy">
                  Birkac alan doldur, sonra Trendyol linklerini kayitli ve daha guvenli bir akista analiz etmeye basla.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="form-label">
                <span>Ad Soyad</span>
                <input
                  type="text"
                  placeholder="Adin ve soyadin"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  autoComplete="name"
                />
              </label>

              <label className="form-label">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="ornek@markan.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                  autoComplete="email"
                />
              </label>

              <label className="form-label">
                <span>Sifre</span>
                <input
                  type="password"
                  placeholder="En az guclu bir sifre belirle"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input"
                  autoComplete="new-password"
                />
                <span className="field-hint">
                  Guclu bir sifre icin harf, rakam ve ayirt edici bir karakter kombinasyonu kullan.
                </span>
              </label>

              <div className="auth-benefit-list">
                <div className="auth-benefit">Kayitli dashboard ve rapor kutuphanesi</div>
                <div className="auth-benefit">Plan seviyesi buyudukce ayni arayuzde daha derin karar katmani</div>
              </div>

              {message && <div className="alert alert-success">{message}</div>}
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-actions">
                <Link href="/login" className="text-link">
                  Zaten hesabim var
                </Link>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner" />
                      <span>Kaydediliyor</span>
                    </>
                  ) : (
                    "Kayit Ol"
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
