import type { Metadata } from "next";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Kullanim Kosullari",
  description: "SellBoost AI kullanim kosullari ve temel hizmet cercevesi.",
};

const sections = [
  {
    title: "Hizmet kapsami",
    text: "SellBoost AI, Trendyol urun sayfalarina yonelik analiz ve karar destek ciktilari sunan bir yazilim hizmetidir.",
  },
  {
    title: "Kullanim sorumlulugu",
    text: "Platform uzerinden uretilen ciktilar karar destegi saglar; nihai ticari karar ve uygulama sorumlulugu kullanicidadir.",
  },
  {
    title: "Erisim ve planlar",
    text: "Bazi ozellikler plan seviyesine, analiz limitine veya hesap durumuna gore farkli derinlikte sunulabilir.",
  },
];

export default function TermsPage() {
  return (
    <div className="sb-shell">
      <SiteHeader />

      <main className="sb-page">
        <div className="sb-container sb-stack-32">
          <section className="marketing-hero">
            <div className="surface marketing-hero__panel sb-stack-20">
              <div className="eyebrow">Kullanim Kosullari</div>
              <h1 className="hero-title">
                Hizmetin cercevesini <strong>yorucu olmadan</strong> anlatan temel metinler.
              </h1>
              <p className="hero-lead">
                Platformun ne sundugu, kullanicinin hangi noktada sorumlu oldugu
                ve plan bazli erisim mantigi burada temel basliklarla yer alir.
              </p>
            </div>
          </section>

          <section className="faq-list">
            {sections.map((section) => (
              <article key={section.title} className="surface faq-item">
                <h2 className="faq-item__q">{section.title}</h2>
                <p className="faq-item__a">{section.text}</p>
              </article>
            ))}
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
