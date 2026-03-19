import { prisma } from "@/lib/prisma";
import { getMonthlyPeriodKey } from "@/lib/usage";

type IncrementAnalyzeUsageParams =
  | {
      type: "guest";
      guestId: string;
    }
  | {
      type: "user";
      userId: string;
    };

export async function incrementAnalyzeUsage(
  params: IncrementAnalyzeUsageParams
) {
  const action = "analyze";
  const periodKey = getMonthlyPeriodKey();

  if (params.type === "guest") {
    await prisma.guestUsageRecord.upsert({
      where: {
        guestId_action_periodKey: {
          guestId: params.guestId,
          action,
          periodKey,
        },
      },
      update: {
        count: {
          increment: 1,
        },
      },
      create: {
        guestId: params.guestId,
        action,
        periodKey,
        count: 1,
      },
    });

    return;
  }

  await prisma.userUsageRecord.upsert({
    where: {
      userId_action_periodKey: {
        userId: params.userId,
        action,
        periodKey,
      },
    },
    update: {
      count: {
        increment: 1,
      },
    },
    create: {
      userId: params.userId,
      action,
      periodKey,
      count: 1,
    },
  });
}
