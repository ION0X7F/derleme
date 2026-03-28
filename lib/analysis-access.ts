import type { AccessPlan, AnalysisAccessState } from "@/types/analysis";

export function resolveAccessPlan(params: {
  sessionUserId?: string | null;
  userPlan?: string | null;
  unlimited: boolean;
}): AccessPlan {
  if (!params.sessionUserId) return "guest";
  if (params.unlimited) return "enterprise";
  if (params.userPlan === "PREMIUM") return "pro";
  return "free";
}

export function buildAnalysisAccessState(plan: AccessPlan): AnalysisAccessState {
  const configs: Record<AccessPlan, AnalysisAccessState> = {
    guest: {
      plan: "guest",
      lockedSections: [
        "advancedOfferAnalysis",
        "competitorAnalysis",
        "premiumActionPlan",
        "history",
        "export",
        "reanalysis",
      ],
      teaserSections: [
        "advancedOfferAnalysis",
        "competitorAnalysis",
        "premiumActionPlan",
      ],
      maxFindings: 2,
      maxSuggestions: 1,
      maxPriorityActions: 1,
    },
    free: {
      plan: "free",
      lockedSections: [
        "advancedOfferAnalysis",
        "competitorAnalysis",
        "premiumActionPlan",
        "export",
        "reanalysis",
      ],
      teaserSections: [
        "advancedOfferAnalysis",
        "competitorAnalysis",
        "premiumActionPlan",
      ],
      maxFindings: 6,
      maxSuggestions: 5,
      maxPriorityActions: 5,
    },
    pro: {
      plan: "pro",
      lockedSections: [],
      teaserSections: [],
      maxFindings: 18,
      maxSuggestions: 24,
      maxPriorityActions: 24,
    },
    enterprise: {
      plan: "enterprise",
      lockedSections: [],
      teaserSections: [],
      maxFindings: 24,
      maxSuggestions: 24,
      maxPriorityActions: 24,
    },
  };

  return configs[plan];
}
