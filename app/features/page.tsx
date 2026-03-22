import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/layout/MarketingShell";
import SectionIntro from "@/components/marketing/SectionIntro";
import { campaignContent } from "@/lib/plans";
import {
  marketingNavItems,
  productFeatureGroups,
} from "@/content/site";

export const metadata: Metadata = {
  title: "Ozellikler",
  description:
    "SellBoost'un urun icerigi, guven, teklif, rekabet ve AI yorumlama katmanlarini nasil ele aldigini inceleyin.",
};

export default function FeaturesPage() {
  return (
    <MarketingShell navItems={marketingNavItems}>
      <div className="sb-container sb-stack-32">
        <section className="marketing-page-hero surface">
          <div className="marketing-page-hero__content">
            <div className="eyebrow">Ozellikler</div>
            <h1 className="hero-title hero-title--tight">
              Urun sayfasini parcalara ayirmaz, <strong>karar sistemi</strong> gibi okur.
            </h1>
            <p className="hero-lead">
              SellBoost yalnizca alan toplamaz. Urunun icerik kalitesini, teklif gucunu,
              guven seviyesini ve rakip baskisini ayni karar modeline baglar.
            </p>
            <div className="hero-actions">
              <Link href="/register" className="btn btn-primary">
                Denemeye Basla
              </Link>
              <Link href="/pricing" className="btn btn-secondary">
                Planlari Karsilastir
              </Link>
            </div>
          </div>
        </section>

        <section className="sb-stack-20">
          <SectionIntro
            eyebrow="Analiz katmanlari"
            title="Hangi sinyalleri urunlestirilmis halde gorursun?"
            description="Her blok ayrik ama ayni dilde. Kullanici ham veri denizi degil, yorumlanmis karar paneli gorur."
          />

          <div className="feature-grid">
            {productFeatureGroups.map((item, index) => (
              <article key={item.title} className="surface feature-card marketing-feature-card">
                <div className="feature-card__icon">{String(index + 1).padStart(2, "0")}</div>
                <div className="stat-card__label">{item.eyebrow}</div>
                <h3 className="feature-card__title">{item.title}</h3>
                <p className="feature-card__text">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-grid-2">
          <article className="surface marketing-split-card">
            <SectionIntro
              eyebrow="AI yorumlari"
              title="Model tek basina degil, kontrollu bir karar zinciriyle calisir"
              description="Kategori benchmarki, kapsam guveni ve ogrenilmis kurallar AI yorumuna eslik eder. Bu da daha seffaf ve daha guven veren cikti uretir."
            />
          </article>

          <article className="surface marketing-split-card marketing-split-card--subtle">
            <div className="marketing-stack-list">
              {[
                "Kritik teshis: ana darbozagi tek cumlede adlandirir.",
                "Veri carpistirma: fiyat, teslimat ve guven farkini birlikte okur.",
                "Karar izi: neden bu sonuca vardigini gorunur hale getirir.",
              ].map((item, index) => (
                <div key={item} className="timeline__item">
                  <div className="timeline__index">0{index + 1}</div>
                  <div>
                    <h3 className="timeline__title">Aciklanabilir yapay zeka</h3>
                    <p className="timeline__text">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="surface marketing-band__card">
          <div className="marketing-band__content">
            <div>
              <div className="eyebrow">{campaignContent.badge}</div>
              <h2 className="card-heading marketing-band__title">
                {campaignContent.title}
              </h2>
            </div>
            <p className="card-copy">{campaignContent.detail}</p>
          </div>
          <Link href={campaignContent.ctaHref} className="btn btn-primary">
            {campaignContent.ctaLabel}
          </Link>
        </section>
      </div>
    </MarketingShell>
  );
}
