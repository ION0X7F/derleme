import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Fiyatlandirma",
  description:
    "SellBoost AI planlarini, analiz limitlerini ve premium katman farklarini inceleyin.",
};

const plans = [
  {
    name: "Guest",
    price: "0 TL",
    subtitle: "Hizli ilk deneme",
    features: [
      "Sinirli ilk analiz gorunumu",
      "Kayit olmadan urun hissi",
      "Temel skor ve teshis akisi",
    ],
  },
  {
    name: "Free",
    price: "0 TL",
    subtitle: "Kayitli temel kullanim",
    features: [
      "Dashboard ve rapor gecmisi",
      "Daha genis kullanim limiti",
      "Temel karar paneli erisimi",
    ],
  },
  {
    name: "Pro",
    price: "Yakinda",
    subtitle: "Derin karar katmani",
    featured: true,
    features: [
      "Rakip teklif baskisi ve export",
      "Premium aksiyon plani",
      "Daha derin AI muhakemesi",
    ],
  },
];

const faqs = [
  {
    q: "Guest ve Free farki ne?",
    a: "Guest hizli deneme icindir. Free ile kayitli dashboard, rapor gecmisi ve daha uzun kullanim akisi acilir.",
  },
  {
    q: "Pro neyi farkli yapar?",
    a: "Premium rapor bolumleri, export, daha genis rekabet analizi ve daha derin AI yorumlama katmani acilir.",
  },
  {
    q: "Planlar arasi gecis kolay mi?",
    a: "Evet. Tasarim ve kullanim akisi ayni kalir; sadece daha fazla analiz ve daha derin icgoruler acilir.",
  },
];

const planMatrix = [
  {
    feature: "Aylik analiz akisi",
    guest: "Kisa deneme",
    free: "Temel kullanim",
    pro: "Derin panel",
  },
  {
    feature: "Kaydedilmis raporlar",
    guest: "Yok",
    free: "Var",
    pro: "Var",
  },
  {
    feature: "Rakip teklif yorumu",
    guest: "Sinirli",
    free: "Temel",
    pro: "Tam",
  },
  {
    feature: "Export ve paylasim",
    guest: "Yok",
    free: "Kilitli",
    pro: "Acik",
  },
];

export default function PricingPage() {
  return (
    <div className="sb-shell">
      <SiteHeader />

      <main className="sb-page">
        <div className="sb-container sb-stack-32">
          <section className="marketing-hero">
            <div className="surface marketing-hero__panel sb-stack-20">
              <div className="eyebrow">Fiyatlandirma</div>
              <h1 className="hero-title">
                Ihtiyacin olan <strong>analiz derinligini</strong> sec.
              </h1>
              <p className="hero-lead">
                SellBoost AI, kayitli kullanim ve premium karar paneli arasinda
                kopuk deneyimler kurmaz. Plan yukseldikce ayni arayuz daha zengin
                ve daha guclu hale gelir.
              </p>
              <div className="hero-actions">
                <Link href="/register" className="btn btn-primary">
                  Ucretsiz Basla
                </Link>
                <Link href="/iletisim" className="btn btn-secondary">
                  Ekip plani sor
                </Link>
              </div>
            </div>
          </section>

          <section className="section-grid-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`surface pricing-card${plan.featured ? " is-featured" : ""}`}
              >
                <div className="pricing-card__head">
                  <div>
                    <h2 className="pricing-card__name">{plan.name}</h2>
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
                  href={plan.name === "Pro" ? "/register" : "/register"}
                  className={plan.featured ? "btn btn-primary" : "btn btn-secondary"}
                >
                  {plan.featured ? "Haberdar Ol" : "Planla Devam Et"}
                </Link>
              </article>
            ))}
          </section>

          <section className="surface app-card sb-stack-20">
            <div className="section-card__header">
              <div>
                <div className="eyebrow">Plan matrisi</div>
                <h2 className="section-card__title" style={{ fontSize: 28 }}>
                  Tek fark gorsellik degil, karar derinligi
                </h2>
                <p className="section-card__text">
                  Plan yukseldikce ayni arayuz korunur; acilan seyler daha derin
                  yorum, daha net rekabet resmi ve daha guclu rapor akisidir.
                </p>
              </div>
            </div>

            <div className="sb-stack-12">
              {planMatrix.map((row) => (
                <div
                  key={row.feature}
                  className="surface-soft"
                  style={{
                    padding: 16,
                    display: "grid",
                    gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.8fr",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div className="card-copy" style={{ color: "var(--text)" }}>
                    {row.feature}
                  </div>
                  <div className="hero-point" style={{ justifyContent: "center" }}>
                    {row.guest}
                  </div>
                  <div className="hero-point" style={{ justifyContent: "center" }}>
                    {row.free}
                  </div>
                  <div
                    className="hero-point status-good"
                    style={{ justifyContent: "center" }}
                  >
                    {row.pro}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="section-grid-2">
            <article className="surface feature-card">
              <div className="section-heading" style={{ marginBottom: 0 }}>
                <div className="eyebrow">Plan mantigi</div>
                <h2 className="section-title" style={{ fontSize: "clamp(28px, 4vw, 42px)" }}>
                  Ayni urun, farkli karar derinligi
                </h2>
                <p className="section-text">
                  Ucretsiz katmanda hizli gorunum, premium katmanda ise rekabet,
                  export ve stratejik aksiyon dili derinlesir. Tasarim sabit, deger artar.
                </p>
              </div>
            </article>

            <div className="faq-list">
              {faqs.map((item) => (
                <article key={item.q} className="surface faq-item">
                  <h3 className="faq-item__q">{item.q}</h3>
                  <p className="faq-item__a">{item.a}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
