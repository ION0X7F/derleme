import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeStoredReportForAccess } from "@/lib/report-access";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 401 });
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
      orderBy: { createdAt: "desc" },
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
        derivedMetrics: true,
        coverage: true,
        accessState: true,
        priorityActions: true,
        suggestions: true,
        extractedData: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      historyLimit,
      reports: reports.map((report) => sanitizeStoredReportForAccess(report)),
    });
  } catch (err) {
    console.error("[reports/list] Error:", err);
    return NextResponse.json({ error: "Raporlar yuklenemedi." }, { status: 500 });
  }
}
