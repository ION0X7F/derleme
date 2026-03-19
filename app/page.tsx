"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { analyzeUrl, fetchReports } from "@/lib/api";
import { AnalysisResult, SavedReport } from "@/types";
import AnalyzeForm from "@/components/AnalyzeForm";
import AnalysisResultBox from "@/components/AnalysisResult";
import ReportHistory from "@/components/ReportHistory";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

const features = [
  {
    icon: "AI",
    title: "Tek ekranlik karar paneli",
    text: "Baslik, fiyat, guven, teslimat, yorum ve rakip sinyallerini tek analiz akisinda birlestirir.",
  },
  {
    icon: "DV",
    title: "Veri carpistiran teshis mantigi",
    text: "Sadece alan saymaz; fiyat ile teslimati, favori ile yorumu, guven ile rekabeti birlikte yorumlar.",
  },
  {
    icon: "AC",
    title: "Aksiyon odakli cikti",
    text: "Kullaniciya sadece skor degil; zayif nokta, kritik sebep ve uygulanabilir aksiyon sirasi verir.",
  },
];

const howItWorks = [
  {
    title: "Linki yapistir",
    text: "Trendyol urun sayfasi URL'si ile giris yap. Sistem hem sayfa HTML'ini hem gercek teklif sinyallerini okur.",
  },
  {
    title: "AI muhakemesi calissin",
    text: "SellBoost urundeki icerik, teklif, guven ve rekabet katmanlarini birbirine carptirarak darbogazi bulur.",
  },
  {
    title: "Oncelikli aksiyonu uygula",
    text: "Rapor ekraninda neyin iyi, neyin riskli ve hangi hamlenin once gelmesi gerektigi net gorunur.",
  },
];

const planPreview = [
  {
    name: "Guest",
    price: "0 TL",
    subtitle: "Hizli ilk deneme",
    features: [
      "Sinirli ilk analiz gorunumu",
      "Anlik AI teshis girisi",
      "Kayit olmadan urun hissi",
    ],
  },
  {
    name: "Free",
    price: "0 TL",
    subtitle: "Kayitli temel kullanim",
    features: [
      "Dashboard ve rapor gecmisi",
      "Temel analiz metrikleri",
      "Daha fazla aylik kullanim",
    ],
  },
  {
    name: "Pro",
    price: "Yakinda",
    subtitle: "Premium karar paneli",
    featured: true,
    features: [
      "Rakip teklif baskisi ve detayli rapor",
      "Export, yeniden analiz, premium aksiyon plani",
      "Daha derin AI icgorusu ve onceliklendirme",
    ],
  },
];

const faqs = [
  {
    q: "SellBoost AI tam olarak neyi analiz ediyor?",
    a: "Trendyol urun sayfasindaki icerik, fiyat, teslimat, yorum, guven ve rakip satici sinyallerini tek karar panelinde topluyor.",
  },
  {
    q: "Bu arac sadece skor mu veriyor?",
    a: "Hayir. Asil hedef, neden satmadigini bulmak ve kullaniciya hangi aksiyonun once gelmesi gerektigini gostermek.",
  },
  {
    q: "Raporlar kaydoluyor mu?",
    a: "Kayitli kullanicilarin uygun plan seviyesinde raporlari gecmise eklenir ve daha sonra detay ekranindan tekrar acilabilir.",
  },
];

const trustSignals = [
  {
    title: "Teklif baskisi okunur",
    text: "Ayni urunu satan diger saticilarin fiyat ve teslimat farki hizla yorumlanir.",
  },
  {
    title: "Yorum riski ayiklanir",
    text: "Olumsuz tema, dusuk yildiz ve guven sinyali tek yerde toplanir.",
  },
  {
    title: "Aksiyon sirasi netlesir",
    text: "Rapor ekrani sorunu tarif etmekle kalmaz, neyin once gelmesi gerektigini soyler.",
  },
];

export default function HomePage() {
  const { status } = useSession();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [historyLimit, setHistoryLimit] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setReports([]);
      return;
    }

    fetchReports()
      .then((data) => {
        setReports(data.reports);
        setHistoryLimit(data.historyLimit);
      })
      .catch(() => {
        setReports([]);
        setHistoryLimit(null);
      });
  }, [status]);

  const quickStats = useMemo(
    () => [
      {
        label: "Odak platform",
        value: "Trendyol",
        text: "Urun detay ve rakip satici mantigina ozel tasarlandi.",
      },
      {
        label: "Analiz hizi",
        value: "AI",
        text: "URL girildigi anda premium karar paneli akisi baslar.",
      },
      {
        label: "Raporlar",
        value: status === "authenticated" ? `${reports.length}` : "Hazir",
        text:
          status === "authenticated"
            ? "Kayitli raporlar dashboard ve rapor kutuphanesinde durur."
            : "Kayitli kullanimda rapor gecmisi ve panel acilir.",
      },
      {
        label: "Cikti tipi",
        value: "Teshis",
        text: "Skordan fazlasi: darbogaz, veri carpistirma ve recete.",
      },
    ],
    [reports.length, status]
  );

  const handleAnalyze = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setAutoSaved(false);

    try {
      const report = await analyzeUrl(url);
      setResult(report);

      const isLoggedIn = status === "authenticated";
      setAutoSaved(isLoggedIn);

      if (isLoggedIn) {
        fetchReports()
          .then((data) => {
            setReports(data.reports);
            setHistoryLimit(data.historyLimit);
          })
          .catch(() => {
            setReports([]);
            setHistoryLimit(null);
          });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata olustu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sb-shell">
      <SiteHeader />

      <main className="sb-page">
        <div className="sb-container sb-stack-32">
          <section className="marketing-hero">
            <div className="marketing-hero__grid">
              <div className="surface marketing-hero__panel sb-stack-24">
                <div className="eyebrow">AI destekli Trendyol analiz platformu</div>

                <div className="sb-stack-16">
                  <h1 className="hero-title">
                    Urunun neden <strong>satmadigini</strong> veriden okuyun.
                  </h1>
                  <p className="hero-lead">
                    SellBoost AI, Trendyol urun sayfasini sadece puanlamaz. darbogazi
                    bulur, verileri carptirir ve sana karar odakli aksiyon plani verir.
                  </p>
                </div>

                <div className="hero-points">
                  <span className="hero-point">Premium SaaS deneyimi</span>
                  <span className="hero-point">Rakip teklif okuma</span>
                  <span className="hero-point">AI teshis ve recete</span>
                </div>

                <AnalyzeForm
                  url={url}
                  loading={loading}
                  onChange={setUrl}
                  onSubmit={handleAnalyze}
                />

                {error && <div className="alert alert-error">{error}</div>}

                <div className="hero-actions">
                  <Link href="/fiyatlandirma" className="btn btn-secondary">
                    Fiyatlandirmayi Incele
                  </Link>
                  <Link href="/hakkimizda" className="btn btn-ghost">
                    Nasil calistigini gor
                  </Link>
                </div>
              </div>

              <div className="surface preview-panel">
                <div className="preview-panel__top">
                  <div>
                    <div className="eyebrow">Canli urun hissi</div>
                    <h2 className="card-heading" style={{ marginTop: 14 }}>
                      Premium karar paneli gorunumu
                    </h2>
                  </div>
                  <span className="hero-point">Dark default</span>
                </div>

                <div className="preview-panel__grid">
                  {quickStats.map((item) => (
                    <div key={item.label} className="preview-metric">
                      <div className="preview-metric__label">{item.label}</div>
                      <div className="preview-metric__value">{item.value}</div>
                      <div className="card-copy">{item.text}</div>
                    </div>
                  ))}
                </div>

                <div className="preview-list">
                  <div className="preview-list__item">
                    <span className="preview-list__label">Kritik teshis</span>
                    <span className="preview-list__value">Teslimat bariyeri</span>
                  </div>
                  <div className="preview-list__item">
                    <span className="preview-list__label">Rakip baskisi</span>
                    <span className="preview-list__value status-danger">3 satici daha ucuz</span>
                  </div>
                  <div className="preview-list__item">
                    <span className="preview-list__label">Guven sinyali</span>
                    <span className="preview-list__value status-good">Yuksek yorum puani</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {result && (
            <section className="sb-stack-16">
              <div className="section-heading">
                <div className="eyebrow">Analiz cikti paneli</div>
                <h2 className="section-title">AI raporu hazir</h2>
                <p className="section-text">
                  Asagidaki panel, linkten cekilen gercek sinyallerle olusturuldu.
                  Guclu ve zayif alanlar ile rakip baskisini tek akista gorebilirsin.
                </p>
              </div>

              <AnalysisResultBox result={result} autoSaved={autoSaved} />
            </section>
          )}

          <section className="sb-stack-20" id="ozellikler">
            <div className="section-heading">
              <div className="eyebrow">Neden SellBoost</div>
              <h2 className="section-title">Basit rapor degil, urunlesmis karar deneyimi</h2>
              <p className="section-text">
                Arac sadece satir satir veri vermez. Once problemi bulur, sonra
                nedenini veri carpistirarak anlatir ve uygulanabilir aksiyona indirger.
              </p>
            </div>

            <div className="feature-grid">
              {features.map((feature) => (
                <article key={feature.title} className="surface feature-card">
                  <div className="feature-card__icon">{feature.icon}</div>
                  <h3 className="feature-card__title">{feature.title}</h3>
                  <p className="feature-card__text">{feature.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="section-grid-2" id="nasil-calisir">
            <div className="surface feature-card">
              <div className="section-heading" style={{ marginBottom: 0 }}>
                <div className="eyebrow">Nasil calisir</div>
                <h2 className="section-title" style={{ fontSize: "clamp(28px, 4vw, 42px)" }}>
                  Tek linkten premium rapora
                </h2>
                <p className="section-text">
                  Akis sade ama urunun hissettirdigi deneyim ciddi: analiz girisi,
                  yorumlama, kayitli rapor ve karar odakli cikti tek aileye ait.
                </p>
              </div>
            </div>

            <div className="timeline">
              {howItWorks.map((item, index) => (
                <div key={item.title} className="surface-soft timeline__item">
                  <div className="timeline__index">0{index + 1}</div>
                  <div>
                    <h3 className="timeline__title">{item.title}</h3>
                    <p className="timeline__text">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="section-grid-3">
            {trustSignals.map((item) => (
              <article key={item.title} className="surface feature-card">
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  Premium signal
                </div>
                <h3 className="feature-card__title">{item.title}</h3>
                <p className="feature-card__text">{item.text}</p>
              </article>
            ))}
          </section>

          <section className="sb-stack-20" id="fiyatlandirma">
            <div className="section-heading">
              <div className="eyebrow">Planlar</div>
              <h2 className="section-title">Kullanim derinligini ihtiyacina gore sec</h2>
              <p className="section-text">
                Deneme, kayitli kullanim ve premium karar paneli ayni tasarim ailesi
                icinde ilerler. Gectigin anda deneyim buyur, karmasa artmaz.
              </p>
            </div>

            <div className="section-grid-3">
              {planPreview.map((plan) => (
                <article
                  key={plan.name}
                  className={`surface pricing-card${plan.featured ? " is-featured" : ""}`}
                >
                  <div className="pricing-card__head">
                    <div>
                      <h3 className="pricing-card__name">{plan.name}</h3>
                      <p className="pricing-card__subtitle">{plan.subtitle}</p>
                    </div>
                    {plan.featured && <div className="eyebrow">En populer</div>}
                  </div>

                  <p className="pricing-card__price">{plan.price}</p>

                  <ul className="pricing-card__list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>

                  <Link
                    href={plan.name === "Pro" ? "/register" : "/fiyatlandirma"}
                    className={plan.featured ? "btn btn-primary" : "btn btn-secondary"}
                  >
                    {plan.name === "Pro" ? "Haberdar Ol" : "Detaylari Gor"}
                  </Link>
                </article>
              ))}
            </div>
          </section>

          {status === "authenticated" && (
            <section className="sb-stack-16">
              <div className="section-heading">
                <div className="eyebrow">Kayitli raporlar</div>
                <h2 className="section-title">Gecmis analizler tek kutuphanede</h2>
                <p className="section-text">
                  Uygun plan seviyende kayitli raporlarini tekrar ac, karsilastir ve
                  ayni urunde zaman icinde neler degistigini izle.
                </p>
                {typeof historyLimit === "number" && (
                  <p className="section-text">
                    Mevcut pakette son {historyLimit} rapor gosteriliyor.
                  </p>
                )}
              </div>

              <div className="surface app-card">
                <ReportHistory reports={reports} />
              </div>
            </section>
          )}

          <section className="sb-stack-20" id="sss">
            <div className="section-heading">
              <div className="eyebrow">SSS</div>
              <h2 className="section-title">Karar vermeden once temel sorular</h2>
            </div>

            <div className="faq-list">
              {faqs.map((item) => (
                <article key={item.q} className="surface faq-item">
                  <h3 className="faq-item__q">{item.q}</h3>
                  <p className="faq-item__a">{item.a}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="surface marketing-hero__panel sb-stack-20">
            <div className="eyebrow">Hazirsan baslayalim</div>
            <h2 className="section-title">Trendyol urun sayfana premium karar paneli ekle</h2>
            <p className="section-text">
              SellBoost AI, ogrenci projesi gibi degil urunlesmis bir karar araci
              gibi hissettirmek icin tasarlandi. Simdi linki gir ve darbogazi gor.
            </p>

            <div className="hero-actions">
              <Link href="/register" className="btn btn-primary">
                Ucretsiz Basla
              </Link>
              <Link href="/dashboard" className="btn btn-secondary">
                Dashboarda Git
              </Link>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}


