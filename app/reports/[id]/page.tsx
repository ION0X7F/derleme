import DashboardShellFrame from "../../_ui/dashboard-shell-frame";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DashboardShellFrame initialView="report-detail" reportId={id} />;
}
