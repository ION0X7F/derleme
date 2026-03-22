import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildAnalysisAccessState,
  resolveAccessPlan,
} from "@/lib/analysis-access";
import { sanitizeAnalysisTraceForAccess } from "@/lib/analysis-trace";
import { getOrCreateGuestId } from "@/lib/guest";
import { checkAnalyzeLimit } from "@/lib/check-analyze-limit";
import { incrementAnalyzeUsage } from "@/lib/increment-analyze-usage";
import { isUnlimitedUser } from "@/lib/is-unlimited-user";
import { recordLearningArtifacts } from "@/lib/learning-engine";
import {
  AnalysisPipelineError,
  runAnalysisPipeline,
} from "@/lib/run-analysis";
import { getUserMembershipSnapshot } from "@/lib/user-membership";
import { validateProductUrl } from "@/lib/url-validation";
import type {
  AnalysisAccessState,
  AnalysisSectionLock,
  BuildAnalysisResult,
  ExtractedProductFields,
} from "@/types/analysis";

function trimArray<T>(items: T[], limit: number) {
  return items.slice(0, limit);
}

function buildTeasers(
  lockedSections: AnalysisSectionLock[],
  analysis: BuildAnalysisResult
) {
  const extracted = analysis.extractedData;

  const map: Partial<Record<AnalysisSectionLock, string>> = {
    advancedOfferAnalysis:
      typeof extracted.other_sellers_count === "number" &&
      extracted.other_sellers_count >= 4 &&
      extracted.has_free_shipping !== true &&
      typeof extracted.discount_rate !== "number"
        ? "Yuksek rekabet gorunurken belirgin teklif avantaji zayif; premium raporda fiyat, kargo ve kampanya baskisi daha derin okunur."
        : typeof extracted.discount_rate === "number" ||
            extracted.has_free_shipping ||
            typeof extracted.shipping_days === "number"
          ? "Mevcut teklif sinyalleri premium raporda fiyat, indirim ve teslimat etkisiyle birlikte daha derin yorumlanir."
        : "Fiyat, indirim ve teslimat avantajlari premium raporda daha derin yorumlanir.",
    competitorAnalysis:
      typeof extracted.other_sellers_count === "number" && extracted.other_sellers_count > 0
        ? extracted.other_sellers_count >= 4
          ? `Bu urunde gorunen ${extracted.other_sellers_count} diger satici rekabet baskisini artiriyor; premium raporda ayrisma ve teklif gucu daha derin okunur.`
          : `Bu urunde gorunen ${extracted.other_sellers_count} diger satici icin rekabet ve ayrisma analizi ust paketlerde acilir.`
        : "Rakip ve other sellers analizi daha ust paketlerde acilabilir.",
    premiumActionPlan:
      analysis.suggestions.length > 0
        ? `Bu urun icin tespit edilen ${analysis.suggestions.length} aksiyon sinyali premium raporda oncelik sirasina gore acilir.`
        : "Onceliklendirilmis premium aksiyon plani ust paketlerde tam gorunur.",
    export: "Rapor disa aktarma ozelligi ust paketlerde acilir.",
    history: "Daha genis rapor gecmisi ust paketlerde acilir.",
    reanalysis: "Yeniden analiz ve tekrar calistirma ust paketlerde acilir.",
  };

  return lockedSections.map((key) => ({
    key,
    teaser: map[key] || "Bu bolum ust paketlerde acilir.",
  }));
}

function shapeExtractedDataForAccess(
  extracted: ExtractedProductFields,
  access: AnalysisAccessState,
  category: string
) {
  const base = {
    ...extracted,
    category,
  };

  if (access.plan === "guest") {
    return {
      ...base,
      original_price: null,
      discount_rate: null,
      question_count: null,
      shipping_days: null,
      delivery_type: null,
      official_seller: undefined,
      has_campaign: undefined,
      campaign_label: null,
      seller_badges: null,
      seller_score: null,
      follower_count: null,
      other_sellers_count: null,
      other_seller_offers: null,
      other_sellers_summary: null,
    };
  }

  if (access.plan === "free") {
    return {
      ...base,
      delivery_type: null,
      official_seller: undefined,
      has_campaign: undefined,
      campaign_label: null,
      seller_badges: null,
      seller_score: null,
      follower_count: null,
      other_sellers_count: null,
      other_seller_offers: null,
      other_sellers_summary: null,
    };
  }

  return base;
}

function shapeAnalysisForAccess(
  analysis: BuildAnalysisResult,
  access: AnalysisAccessState,
  category: string
) {
  const strengths = trimArray(analysis.strengths, access.maxFindings);
  const weaknesses = trimArray(analysis.weaknesses, access.maxFindings);
  const suggestions = trimArray(analysis.suggestions, access.maxSuggestions);
  const priorityActions = trimArray(
    analysis.priorityActions,
    access.maxPriorityActions
  );

  return {
    url: undefined,
    platform: analysis.extractedData.platform || "trendyol",
    category,
    seoScore: analysis.seoScore,
    dataCompletenessScore: analysis.dataCompletenessScore,
    conversionScore: analysis.conversionScore,
    overallScore: analysis.overallScore,
    priceCompetitiveness:
      access.plan === "guest" ? null : analysis.priceCompetitiveness,
    summary: analysis.summary,
    dataSource: analysis.dataSource,
    derivedMetrics:
      access.plan === "guest"
        ? null
        : access.plan === "free"
          ? {
              contentQuality: analysis.derivedMetrics.contentQuality,
              trustStrength: analysis.derivedMetrics.trustStrength,
              decisionClarity: analysis.derivedMetrics.decisionClarity,
            }
          : analysis.derivedMetrics,
    coverage:
      access.plan === "guest"
        ? {
            availableFields: [],
            missingFields: [],
            confidence: analysis.decisionSupportPacket.coverage.confidence,
          }
        : access.plan === "free"
          ? {
              availableFields:
                analysis.decisionSupportPacket.coverage.availableFields.slice(0, 8),
              missingFields:
                analysis.decisionSupportPacket.coverage.missingFields.slice(0, 6),
              confidence: analysis.decisionSupportPacket.coverage.confidence,
            }
          : analysis.decisionSupportPacket.coverage,
    extractedData: shapeExtractedDataForAccess(
      analysis.extractedData,
      access,
      category
    ),
    analysisTrace: sanitizeAnalysisTraceForAccess(analysis.analysisTrace, access.plan),
    strengths,
    weaknesses,
    suggestions,
    priorityActions,
    access,
    teaserSections: buildTeasers(access.teaserSections, analysis),
  };
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();
    const rawUrl = typeof body?.url === "string" ? body.url : "";
    const validatedUrl = validateProductUrl(rawUrl, {
      allowedPlatforms: ["trendyol"],
      allowShortTrendyolLinks: false,
    });

    if (!validatedUrl.ok) {
      return NextResponse.json(
        {
          error: validatedUrl.code,
          message: validatedUrl.message,
        },
        { status: 400 }
      );
    }

    const url = validatedUrl.normalizedUrl;
    const unlimited = isUnlimitedUser(session?.user?.email);
    const membership = session?.user?.id
      ? await getUserMembershipSnapshot(session.user.id)
      : null;
    const accessPlan = resolveAccessPlan({
      sessionUserId: session?.user?.id,
      userPlan:
        membership?.planCode ??
        (session?.user && "plan" in session.user ? String(session.user.plan) : null),
      unlimited,
    });
    const access = buildAnalysisAccessState(accessPlan);

    let limitInfo:
      | {
          allowed: boolean;
          used: number;
          limit: number;
          remaining: number;
          periodKey: string;
          periodType: string;
        }
      | Awaited<ReturnType<typeof checkAnalyzeLimit>>;

    let usageTarget:
      | { type: "guest"; guestId: string }
      | { type: "user"; userId: string };

    if (session?.user?.id) {
      usageTarget = { type: "user", userId: session.user.id };

      if (unlimited) {
        limitInfo = {
          allowed: true,
          used: 0,
          limit: 999999,
          remaining: 999999,
          periodKey: "unlimited",
          periodType: "lifetime",
        };
      } else {
        limitInfo = await checkAnalyzeLimit({ type: "user", userId: session.user.id });
      }
    } else {
      const guestId = await getOrCreateGuestId();
      usageTarget = { type: "guest", guestId };
      limitInfo = await checkAnalyzeLimit({ type: "guest", guestId });
    }

    if (!limitInfo.allowed) {
      return NextResponse.json(
        {
          error: "LIMIT_REACHED",
          message:
            usageTarget.type === "guest"
              ? "Guest analiz limitine ulastiniz. Devam etmek icin kayit olun."
              : "Aylik analiz limitine ulastiniz.",
          usage: limitInfo,
        },
        { status: 429 }
      );
    }

    try {
      const pipeline = await runAnalysisPipeline({
        url,
        planContext: accessPlan,
        learningSourceType: "real",
      });

      const { analysis, category, platform, learningStatus, missingDataReport } =
        pipeline;
      const shapedResult = shapeAnalysisForAccess(analysis, access, category);

      let savedReport = null;

      if (usageTarget.type === "user") {
        savedReport = await prisma.report.create({
          data: {
            guestId: null,
            user: {
              connect: {
                id: usageTarget.userId,
              },
            },
            url,
            platform,
            category,
            seoScore: shapedResult.seoScore,
            dataCompletenessScore: shapedResult.dataCompletenessScore,
            conversionScore: shapedResult.conversionScore,
            overallScore: shapedResult.overallScore,
            priceCompetitiveness: shapedResult.priceCompetitiveness,
            summary: shapedResult.summary,
            dataSource: shapedResult.dataSource,
            extractedData: shapedResult.extractedData as Prisma.InputJsonValue,
            derivedMetrics:
              shapedResult.derivedMetrics === null
                ? Prisma.JsonNull
                : (shapedResult.derivedMetrics as Prisma.InputJsonValue),
            coverage:
              shapedResult.coverage === null
                ? Prisma.JsonNull
                : (shapedResult.coverage as Prisma.InputJsonValue),
            accessState: access as Prisma.InputJsonValue,
            suggestions: shapedResult.suggestions as Prisma.InputJsonValue,
            priorityActions: shapedResult.priorityActions as Prisma.InputJsonValue,
            analysisTrace:
              shapedResult.analysisTrace === null
                ? Prisma.JsonNull
                : (shapedResult.analysisTrace as Prisma.InputJsonValue),
          },
        });
      }

      try {
        await recordLearningArtifacts({
          reportId: savedReport?.id ?? null,
          platform,
          category,
          extracted: analysis.extractedData,
          summary: analysis.summary,
          overallScore: analysis.overallScore,
          sourceType: "real",
          missingDataReport,
          learningStatus,
        });
      } catch (learningError) {
        console.error("Learning memory update failed:", learningError);
      }

      if (!unlimited) {
        await incrementAnalyzeUsage(usageTarget);
      }

      const updatedUsage =
        unlimited && usageTarget.type === "user"
          ? {
              allowed: true,
              used: 0,
              limit: 999999,
              remaining: 999999,
              periodKey: "unlimited",
              periodType: "lifetime",
            }
          : await checkAnalyzeLimit(usageTarget);

      return NextResponse.json(
        {
          success: true,
          result: {
            ...shapedResult,
            missingDataReport,
            learningStatus,
            url,
          },
          report: savedReport,
          usage: updatedUsage,
          autoSaved: usageTarget.type === "user",
        }
      );
    } catch (error) {
      if (error instanceof AnalysisPipelineError) {
        return NextResponse.json(
          {
            error: error.code,
            message: error.message,
            detail: error.detail,
          },
          { status: 400 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("Analyze POST error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Analiz sirasinda bir hata olustu.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
