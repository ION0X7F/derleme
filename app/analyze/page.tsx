"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AnalyzeForm from "@/components/AnalyzeForm";
import AppChrome from "@/components/layout/AppChrome";

type UsageInfo = {
  type: "user" | "guest";
  planLabel?: string;
  planId?: string;
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

const ANALYSIS_STEPS = [
  {
    title: "Linki ver",
    text: "Trendyol urun URL'si ile extractor, teklif okuma ve karar akisini ayni anda tetikle.",
  },
  {
    title: "Sinyalleri carptir",
    text: "Fiyat, teslimat, yorum, icerik ve guven farklari benchmark ile yan yana tartilsin.",
  },
  {
    title: "Raporu ac",
    text: "Kritik teshis, oncelikli aksiyonlar ve karar izi kayitli ekranda tek seferde gorunsun.",
  },
];

const ANALYSIS_FOCUS_AREAS = [
  {
    label: "Karar katmani",
    title: "Darbogaz adlandirma",
    text: "Sistem, en kritik freni tek cumlede isimlendirip aksiyon rotasini buna gore kurar.",
  },
  {
    label: "Benchmark farki",
    title: "Kategoriye gore sapma",
    text: "Teslimat, gorsel, yorum ve fiyat sadece tekil degil, ortalamaya gore fark olarak okunur.",
  },
  {
    label: "Kayitli akis",
    title: "Rapor ve export devam eder",
    text: "Olusan analiz detay ekrana gider; uygun planda kutuphane ve export zinciri acilir.",
  },
];

const ANALYSIS_OUTPUTS = [
  {
    code: "KT",
    label: "Kritik teshis",
    title: "Ana darbozagi ilk bakista anlarsin",
    text: "Rapor, sorunu daginik yorumlarla degil tek bir merkez teshisle aciklar.",
  },
  {
    code: "AR",
    label: "Aksiyon rotasi",
    title: "Ilk 3 hamle siraya girer",
    text: "Fiyat, icerik, teslimat ya da guven tarafinda hangi hamlenin once gelmesi gerektigi netlesir.",
  },
  {
    code: "KI",
    label: "Karar izi",
    title: "Neden o sonuca vardigini gorursun",
    text: "Tetikleyici sinyaller, benchmark baskisi ve veri sinirlari kullaniciya daha seffaf gorunur.",
  },
];

function getPlanHint(usage: UsageInfo | null) {
  if (!usage) return null;

  if (usage.type === "guest") {
    return {
      title: "Guest modundasin",
      detail:
        "Aylik 2 analiz hakkindan sonra giris yapman gerekir. Free uyelikte daha genis panel acilir.",
    };
  }

  if (usage.planId && usage.planId !== "FREE") {
    return {
      title: `${usage.planLabel || "Premium"} aktif`,
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

function meterFillClass(tone?: "good" | "warn" | "danger") {
  if (tone === "danger") return "analysis-meter__fill analysis-meter__fill--danger";
  if (tone === "warn") return "analysis-meter__fill analysis-meter__fill--warn";
  return "analysis-meter__fill analysis-meter__fill--good";
}

function formatUsageDate(value?: string) {
  if (!value) return "Tarih baglanmadi";

  try {
    return new Date(value).toLocaleDateString("tr-TR");
  } catch {
    return "Tarih baglanmadi";
  }
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
        router.push(`/report/${data.report.id}`);
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
  const usageTone = usage?.usageStatus?.tone ?? "good";
  const planHint = getPlanHint(usage);
  const planLabel =
    usage?.planLabel || (usage?.type === "guest" ? "Guest" : "Ucretsiz");
  const accessModeLabel =
    usage?.type === "guest" ? "Hizli giris" : "Kayitli akis";
  const renewalLabel = formatUsageDate(usage?.renewalDate);
  const showUpgradeNudge = !!usage && (usage.remaining <= 2 || !usage.allowed);
  const usageDetailMessage = usageLoading
    ? "Kullanim, limit ve yenilenme sinyalleri baglaniyor."
    : usage?.usageStatus?.detailMessage ||
      "Analiz hakkin aktif ve karar paneli hazir.";

  const launchMetrics = [
    {
      label: "Plan",
      value: planLabel,
      text: planHint?.title || "Aktif kullanim seviyesi",
    },
    {
      label: "Kalan hak",
      value: usageLoading ? "..." : `${usage?.remaining ?? "-"}`,
      text: usageLoading
        ? "Kullanim hakki hesaplaniyor."
        : usage?.usageStatus?.shortMessage || "Yeni analizler icin kalan hak.",
    },
    {
      label: "Calisma modu",
      value: accessModeLabel,
      text:
        usage?.type === "guest"
          ? "Hizli deneme ekraninda calisir."
          : "Kayitli rapor ekranina gider.",
    },
    {
      label: "Yenilenme",
      value: renewalLabel,
      text: usage?.renewalDate
        ? "Bir sonraki donem baslangici"
        : "Donem tarihi baglaniyor.",
    },
  ];

  return (
    <AppChrome
      currentPath="/analyze"
      eyebrow="Yeni analiz"
      title="Yeni Trendyol analizi kur"
      description="URL'den AI teshis, benchmark farki ve karar izine giden akisi tek merkezden yonet."
      navItems={[
        { href: "/dashboard", label: "Dashboard" },
        { href: "/analyze", label: "Yeni Analiz" },
        { href: "/", label: "Ana Sayfa" },
      ]}
      headerMeta={
        <>
          <span className="hero-point">{planLabel}</span>
          <span className="hero-point">
            {usageLoading ? "Oturum baglaniyor" : `${usage?.remaining ?? "-"} hak`}
          </span>
          <span className={`hero-point ${toneClass(usage?.usageStatus?.tone)}`}>
            {usageLoading
              ? "Hazirlaniyor"
              : usage?.usageStatus?.badge || "Analiz acik"}
          </span>
          <span className="hero-point">Karar izi</span>
        </>
      }
      actions={
        <Link href="/dashboard" className="btn btn-secondary">
          Dashboarda Don
        </Link>
      }
      sidebarMeta={
        <div className="sb-stack-12">
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Analiz modu</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {planLabel}
            </div>
            <p className="card-copy">
              {usageLoading
                ? "Kullanim radari ve limit bilgisi baglaniyor."
                : usage?.usageStatus?.shortMessage || "Analiz paneli hazir."}
            </p>
          </div>

          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Karar cikisi</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {usage?.allowed === false ? "Yonetimli giris" : "Rapor akisi"}
            </div>
            <p className="card-copy">
              Kritik teshis, benchmark farki ve karar izi ayni rapor zincirinde toplanir.
            </p>
          </div>
        </div>
      }
    >
      <section className="surface analysis-launch">
        <div className="analysis-launch__grid">
          <div className="analysis-launch__content">
            <div className="analysis-launch__intro">
              <div className="pill-row">
                <span className="hero-point">Benchmark carpistirma</span>
                <span className="hero-point">AI teshis</span>
                <span className="hero-point">Kayitli rapor akisi</span>
              </div>

              <div className="sb-stack-12">
                <div className="eyebrow">Analiz komut merkezi</div>
                <h2 className="analysis-launch__title">
                  URL adresini ver, sistem once darbozagi sonra aksiyon rotasini kursun.
                </h2>
                <p className="analysis-launch__lead">
                  Bu ekran sadece bir input alani degil. Kullanim sagligi, karar
                  katmani ve rapora tasinan sonuc dili daha linki girmeden okunabilir
                  hale geliyor.
                </p>
              </div>
            </div>

            <AnalyzeForm
              url={url}
              loading={loading}
              onChange={setUrl}
              onSubmit={handleAnalyze}
              variant="workspace"
            />

            {error && <div className="alert alert-error">{error}</div>}

            <div className="analysis-step-grid">
              {ANALYSIS_STEPS.map((item, index) => (
                <article key={item.title} className="analysis-step-card">
                  <div className="analysis-step-card__index">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <h3 className="analysis-step-card__title">{item.title}</h3>
                    <p className="analysis-step-card__text">{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="analysis-launch__rail">
            <div className="analysis-rail-card analysis-rail-card--live">
              <div className="analysis-rail-card__header">
                <div>
                  <div className="stat-card__label">Canli oturum</div>
                  <div className="card-heading" style={{ marginBottom: 6 }}>
                    Analiz hazirlik radari
                  </div>
                </div>

                <span className={`analysis-live-pill ${toneClass(usageTone)}`}>
                  {usageLoading
                    ? "Baglaniyor"
                    : usage?.usageStatus?.badge || "Hazir"}
                </span>
              </div>

              <p className="card-copy">{usageDetailMessage}</p>

              <div className="analysis-meter">
                <div className="analysis-meter__top">
                  <span className="stat-card__label">Donem doluluk orani</span>
                  <span className={`analysis-meter__value ${toneClass(usageTone)}`}>
                    %{usageLoading ? "..." : usagePercent}
                  </span>
                </div>

                <div className="analysis-meter__track">
                  <div
                    className={meterFillClass(usageTone)}
                    style={{ width: `${usageLoading ? 18 : usagePercent}%` }}
                  />
                </div>

                <div className="analysis-meter__caption">
                  <span>
                    {usageLoading
                      ? "Plan verisi geliyor"
                      : usage?.usageStatus?.shortMessage || "Analiz hakkin aktif."}
                  </span>
                  <span>{renewalLabel}</span>
                </div>
              </div>

              <div className="analysis-kpi-grid">
                {launchMetrics.map((item) => (
                  <article key={item.label} className="analysis-kpi">
                    <div className="analysis-kpi__label">{item.label}</div>
                    <div className="analysis-kpi__value">{item.value}</div>
                    <div className="analysis-kpi__text">{item.text}</div>
                  </article>
                ))}
              </div>
            </div>

            <div className="analysis-rail-card">
              <div className="stat-card__label">Karar panelinde acilacak katmanlar</div>

              <div className="analysis-signal-list">
                {ANALYSIS_FOCUS_AREAS.map((item) => (
                  <article key={item.title} className="analysis-signal-card">
                    <div className="analysis-signal-card__eyebrow">{item.label}</div>
                    <div className="analysis-signal-card__title">{item.title}</div>
                    <p className="analysis-signal-card__text">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-grid-2">
        <section className="surface app-card sb-stack-20">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Kullanim radari</h2>
              <p className="section-card__text">
                Donem icindeki kapasite durumunu, kalan hakki ve yenilenme ritmini
                tek bakista oku.
              </p>
            </div>
          </div>

          {usageLoading ? (
            <div className="state-card state-card--loading">
              <div className="state-card__icon">
                <div className="spinner" />
              </div>
              <h3 className="state-card__title">Kullanim bilgisi geliyor</h3>
              <p className="state-card__text">
                Plan, limit ve yenilenme verileri hazirlaniyor.
              </p>
            </div>
          ) : usage ? (
            <div className="sb-stack-20">
              <div className="pill-row">
                <span className="hero-point">{planLabel}</span>
                <span className={`hero-point ${toneClass(usage.usageStatus?.tone)}`}>
                  {usage.usageStatus?.badge || "Aktif"}
                </span>
                <span className="hero-point">{usage.periodType}</span>
              </div>

              <div className="analysis-meter">
                <div className="analysis-meter__top">
                  <span className="stat-card__label">Kullanim orani</span>
                  <span className={`analysis-meter__value ${toneClass(usage.usageStatus?.tone)}`}>
                    %{usagePercent}
                  </span>
                </div>

                <div className="analysis-meter__track">
                  <div
                    className={meterFillClass(usage.usageStatus?.tone)}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>

                <div className="analysis-meter__caption">
                  <span>{usage.usageStatus?.detailMessage || "Analiz hakkin aktif."}</span>
                  <span>{renewalLabel}</span>
                </div>
              </div>

              <div
                className="stat-grid"
                style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
              >
                <div className="stat-card">
                  <div className="stat-card__label">Kalan</div>
                  <div className="stat-card__value">{usage.remaining}</div>
                  <div className="stat-card__text">Yeni analizler icin kalan hak.</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Kullanilan</div>
                  <div className="stat-card__value">{usage.used}</div>
                  <div className="stat-card__text">Bu donem harcanan analiz adedi.</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">Limit</div>
                  <div className="stat-card__value">{usage.limit}</div>
                  <div className="stat-card__text">Donemsel toplam analiz tavanin.</div>
                </div>
              </div>

              <div className="analysis-kpi-grid">
                <article className="analysis-kpi">
                  <div className="analysis-kpi__label">Erisim</div>
                  <div className="analysis-kpi__value">
                    {usage.allowed ? "Acik" : "Sinirda"}
                  </div>
                  <div className="analysis-kpi__text">
                    {usage.allowed
                      ? "Yeni rapor akisi simdi tetiklenebilir."
                      : "Yeni analiz icin plan seviyesini yukselt veya donem yenilenmesini bekle."}
                  </div>
                </article>

                <article className="analysis-kpi">
                  <div className="analysis-kpi__label">Donem anahtari</div>
                  <div className="analysis-kpi__value">{usage.periodKey}</div>
                  <div className="analysis-kpi__text">
                    Kullanim takibini ayni donem icinde sabit tutar.
                  </div>
                </article>
              </div>
            </div>
          ) : (
            <div className="state-card state-card--error">
              <div className="state-card__icon">ERR</div>
              <h3 className="state-card__title">Kullanim bilgisi yok</h3>
              <p className="state-card__text">
                Bu alan su an goruntulenemiyor.
              </p>
            </div>
          )}
        </section>

        <section className="surface app-card sb-stack-20">
          <div className="section-card__header">
            <div>
              <h2 className="section-card__title">Plan ve teslim dili</h2>
              <p className="section-card__text">
                Mevcut planin ne actigini ve bir ust seviyede hangi akislarin
                derinlestigini sade bir dille gor.
              </p>
            </div>
          </div>

          {planHint && (
            <div className="analysis-highlight-panel">
              <div className="stat-card__label">Aktif okuma</div>
              <div className="card-heading" style={{ fontSize: 20, marginBottom: 8 }}>
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

          <div className="analysis-signal-list">
            <article className="analysis-signal-card">
              <div className="analysis-signal-card__eyebrow">Karar izi</div>
              <div className="analysis-signal-card__title">
                Tetikleyici sinyal ve odak rotasi daha net gorunur
              </div>
              <p className="analysis-signal-card__text">
                Sistem hangi sinyalin ana temayi tetikledigini raporda kullanici diline
                daha seffaf tasir.
              </p>
            </article>

            <article className="analysis-signal-card">
              <div className="analysis-signal-card__eyebrow">Kayitli akis</div>
              <div className="analysis-signal-card__title">
                Detay ekrani tekrar okunabilir hale gelir
              </div>
              <p className="analysis-signal-card__text">
                Analiz bittiginde rapor detayina gecilir, kutuphane ve sonraki is akislari
                ayni zeminde devam eder.
              </p>
            </article>

            <article className="analysis-signal-card">
              <div className="analysis-signal-card__eyebrow">Premium farki</div>
              <div className="analysis-signal-card__title">
                Export ve derin AI katmani uygun planda acilir
              </div>
              <p className="analysis-signal-card__text">
                Ust paket, daha yogun aksiyon plani ve export akisiyla karar hizini
                artirir.
              </p>
            </article>
          </div>

          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link href="/dashboard" className="btn btn-secondary">
              Paket detaylari
            </Link>
            <Link href="/pricing" className="btn btn-primary">
              Planlari karsilastir
            </Link>
          </div>
        </section>
      </div>

      <section className="surface app-card sb-stack-20">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">Rapor geldiginde ne hazir olur?</h2>
            <p className="section-card__text">
              Analiz bittiginde skorlarin otesinde hangi karar katmanlarini teslim
              aldigini bastan gorebilirsin.
            </p>
          </div>
        </div>

        <div className="analysis-orbit-grid">
          {ANALYSIS_OUTPUTS.map((item) => (
            <article key={item.title} className="analysis-orbit-card">
              <div className="feature-card__icon">{item.code}</div>
              <div className="stat-card__label">{item.label}</div>
              <h3 className="analysis-orbit-card__title">{item.title}</h3>
              <p className="analysis-orbit-card__text">{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </AppChrome>
  );
}
