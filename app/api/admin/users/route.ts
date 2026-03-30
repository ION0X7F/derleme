import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveAppPlanId } from "@/lib/plans";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 403 });
  }

  const search = String(request.nextUrl.searchParams.get("q") || "").trim();
  const takeRaw = Number(request.nextUrl.searchParams.get("take") || "50");
  const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(100, takeRaw)) : 50;

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { email: { contains: search } },
            { name: { contains: search } },
            { username: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      plan: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          variant: true,
          plan: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
      reports: {
        select: {
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      _count: {
        select: {
          reports: true,
        },
      },
    },
  });

  const userIds = users.map((user) => user.id);
  const unreadCounts = await prisma.userNotification.groupBy({
    by: ["userId"],
    where: {
      userId: { in: userIds },
      readAt: null,
    },
    _count: {
      _all: true,
    },
  });

  const unreadByUserId = new Map<string, number>(
    unreadCounts.map((item) => [item.userId, item._count._all])
  );

  return NextResponse.json({
    users: users.map((user) => {
      const planId = resolveAppPlanId({
        planCode: user.subscription?.plan?.code ?? user.plan,
        planVariant: user.subscription?.variant ?? null,
        planName: user.subscription?.plan?.name ?? null,
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        planCode: user.subscription?.plan?.code ?? user.plan,
        planId,
        subscriptionStatus: user.subscription?.status ?? null,
        createdAt: user.createdAt,
        reportCount: user._count.reports,
        lastReportAt: user.reports[0]?.createdAt ?? null,
        unreadNotificationCount: unreadByUserId.get(user.id) ?? 0,
      };
    }),
  });
}
