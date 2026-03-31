import DashboardShellFrame from "../_ui/dashboard-shell-frame";

type AnalyzePageProps = {
  searchParams?: Promise<{
    url?: string;
    keyword?: string;
    autorun?: string;
  }>;
};

export default async function AnalyzePage({ searchParams }: AnalyzePageProps) {
  const params = (await searchParams) ?? {};
  return (
    <DashboardShellFrame
      initialView="new-analysis"
      initialPrefillUrl={typeof params.url === "string" ? params.url : undefined}
      initialPrefillKeyword={typeof params.keyword === "string" ? params.keyword : undefined}
      initialAutorun={params.autorun === "1"}
    />
  );
}
