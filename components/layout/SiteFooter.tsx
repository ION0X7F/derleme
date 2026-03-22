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
                ? "SellBoost AI, Trendyol urun sayfalarini fiyat, guven, icerik ve rekabet sinyalleriyle okuyup ekiplerin daha hizli karar vermesi icin tasarlanmis bir AI satis teshis katmanidir."
                : "SellBoost AI, Trendyol urun sayfalarini veri, rekabet ve guven sinyalleriyle okuyup ekiplerin daha hizli karar vermesi icin tasarlanmis sade ama premium bir analiz deneyimidir."}
            </p>
            <p className="site-footer__small">
              {isBright
                ? "Landing tarafi hizli ilk teshisi, kayitli deneyim ise tam rapor, kutuphane ve karar akisini acacak sekilde kuruldu."
                : "Referans sitedeki hizli giris mantigini korurken daha sicak bir renk dili, daha net hiyerarsi ve uygulamaya acilan daha guclu bir rapor akisi kurduk."}
            </p>
          </div>

          <div className="site-footer__columns">
            <div className="site-footer__column">
              <div className="site-footer__label">Kesfet</div>
              <div className="site-footer__links site-footer__links--stacked">
                {footerLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="text-link">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="site-footer__column">
              <div className="site-footer__label">Iletisim ve Yasal</div>
              <div className="site-footer__links site-footer__links--stacked">
                <Link href="/gizlilik-politikasi" className="text-link">
                  Gizlilik Politikasi
                </Link>
                <Link href="/kullanim-kosullari" className="text-link">
                  Kullanim Kosullari
                </Link>
                <Link href="/iletisim" className="text-link">
                  Iletisim
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
