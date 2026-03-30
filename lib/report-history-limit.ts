import { prisma } from "@/lib/prisma";

export const DEFAULT_REPORT_HISTORY_LIMIT = 5;

export async function resolveReportHistoryLimit(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscription: {
        select: {
          status: true,
          plan: {
            select: {
              reportsHistoryLimit: true,
            },
          },
        },
      },
    },
  });

  if (
    user?.subscription &&
    (user.subscription.status === "ACTIVE" ||
      user.subscription.status === "TRIALING")
  ) {
    return user.subscription.plan?.reportsHistoryLimit ?? DEFAULT_REPORT_HISTORY_LIMIT;
  }

  return DEFAULT_REPORT_HISTORY_LIMIT;
}
