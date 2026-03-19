"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import ThemeToggle from "@/components/theme/ThemeToggle";

type NavItem = {
  href: string;
  label: string;
};

const defaultItems: NavItem[] = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/#nasil-calisir", label: "Nasil Calisir" },
  { href: "/#ozellikler", label: "Ozellikler" },
  { href: "/fiyatlandirma", label: "Fiyatlandirma" },
  { href: "/hakkimizda", label: "Hakkimizda" },
];

type Props = {
  items?: NavItem[];
};

export default function SiteHeader({ items = defaultItems }: Props) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isAuthenticated = status === "authenticated";

  return (
    <header className="site-header">
      <div className="sb-container site-header__inner">
        <Link href="/" className="brand" aria-label="SellBoost AI ana sayfa">
          <span className="brand__mark">SB</span>
          <span className="brand__copy">
            <span className="brand__title">
              Sell<strong>Boost</strong> AI
            </span>
            <span className="brand__subtitle">AI destekli karar paneli</span>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Genel gezinme">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${
                item.href === pathname ? " is-active" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <ThemeToggle />

          {isAuthenticated ? (
            <Link href="/dashboard" className="btn btn-primary">
              Panel
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-secondary">
                Giris Yap
              </Link>
              <Link href="/register" className="btn btn-primary">
                Kayit Ol
              </Link>
            </>
          )}

          {session?.user?.role === "ADMIN" && (
            <span className="eyebrow" style={{ margin: 0 }}>
              Admin
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
