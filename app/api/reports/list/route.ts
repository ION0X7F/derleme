import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logAnalyzeEvent } from "@/lib/analysis-observability";
import { createRequestId } from "@/lib/request-id";
import { loadReportListForUser } from "@/lib/report-list-service";

export async function GET(req: Request) {
  const requestId = createRequestId("rlist");
  try {
    const session = await auth();

    if (!session?.user?.id) {
      logAnalyzeEvent({
        level: "warn",
        stage: "reports_list_unauthorized",
        requestId,
        actor: "unknown",
        message: "Rapor listesi icin oturumsuz erisim denemesi",
      });
      return NextResponse.json({ requestId, error: "Yetkisiz erisim." }, { status: 401 });
    }
    const actor = `user:${session.user.id}`;
    const { detailMode, historyLimit, take, cursor, reports } =
      await loadReportListForUser({
        req,
        userId: session.user.id,
      });

    logAnalyzeEvent({
      stage: "reports_list_success",
      requestId,
      actor,
      message: "Rapor listesi basariyla yuklendi",
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
  } catch (err) {
    logAnalyzeEvent({
      level: "error",
      stage: "reports_list_unhandled_error",
      requestId,
      actor: "unknown",
      message: "Rapor listesi yuklenirken beklenmeyen hata",
      extra: { detail: err instanceof Error ? err.message : String(err) },
    });
    console.error("[reports/list] Error:", err);
    return NextResponse.json(
      { requestId, error: "Raporlar yuklenemedi." },
      { status: 500 }
    );
  }
}
