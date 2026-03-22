"use client";

import Link from "next/link";
import { useState } from "react";
import SiteHeader from "@/components/layout/SiteHeader";

const benefits = [
  "Kayıtlı dashboard ve rapor geçmişi",
  "Daha fazla analiz hakkı",
  "Trendyol odaklı premium UI deneyimi",
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Bir hata oluştu.");
        return;
      }

      setMessage("Kayıt başarılı. Şimdi giriş yapabilirsin.");
      setForm({
        name: "",
        email: "",
        password: "",
      });
    } catch {
      setError("Sunucu hatası oluştu.");
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
            <div className="eyebrow">Onboarding başlangıcı</div>
            <div className="sb-stack-16">
              <h1 className="section-title">SellBoost AI ile ürün kararlarını merkezileştir.</h1>
              <p className="section-text">
                Kayıt olduğunda dashboard, rapor kütüphanesi ve plan bazlı analiz akışı
                aynı premium arayüzde açılır.
              </p>
            </div>

            <div className="auth-panel__hero sb-stack-12">
              <div className="stat-card__label">Hızlı başlangıç</div>
              <div className="card-heading" style={{ fontSize: 20, marginBottom: 0 }}>
                İlk kayıtla birlikte daha ciddi, daha güven veren bir analiz paneline girersin.
              </div>
              <p className="card-copy">
                Bu ekran onboarding başlangıcı gibi davranır; form kadar ürün değerini de hissettirir.
              </p>
            </div>

            <div className="surface-soft" style={{ padding: 18 }}>
              <div className="card-heading" style={{ fontSize: 18, marginBottom: 8 }}>
                Ücretsiz başlangıç
              </div>
              <p className="card-copy" style={{ marginBottom: 14 }}>
                İlk aşamada temel kullanım ile başla; ihtiyaç büyüdükçe daha derin premium analiz katmanına geç.
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
              <div className="eyebrow">Kayıt Ol</div>
              <div>
                <h2 className="card-heading" style={{ fontSize: 30, marginBottom: 10 }}>
                  Hesabını oluştur
                </h2>
                <p className="card-copy">
                  Birkaç alan doldur, sonra Trendyol linklerini kayıtlı ve daha güvenli bir akışta analiz etmeye başla.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="form-label">
                <span>Ad Soyad</span>
                <input
                  type="text"
                  placeholder="Adın ve soyadın"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="input"
                  autoComplete="name"
                />
              </label>

              <label className="form-label">
                <span>E-posta</span>
                <input
                  type="email"
                  placeholder="ornek@markan.com"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="input"
                  autoComplete="email"
                />
              </label>

              <label className="form-label">
                <span>Şifre</span>
                <input
                  type="password"
                  placeholder="En az 6 karakterlik bir şifre belirle"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  className="input"
                  autoComplete="new-password"
                />
                <span className="field-hint">
                  Güçlü bir şifre için harf, rakam ve ayırt edici karakter kombinasyonu kullan.
                </span>
              </label>

              <div className="auth-benefit-list">
                <div className="auth-benefit">Kayıtlı dashboard ve rapor kütüphanesi</div>
                <div className="auth-benefit">
                  Plan seviyesi büyüdükçe aynı arayüzde daha derin karar katmanı
                </div>
              </div>

              {message && <div className="alert alert-success">{message}</div>}
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-actions">
                <Link href="/login" className="text-link">
                  Zaten hesabım var
                </Link>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner" />
                      <span>Kaydediliyor</span>
                    </>
                  ) : (
                    "Kayıt Ol"
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
