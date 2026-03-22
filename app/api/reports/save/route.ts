import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import {
  buildAnalysisAccessState,
  resolveAccessPlan,
} from "@/lib/analysis-access";
import { isUnlimitedUser } from "@/lib/is-unlimited-user";
import { prisma } from "@/lib/prisma";
import { sanitizeStoredReportForAccess } from "@/lib/report-access";
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

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 401 });
    }

    const body = (await req.json()) as SaveReportBody;
    const rawUrl = typeof body.url === "string" ? body.url : "";
    const validatedUrl = validateProductUrl(rawUrl);

    if (!validatedUrl.ok) {
      return NextResponse.json(
        { error: validatedUrl.message },
        { status: 400 }
      );
    }

    const url = validatedUrl.normalizedUrl;

    const seoScore =
      body.seoScore === null ||
      body.seoScore === undefined ||
      body.seoScore === ""
        ? null
        : Number(body.seoScore);

    if (seoScore !== null && Number.isNaN(seoScore)) {
      return NextResponse.json({ error: "Gecersiz alan: seoScore" }, { status: 400 });
    }

    const dataCompletenessScore =
      body.dataCompletenessScore === null ||
      body.dataCompletenessScore === undefined ||
      body.dataCompletenessScore === ""
        ? null
        : Number(body.dataCompletenessScore);

    const conversionScore =
      body.conversionScore === null ||
      body.conversionScore === undefined ||
      body.conversionScore === ""
        ? null
        : Number(body.conversionScore);

    const overallScore =
      body.overallScore === null ||
      body.overallScore === undefined ||
      body.overallScore === ""
        ? null
        : Number(body.overallScore);

    if (
      (dataCompletenessScore !== null && Number.isNaN(dataCompletenessScore)) ||
      (conversionScore !== null && Number.isNaN(conversionScore)) ||
      (overallScore !== null && Number.isNaN(overallScore))
    ) {
      return NextResponse.json({ error: "Gecersiz skor alanlari" }, { status: 400 });
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
      extractedData: body.extractedData ?? {},
      derivedMetrics: body.derivedMetrics ?? null,
      coverage: body.coverage ?? null,
      priceCompetitiveness: body.priceCompetitiveness ?? null,
      accessState,
      suggestions: body.suggestions ?? [],
      priorityActions: body.priorityActions ?? [],
      analysisTrace: body.analysisTrace ?? null,
    });

    const report = await prisma.report.create({
      data: {
        user: {
          connect: {
            id: session.user.id,
          },
        },
        url,
        platform: validatedUrl.platform,
        category: body.category ?? null,
        seoScore,
        dataCompletenessScore,
        conversionScore,
        overallScore,
        priceCompetitiveness: sanitizedReport.priceCompetitiveness ?? null,
        summary: body.summary ?? null,
        dataSource: body.dataSource ?? null,
        extractedData:
          sanitizedReport.extractedData === null
            ? Prisma.JsonNull
            : ((sanitizedReport.extractedData ?? {}) as Prisma.InputJsonValue),
        derivedMetrics:
          sanitizedReport.derivedMetrics === null
            ? Prisma.JsonNull
            : sanitizedReport.derivedMetrics === undefined
              ? undefined
              : (sanitizedReport.derivedMetrics as Prisma.InputJsonValue),
        coverage:
          sanitizedReport.coverage === null
            ? Prisma.JsonNull
            : sanitizedReport.coverage === undefined
              ? undefined
              : (sanitizedReport.coverage as Prisma.InputJsonValue),
        accessState: accessState as Prisma.InputJsonValue,
        suggestions:
          body.suggestions === null
            ? Prisma.JsonNull
            : ((sanitizedReport.suggestions ?? []) as Prisma.InputJsonValue),
        priorityActions:
          body.priorityActions === null
            ? Prisma.JsonNull
            : ((sanitizedReport.priorityActions ?? []) as Prisma.InputJsonValue),
        analysisTrace:
          sanitizedReport.analysisTrace === null
            ? Prisma.JsonNull
            : sanitizedReport.analysisTrace === undefined
              ? undefined
              : (sanitizedReport.analysisTrace as Prisma.InputJsonValue),
      },
    });

    return NextResponse.json(
      {
        success: true,
        id: report.id,
        createdAt: report.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[reports/save] Error:", err);
    return NextResponse.json(
      { error: "Rapor kaydedilemedi. Lutfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
