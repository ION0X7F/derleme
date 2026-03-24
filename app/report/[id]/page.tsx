import DashboardShellFrame from "../../_ui/dashboard-shell-frame";

export default async function LegacyReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DashboardShellFrame initialView="report-detail" reportId={id} />;
}
