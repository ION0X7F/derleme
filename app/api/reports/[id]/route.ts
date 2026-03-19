import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeStoredReportForAccess } from "@/lib/report-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const report = await prisma.report.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Rapor bulunamadi." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      report: sanitizeStoredReportForAccess(report),
    });
  } catch (err) {
    console.error("[reports/id] GET error:", err);
    return NextResponse.json({ error: "Rapor yuklenemedi." }, { status: 500 });
  }
}
