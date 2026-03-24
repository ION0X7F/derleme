import { NextResponse } from "next/server";

type LimitUsagePayload = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  periodKey: string;
  periodType: string;
};

export function buildAnalyzeLimitReachedResponse(params: {
  requestId: string;
  usage: LimitUsagePayload;
  actorType: "guest" | "user";
}) {
  return NextResponse.json(
    {
      requestId: params.requestId,
      error: "LIMIT_REACHED",
      message:
        params.actorType === "guest"
          ? "Guest analiz limitine ulastiniz. Devam etmek icin kayit olun."
          : "Aylik analiz limitine ulastiniz.",
      usage: params.usage,
    },
    { status: 429 }
  );
}

export function buildAnalyzeThrottledResponse(params: {
  requestId: string;
  reason: string;
  retryAfterSeconds: number;
}) {
  return NextResponse.json(
    {
      requestId: params.requestId,
      error: "ANALYZE_THROTTLED",
      message: params.reason,
      retryAfterSeconds: params.retryAfterSeconds,
    },
    { status: 429 }
  );
}
