import {
  buildAnalysisAccessState,
  resolveAccessPlan,
} from "@/lib/analysis-access";
import { resolvePlanFullContext } from "@/lib/resolve-plan";

type ResolvedPlanSnapshot = {
  planCode: string;
  isUnlimited: boolean;
  monthlyAnalysisLimit: number | null;
};

export function buildUserAnalysisContextFromPlan(params: {
  userId: string;
  plan: ResolvedPlanSnapshot;
}) {
  const accessPlan = resolveAccessPlan({
    sessionUserId: params.userId,
    userPlan: params.plan.planCode,
    unlimited: params.plan.isUnlimited,
  });

  return {
    planCode: params.plan.planCode,
    unlimited: params.plan.isUnlimited,
    monthlyLimit: params.plan.monthlyAnalysisLimit ?? 10,
    accessPlan,
    access: buildAnalysisAccessState(accessPlan),
  };
}

export async function resolveUserAnalysisContext(params: {
  userId: string;
  email?: string | null;
}) {
  const planContext = await resolvePlanFullContext(params.userId, params.email);
  return buildUserAnalysisContextFromPlan({
    userId: params.userId,
    plan: {
      planCode: planContext.planCode,
      isUnlimited: planContext.isUnlimited,
      monthlyAnalysisLimit: planContext.monthlyAnalysisLimit,
    },
  });
}
