import Link from "next/link";
import { ReactNode } from "react";
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
  return (
    <>
      <style>{`
        .dm-shell {
          display: flex;
          min-height: 100vh;
          background: var(--dm-bg, #F3F6F9);
        }
        .dm-sidebar {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: 260px;
          background: var(--dm-card-bg, #fff);
          border-right: 1px solid var(--dm-border, #e2e8f0);
          display: flex;
          flex-direction: column;
          z-index: 100;
          overflow-y: auto;
          transition: margin-left 0.3s ease;
        }
        html[data-theme="dark"] {
          --dm-bg: #16192a;
          --dm-card-bg: #1e2130;
          --dm-border: rgba(255,255,255,0.08);
          --dm-text: #e2e8f0;
          --dm-text-soft: #94a3b8;
          --dm-nav-hover: rgba(255,255,255,0.05);
          --dm-nav-active-bg: rgba(242,135,5,0.12);
        }
        html[data-theme="light"] {
          --dm-bg: #F3F6F9;
          --dm-card-bg: #ffffff;
          --dm-border: #e2e8f0;
          --dm-text: #1a202c;
          --dm-text-soft: #718096;
          --dm-nav-hover: #F3F6F9;
          --dm-nav-active-bg: color-mix(in srgb, var(--brand) 10%, transparent);
        }
        .dm-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 20px 16px;
          border-bottom: 1px solid var(--dm-border);
          text-decoration: none;
          color: var(--dm-text);
        }
        .dm-brand__mark {
          width: 40px; height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
          display: grid; place-items: center;
          color: #fff; font-weight: 800; font-size: 14px; flex-shrink: 0;
        }
        .dm-brand__name {
          font-size: 16px; font-weight: 700;
          letter-spacing: -0.02em; line-height: 1.2;
        }
        .dm-brand__name strong { color: var(--brand); }
        .dm-brand__sub {
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--dm-text-soft); margin-top: 1px;
        }
        .dm-nav {
          flex: 1; padding: 16px 12px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .dm-nav-label {
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--dm-text-soft); padding: 8px 8px 4px; margin-top: 8px;
        }
        .dm-nav-link {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          font-size: 14px; font-weight: 600;
          color: var(--dm-text-soft); text-decoration: none;
          transition: background 160ms ease, color 160ms ease;
          border-left: 3px solid transparent;
        }
        .dm-nav-link:hover { background: var(--dm-nav-hover); color: var(--dm-text); }
        .dm-nav-link.is-active {
          background: var(--dm-nav-active-bg);
          color: var(--brand); border-left-color: var(--brand); font-weight: 700;
        }
        .dm-nav-link__icon {
          width: 32px; height: 32px; border-radius: 8px;
          display: grid; place-items: center; font-size: 15px;
          background: var(--dm-nav-hover); flex-shrink: 0;
        }
        .dm-nav-link.is-active .dm-nav-link__icon {
          background: color-mix(in srgb, var(--brand) 15%, transparent);
        }
        .dm-sidebar__footer {
          padding: 16px; border-top: 1px solid var(--dm-border);
          display: flex; flex-direction: column; gap: 10px;
        }
        .dm-main {
          margin-left: 260px; flex: 1;
          display: flex; flex-direction: column;
          min-height: 100vh; background: var(--dm-bg);
        }
        .dm-topbar {
          position: sticky; top: 0; z-index: 90;
          background: var(--dm-card-bg);
          border-bottom: 1px solid var(--dm-border);
          padding: 0 24px; height: 64px;
          display: flex; align-items: center;
          justify-content: space-between; gap: 16px;
        }
        .dm-topbar__left { display: flex; flex-direction: column; gap: 2px; }
        .dm-topbar__eyebrow {
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--dm-text-soft);
        }
        .dm-topbar__title {
          font-size: 18px; font-weight: 700;
          letter-spacing: -0.02em; margin: 0; line-height: 1.2;
        }
        .dm-topbar__right {
          display: flex; align-items: center; gap: 12px; flex-shrink: 0;
        }
        .dm-content {
          padding: 24px; display: flex;
          flex-direction: column; gap: 20px; flex: 1;
        }
        @media (max-width: 991px) {
          .dm-sidebar { margin-left: -260px; }
          .dm-main { margin-left: 0; }
        }
      `}</style>

      <div className="dm-shell">
        <aside className="dm-sidebar">
          <Link href="/" className="dm-brand">
            <div className="dm-brand__mark">SB</div>
            <div>
              <div className="dm-brand__name">Sell<strong>Boost</strong> AI</div>
              <div className="dm-brand__sub">
                {brandSubtitle || (variant === "admin" ? "Control Center" : "Workspace")}
              </div>
            </div>
          </Link>

          <nav className="dm-nav">
            <div className="dm-nav-label">Ana Menü</div>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`dm-nav-link${currentPath === item.href ? " is-active" : ""}`}
              >
                <span className="dm-nav-link__icon">{item.icon || "○"}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {sidebarMeta && (
            <div style={{ padding: "0 16px 16px" }}>{sidebarMeta}</div>
          )}

          <div className="dm-sidebar__footer">
            <ThemeToggle />
            {sidebarFooter}
          </div>
        </aside>

        <div className="dm-main">
          <div className="dm-topbar">
            <div className="dm-topbar__left">
              {eyebrow && <div className="dm-topbar__eyebrow">{eyebrow}</div>}
              <h1 className="dm-topbar__title">{title}</h1>
              {description && (
                <p style={{ fontSize: 12, color: "var(--dm-text-soft)", margin: 0 }}>{description}</p>
              )}
            </div>
            <div className="dm-topbar__right">
              {headerMeta && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{headerMeta}</div>}
              {actions && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>}
            </div>
          </div>

          <div className="dm-content">{children}</div>
        </div>
      </div>
    </>
  );
}
