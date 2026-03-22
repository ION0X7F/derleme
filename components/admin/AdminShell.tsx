import { ReactNode } from "react";
import AppChrome from "@/components/layout/AppChrome";
import { campaignContent } from "@/lib/plans";
import { getAdminNav } from "@/lib/workspace-nav";

type Props = {
  currentPath: string;
  title: string;
  description: string;
  headerMeta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminShell({
  currentPath,
  title,
  description,
  headerMeta,
  actions,
  children,
}: Props) {
  return (
    <AppChrome
      currentPath={currentPath}
      eyebrow="Admin Control"
      title={title}
      description={description}
      navItems={getAdminNav()}
      variant="admin"
      brandSubtitle="Operations"
      headerMeta={headerMeta}
      actions={actions}
      sidebarMeta={
        <div className="sb-stack-12">
          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Operasyon modu</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              Yonetim gorunumu
            </div>
            <p className="card-copy">
              Kullanici, plan, rapor ve sistem akislarini ayni operasyon dilinde
              yonetmek icin ayrik bir panel.
            </p>
          </div>

          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">Runtime notu</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              Hafif ama yogun
            </div>
            <p className="card-copy">
              Normal kullanici panelinden ayrisir; daha fazla veri gosterir ama
              okunabilir ritmini korur.
            </p>
          </div>

          <div className="surface-soft" style={{ padding: 16 }}>
            <div className="stat-card__label">{campaignContent.badge}</div>
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 6 }}>
              {campaignContent.title}
            </div>
            <p className="card-copy">{campaignContent.detail}</p>
          </div>
        </div>
      }
    >
      {children}
    </AppChrome>
  );
}
