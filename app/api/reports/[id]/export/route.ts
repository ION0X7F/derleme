import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseAnalysisSummary } from "@/lib/analysis-summary";
import { sanitizeStoredReportForAccess } from "@/lib/report-access";
import { getReadableReportTitle } from "@/lib/report-title";
import { logAnalyzeEvent } from "@/lib/analysis-observability";
import { createRequestId } from "@/lib/request-id";
import { fetchReportExportForUser } from "@/lib/report-detail-query";

type ExportMode = "full" | "compact";

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveExportMode(req: Request): ExportMode {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");
    if (mode === "compact") return "compact";
  } catch {
    // noop
  }
  return "full";
}

function buildExportPayload(params: {
  mode: ExportMode;
  sanitized: ReturnType<typeof sanitizeStoredReportForAccess>;
  extracted: Record<string, unknown>;
  summary: ReturnType<typeof parseAnalysisSummary>;
}) {
  const reportUrl = asString(params.sanitized.url) ?? "";
  const basePayload = {
    version: 1,
    reportId: asString(params.sanitized.id),
    generatedAt: new Date().toISOString(),
    title: getReadableReportTitle({
      url: reportUrl,
      extractedData: params.extracted,
      fallback: "SellBoost AI raporu",
    }),
    meta: {
      url: reportUrl,
      platform: asString(params.sanitized.platform),
      category: asString(params.sanitized.category),
      createdAt: asString(params.sanitized.createdAt),
      dataSource: asString(params.sanitized.dataSource),
    },
    scores: {
      seo: asNumber(params.sanitized.seoScore),
      completeness: asNumber(params.sanitized.dataCompletenessScore),
      conversion: asNumber(params.sanitized.conversionScore),
      overall: asNumber(params.sanitized.overallScore),
    },
    summary: {
      raw: asString(params.sanitized.summary),
      structured: params.summary,
    },
    extracted: params.extracted,
    derivedMetrics: params.sanitized.derivedMetrics ?? null,
    coverage: params.sanitized.coverage ?? null,
    analysisTrace: params.sanitized.analysisTrace ?? null,
    suggestions: asArray(params.sanitized.suggestions),
    priorityActions: asArray(params.sanitized.priorityActions),
  };

  if (params.mode === "full") {
    return basePayload;
  }

  const compactExtracted = {
    title: typeof params.extracted.title === "string" ? params.extracted.title : null,
    brand: typeof params.extracted.brand === "string" ? params.extracted.brand : null,
    product_name:
      typeof params.extracted.product_name === "string"
        ? params.extracted.product_name
        : null,
    normalized_price:
      typeof params.extracted.normalized_price === "number"
        ? params.extracted.normalized_price
        : null,
    image_count:
      typeof params.extracted.image_count === "number"
        ? params.extracted.image_count
        : null,
    review_count:
      typeof params.extracted.review_count === "number"
        ? params.extracted.review_count
        : null,
    rating_value:
      typeof params.extracted.rating_value === "number"
        ? params.extracted.rating_value
        : null,
    seller_name:
      typeof params.extracted.seller_name === "string"
        ? params.extracted.seller_name
        : null,
    seller_score:
      typeof params.extracted.seller_score === "number"
        ? params.extracted.seller_score
        : null,
    other_sellers_count:
      typeof params.extracted.other_sellers_count === "number"
        ? params.extracted.other_sellers_count
        : null,
    shipping_days:
      typeof params.extracted.shipping_days === "number"
        ? params.extracted.shipping_days
        : null,
    dataFlags: {
      has_free_shipping: params.extracted.has_free_shipping === true,
      has_video: params.extracted.has_video === true,
      has_campaign: params.extracted.has_campaign === true,
      official_seller: params.extracted.official_seller === true,
    },
  };

  const trace = asObject(basePayload.analysisTrace);
  const compactTrace = trace
    ? {
        mode: trace.mode ?? null,
        confidence: trace.confidence ?? null,
        primaryDiagnosis: trace.primaryDiagnosis ?? null,
        primaryTheme: trace.primaryTheme ?? null,
        aiDecision: asObject(trace.aiDecision),
        topSignals: asArray(trace.topSignals).slice(0, 4),
        recommendedFocus: asArray(trace.recommendedFocus).slice(0, 3),
        blockedByData: asArray(trace.blockedByData).slice(0, 6),
      }
    : null;

  return {
    ...basePayload,
    extracted: compactExtracted,
    analysisTrace: compactTrace,
    suggestions: basePayload.suggestions.slice(0, 5),
    priorityActions: basePayload.priorityActions.slice(0, 5),
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = createRequestId("exp");
  const mode = resolveExportMode(req);
  const session = await auth();
  if (!session?.user?.id) {
    logAnalyzeEvent({
      level: "warn",
      stage: "report_export_unauthorized",
      requestId,
      actor: "unknown",
      message: "Rapor export icin oturumsuz erisim denemesi",
    });
    return NextResponse.json({ requestId, error: "Yetkisiz erisim." }, { status: 401 });
  }

  const { id } = await params;
  const report = await fetchReportExportForUser({
    id,
    userId: session.user.id,
  });

  if (!report) {
    logAnalyzeEvent({
      level: "warn",
      stage: "report_export_not_found",
      requestId,
      actor: `user:${session.user.id}`,
      message: "Kullaniciya ait olmayan rapor export denemesi",
      extra: { reportId: id },
    });
    return NextResponse.json({ requestId, error: "Rapor bulunamadi." }, { status: 404 });
  }

  const sanitized = sanitizeStoredReportForAccess(report);
  const accessState = asObject(sanitized.accessState);
  const lockedSections = Array.isArray(accessState?.lockedSections)
    ? accessState?.lockedSections
    : [];

  if (lockedSections.includes("export")) {
    logAnalyzeEvent({
      level: "warn",
      stage: "report_export_locked",
      requestId,
      actor: `user:${session.user.id}`,
      url: report.url,
      message: "Plan seviyesinde export kilitli",
      extra: { reportId: report.id },
    });
    return NextResponse.json(
      {
        requestId,
        error: "EXPORT_LOCKED",
        message: "Bu rapor mevcut plan seviyesinde export icin kilitli.",
      },
      { status: 403 }
    );
  }

  const extracted = asObject(sanitized.extractedData) ?? {};
  const summary = parseAnalysisSummary(
    typeof sanitized.summary === "string" ? sanitized.summary : null
  );

  logAnalyzeEvent({
    stage: "report_export_success",
    requestId,
    actor: `user:${session.user.id}`,
    url: report.url,
    message: "Rapor export payload olusturuldu",
    extra: { reportId: report.id, mode },
  });

  const exportPayload = buildExportPayload({
    mode,
    sanitized,
    extracted,
    summary,
  });

  return NextResponse.json({
    success: true,
    requestId,
    mode,
    exportPayload,
  });
}
