import Link from "next/link";

const footerLinks = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/fiyatlandirma", label: "Fiyatlandirma" },
  { href: "/hakkimizda", label: "Hakkimizda" },
  { href: "/iletisim", label: "Iletisim" },
  { href: "/gizlilik-politikasi", label: "Gizlilik" },
  { href: "/kullanim-kosullari", label: "Kosullar" },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="sb-container">
        <div className="surface site-footer__inner">
          <div className="site-footer__copy">
            SellBoost AI, Trendyol urun sayfalarini veri, rekabet ve guven
            sinyalleriyle okuyup ekiplerin daha hizli karar vermesi icin
            tasarlanmis premium analiz deneyimidir.
          </div>

          <div className="site-footer__links">
            {footerLinks.map((item) => (
              <Link key={item.href} href={item.href} className="nav-link">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
