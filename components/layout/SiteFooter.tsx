import Link from "next/link";
import { footerLinks } from "@/content/site";

type Props = {
  variant?: "default" | "bright";
};

export default function SiteFooter({ variant = "default" }: Props) {
  const isBright = variant === "bright";

  return (
    <footer className={`site-footer${isBright ? " site-footer--bright" : ""}`}>
      <div className="sb-container">
        <div className="surface site-footer__inner site-footer__inner--expanded">
          <div className="site-footer__copy">
            {!isBright && (
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                SellBoost AI
              </div>
            )}
            <p style={{ margin: 0 }}>
              {isBright
                ? "SellBoost AI, Trendyol ürün sayfalarını fiyat, güven, içerik ve rekabet sinyalleriyle okuyup ekiplerin daha hızlı karar vermesi için tasarlanmış bir AI satış teşhis katmanıdır."
                : "SellBoost AI, Trendyol ürün sayfalarını veri, rekabet ve güven sinyalleriyle okuyup ekiplerin daha hızlı karar vermesi için tasarlanmış sade ama premium bir analiz deneyimidir."}
            </p>
            <p className="site-footer__small">
              {isBright
                ? "Landing tarafı hızlı ilk teşhisi, kayıtlı deneyim ise tam rapor, kütüphane ve karar akışını açacak şekilde kuruldu."
                : "İlk ekranda hızlı teşhis mantığını korurken, daha sıcak bir tema ve daha net bir ürün hiyerarşisi kurduk."}
            </p>
          </div>

          <div className="site-footer__columns">
            <div className="site-footer__column">
              <div className="site-footer__label">Keşfet</div>
              <div className="site-footer__links site-footer__links--stacked">
                {footerLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="text-link">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="site-footer__column">
              <div className="site-footer__label">İletişim ve Yasal</div>
              <div className="site-footer__links site-footer__links--stacked">
                <Link href="/gizlilik-politikasi" className="text-link">
                  Gizlilik Politikası
                </Link>
                <Link href="/kullanim-kosullari" className="text-link">
                  Kullanım Koşulları
                </Link>
                <Link href="/iletisim" className="text-link">
                  İletişim
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
