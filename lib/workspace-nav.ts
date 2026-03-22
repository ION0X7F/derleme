type NavItem = {
  href: string;
  label: string;
};

export function getWorkspaceNav(params?: {
  includeAdmin?: boolean;
  reportId?: string | null;
}): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/analyze", label: "Yeni Analiz" },
    { href: "/reports", label: "Raporlar" },
    { href: "/account", label: "Hesap" },
  ];

  if (params?.reportId) {
    items.push({ href: `/report/${params.reportId}`, label: "Rapor" });
  }

  if (params?.includeAdmin) {
    items.push({ href: "/admin", label: "Admin" });
  }

  return items;
}

export function getAdminNav(): NavItem[] {
  return [
    { href: "/admin", label: "Genel Bakis" },
    { href: "/admin/users", label: "Kullanicilar" },
    { href: "/admin/plans", label: "Planlar" },
    { href: "/admin/reports", label: "Raporlar" },
    { href: "/admin/system", label: "Sistem" },
  ];
}
