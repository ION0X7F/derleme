import { Prisma } from "@prisma/client";
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

type UsageDbClient = Partial<
  Pick<typeof prisma, "guestUsageRecord" | "userUsageRecord">
>;

export async function incrementAnalyzeUsage(
  params: IncrementAnalyzeUsageParams
) {
  const action = "analyze";
  const periodKey = getMonthlyPeriodKey();

  if (params.type === "guest") {
    const record = await prisma.guestUsageRecord.upsert({
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

    return {
      used: record.count,
      periodKey,
    } as const;
  }

  const record = await prisma.userUsageRecord.upsert({
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

  return {
    used: record.count,
    periodKey,
  } as const;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function consumeAnalyzeUsageIfAllowed(
  params:
    | {
        type: "guest";
        guestId: string;
        limit: number;
        client?: UsageDbClient;
      }
    | {
        type: "user";
        userId: string;
        limit: number;
        client?: UsageDbClient;
      }
) {
  const action = "analyze";
  const periodKey = getMonthlyPeriodKey();
  const client = params.client ?? prisma;

  const buildSnapshot = (used: number, allowed: boolean) => ({
    allowed,
    used,
    limit: params.limit,
    remaining: Math.max(params.limit - used, 0),
    periodKey,
    periodType: "monthly" as const,
  });

  if (!Number.isFinite(params.limit) || params.limit <= 0) {
    return buildSnapshot(0, false);
  }

  if (params.type === "guest") {
    const guestUsageRecord = client.guestUsageRecord ?? prisma.guestUsageRecord;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const updated = await guestUsageRecord.updateMany({
        where: {
          guestId: params.guestId,
          action,
          periodKey,
          count: {
            lt: params.limit,
          },
        },
        data: {
          count: {
            increment: 1,
          },
        },
      });

      if (updated.count > 0) {
        const record = await guestUsageRecord.findUnique({
          where: {
            guestId_action_periodKey: {
              guestId: params.guestId,
              action,
              periodKey,
            },
          },
        });

        return buildSnapshot(record?.count ?? 1, true);
      }

      try {
        const record = await guestUsageRecord.create({
          data: {
            guestId: params.guestId,
            action,
            periodKey,
            count: 1,
          },
        });

        return buildSnapshot(record.count, true);
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    const record = await guestUsageRecord.findUnique({
      where: {
        guestId_action_periodKey: {
          guestId: params.guestId,
          action,
          periodKey,
        },
      },
    });

    return buildSnapshot(record?.count ?? 0, false);
  }

  const userUsageRecord = client.userUsageRecord ?? prisma.userUsageRecord;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const updated = await userUsageRecord.updateMany({
      where: {
        userId: params.userId,
        action,
        periodKey,
        count: {
          lt: params.limit,
        },
      },
      data: {
        count: {
          increment: 1,
        },
      },
    });

    if (updated.count > 0) {
      const record = await userUsageRecord.findUnique({
        where: {
          userId_action_periodKey: {
            userId: params.userId,
            action,
            periodKey,
          },
        },
      });

      return buildSnapshot(record?.count ?? 1, true);
    }

    try {
      const record = await userUsageRecord.create({
        data: {
          userId: params.userId,
          action,
          periodKey,
          count: 1,
        },
      });

      return buildSnapshot(record.count, true);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  const record = await userUsageRecord.findUnique({
    where: {
      userId_action_periodKey: {
        userId: params.userId,
        action,
        periodKey,
      },
    },
  });

  return buildSnapshot(record?.count ?? 0, false);
}
