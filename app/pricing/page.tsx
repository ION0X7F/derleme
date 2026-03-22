import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import MarketingShell from "@/components/layout/MarketingShell";
import PricingCards from "@/components/marketing/PricingCards";
import SectionIntro from "@/components/marketing/SectionIntro";
import {
  buildPricingPlans,
  campaignContent,
  pricingMatrix,
} from "@/lib/plans";
import { getUserMembershipSnapshot } from "@/lib/user-membership";
import {
  marketingNavItems,
} from "@/content/site";

export const metadata: Metadata = {
  title: "Fiyatlandirma",
  description:
    "SellBoost planlarini, kampanya vurgusunu ve ucretsizden Pro'ya giden deger farklarini inceleyin.",
};

export default async function PricingPage() {
  const session = await auth();
  const membership = session?.user?.id
    ? await getUserMembershipSnapshot(session.user.id)
    : null;
  const pricingPlans = buildPricingPlans({
    currentPlanId: membership?.planId ?? null,
    isAuthenticated: !!session?.user?.id,
  });

  return (
    <MarketingShell navItems={marketingNavItems}>
      <div className="sb-container sb-stack-32">
        <section className="marketing-page-hero surface">
          <div className="marketing-page-hero__content">
            <div className="eyebrow">Fiyatlandirma</div>
            <h1 className="hero-title hero-title--tight">
              Planlar kararsizlik yaratmasin, <strong>hangi seviyede ne acildigi</strong> net olsun.
            </h1>
            <p className="hero-lead">
              Ucretsiz plan denemek icin, Pro ana kullanim icin, Pro Yillik uzun vadeli deger
              icin, Team ise ekip ve ajans akislari icin kurgulandi.
            </p>
            <div className="hero-actions">
              <Link href="/register" className="btn btn-primary">
                Ucretsiz Basla
              </Link>
              <Link href="/about" className="btn btn-secondary">
                Urunu Tani
              </Link>
            </div>
          </div>
        </section>

        <section className="marketing-band">
          <div className="surface marketing-band__card marketing-band__card--highlight">
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
          </div>
        </section>

        <section className="sb-stack-20">
          <SectionIntro
            eyebrow="Planlar"
            title="Free giris, Pro ana satis, yillik deger, Team kurumsal genisleme"
            description="Plan kartlari gordugu anda hangi kullanici tipi icin tasarlandigi anlasilsin; CTA dili de buna gore net kalsin."
          />

          <PricingCards plans={pricingPlans} />
        </section>

        <section className="surface app-card sb-stack-20">
          <SectionIntro
            eyebrow="Karsilastirma"
            title="Deger farki net, tablo basit ve okunur"
            description="Kullaniciyi bogan uzun fiyat tablolarina gerek yok; ana farklar once gorunmeli."
          />

          <div className="pricing-matrix">
            <div className="pricing-matrix__header">
              <div>Ozellik</div>
              <div>Ucretsiz</div>
              <div>Pro</div>
              <div>Pro Yillik</div>
              <div>Team</div>
            </div>

            {pricingMatrix.map((row) => (
              <div key={row.feature} className="pricing-matrix__row">
                <div className="pricing-matrix__feature">{row.feature}</div>
                <div className="pricing-matrix__cell">{row.free}</div>
                <div className="pricing-matrix__cell pricing-matrix__cell--featured">
                  {row.pro}
                </div>
                <div className="pricing-matrix__cell">{row.yearly}</div>
                <div className="pricing-matrix__cell">{row.team}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
