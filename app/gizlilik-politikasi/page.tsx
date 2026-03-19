import type { Metadata } from "next";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Gizlilik Politikasi",
  description: "SellBoost AI gizlilik politikasi ve temel veri isleme prensipleri.",
};

const sections = [
  {
    title: "Toplanan veriler",
    text: "Analiz edilen URL, hesap bilgileri ve rapor olusturma akisinda gereken temel kullanim verileri hizmetin calismasi icin islenebilir.",
  },
  {
    title: "Kullanim amaci",
    text: "Bu veriler rapor olusturmak, gecmisi gostermek, erisim haklarini yonetmek ve urun deneyimini gelistirmek icin kullanilir.",
  },
  {
    title: "Saklama yaklasimi",
    text: "Veriler yalnizca hizmetin calismasi icin gereken kapsamda tutulur; gereksiz kalici veri birikimini azaltmak esastir.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="sb-shell">
      <SiteHeader />

      <main className="sb-page">
        <div className="sb-container sb-stack-32">
          <section className="marketing-hero">
            <div className="surface marketing-hero__panel sb-stack-20">
              <div className="eyebrow">Gizlilik Politikasi</div>
              <h1 className="hero-title">
                Veriyi neden kullandigimizi <strong>acik ve sade</strong> anlatiriz.
              </h1>
              <p className="hero-lead">
                SellBoost AI icindeki veri isleme mantigi, hizmetin calismasi icin
                gereken kapsamla sinirli tutulur ve kullaniciya anlasilir bir dille sunulur.
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
