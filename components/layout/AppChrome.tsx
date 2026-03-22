"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme/ThemeToggle";

type AppNavItem = {
  href: string;
  label: string;
  icon?: string;
};

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  currentPath: string;
  navItems: AppNavItem[];
  variant?: "workspace" | "admin";
  brandSubtitle?: string;
  actions?: ReactNode;
  headerMeta?: ReactNode;
  sidebarMeta?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
};

function isItemActive(currentPath: string, pathname: string, href: string) {
  return pathname === href || currentPath === href;
}

export default function AppChrome({
  eyebrow,
  title,
  description,
  currentPath,
  navItems,
  variant = "workspace",
  brandSubtitle,
  actions,
  headerMeta,
  sidebarMeta,
  sidebarFooter,
  children,
}: Props) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className={`app-chrome app-chrome--${variant}`}>
      <button
        type="button"
        className={`app-chrome__overlay${isSidebarOpen ? " is-visible" : ""}`}
        aria-hidden={!isSidebarOpen}
        tabIndex={isSidebarOpen ? 0 : -1}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside
        className={`app-chrome__sidebar${isSidebarOpen ? " is-open" : ""}`}
        aria-label={variant === "admin" ? "Admin gezinmesi" : "Uygulama gezinmesi"}
      >
        <div className="app-chrome__sidebar-top">
          <Link href="/" className="app-chrome__brand" aria-label="SellBoost AI ana sayfa">
            <span className="app-chrome__brand-mark">SB</span>
            <span className="app-chrome__brand-copy">
              <span className="app-chrome__brand-title">
                Sell<strong>Boost</strong> AI
              </span>
              <span className="app-chrome__brand-subtitle">
                {brandSubtitle ||
                  (variant === "admin" ? "Control Center" : "Workspace")}
              </span>
            </span>
          </Link>

          <button
            type="button"
            className="app-chrome__sidebar-close"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Menüyü kapat"
          >
            Kapat
          </button>
        </div>

        <nav className="app-chrome__nav">
          <div className="app-chrome__nav-label">Ana Menü</div>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`app-chrome__nav-link${
                isItemActive(currentPath, pathname, item.href) ? " is-active" : ""
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <span className="app-chrome__nav-icon" aria-hidden="true">
                {item.icon || "•"}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {sidebarMeta ? (
          <div className="app-chrome__sidebar-meta">{sidebarMeta}</div>
        ) : null}

        <div className="app-chrome__sidebar-footer">
          <ThemeToggle />
          {sidebarFooter}
        </div>
      </aside>

      <div className="app-chrome__main">
        <header className="app-chrome__topbar">
          <div className="app-chrome__topbar-main">
            <button
              type="button"
              className="app-chrome__menu-button"
              onClick={() => setIsSidebarOpen((value) => !value)}
              aria-label="Menüyü aç"
              aria-expanded={isSidebarOpen}
            >
              Menü
            </button>

            <div className="app-chrome__titles">
              {eyebrow ? (
                <div className="app-chrome__eyebrow">{eyebrow}</div>
              ) : null}
              <h1 className="app-chrome__title">{title}</h1>
              {description ? (
                <p className="app-chrome__description">{description}</p>
              ) : null}
            </div>
          </div>

          {(headerMeta || actions) && (
            <div className="app-chrome__topbar-actions">
              {headerMeta ? <div className="pill-row">{headerMeta}</div> : null}
              {actions ? <div className="inline-actions">{actions}</div> : null}
            </div>
          )}
        </header>

        <main className="app-chrome__content">{children}</main>
      </div>
    </div>
  );
}
