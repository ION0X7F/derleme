import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/layout/MarketingShell";
import SectionIntro from "@/components/marketing/SectionIntro";
import { aboutPrinciples, marketingNavItems } from "@/content/site";

export const metadata: Metadata = {
  title: "Hakkimizda",
  description:
    "SellBoost'un urun felsefesini, veri odakli yaklasimini ve neyi cozmeye calistigini inceleyin.",
};

export default function AboutPage() {
  return (
    <MarketingShell navItems={marketingNavItems}>
      <div className="sb-container sb-stack-32">
        <section className="marketing-page-hero surface">
          <div className="marketing-page-hero__content">
            <div className="eyebrow">Hakkimizda</div>
            <h1 className="hero-title hero-title--tight">
              SellBoost, pazar yeri performansini <strong>karar problemine</strong> cevirir.
            </h1>
            <p className="hero-lead">
              Amacimiz sadece veri gostermek degil. Saticinin neden zorlandigini,
              nerede guc kaybettigini ve ilk iyilestirme noktasinin ne oldugunu netlestirmek.
            </p>
          </div>
        </section>

        <section className="section-grid-3">
          {aboutPrinciples.map((item) => (
            <article key={item.title} className="surface feature-card marketing-feature-card">
              <h2 className="feature-card__title">{item.title}</h2>
              <p className="feature-card__text">{item.text}</p>
            </article>
          ))}
        </section>

        <section className="section-grid-2">
          <article className="surface marketing-split-card">
            <SectionIntro
              eyebrow="Yaklasim"
              title="Hizli ama yuzeysel olmayan bir SaaS deneyimi"
              description="Landing sayfasinda ikna, uygulama tarafinda deger, rapor ekraninda seffaflik. Tum urun bu ritimde kuruldu."
            />
          </article>

          <article className="surface marketing-split-card marketing-split-card--subtle">
            <SectionIntro
              eyebrow="Marka hissi"
              title="Gosterisli degil, premium ve guven veren"
              description="Yavaslayan, agirdan akan veya asiri efektli arayuzler yerine hizli acilan, net hiyerarsili ve gercek urun hissi veren yuzeyler hedeflendi."
            />
            <div className="hero-actions" style={{ marginTop: 0 }}>
              <Link href="/features" className="btn btn-secondary">
                Ozellikleri Incele
              </Link>
              <Link href="/register" className="btn btn-primary">
                Denemeye Basla
              </Link>
            </div>
          </article>
        </section>
      </div>
    </MarketingShell>
  );
}
