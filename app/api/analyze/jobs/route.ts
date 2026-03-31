import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createAnalyzeJob,
} from "@/lib/analyze-jobs";
import { buildAnalyzeLimitReachedResponse, buildAnalyzeThrottledResponse } from "@/lib/analyze-error-response";
import { checkAnalyzeRequestGuard } from "@/lib/analyze-request-guard";
import { resolveGuestAnalyzeUsageContext, resolveUserAnalyzeUsageContext } from "@/lib/analyze-usage-context";
import { resolveUserAnalysisContext } from "@/lib/analysis-user-context";
import { getOrCreateGuestId } from "@/lib/guest";
import { createRequestId } from "@/lib/request-id";
import { validateProductUrl } from "@/lib/url-validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = createRequestId("job");
  let actorType: "guest" | "user" = "guest";

  try {
    const session = await auth();
    actorType = session?.user?.id ? "user" : "guest";
    const guestId = session?.user?.id ? null : await getOrCreateGuestId();
    let body: { url?: unknown; keyword?: unknown };

    try {
      body = (await req.json()) as { url?: unknown; keyword?: unknown };
    } catch {
      return NextResponse.json(
        {
          requestId,
          error: "INVALID_REQUEST_BODY",
          message: "Gecersiz istek govdesi.",
        },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        {
          requestId,
          error: "INVALID_REQUEST_BODY",
          message: "Gecersiz istek govdesi.",
        },
        { status: 400 }
      );
    }

    const rawUrl = typeof body.url === "string" ? body.url : "";
    const keyword =
      typeof body.keyword === "string" ? body.keyword.trim().slice(0, 120) : "";
    const validatedUrl = validateProductUrl(rawUrl, {
      allowedPlatforms: ["trendyol"],
      allowShortTrendyolLinks: false,
    });

    if (!validatedUrl.ok) {
      return NextResponse.json(
        {
          requestId,
          error: validatedUrl.code,
          message: validatedUrl.message,
        },
        { status: 400 }
      );
    }

    const usageContext = session?.user?.id
      ? await (async () => {
          const userAnalysisContext = await resolveUserAnalysisContext({
            userId: session.user.id,
            email: session.user.email,
          });

          return resolveUserAnalyzeUsageContext({
            userId: session.user.id,
            monthlyLimit: userAnalysisContext.monthlyLimit,
            unlimited: userAnalysisContext.unlimited,
          });
        })()
      : await resolveGuestAnalyzeUsageContext(guestId ?? undefined);

    if (!usageContext.usageWindow.allowed) {
      return buildAnalyzeLimitReachedResponse({
        requestId,
        usage: usageContext.usageWindow,
        actorType,
      });
    }

    const guard = checkAnalyzeRequestGuard({
      actor: usageContext.actor,
      url: validatedUrl.normalizedUrl,
    });

    if (!guard.allowed) {
      return buildAnalyzeThrottledResponse({
        requestId,
        reason: guard.reason,
        retryAfterSeconds: guard.retryAfterSeconds,
      });
    }

    const job = await createAnalyzeJob({
      id: createRequestId("anjob"),
      requestId,
      url: validatedUrl.normalizedUrl,
      userId: session?.user?.id ?? null,
      guestId,
    });
    if (!job) {
      throw new Error("ANALYZE_JOB_CREATE_FAILED");
    }

    return NextResponse.json(
      {
        success: true,
        requestId,
        jobId: job.id,
        status: job.status,
        keyword: keyword || null,
        pollUrl: `/api/analyze/jobs/${job.id}`,
      },
      { status: 202 }
    );
  } catch {
    return NextResponse.json(
      {
        requestId,
        error: "INTERNAL_SERVER_ERROR",
        message: "Analiz isi baslatilamadi.",
      },
      { status: 500 }
    );
  }
}
