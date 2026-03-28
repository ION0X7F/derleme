import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createAnalyzeJob,
} from "@/lib/analyze-jobs";
import { getOrCreateGuestId } from "@/lib/guest";
import { createRequestId } from "@/lib/request-id";
import { validateProductUrl } from "@/lib/url-validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = createRequestId("job");

  try {
    const session = await auth();
    const guestId = session?.user?.id ? null : await getOrCreateGuestId();
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
        pollUrl: `/api/analyze/jobs/${job.id}`,
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        requestId,
        error: "INTERNAL_SERVER_ERROR",
        message: "Analiz isi baslatilamadi.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
