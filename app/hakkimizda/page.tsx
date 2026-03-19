import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Hakkimizda",
  description:
    "SellBoost AI neden var, nasil calisiyor ve kimler icin uretildi, kisaca inceleyin.",
};

const blocks = [
  {
    title: "Neyi cozuyor?",
    text: "SellBoost AI, Trendyol urun sayfasina bakip sadece skor vermek yerine neden zayif kaldigini ve nasil toparlanacagini gostermeyi hedefler.",
  },
  {
    title: "Nasil dusunuyor?",
    text: "Icerik, guven, teslimat, fiyat ve rakip satici sinyallerini birbiriyle carptirarak ana darbogazi ortaya cikarir.",
  },
  {
    title: "Kimler icin?",
    text: "Kendi urununu satan markalar, e-ticaret ekipleri ve performansi duzgun okumak isteyen karar vericiler icin tasarlandi.",
  },
];

export default function AboutPage() {
  return (
    <div className="sb-shell">
      <SiteHeader />

      <main className="sb-page">
        <div className="sb-container sb-stack-32">
          <section className="marketing-hero">
            <div className="surface marketing-hero__panel sb-stack-20">
              <div className="eyebrow">Hakkimizda</div>
              <h1 className="hero-title">
                Veriyi sadece gosteren degil, <strong>aksiyona ceviren</strong> analiz dili.
              </h1>
              <p className="hero-lead">
                SellBoost AI, Trendyol urun performansini bir kontrol listesi gibi
                degil, satisa etki eden sinyallerin bir butunu gibi okumak icin tasarlandi.
              </p>
            </div>
          </section>

          <section className="section-grid-3">
            {blocks.map((block) => (
              <article key={block.title} className="surface feature-card">
                <h2 className="feature-card__title">{block.title}</h2>
                <p className="feature-card__text">{block.text}</p>
              </article>
            ))}
          </section>

          <section className="section-grid-2">
            <article className="surface feature-card">
              <div className="section-heading" style={{ marginBottom: 0 }}>
                <div className="eyebrow">Yaklasimimiz</div>
                <h2 className="section-title" style={{ fontSize: "clamp(28px, 4vw, 42px)" }}>
                  Tek ekran, net hiyerarsi, karar odakli sonuc
                </h2>
                <p className="section-text">
                  Icerik, teklif ve guven sinyalleri tek bir premium karar paneli
                  icinde sunulur. Kullanicinin &quot;sorun ne&quot; ve &quot;simdi ne yapmaliyim&quot;
                  sorulari ayni yerde cevap bulur.
                </p>
              </div>
            </article>

            <article className="surface feature-card">
              <div className="section-heading" style={{ marginBottom: 0 }}>
                <div className="eyebrow">Marka hissi</div>
                <h2 className="section-title" style={{ fontSize: "clamp(28px, 4vw, 42px)" }}>
                  Ciddi, modern ve guven veren bir SaaS dili
                </h2>
                <p className="section-text">
                  Tasarim dili kurumsal ama soguk degil; karar destekli, veri odakli
                  ve premium bir urun hissi vermek uzere kuruludur.
                </p>
              </div>

              <div className="hero-actions" style={{ marginTop: 0 }}>
                <Link href="/" className="btn btn-primary">
                  Analize Don
                </Link>
                <Link href="/fiyatlandirma" className="btn btn-secondary">
                  Planlari Incele
                </Link>
              </div>
            </article>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}


