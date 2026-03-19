import Link from "next/link";
import { ReactNode } from "react";
import ThemeToggle from "@/components/theme/ThemeToggle";

type AppNavItem = {
  href: string;
  label: string;
};

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  currentPath: string;
  navItems: AppNavItem[];
  actions?: ReactNode;
  headerMeta?: ReactNode;
  sidebarMeta?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
};

export default function AppChrome({
  eyebrow,
  title,
  description,
  currentPath,
  navItems,
  actions,
  headerMeta,
  sidebarMeta,
  sidebarFooter,
  children,
}: Props) {
  return (
    <div className="sb-page">
      <div className="sb-container dashboard-grid">
        <aside className="surface app-sidebar">
          <Link href="/" className="brand" aria-label="SellBoost AI ana sayfa">
            <span className="brand__mark">SB</span>
            <span className="brand__copy">
              <span className="brand__title">
                Sell<strong>Boost</strong> AI
              </span>
              <span className="brand__subtitle">Workspace</span>
            </span>
          </Link>

          <nav className="app-sidebar__nav" aria-label="Uygulama gezinme">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`app-nav-link${
                  currentPath === item.href ? " is-active" : ""
                }`}
              >
                <span>{item.label}</span>
                {currentPath === item.href && <span className="status-good">Canli</span>}
              </Link>
            ))}
          </nav>

          {sidebarMeta && <div className="app-sidebar__meta">{sidebarMeta}</div>}

          <div className="subtle-divider" style={{ margin: "18px 0" }} />

          <div className="app-sidebar__footer">
            <ThemeToggle />
            {sidebarFooter}
          </div>
        </aside>

        <div className="app-main">
          <section className="surface app-header">
            <div className="app-header__top">
              <div>
                {eyebrow && <div className="eyebrow">{eyebrow}</div>}
                <h1 className="app-header__title">{title}</h1>
                {description && <p className="app-header__text">{description}</p>}
                {headerMeta && <div className="app-header__meta">{headerMeta}</div>}
              </div>

              {actions && <div className="inline-actions">{actions}</div>}
            </div>
          </section>

          {children}
        </div>
      </div>
    </div>
  );
}
