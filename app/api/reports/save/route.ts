import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildAnalysisAccessState,
  resolveAccessPlan,
} from "@/lib/analysis-access";
import { isUnlimitedUser } from "@/lib/is-unlimited-user";
import { sanitizeStoredReportForAccess } from "@/lib/report-access";
import {
  buildStoredDerivedMetrics,
  buildStoredExtractedData,
} from "@/lib/report-storage";
import { createSavedReport } from "@/lib/report-detail-query";
import { createRequestId } from "@/lib/request-id";
import { getUserMembershipSnapshot } from "@/lib/user-membership";
import { validateProductUrl } from "@/lib/url-validation";

type SaveReportBody = {
  url?: string;
  platform?: string | null;
  category?: string | null;
  seoScore?: number | string | null;
  dataCompletenessScore?: number | string | null;
  conversionScore?: number | string | null;
  overallScore?: number | string | null;
  priceCompetitiveness?: string | null;
  summary?: string | null;
  dataSource?: string | null;
  extractedData?: unknown;
  derivedMetrics?: unknown;
  coverage?: unknown;
  accessState?: unknown;
  suggestions?: unknown;
  priorityActions?: unknown;
  analysisTrace?: unknown;
};

function toDbJson<T>(value: T) {
  return value as T & object;
}

type ParsedNullableScore =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

type ParsedNullableText =
  | { ok: true; value: string | null }
  | { ok: false; error: string };
type ParsedStringArray =
  | { ok: true; value: string[] | null }
  | { ok: false; error: string };
type JsonSizeCheck =
  | { ok: true }
  | { ok: false; error: string };

function parseNullableScore(
  rawValue: number | string | null | undefined,
  fieldName: string
): ParsedNullableScore {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return { ok: true, value: null };
  }

  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return { ok: false, error: `Gecersiz alan: ${fieldName}` };
  }

  if (numeric < 0 || numeric > 100) {
    return { ok: false, error: `${fieldName} 0-100 araliginda olmali` };
  }

  return { ok: true, value: numeric };
}

function parseNullableText(
  rawValue: string | null | undefined,
  fieldName: string,
  maxLength: number
): ParsedNullableText {
  if (rawValue === null || rawValue === undefined) {
    return { ok: true, value: null };
  }

  if (typeof rawValue !== "string") {
    return { ok: false, error: `Gecersiz alan: ${fieldName}` };
  }

  const normalized = rawValue.trim();
  if (!normalized) {
    return { ok: true, value: null };
  }

  if (normalized.length > maxLength) {
    return {
      ok: false,
      error: `${fieldName} en fazla ${maxLength} karakter olabilir`,
    };
  }

  return { ok: true, value: normalized };
}

function parseStringArray(
  rawValue: unknown,
  fieldName: string,
  maxItems: number
): ParsedStringArray {
  if (rawValue === null || rawValue === undefined) {
    return { ok: true, value: null };
  }

  if (!Array.isArray(rawValue)) {
    return { ok: false, error: `Gecersiz alan: ${fieldName}` };
  }

  if (rawValue.length > maxItems) {
    return {
      ok: false,
      error: `${fieldName} en fazla ${maxItems} oge icerebilir`,
    };
  }

  const normalized: string[] = [];

  for (const item of rawValue) {
    if (typeof item !== "string") {
      return { ok: false, error: `Gecersiz alan: ${fieldName}` };
    }

    const trimmed = item.trim();
    if (!trimmed) continue;

    if (trimmed.length > 240) {
      return {
        ok: false,
        error: `${fieldName} ogeleri en fazla 240 karakter olabilir`,
      };
    }

    normalized.push(trimmed);
  }

  return { ok: true, value: normalized };
}

function ensureJsonPayloadSize(
  value: unknown,
  fieldName: string,
  maxBytes: number
): JsonSizeCheck {
  if (value === null || value === undefined) {
    return { ok: true };
  }

  try {
    const serialized = JSON.stringify(value);
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes > maxBytes) {
      return {
        ok: false,
        error: `${fieldName} boyutu en fazla ${maxBytes} byte olabilir`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: `Gecersiz alan: ${fieldName}` };
  }
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId("rsave");
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ requestId, error: "Yetkisiz erisim." }, { status: 401 });
    }

    let body: SaveReportBody;
    try {
      body = (await req.json()) as SaveReportBody;
    } catch {
      return NextResponse.json(
        { requestId, error: "Gecersiz istek govdesi." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { requestId, error: "Gecersiz istek govdesi." },
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
        { requestId, error: validatedUrl.message },
        { status: 400 }
      );
    }

    if (typeof body.platform === "string" && body.platform.trim()) {
      const normalizedPlatform = body.platform.trim().toLocaleLowerCase("tr-TR");
      if (normalizedPlatform !== validatedUrl.platform) {
        return NextResponse.json(
          {
            requestId,
            error: "Platform bilgisi URL ile uyusmuyor.",
          },
          { status: 400 }
        );
      }
    }

    const url = validatedUrl.normalizedUrl;

    const parsedSeoScore = parseNullableScore(body.seoScore, "seoScore");
    if (!parsedSeoScore.ok) {
      return NextResponse.json(
        { requestId, error: parsedSeoScore.error },
        { status: 400 }
      );
    }

    const parsedDataCompletenessScore = parseNullableScore(
      body.dataCompletenessScore,
      "dataCompletenessScore"
    );
    if (!parsedDataCompletenessScore.ok) {
      return NextResponse.json(
        { requestId, error: parsedDataCompletenessScore.error },
        { status: 400 }
      );
    }

    const parsedConversionScore = parseNullableScore(
      body.conversionScore,
      "conversionScore"
    );
    if (!parsedConversionScore.ok) {
      return NextResponse.json(
        { requestId, error: parsedConversionScore.error },
        { status: 400 }
      );
    }

    const parsedOverallScore = parseNullableScore(
      body.overallScore,
      "overallScore"
    );
    if (!parsedOverallScore.ok) {
      return NextResponse.json(
        { requestId, error: parsedOverallScore.error },
        { status: 400 }
      );
    }

    const seoScore = parsedSeoScore.value;
    const dataCompletenessScore = parsedDataCompletenessScore.value;
    const conversionScore = parsedConversionScore.value;
    const overallScore = parsedOverallScore.value;
    const parsedCategory = parseNullableText(body.category, "category", 120);
    if (!parsedCategory.ok) {
      return NextResponse.json(
        { requestId, error: parsedCategory.error },
        { status: 400 }
      );
    }

    const parsedSummary = parseNullableText(body.summary, "summary", 2_500);
    if (!parsedSummary.ok) {
      return NextResponse.json(
        { requestId, error: parsedSummary.error },
        { status: 400 }
      );
    }

    const parsedDataSource = parseNullableText(
      body.dataSource,
      "dataSource",
      80
    );
    if (!parsedDataSource.ok) {
      return NextResponse.json(
        { requestId, error: parsedDataSource.error },
        { status: 400 }
      );
    }

    const parsedPriceCompetitiveness = parseNullableText(
      body.priceCompetitiveness,
      "priceCompetitiveness",
      240
    );
    if (!parsedPriceCompetitiveness.ok) {
      return NextResponse.json(
        { requestId, error: parsedPriceCompetitiveness.error },
        { status: 400 }
      );
    }

    const parsedSuggestions = parseStringArray(
      body.suggestions,
      "suggestions",
      20
    );
    if (!parsedSuggestions.ok) {
      return NextResponse.json(
        { requestId, error: parsedSuggestions.error },
        { status: 400 }
      );
    }

    const parsedPriorityActions = parseStringArray(
      body.priorityActions,
      "priorityActions",
      20
    );
    if (!parsedPriorityActions.ok) {
      return NextResponse.json(
        { requestId, error: parsedPriorityActions.error },
        { status: 400 }
      );
    }

    const compactExtractedData = buildStoredExtractedData({
      extractedData: body.extractedData ?? null,
    });
    const compactDerivedMetrics = buildStoredDerivedMetrics({
      derivedMetrics: body.derivedMetrics ?? null,
    });

    const extractedDataSize = ensureJsonPayloadSize(
      compactExtractedData,
      "extractedData",
      150_000
    );
    if (!extractedDataSize.ok) {
      return NextResponse.json(
        { requestId, error: extractedDataSize.error },
        { status: 400 }
      );
    }

    const derivedMetricsSize = ensureJsonPayloadSize(
      compactDerivedMetrics,
      "derivedMetrics",
      50_000
    );
    if (!derivedMetricsSize.ok) {
      return NextResponse.json(
        { requestId, error: derivedMetricsSize.error },
        { status: 400 }
      );
    }

    const coverageSize = ensureJsonPayloadSize(body.coverage, "coverage", 50_000);
    if (!coverageSize.ok) {
      return NextResponse.json(
        { requestId, error: coverageSize.error },
        { status: 400 }
      );
    }

    const analysisTraceSize = ensureJsonPayloadSize(
      body.analysisTrace,
      "analysisTrace",
      200_000
    );
    if (!analysisTraceSize.ok) {
      return NextResponse.json(
        { requestId, error: analysisTraceSize.error },
        { status: 400 }
      );
    }

    const unlimited = isUnlimitedUser(session.user.email);
    const membership = await getUserMembershipSnapshot(session.user.id);
    const accessPlan = resolveAccessPlan({
      sessionUserId: session.user.id,
      userPlan:
        membership?.planCode ??
        ("plan" in session.user ? String(session.user.plan) : null),
      unlimited,
    });
    const accessState = buildAnalysisAccessState(accessPlan);

    const sanitizedReport = sanitizeStoredReportForAccess({
      extractedData: compactExtractedData ?? {},
      derivedMetrics: compactDerivedMetrics,
      coverage: body.coverage ?? null,
      priceCompetitiveness: parsedPriceCompetitiveness.value,
      accessState,
      suggestions: parsedSuggestions.value ?? [],
      priorityActions: parsedPriorityActions.value ?? [],
      analysisTrace: body.analysisTrace ?? null,
    });

    const report = await createSavedReport({
      data: {
        user: {
          connect: {
            id: session.user.id,
          },
        },
        url,
        platform: validatedUrl.platform,
        category: parsedCategory.value,
        seoScore,
        dataCompletenessScore,
        conversionScore,
        overallScore,
        priceCompetitiveness: sanitizedReport.priceCompetitiveness ?? null,
        summary: parsedSummary.value,
        dataSource: parsedDataSource.value,
        extractedData:
          sanitizedReport.extractedData === null
            ? null
            : toDbJson(sanitizedReport.extractedData ?? {}),
        derivedMetrics:
          sanitizedReport.derivedMetrics === null
            ? null
            : sanitizedReport.derivedMetrics === undefined
              ? undefined
              : toDbJson(sanitizedReport.derivedMetrics),
        coverage:
          sanitizedReport.coverage === null
            ? null
            : sanitizedReport.coverage === undefined
              ? undefined
              : toDbJson(sanitizedReport.coverage),
        accessState: toDbJson(accessState),
        suggestions:
          parsedSuggestions.value === null
            ? null
            : toDbJson(sanitizedReport.suggestions ?? []),
        priorityActions:
          parsedPriorityActions.value === null
            ? null
            : toDbJson(sanitizedReport.priorityActions ?? []),
        analysisTrace:
          sanitizedReport.analysisTrace === null
            ? null
            : sanitizedReport.analysisTrace === undefined
              ? undefined
              : toDbJson(sanitizedReport.analysisTrace),
      } as any,
    });

    return NextResponse.json(
      {
        success: true,
        requestId,
        id: report.id,
        createdAt: report.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[reports/save] Error:", err);
    return NextResponse.json(
      { requestId, error: "Rapor kaydedilemedi. Lutfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
