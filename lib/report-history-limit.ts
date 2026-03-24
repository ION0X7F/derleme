import { prisma } from "@/lib/prisma";

export const DEFAULT_REPORT_HISTORY_LIMIT = 5;

export async function resolveReportHistoryLimit(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscription: {
        select: {
          plan: {
            select: {
              reportsHistoryLimit: true,
            },
          },
        },
      },
    },
  });

  return user?.subscription?.plan?.reportsHistoryLimit ?? DEFAULT_REPORT_HISTORY_LIMIT;
}
