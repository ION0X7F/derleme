export const WORKSPACE_ROUTES = {
  dashboard: "/dashboard",
  analyze: "/analyze",
  reports: "/reports",
  account: "/account",
  settings: "/settings",
} as const;

export function getCanonicalReportRoute(reportId: string | number) {
  return `/report/${encodeURIComponent(String(reportId))}`;
}

export function isCanonicalWorkspacePath(pathname: string) {
  return (
    pathname === WORKSPACE_ROUTES.dashboard ||
    pathname === WORKSPACE_ROUTES.analyze ||
    pathname === WORKSPACE_ROUTES.reports ||
    pathname === WORKSPACE_ROUTES.account ||
    pathname === WORKSPACE_ROUTES.settings ||
    pathname.startsWith("/report/")
  );
}

export const LEGACY_WORKSPACE_PREFIXES = ["/reports/"] as const;
