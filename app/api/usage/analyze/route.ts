import { getAnalyzeUsageResponse } from "@/lib/usage-route-response";

export async function GET() {
  return getAnalyzeUsageResponse();
}
