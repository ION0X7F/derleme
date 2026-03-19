import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeStoredReportForAccess } from "@/lib/report-access";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json([]);
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    const historyLimit = user?.subscription?.plan?.reportsHistoryLimit ?? 5;

    const reports = await prisma.report.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: historyLimit > 0 ? historyLimit : 100,
      select: {
        id: true,
        url: true,
        platform: true,
        category: true,
        seoScore: true,
        dataCompletenessScore: true,
        conversionScore: true,
        overallScore: true,
        priceCompetitiveness: true,
        summary: true,
        dataSource: true,
        createdAt: true,
        extractedData: true,
        derivedMetrics: true,
        coverage: true,
        accessState: true,
        suggestions: true,
        priorityActions: true,
      },
    });

    return NextResponse.json({
      success: true,
      historyLimit,
      reports: reports.map((report) => sanitizeStoredReportForAccess(report)),
    });
  } catch (error) {
    console.error("GET /api/reports error:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Raporlar alinamadi.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
