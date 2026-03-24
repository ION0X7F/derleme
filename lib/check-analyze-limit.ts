import { prisma } from "@/lib/prisma";
import { getMonthlyPeriodKey } from "@/lib/usage";
import { GUEST_ANALYZE_MONTHLY_LIMIT } from "@/lib/limits";

type CheckAnalyzeLimitParams =
  | {
      type: "guest";
      guestId: string;
    }
  | {
      type: "user";
      userId: string;
      monthlyLimitOverride?: number | null;
    };

export type AnalyzeLimitResult = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  periodKey: string;
  periodType: "monthly";
};

export async function checkAnalyzeLimit(
  params: CheckAnalyzeLimitParams
): Promise<AnalyzeLimitResult> {
  const action = "analyze";
  const periodKey = getMonthlyPeriodKey();

  if (params.type === "guest") {
    const record = await prisma.guestUsageRecord.findUnique({
      where: {
        guestId_action_periodKey: {
          guestId: params.guestId,
          action,
          periodKey,
        },
      },
    });

    const used = record?.count ?? 0;
    const limit = GUEST_ANALYZE_MONTHLY_LIMIT;

    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      periodKey,
      periodType: "monthly",
    };
  }

  let monthlyLimit =
    typeof params.monthlyLimitOverride === "number" &&
    Number.isFinite(params.monthlyLimitOverride) &&
    params.monthlyLimitOverride > 0
      ? Math.floor(params.monthlyLimitOverride)
      : 10;

  if (params.monthlyLimitOverride == null) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        subscription: {
          select: {
            status: true,
            plan: {
              select: {
                monthlyAnalysisLimit: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return {
        allowed: false,
        used: 0,
        limit: 0,
        remaining: 0,
        periodKey,
        periodType: "monthly",
      };
    }

    if (
      user.subscription &&
      (user.subscription.status === "ACTIVE" ||
        user.subscription.status === "TRIALING")
    ) {
      monthlyLimit = user.subscription.plan.monthlyAnalysisLimit;
    }
  }

  const record = await prisma.userUsageRecord.findUnique({
    where: {
      userId_action_periodKey: {
        userId: params.userId,
        action,
        periodKey,
      },
    },
  });

  const used = record?.count ?? 0;

  return {
    allowed: used < monthlyLimit,
    used,
    limit: monthlyLimit,
    remaining: Math.max(monthlyLimit - used, 0),
    periodKey,
    periodType: "monthly",
  };
}
