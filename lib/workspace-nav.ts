import { getCanonicalReportRoute, WORKSPACE_ROUTES } from "@/lib/workspace-routes";

type NavItem = {
  href: string;
  label: string;
};

export function getWorkspaceNav(params?: {
  includeAdmin?: boolean;
  reportId?: string | null;
}): NavItem[] {
  const items: NavItem[] = [
    { href: WORKSPACE_ROUTES.dashboard, label: "Dashboard" },
    { href: WORKSPACE_ROUTES.analyze, label: "Yeni Analiz" },
    { href: WORKSPACE_ROUTES.reports, label: "Raporlar" },
    { href: WORKSPACE_ROUTES.account, label: "Hesap" },
  ];

  if (params?.reportId) {
    items.push({ href: getCanonicalReportRoute(params.reportId), label: "Rapor" });
  }

  if (params?.includeAdmin) {
    items.push({ href: "/admin", label: "Admin Operasyon" });
  }

  return items;
}

export function getAdminNav(): NavItem[] {
  return [
    { href: "/admin", label: "Operasyon Ozeti" },
    { href: "/admin/users", label: "Kullanicilar" },
    { href: "/admin/plans", label: "Planlar" },
    { href: "/admin/reports", label: "Rapor Operasyonu" },
    { href: "/admin/system", label: "Sistem Sagligi" },
  ];
}
