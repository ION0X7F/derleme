import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAnalyzeEvent } from "@/lib/analysis-observability";
import { createRequestId } from "@/lib/request-id";

async function resolveAuthorizedUser() {
  const session = await auth();
  return session?.user?.id ? session.user.id : null;
}

export async function GET() {
  const requestId = createRequestId("rfav");
  const userId = await resolveAuthorizedUser();

  if (!userId) {
    return NextResponse.json({ requestId, error: "Yetkisiz erisim." }, { status: 401 });
  }

  const favorites = await prisma.reportFavorite.findMany({
    where: { userId },
    select: { reportId: true },
  });

  return NextResponse.json({
    success: true,
    requestId,
    reportIds: favorites.map((item) => item.reportId),
  });
}

export async function POST(req: Request) {
  const requestId = createRequestId("rfav");
  const userId = await resolveAuthorizedUser();

  if (!userId) {
    return NextResponse.json({ requestId, error: "Yetkisiz erisim." }, { status: 401 });
  }

  try {
    const payload = (await req.json().catch(() => null)) as
      | { reportId?: unknown; active?: unknown }
      | null;
    const reportId = String(payload?.reportId ?? "").trim();
    const active = Boolean(payload?.active);

    if (!reportId) {
      return NextResponse.json(
        { requestId, error: "Gecersiz rapor kimligi." },
        { status: 400 }
      );
    }

    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        userId,
      },
      select: { id: true },
    });

    if (!report) {
      logAnalyzeEvent({
        level: "warn",
        stage: "report_favorite_forbidden",
        requestId,
        actor: `user:${userId}`,
        message: "Kullaniciya ait olmayan rapor favorilenmek istendi",
        extra: { reportId },
      });
      return NextResponse.json({ requestId, error: "Rapor bulunamadi." }, { status: 404 });
    }

    if (active) {
      await prisma.reportFavorite.upsert({
        where: {
          userId_reportId: {
            userId,
            reportId,
          },
        },
        update: {},
        create: {
          userId,
          reportId,
        },
      });
    } else {
      await prisma.reportFavorite.deleteMany({
        where: {
          userId,
          reportId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      requestId,
      reportId,
      active,
    });
  } catch (error) {
    logAnalyzeEvent({
      level: "error",
      stage: "report_favorite_unhandled_error",
      requestId,
      actor: `user:${userId}`,
      message: "Favori guncellenirken beklenmeyen hata",
      extra: { detail: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { requestId, error: "Favori durumu guncellenemedi." },
      { status: 500 }
    );
  }
}
