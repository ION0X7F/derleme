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
    };

type LimitResult = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  periodKey: string;
  periodType: "monthly";
};

export async function checkAnalyzeLimit(
  params: CheckAnalyzeLimitParams
): Promise<LimitResult> {
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

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: {
      subscription: {
        include: {
          plan: true,
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

  let monthlyLimit = 10;

  if (
    user.subscription &&
    (user.subscription.status === "ACTIVE" ||
      user.subscription.status === "TRIALING")
  ) {
    monthlyLimit = user.subscription.plan.monthlyAnalysisLimit;
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
