import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/layout/MarketingShell";

export const metadata: Metadata = {
  title: "Iletisim",
  description:
    "SellBoost AI ile iletisime gecmek, destek veya is birligi talebi iletmek icin kullanin.",
};

const contactCards = [
  {
    title: "Genel iletisim",
    value: "hello@sellboost.app",
    text: "Urun, geri bildirim ve platformla ilgili genel talepler icin.",
  },
  {
    title: "Destek",
    value: "support@sellboost.app",
    text: "Analiz akisinda, hesapta veya erisim deneyiminde yardim gerektiginde.",
  },
  {
    title: "Is birligi",
    value: "partnerships@sellboost.app",
    text: "Ajans, marka ve ekip bazli kullanim senaryolari icin.",
  },
];

export default function ContactPage() {
  return (
    <MarketingShell>
      <div className="sb-container sb-stack-32">
        <section className="marketing-page-hero surface">
          <div className="marketing-page-hero__content">
            <div className="eyebrow">Iletisim</div>
            <h1 className="hero-title hero-title--tight">
              Sorun, destek ya da <strong>is birligi</strong> icin net erisim.
            </h1>
            <p className="hero-lead">
              SellBoost AI ile ilgili talebini dogru kanala hizla yonlendirebilmen
              icin iletisim yapisi sade ve profesyonel tutuldu.
            </p>
          </div>
        </section>

        <section className="section-grid-3">
          {contactCards.map((card) => (
            <article key={card.title} className="surface feature-card">
              <h2 className="feature-card__title">{card.title}</h2>
              <p
                style={{
                  margin: "0 0 12px",
                  color: "var(--brand-strong)",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {card.value}
              </p>
              <p className="feature-card__text">{card.text}</p>
            </article>
          ))}
        </section>

        <section className="section-grid-2">
          <article className="surface feature-card">
            <div className="section-heading" style={{ marginBottom: 0 }}>
              <div className="eyebrow">Destek yaklasimi</div>
              <h2 className="section-title" style={{ fontSize: "clamp(28px, 4vw, 42px)" }}>
                Net kanal, hizli yonlendirme, urun odakli dil
              </h2>
              <p className="section-text">
                Iletisim yapisi sade tutuldu. Kullanici genel soru, destek ve is
                birligi taleplerini tek bakista dogru kanala yonlendirebilir.
              </p>
            </div>
          </article>

          <article className="surface feature-card">
            <div className="section-heading" style={{ marginBottom: 0 }}>
              <div className="eyebrow">Hizli aksiyon</div>
              <h2 className="section-title" style={{ fontSize: "clamp(28px, 4vw, 42px)" }}>
                Uygulama akisini inceleyip sonra bize yazin
              </h2>
              <p className="section-text">
                Once urun deneyimini gor, sonra gerekirse destek veya ekip plani
                icin iletisime gec. Tasarim dili tum yuzeylerde ayni kalir.
              </p>
            </div>

            <div className="hero-actions" style={{ marginTop: 0 }}>
              <Link href="/" className="btn btn-primary">
                Ana Sayfaya Don
              </Link>
              <Link href="/pricing" className="btn btn-secondary">
                Planlari Incele
              </Link>
            </div>
          </article>
        </section>
      </div>
    </MarketingShell>
  );
}
