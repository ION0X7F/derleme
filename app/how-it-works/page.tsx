import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/layout/MarketingShell";
import SectionIntro from "@/components/marketing/SectionIntro";
import { howItWorksSteps, marketingNavItems } from "@/content/site";

export const metadata: Metadata = {
  title: "Nasil Calisir",
  description:
    "SellBoost'un Trendyol linkinden karar paneline giden analiz akisini adim adim inceleyin.",
};

export default function HowItWorksPage() {
  return (
    <MarketingShell navItems={marketingNavItems}>
      <div className="sb-container sb-stack-32">
        <section className="marketing-page-hero surface">
          <div className="marketing-page-hero__content">
            <div className="eyebrow">Nasil Calisir</div>
            <h1 className="hero-title hero-title--tight">
              Linkten rapora giden akis <strong>hizli, kontrollu ve aciklanabilir</strong>.
            </h1>
            <p className="hero-lead">
              SellBoost&apos;un urun motoru, extractor, benchmark ve AI yorumunu tek zincirde
              birlestirir. Kullaniciya sadece sonuc degil, neden o sonuca varildigini da gosterir.
            </p>
          </div>
        </section>

        <section className="sb-stack-20">
          <SectionIntro
            eyebrow="Adim adim"
            title="Kullanici linki verir, sistem karari adim adim kurar"
            description="Buradaki akis hafif gorunur ama arka planda olgun bir veri okuma, tamamlama ve yorumlama hatti calisir."
          />

          <div className="timeline marketing-timeline">
            {howItWorksSteps.map((item) => (
              <article key={item.step} className="surface-soft timeline__item">
                <div className="timeline__index">{item.step}</div>
                <div>
                  <h3 className="timeline__title">{item.title}</h3>
                  <p className="timeline__text">{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section-grid-2">
          <article className="surface marketing-split-card">
            <SectionIntro
              eyebrow="Kontrol katmani"
              title="AI yorumlari deterministik guardrail ile tutulur"
              description="Kapsam guveni, benchmark deltalari ve ogrenilmis kurallar prompta girer; skor ve tavsiye drift'i kontrol edilir."
            />
          </article>

          <article className="surface marketing-split-card marketing-split-card--subtle">
            <SectionIntro
              eyebrow="Cikti"
              title="Son ekranda sadece skor degil, aksiyon sirasi da gorunur"
              description="Kritik teshis, oncelikli aksiyonlar, karar izi, kalite kartlari ve rekabet baskisi ayni rapor akisina tasinir."
            />

            <div className="hero-actions" style={{ marginTop: 0 }}>
              <Link href="/features" className="btn btn-secondary">
                Ozelliklere Don
              </Link>
              <Link href="/register" className="btn btn-primary">
                Ucretsiz Basla
              </Link>
            </div>
          </article>
        </section>
      </div>
    </MarketingShell>
  );
}
