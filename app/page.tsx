import type { Metadata } from "next";
import Link from "next/link";
import HomeHeroClient from "@/components/marketing/HomeHeroClient";
import MarketingShell from "@/components/layout/MarketingShell";
import { pricingPlans } from "@/lib/plans";
import { faqItems } from "@/content/site";

const homeNavItems = [
  { href: "#features", label: "Özellikler" },
  { href: "#pricing", label: "Planlar" },
  { href: "#resources", label: "Kaynaklar" },
  { href: "#faqs", label: "SSS" },
];

const featureRows = [
  {
    eyebrow: "Teşhis motoru",
    title: "Satışı yavaşlatan darboğazı metrik değil karar olarak okur",
    text: "SellBoost yalnızca skor göstermez. Fiyat, güven, içerik ve teklif baskısını aynı satış kararının içindeki etki alanları olarak yorumlar.",
    metricValue: "01",
    metricLabel: "Ana teşhis",
    bullets: [
      "Kritik darboğazı ilk ekranda görünür kılar.",
      "AI yorumunu veriye ve benchmark farkına bağlar.",
      "Satış hızını düşüren katmanı önceliklendirir.",
    ],
  },
  {
    eyebrow: "Rekabet katmanı",
    title: "Rakip satıcıları, teslimatı ve fiyatı birlikte tartar",
    text: "Teklif baskısı yalnızca fiyat değildir. Rakiplerin güveni, kargo hızı ve görünürlüğü de karar anındaki baskıyı belirler.",
    metricValue: "02",
    metricLabel: "Teklif baskısı",
    bullets: [
      "Rakip fiyat aralığını hızla özetler.",
      "Diğer satıcıların baskısını ilk görünümde işler.",
      "Daha pahalı olsan bile neden kaybettiğini ayırır.",
    ],
  },
  {
    eyebrow: "İçerik ve güven",
    title: "Başlık, görsel ve yorumları satış iknası açısından konumlar",
    text: "Başlık netliği, görsel yeterliliği ve yorum gücü; kullanıcının ürünü ilk bakışta neden seçmediğini anlamak için birlikte okunur.",
    metricValue: "03",
    metricLabel: "İkna alanı",
    bullets: [
      "Güçlü yorumları daha görünür aksiyona çevirir.",
      "İçerik tarafındaki zayıf halkayı hızla işaret eder.",
      "İlk ekranı daha net bir ikna akışına taşır.",
    ],
  },
];

const processSteps = [
  {
    step: "01",
    title: "Linki bırak",
    text: "Trendyol ürün linkini yapıştır. Sayfa, satıcı ve teklif katmanları aynı akışta okunmaya başlar.",
  },
  {
    step: "02",
    title: "Sinyalleri birleştir",
    text: "Fiyat, teslimat, güven, yorum ve içerik alanları tek bir teşhis modeline bağlanır.",
  },
  {
    step: "03",
    title: "Önceliği gör",
    text: "İlk ekranda hangi alanın satışı yavaşlattığı ve neyin önce düzelmesi gerektiği görünür.",
  },
  {
    step: "04",
    title: "Raporu derinleştir",
    text: "Kayıtlı deneyimde tam rapor, rapor kütüphanesi ve dışa aktarma akışı açılır.",
  },
];

const resourceItems = [
  {
    eyebrow: "Rapor kütüphanesi",
    title: "Aynı ürünü yeniden aç, karşılaştır ve geçmişe dön",
    text: "Kaydedilen raporlar ekip içinde tekrar okunabilir kalır. Böylece aksiyonlar tek seferlik değil takip edilebilir olur.",
    href: "/reports",
    cta: "Rapor akışını gör",
  },
  {
    eyebrow: "Karar izi",
    title: "AI’nin neye bakarak teşhis verdiğini ekipçe anlatılabilir kıl",
    text: "Deterministik sinyaller, benchmark farkı ve AI yorumu tek bir karar hikâyesi halinde okunur.",
    href: "/how-it-works",
    cta: "Sistem nasıl çalışıyor",
  },
  {
    eyebrow: "Ticari derinlik",
    title: "Teaser deneyiminden tam rekabet ve aksiyon katmanına geç",
    text: "İlk sonuç ekranı hızlı karar için yeterli, tam rapor ise daha güçlü ekip operasyonu için tasarlandı.",
    href: "/pricing",
    cta: "Planları incele",
  },
];

export const metadata: Metadata = {
  title: "Trendyol ürününüz neden satmıyor? | SellBoost AI",
  description:
    "Ürün linkinizi yapıştırın. AI saniyeler içinde analiz etsin, somut aksiyon planı çıkarsın.",
};

export default function HomePage() {
  return (
    <MarketingShell navItems={homeNavItems} variant="bright">
      <HomeHeroClient />

      <section className="bright-section" id="features">
        <div className="sb-container bright-section__stack">
          <div className="bright-section__intro">
            <div className="bright-section-kicker">Özellikler</div>
            <h2 className="bright-section__title">
              Güzel görünen değil, satış kararını hızlandıran bir analiz akışı
            </h2>
            <p className="bright-section__text">
              BrightSaaS ritmindeki akışı, senin sistemine uyarladım: koyu,
              odaklı, büyük başlıklar ve kartsız section yapısı. Ama içerik
              tamamen SellBoost’un teşhis mantığına göre çalışıyor.
            </p>
          </div>

          <div className="bright-feature-stream">
            {featureRows.map((item, index) => (
              <article
                key={item.title}
                className={`bright-feature-row${index % 2 === 1 ? " is-reverse" : ""}`}
              >
                <div className="bright-feature-row__visual">
                  <div className="bright-feature-row__metric">{item.metricValue}</div>
                  <div className="bright-feature-row__metric-label">{item.metricLabel}</div>
                  <div className="bright-feature-row__visual-copy">{item.text}</div>
                </div>

                <div className="bright-feature-row__copy">
                  <div className="bright-section-kicker">{item.eyebrow}</div>
                  <h3 className="bright-feature-row__title">{item.title}</h3>
                  <p className="bright-feature-row__text">{item.text}</p>
                  <ul className="bright-inline-points">
                    {item.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <div className="bright-process">
            {processSteps.map((step) => (
              <article key={step.step} className="bright-process__item">
                <div className="bright-process__step">{step.step}</div>
                <div className="bright-process__body">
                  <h3 className="bright-process__title">{step.title}</h3>
                  <p className="bright-process__text">{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bright-section bright-section--accent" id="pricing">
        <div className="sb-container bright-section__stack">
          <div className="bright-section__intro">
            <div className="bright-section-kicker">Planlar</div>
            <h2 className="bright-section__title">
              Kart dizisi değil, net bir seçim akışı
            </h2>
            <p className="bright-section__text">
              Fiyatlandırmayı daha editorial bir düzene çektim. Her plan ayrı
              kutu gibi değil, aşağı doğru akan karar satırları gibi okunuyor.
            </p>
          </div>

          <div className="bright-plan-list">
            {pricingPlans.map((plan) => (
              <article
                key={plan.key}
                className={`bright-plan-row${plan.featured ? " is-featured" : ""}`}
              >
                <div className="bright-plan-row__head">
                  <div className="bright-section-kicker">
                    {plan.badge || plan.subtitle}
                  </div>
                  <h3 className="bright-plan-row__title">{plan.name}</h3>
                  <p className="bright-plan-row__text">{plan.description}</p>
                </div>

                <div className="bright-plan-row__price">
                  <span className="bright-plan-row__amount">{plan.price}</span>
                  <span className="bright-plan-row__billing">{plan.billing}</span>
                </div>

                <ul className="bright-plan-row__features">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                <div className="bright-plan-row__action">
                  <Link
                    href={plan.ctaHref}
                    className={plan.featured ? "btn btn-primary" : "btn btn-secondary"}
                  >
                    {plan.ctaLabel}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bright-section" id="resources">
        <div className="sb-container bright-section__stack">
          <div className="bright-section__intro">
            <div className="bright-section-kicker">Kaynaklar</div>
            <h2 className="bright-section__title">
              İlk teşhisten sonra sistem seni boş bırakmaz
            </h2>
            <p className="bright-section__text">
              Homepage yalnızca giriş noktası. Asıl değer, raporların ekip içinde
              tekrar açılabilir ve karar verilebilir hale gelmesinde.
            </p>
          </div>

          <div className="bright-resource-list">
            {resourceItems.map((item) => (
              <article key={item.title} className="bright-resource">
                <div className="bright-resource__main">
                  <div className="bright-section-kicker">{item.eyebrow}</div>
                  <h3 className="bright-resource__title">{item.title}</h3>
                  <p className="bright-resource__text">{item.text}</p>
                </div>
                <Link href={item.href} className="bright-resource__link">
                  {item.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bright-section bright-section--soft" id="faqs">
        <div className="sb-container bright-section__stack">
          <div className="bright-section__intro">
            <div className="bright-section-kicker">SSS</div>
            <h2 className="bright-section__title">
              Ürün, üyelik ve rapor akışı hakkında en net sorular
            </h2>
            <p className="bright-section__text">
              Referanstaki gibi son bölümde bariyer azaltan, kısa ama yeterince
              açıklayıcı bir soru-cevap alanı bıraktım.
            </p>
          </div>

          <div className="bright-faq-list">
            {faqItems.slice(0, 4).map((item) => (
              <article key={item.q} className="bright-faq-item">
                <h3 className="bright-faq-item__q">{item.q}</h3>
                <p className="bright-faq-item__a">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bright-cta">
        <div className="sb-container bright-cta__inner">
          <div>
            <div className="bright-section-kicker">Hazırsan başla</div>
            <h2 className="bright-cta__title">
              Linki bırak, ilk satış teşhisini şimdi al.
            </h2>
            <p className="bright-cta__text">
              Teaser ile ilk sinyalleri gör, kaydolunca tam rapor ve karar
              akışına geç.
            </p>
          </div>

          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link href="/register" className="btn btn-primary btn--lg">
              Ücretsiz başla
            </Link>
            <Link href="/pricing" className="btn btn-secondary btn--lg">
              Planları incele
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
