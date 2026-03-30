import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 403 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    usersLast30Days,
    activeSubscriptions,
    reportsLast30Days,
    reportsLast7Days,
    unreadNotificationReceipts,
    latestUpgrades,
    latestReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.subscription.count({
      where: {
        status: {
          in: ["ACTIVE", "TRIALING"],
        },
      },
    }),
    prisma.report.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.report.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.userNotification.count({
      where: {
        readAt: null,
      },
    }),
    prisma.subscription.findMany({
      where: {
        variant: {
          in: ["PRO_MONTHLY", "PRO_YEARLY", "TEAM"],
        },
        status: {
          in: ["ACTIVE", "TRIALING"],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        userId: true,
        variant: true,
        updatedAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        url: true,
        overallScore: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    metrics: {
      totalUsers,
      usersLast30Days,
      activeSubscriptions,
      reportsLast30Days,
      reportsLast7Days,
      unreadNotificationReceipts,
    },
    latestUpgrades,
    latestReports,
  });
}
