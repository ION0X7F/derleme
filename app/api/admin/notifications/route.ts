import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type NotificationTypeInput = "INFO" | "SUCCESS" | "WARNING" | "ALERT";

type CreateNotificationBody = {
  title?: string;
  message?: string;
  type?: NotificationTypeInput;
  target?: "all" | "user";
  userId?: string;
};

const ALLOWED_TYPES = new Set<NotificationTypeInput>([
  "INFO",
  "SUCCESS",
  "WARNING",
  "ALERT",
]);

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 403 });
  }

  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      targetScope: true,
      targetUserId: true,
      createdAt: true,
      sender: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      _count: {
        select: {
          receipts: true,
        },
      },
    },
  });

  return NextResponse.json({
    notifications: notifications.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      type: item.type,
      targetScope: item.targetScope,
      targetUserId: item.targetUserId,
      createdAt: item.createdAt,
      sender: item.sender,
      deliveryCount: item._count.receipts,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 403 });
  }

  const body = (await request.json()) as CreateNotificationBody;
  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const target = body.target === "user" ? "user" : "all";
  const type = String(body.type || "INFO").toUpperCase() as NotificationTypeInput;
  const userId = String(body.userId || "").trim();

  if (!title || !message) {
    return NextResponse.json(
      { error: "Baslik ve mesaj zorunlu." },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      { error: "Gecersiz bildirim tipi." },
      { status: 400 }
    );
  }

  if (target === "user" && !userId) {
    return NextResponse.json(
      { error: "Tekil bildirim icin kullanici secimi zorunlu." },
      { status: 400 }
    );
  }

  const notification = await prisma.notification.create({
    data: {
      title,
      message,
      type,
      targetScope: target === "all" ? "ALL_USERS" : "SINGLE_USER",
      targetUserId: target === "user" ? userId : null,
      senderUserId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  let recipients: string[] = [];

  if (target === "all") {
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
      },
    });
    recipients = allUsers.map((item) => item.id);
  } else {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      await prisma.notification.delete({
        where: { id: notification.id },
      });
      return NextResponse.json(
        { error: "Secilen kullanici bulunamadi." },
        { status: 404 }
      );
    }

    recipients = [targetUser.id];
  }

  if (recipients.length > 0) {
    await prisma.userNotification.createMany({
      data: recipients.map((recipientId) => ({
        userId: recipientId,
        notificationId: notification.id,
      })),
    });
  }

  return NextResponse.json({
    success: true,
    notificationId: notification.id,
    recipientCount: recipients.length,
  });
}
