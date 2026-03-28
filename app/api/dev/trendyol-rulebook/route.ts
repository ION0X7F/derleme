import { NextResponse } from "next/server";
import { resolveFullRulebook } from "@/lib/trendyol-rule-resolution";
import { TRENDYOL_RULEBOOK } from "@/lib/trendyol-rulebook";
import {
  getCoverageGaps,
  getRecommendedCoverageWork,
  summarizeRuleCoverage,
  TRENDYOL_RULE_COVERAGE,
} from "@/lib/trendyol-rule-coverage";

export const dynamic = "force-dynamic";

export async function GET() {
  const coverageSummary = summarizeRuleCoverage();
  const coverageGaps = getCoverageGaps();
  const recommendedCoverageWork = getRecommendedCoverageWork();

  return NextResponse.json({
    success: true,
    metadata: {
      note: "Yeni tarihli notlar otomatik override etmez; additive ve conflict mantigi birlikte uygulanir.",
      preserveLegacyWhenMissing: TRENDYOL_RULEBOOK.shared.valuePolicy.preserveLegacyWhenMissing,
      intentionalLegacyCards: coverageGaps.legacy.map((item) => item.card),
      remainingLegacyCount: coverageSummary.legacy,
    },
    coverage: TRENDYOL_RULE_COVERAGE,
    coverageSummary,
    coverageGaps,
    recommendedCoverageWork,
    resolved: resolveFullRulebook(),
  });
}
