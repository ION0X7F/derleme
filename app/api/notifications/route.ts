import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const receipts = await prisma.userNotification.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
    select: {
      id: true,
      readAt: true,
      createdAt: true,
      notification: {
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          createdAt: true,
        },
      },
    },
  });

  const unreadCount = await prisma.userNotification.count({
    where: {
      userId: session.user.id,
      readAt: null,
    },
  });

  return NextResponse.json({
    unreadCount,
    notifications: receipts.map((item) => ({
      receiptId: item.id,
      notificationId: item.notification.id,
      title: item.notification.title,
      message: item.notification.message,
      type: item.notification.type,
      createdAt: item.notification.createdAt,
      readAt: item.readAt,
    })),
  });
}
