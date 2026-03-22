import type { Metadata } from "next";
import HomeHeroClient from "@/components/marketing/HomeHeroClient";
import MarketingShell from "@/components/layout/MarketingShell";

const homeNavItems = [
  { href: "/features", label: "Özellikler" },
  { href: "/pricing", label: "Planlar" },
  { href: "/how-it-works", label: "Kaynaklar" },
  { href: "/faq", label: "SSS" },
];

export const metadata: Metadata = {
  title: "Trendyol ürününüz neden satmıyor? | SellBoost AI",
  description:
    "Ürün linkinizi yapıştırın. AI saniyeler içinde analiz etsin, somut aksiyon planı çıkarsın.",
};

export default function HomePage() {
  return (
    <MarketingShell navItems={homeNavItems} variant="bright" showFooter={false}>
      <HomeHeroClient />
    </MarketingShell>
  );
}
