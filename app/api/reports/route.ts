import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logAnalyzeEvent } from "@/lib/analysis-observability";
import { createRequestId } from "@/lib/request-id";
import { loadReportListForUser } from "@/lib/report-list-service";

export async function GET(req: Request) {
  const requestId = createRequestId("reports");
  try {
    const session = await auth();

    if (!session?.user?.id) {
      logAnalyzeEvent({
        level: "warn",
        stage: "reports_collection_unauthorized",
        requestId,
        actor: "unknown",
        message: "Oturumsuz reports koleksiyonu erisimi",
      });
      return NextResponse.json(
        {
          requestId,
          error: "UNAUTHORIZED",
          message: "Raporlar icin oturum acmaniz gerekiyor.",
        },
        { status: 401 }
      );
    }

    const actor = `user:${session.user.id}`;
    const { detailMode, historyLimit, take, cursor, reports } =
      await loadReportListForUser({
        req,
        userId: session.user.id,
      });

    logAnalyzeEvent({
      stage: "reports_collection_success",
      requestId,
      actor,
      message: "Reports koleksiyonu basariyla yuklendi",
      extra: {
        historyLimit,
        take,
        cursor,
        detailMode,
        returned: reports.length,
      },
    });

    return NextResponse.json({
      success: true,
      requestId,
      historyLimit,
      paging: {
        cursor,
        take,
        nextCursor: reports.length === take ? cursor + take : null,
      },
      reports,
    });
  } catch (error) {
    logAnalyzeEvent({
      level: "error",
      stage: "reports_collection_unhandled_error",
      requestId,
      actor: "unknown",
      message: "Reports koleksiyonu yuklenirken beklenmeyen hata",
      extra: { detail: error instanceof Error ? error.message : String(error) },
    });
    console.error("GET /api/reports error:", error);

    return NextResponse.json(
      {
        requestId,
        error: "INTERNAL_SERVER_ERROR",
        message: "Raporlar alinamadi.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
