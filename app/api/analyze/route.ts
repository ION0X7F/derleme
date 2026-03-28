import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  executeAnalyzeUrl,
} from "@/lib/analyze-execution";
import { buildAnalyzeLimitReachedResponse, buildAnalyzeThrottledResponse } from "@/lib/analyze-error-response";
import { createRequestId } from "@/lib/request-id";
import { validateProductUrl } from "@/lib/url-validation";
import { AnalysisPipelineError } from "@/lib/run-analysis";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = createRequestId("req");
  let actorType: "guest" | "user" = "guest";

  try {
    const session = await auth();
    actorType = session?.user?.id ? "user" : "guest";
    let body: { url?: unknown };

    try {
      body = (await req.json()) as { url?: unknown };
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

    const payload = await executeAnalyzeUrl({
      requestId,
      url: validatedUrl.normalizedUrl,
      sessionUserId: session?.user?.id ?? null,
      sessionUserEmail: session?.user?.email ?? null,
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AnalysisPipelineError) {
      return NextResponse.json(
        {
          requestId,
          error: error.code,
          message: error.message,
          detail: error.detail,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.name === "AnalyzeLimitReachedError") {
      return buildAnalyzeLimitReachedResponse({
        requestId,
        usage: (error as Error & { payload?: unknown }).payload as never,
        actorType,
      });
    }

    if (error instanceof Error && error.name === "AnalyzeThrottledError") {
      const throttled = error as Error & {
        retryAfterSeconds?: number;
        reason?: string;
      };
      return buildAnalyzeThrottledResponse({
        requestId,
        reason: throttled.reason || "Ayni URL icin tekrar deneme siniri asildi.",
        retryAfterSeconds: throttled.retryAfterSeconds ?? 15,
      });
    }

    console.error("Analyze POST error:", error);
    return NextResponse.json(
      {
        requestId,
        error: "INTERNAL_SERVER_ERROR",
        message: "Analiz sirasinda bir hata olustu.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
