import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sanitizeStoredReportForAccess } from "@/lib/report-access";
import { readReportVersionMeta } from "@/lib/report-versioning";
import { logAnalyzeEvent } from "@/lib/analysis-observability";
import { createRequestId } from "@/lib/request-id";
import {
  fetchReportDetailForUser,
  fetchReportTimelineForUser,
} from "@/lib/report-detail-query";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = createRequestId("rep");
  const includeTimeline = new URL(req.url).searchParams.get("timeline") !== "0";
  const session = await auth();

  if (!session?.user?.id) {
    logAnalyzeEvent({
      level: "warn",
      stage: "report_detail_unauthorized",
      requestId,
      actor: "unknown",
      message: "Rapor detayi icin oturumsuz erisim denemesi",
    });
    return NextResponse.json({ requestId, error: "Yetkisiz erisim." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const report = await fetchReportDetailForUser({
      id,
      userId: session.user.id,
    });

    if (!report) {
      logAnalyzeEvent({
        level: "warn",
        stage: "report_detail_not_found",
        requestId,
        actor: `user:${session.user.id}`,
        message: "Kullaniciya ait olmayan rapor detayi denemesi",
        extra: { reportId: id },
      });
      return NextResponse.json({ requestId, error: "Rapor bulunamadi." }, { status: 404 });
    }
    const relatedReports = includeTimeline
      ? await fetchReportTimelineForUser({
          userId: session.user.id,
          url: report.url,
          take: 8,
        })
      : [];

    logAnalyzeEvent({
      stage: "report_detail_success",
      requestId,
      actor: `user:${session.user.id}`,
      url: report.url,
      message: "Rapor detayi basariyla yuklendi",
      extra: {
        reportId: report.id,
        includeTimeline,
        timelineCount: relatedReports.length,
      },
    });

    const responsePayload: Record<string, unknown> = {
      success: true,
      requestId,
      report: sanitizeStoredReportForAccess(report),
    };

    if (includeTimeline) {
      responsePayload.timeline = relatedReports.map((item) => {
        const version = readReportVersionMeta(item.accessState);
        return {
          id: item.id,
          createdAt: item.createdAt,
          overallScore: item.overallScore,
          dataSource: item.dataSource,
          generation: version.generation,
          trigger: version.trigger,
          previousReportId: version.previousReportId,
          rootReportId: version.rootReportId,
          isCurrent: item.id === report.id,
        };
      });
    }

    return NextResponse.json(responsePayload);
  } catch (err) {
    logAnalyzeEvent({
      level: "error",
      stage: "report_detail_unhandled_error",
      requestId,
      actor: `user:${session.user.id}`,
      message: "Rapor detayinda beklenmeyen hata",
      extra: { detail: err instanceof Error ? err.message : String(err) },
    });
    console.error("[reports/id] GET error:", err);
    return NextResponse.json(
      { requestId, error: "Rapor yuklenemedi." },
      { status: 500 }
    );
  }
}
