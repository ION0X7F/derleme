import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ReadBody = {
  notificationId?: string;
};

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as ReadBody;
  const notificationId = String(body.notificationId || "").trim();
  const now = new Date();

  if (notificationId) {
    await prisma.userNotification.updateMany({
      where: {
        userId: session.user.id,
        notificationId,
      },
      data: {
        readAt: now,
      },
    });
  } else {
    await prisma.userNotification.updateMany({
      where: {
        userId: session.user.id,
        readAt: null,
      },
      data: {
        readAt: now,
      },
    });
  }

  const unreadCount = await prisma.userNotification.count({
    where: {
      userId: session.user.id,
      readAt: null,
    },
  });

  return NextResponse.json({
    success: true,
    unreadCount,
  });
}
