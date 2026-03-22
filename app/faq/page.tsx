import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/layout/MarketingShell";
import SectionIntro from "@/components/marketing/SectionIntro";
import { faqItems, marketingNavItems } from "@/content/site";

export const metadata: Metadata = {
  title: "SSS",
  description:
    "SellBoost'un analiz mantigi, plan farklari, kampanya ve rapor akisina dair sik sorulan sorular.",
};

export default function FaqPage() {
  return (
    <MarketingShell navItems={marketingNavItems}>
      <div className="sb-container sb-stack-32">
        <section className="marketing-page-hero surface">
          <div className="marketing-page-hero__content">
            <div className="eyebrow">Sik sorulan sorular</div>
            <h1 className="hero-title hero-title--tight">
              En cok sorulan konulari <strong>daginik degil, net bir duzende</strong> cevapla.
            </h1>
            <p className="hero-lead">
              Uyelik, analiz, kampanya, raporlar ve Trendyol odagi hakkindaki temel
              sorular burada hizli okunabilir sekilde toplandi.
            </p>
          </div>
        </section>

        <section className="sb-stack-20">
          <SectionIntro
            eyebrow="SSS"
            title="Uyelikten AI yorumuna kadar ana sorular"
            description="Bu sayfa onboarding sirasinda kullanicinin aklindaki bariyerleri azaltacak kadar net, ama gereksiz kadar uzun olmayacak kadar kisa tutuldu."
          />

          <div className="faq-list">
            {faqItems.map((item) => (
              <article key={item.q} className="surface faq-item faq-item--large">
                <h2 className="faq-item__q">{item.q}</h2>
                <p className="faq-item__a">{item.a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface marketing-cta-panel">
          <div className="marketing-cta-panel__content">
            <div className="eyebrow">Hala karar veremediysen</div>
            <h2 className="section-title" style={{ fontSize: "clamp(28px, 4vw, 42px)" }}>
              Ucretsiz basla, sonra ihtiyacina gore Pro&apos;ya gec.
            </h2>
            <p className="section-text">
              Landing tarafinda teaser deneyimi, kayitli tarafta ise tam karar paneli seni bekliyor.
            </p>
          </div>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link href="/register" className="btn btn-primary">
              Ucretsiz Basla
            </Link>
            <Link href="/pricing" className="btn btn-secondary">
              Planlari Incele
            </Link>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
