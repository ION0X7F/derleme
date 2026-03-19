"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AnalyzeForm from "@/components/AnalyzeForm";
import AppChrome from "@/components/layout/AppChrome";

type UsageInfo = {
  type: "user" | "guest";
  planLabel?: string;
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  periodKey: string;
  periodType: string;
  renewalDate?: string;
  usageStatus?: {
    percent: number;
    tone: "good" | "warn" | "danger";
    badge: string;
    shortMessage: string;
    detailMessage: string;
    upgradeMessage: string | null;
  };
};

function getPlanHint(usage: UsageInfo | null) {
  if (!usage) return null;

  if (usage.type === "guest") {
    return {
      title: "Guest modundasin",
      detail:
        "Aylik 2 analiz hakkindan sonra giris yapman gerekir. Free uyelikte daha genis panel acilir.",
    };
  }

  if (usage.planLabel === "Pro") {
    return {
      title: "Pro paket aktif",
      detail:
        "Premium AI raporlari, export ve daha derin Trendyol aksiyon plani aktif.",
    };
  }

  return {
    title: "Free paket aktif",
    detail:
      "Temel analiz acik. Premium fiyat yorumu, export ve daha derin aksiyon katmani ust pakette acilir.",
  };
}

function toneClass(tone?: "good" | "warn" | "danger") {
  if (tone === "danger") return "status-danger";
  if (tone === "warn") return "status-warn";
  return "status-good";
}

export default function AnalyzePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      try {
        setUsageLoading(true);

        const res = await fetch("/api/usage/analyze", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.message || data.error || "Kullanim bilgisi alinamadi.");
          return;
        }

        setUsage(data);
      } catch {
        setError("Kullanim bilgisi alinirken hata olustu.");
      } finally {
        setUsageLoading(false);
      }
    }

    fetchUsage();
  }, []);

  async function handleAnalyze() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.usage) {
          setUsage(data.usage);
        }

        setError(data.message || data.error || "Bir hata olustu.");
        return;
      }

      if (data?.usage) {
        setUsage(data.usage);
      }

      if (data?.report?.id) {
        router.push(`/reports/${data.report.id}`);
        return;
      }

      setError("Rapor olustu ama yonlendirme icin report id bulunamadi.");
    } catch {
      setError("Sunucu hatasi olustu.");
    } finally {
      setLoading(false);
    }
  }

  const usagePercent = usage?.usageStatus?.percent ?? 0;
  const planHint = getPlanHint(usage);
  const showUpgradeNudge = !!usage && (usage.remaining <= 2 || !usage.allowed);

  return (
    <AppChrome
      currentPath="/analyze"
      eyebrow="Yeni analiz"
      title="Yeni Trendyol analizi baslat"
      description="Linki gir, kullanim durumunu gor ve rapor detay ekranina dogrudan gec."
      navItems={[
        { href: "/dashboard", label: "Dashboard" },
        { href: "/analyze", label: "Yeni Analiz" },
        { href: "/", label: "Ana Sayfa" },
      ]}
      headerMeta={
        <>
          <span className="hero-point">{usage?.planLabel || (usage?.type === "guest" ? "Guest" : "Free")}</span>
          <span className="hero-point">{usageLoading ? "Kullanim hazirlaniyor" : `${usage?.remaining ?? "-"} hak`}</span>
          {usage?.usageStatus?.badge && (
            <span className={`hero-point ${toneClass(usage.usageStatus.tone)}`}>
              {usage.usageStatus.badge}
            </span>
          )}
        </>
      }
      actions={
        <Link href="/dashboard" className="btn btn-secondary">
          Dashboarda Don
        </Link>
      }
      sidebarMeta={
        <>
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Paket</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {usage?.planLabel || (usage?.type === "guest" ? "Guest" : "Free")}
            </div>
            <p className="card-copy">Analiz hakkini ve premium acilan katmanlari buradan izleyebilirsin.</p>
          </div>
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Kalan hak</div>
            <div className="auth-panel__value">{usageLoading ? "..." : usage?.remaining ?? "-"}</div>
            <p className="card-copy">
              {usageLoading
                ? "Kullanim bilgisi yukleniyor."
                : usage?.usageStatus?.shortMessage || "Analiz hakkin aktif."}
            </p>
          </div>
        </>
      }
    >
      <section className="surface app-card sb-stack-20">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Analiz girisi</h2>
            <p className="section-card__text">
              Trendyol urun linkini girerek premium karar paneli akisina gec.
            </p>
          </div>

          <div className="pill-row">
            <span className="hero-point">AI teshis</span>
            <span className="hero-point">Rakip baskisi</span>
            <span className="hero-point">Kaydedilmis rapor akisi</span>
          </div>
        </div>

        <AnalyzeForm
          url={url}
          loading={loading}
          onChange={setUrl}
          onSubmit={handleAnalyze}
        />

        {error && <div className="alert alert-error">{error}</div>}
      </section>

      <div className="section-grid-2">
        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Kullanim durumu</h2>
              <p className="section-card__text">
                Mevcut donem kullanimi, kalan hak ve yenilenme tarihi.
              </p>
            </div>
          </div>

          {usageLoading ? (
            <div className="state-card state-card--loading">
              <div className="state-card__icon">
                <div className="spinner" />
              </div>
              <h3 className="state-card__title">Kullanim bilgisi geliyor</h3>
              <p className="state-card__text">Plan ve limit verileri hazirlaniyor.</p>
            </div>
          ) : usage ? (
            <div className="sb-stack-16">
              <div className="pill-row">
                <span className="hero-point">{usage.planLabel || usage.type}</span>
                <span className={`hero-point ${toneClass(usage.usageStatus?.tone)}`}>
                  {usage.usageStatus?.badge || "Aktif"}
                </span>
                <span className="hero-point">{usage.periodType}</span>
              </div>

              <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                <div className="stat-card">
                  <div className="stat-card__label">Kalan</div>
                  <div className="stat-card__value">{usage.remaining}</div>
                  <div className="stat-card__text">Kalan analiz hakki</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Kullanilan</div>
                  <div className="stat-card__value">{usage.used}</div>
                  <div className="stat-card__text">Bu donem harcanan analiz</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Limit</div>
                  <div className="stat-card__value">{usage.limit}</div>
                  <div className="stat-card__text">Donemsel toplam limit</div>
                </div>
              </div>

              <div className="surface-soft" style={{ padding: 16 }}>
                <div className="stat-card__label">Kullanim orani</div>
                <div
                  style={{
                    width: "100%",
                    height: 12,
                    borderRadius: 999,
                    background: "color-mix(in srgb, var(--surface-strong) 100%, transparent)",
                    overflow: "hidden",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: `${usagePercent}%`,
                      height: "100%",
                      borderRadius: 999,
                      background:
                        usage.usageStatus?.tone === "danger"
                          ? "linear-gradient(90deg, var(--danger), color-mix(in srgb, var(--danger) 70%, white 30%))"
                          : usage.usageStatus?.tone === "warn"
                            ? "linear-gradient(90deg, var(--warning), color-mix(in srgb, var(--warning) 70%, white 30%))"
                            : "linear-gradient(90deg, var(--success), color-mix(in srgb, var(--success) 70%, white 30%))",
                    }}
                  />
                </div>
                <p className={`card-copy ${toneClass(usage.usageStatus?.tone)}`}>
                  {usage.usageStatus?.detailMessage || "Analiz hakkin aktif."}
                </p>
                {usage.renewalDate && (
                  <p className="field-hint">
                    Yenilenme: {new Date(usage.renewalDate).toLocaleDateString("tr-TR")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="state-card state-card--error">
              <div className="state-card__icon">ERR</div>
              <h3 className="state-card__title">Kullanim bilgisi yok</h3>
              <p className="state-card__text">Bu alan su an goruntulenemiyor.</p>
            </div>
          )}
        </section>

        <section className="surface app-card sb-stack-16">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Plan notu</h2>
              <p className="section-card__text">
                Uygun yerde kullaniciyi yormadan premium farki hissettiren yonlendirme alani.
              </p>
            </div>
          </div>

          {planHint && (
            <div className="surface-soft" style={{ padding: 18 }}>
              <div className="card-heading" style={{ fontSize: 18, marginBottom: 8 }}>
                {planHint.title}
              </div>
              <p className="card-copy">{planHint.detail}</p>
            </div>
          )}

          {showUpgradeNudge && (
            <div className="alert alert-warning">
              {usage?.usageStatus?.upgradeMessage ||
                "Pro seviyesinde daha fazla analiz hakki, export ve daha derin Trendyol aksiyon plani acilir."}
            </div>
          )}

          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link href="/dashboard" className="btn btn-secondary">
              Paket detaylari
            </Link>
            <Link href="/fiyatlandirma" className="btn btn-primary">
              Planlari karsilastir
            </Link>
          </div>
        </section>
      </div>

      <section className="surface app-card sb-stack-16">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Bu ekranda ne olacak?</h2>
            <p className="section-card__text">
              Link girildikten sonra sistem once sayfayi okur, sonra veriyi
              carptirir ve raporu kaydedilmis karar ekranina tasir.
            </p>
          </div>
        </div>

        <div className="section-grid-3">
          {[
            {
              title: "Veri cekimi",
              text: "Urun sayfasi, fiyat, yorum, teslimat ve rakip sinyalleri toplanir.",
            },
            {
              title: "AI muhakemesi",
              text: "Darbogaz, celiski ve oncelikli aksiyonlar tek akista uretilir.",
            },
            {
              title: "Kayitli rapor",
              text: "Sonuc detay ekranina tasinir; tekrar acilabilir ve export akisina girer.",
            },
          ].map((item) => (
            <article key={item.title} className="surface-soft feature-card">
              <div className="card-heading">{item.title}</div>
              <p className="card-copy">{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </AppChrome>
  );
}
