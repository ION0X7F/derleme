import type { ReactNode } from "react";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import type { MarketingNavItem } from "@/content/site";

type Props = {
  children: ReactNode;
  navItems?: MarketingNavItem[];
  variant?: "default" | "bright";
};

export default function MarketingShell({
  children,
  navItems,
  variant = "default",
}: Props) {
  return (
    <div className={`sb-shell${variant === "bright" ? " sb-shell--bright" : ""}`}>
      <SiteHeader items={navItems} variant={variant} />
      <main className={`sb-page${variant === "bright" ? " sb-page--bright" : ""}`}>
        {children}
      </main>
      <SiteFooter variant={variant} />
    </div>
  );
}
