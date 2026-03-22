"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { marketingNavItems } from "@/content/site";
import ThemeToggle from "@/components/theme/ThemeToggle";

type NavItem = {
  href: string;
  label: string;
};

const defaultItems: NavItem[] = marketingNavItems;

type Props = {
  items?: NavItem[];
  variant?: "default" | "bright";
};

export default function SiteHeader({
  items = defaultItems,
  variant = "default",
}: Props) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isAuthenticated = status === "authenticated";
  const isAdmin = session?.user?.role === "ADMIN";
  const isBright = variant === "bright";

  return (
    <header className={`site-header${isBright ? " site-header--bright" : ""}`}>
      <div className="sb-container site-header__inner">
        <Link href="/" className="brand" aria-label="SellBoost AI ana sayfa">
          <span className="brand__mark">SB</span>
          <span className="brand__copy">
            <span className="brand__title">
              Sell<strong>Boost</strong> AI
            </span>
            <span className="brand__subtitle">
              {isBright
                ? "AI satış teşhisi ve karar akışı"
                : "Trendyol ürün analizi ve karar paneli"}
            </span>
          </span>
        </Link>

        <div className="site-header__nav-shell">
          <nav className="site-nav" aria-label="Genel gezinme">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${pathname === item.href ? " is-active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            {!isBright && <ThemeToggle />}

            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Link href="/admin" className="btn btn-secondary">
                    Admin
                  </Link>
                )}
                <Link href="/dashboard" className="btn btn-primary">
                  Panele Git
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary">
                  Giriş Yap
                </Link>
                <Link href="/register" className="btn btn-primary">
                  Ücretsiz Dene
                </Link>
              </>
            )}

            {isAdmin && (
              <span className="eyebrow" style={{ margin: 0 }}>
                Admin
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
