import { permanentRedirect } from "next/navigation";
import { getCanonicalReportRoute } from "@/lib/workspace-routes";

export default async function LegacyReportDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(getCanonicalReportRoute(id));
}
