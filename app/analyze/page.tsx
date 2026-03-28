import DashboardShellFrame from "../_ui/dashboard-shell-frame";

type AnalyzePageProps = {
  searchParams?: Promise<{
    url?: string;
    autorun?: string;
  }>;
};

export default async function AnalyzePage({ searchParams }: AnalyzePageProps) {
  const params = (await searchParams) ?? {};
  return (
    <DashboardShellFrame
      initialView="new-analysis"
      initialPrefillUrl={typeof params.url === "string" ? params.url : undefined}
      initialAutorun={params.autorun === "1"}
    />
  );
}
