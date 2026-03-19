import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractFieldsWithFallback } from "@/lib/extractors";
import { fetchPageHtml } from "@/lib/fetch-page-html";
import { fetchTrendyolApi } from "@/lib/fetch-trendyol-api";
import { buildAnalysis } from "@/lib/build-analysis";
import { getOrCreateGuestId } from "@/lib/guest";
import { checkAnalyzeLimit } from "@/lib/check-analyze-limit";
import { incrementAnalyzeUsage } from "@/lib/increment-analyze-usage";
import { isUnlimitedUser } from "@/lib/is-unlimited-user";
import { analyzeWithAi } from "@/lib/ai-analysis";
import {
  getLearningContext,
  recordLearningArtifacts,
} from "@/lib/learning-engine";
import { completeMissingFields, getLearningStatus } from "@/lib/missing-data";
import type {
  AccessPlan,
  AnalysisAccessState,
  AnalysisSectionLock,
  BuildAnalysisResult,
  ExtractedProductFields,
} from "@/types/analysis";

function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
}

function shouldUseAiScore(aiScore: number, fallbackScore: number) {
  if (!Number.isFinite(aiScore)) return false;
  if (aiScore <= 0 && fallbackScore > 0) return false;
  return true;
}

function resolveAccessPlan(params: {
  sessionUserId?: string | null;
  userPlan?: string | null;
  unlimited: boolean;
}): AccessPlan {
  if (!params.sessionUserId) return "guest";
  if (params.unlimited) return "enterprise";
  if (params.userPlan === "PREMIUM") return "pro";
  return "free";
}

function buildAccessState(plan: AccessPlan): AnalysisAccessState {
  const configs: Record<AccessPlan, AnalysisAccessState> = {
    guest: {
      plan: "guest",
      lockedSections: [
        "advancedOfferAnalysis",
        "competitorAnalysis",
        "premiumActionPlan",
        "history",
        "export",
        "reanalysis",
      ],
      teaserSections: [
        "advancedOfferAnalysis",
        "competitorAnalysis",
        "premiumActionPlan",
      ],
      maxFindings: 2,
      maxSuggestions: 1,
      maxPriorityActions: 1,
    },
    free: {
      plan: "free",
      lockedSections: [
        "advancedOfferAnalysis",
        "competitorAnalysis",
        "premiumActionPlan",
        "export",
        "reanalysis",
      ],
      teaserSections: [
        "advancedOfferAnalysis",
        "competitorAnalysis",
        "premiumActionPlan",
      ],
      maxFindings: 6,
      maxSuggestions: 3,
      maxPriorityActions: 3,
    },
    pro: {
      plan: "pro",
      lockedSections: [],
      teaserSections: [],
      maxFindings: 10,
      maxSuggestions: 5,
      maxPriorityActions: 5,
    },
    enterprise: {
      plan: "enterprise",
      lockedSections: [],
      teaserSections: [],
      maxFindings: 10,
      maxSuggestions: 5,
      maxPriorityActions: 5,
    },
  };

  return configs[plan];
}

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
    strengths,
    weaknesses,
    suggestions,
    priorityActions,
    access,
    teaserSections: buildTeasers(access.teaserSections, analysis),
  };
}

function detectCategory(params: {
  url: string;
  title?: string | null;
  h1?: string | null;
  brand?: string | null;
  product_name?: string | null;
}) {
  const text = `${params.url} ${params.title || ""} ${params.h1 || ""} ${
    params.brand || ""
  } ${params.product_name || ""}`.toLowerCase();

  if (
    text.includes("ayakkabi") ||
    text.includes("sneaker") ||
    text.includes("bot") ||
    text.includes("terlik") ||
    text.includes("cizme")
  ) return "Ayakkabi";

  if (
    text.includes("tisort") ||
    text.includes("gomlek") ||
    text.includes("pantolon") ||
    text.includes("ceket") ||
    text.includes("elbise") ||
    text.includes("mont")
  ) return "Giyim";

  if (text.includes("kitap") || text.includes("roman") || text.includes("yazar")) {
    return "Kitap";
  }

  if (
    text.includes("telefon") ||
    text.includes("kulaklik") ||
    text.includes("tablet") ||
    text.includes("laptop") ||
    text.includes("bilgisayar")
  ) return "Elektronik";

  return "General";
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();
    const url = body?.url?.trim();

    if (!url) {
      return NextResponse.json(
        { error: "URL_REQUIRED", message: "URL zorunlu." },
        { status: 400 }
      );
    }

    if (!url.toLowerCase().includes("trendyol.com")) {
      return NextResponse.json(
        {
          error: "PLATFORM_NOT_SUPPORTED",
          message: "Bu surum yalnizca Trendyol urun URL'leri icin aktif.",
        },
        { status: 400 }
      );
    }

    const unlimited = isUnlimitedUser(session?.user?.email);
    const accessPlan = resolveAccessPlan({
      sessionUserId: session?.user?.id,
      userPlan: session?.user && "plan" in session.user ? String(session.user.plan) : null,
      unlimited,
    });
    const access = buildAccessState(accessPlan);

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

    let html = "";

    try {
      html = await fetchPageHtml(url);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "";
      return NextResponse.json(
        {
          error: "FETCH_FAILED",
          message: "Sayfa icerigi alinamadi. URL'yi kontrol edin.",
          detail: message,
        },
        { status: 400 }
      );
    }

    if (!html || html.trim().length === 0) {
      return NextResponse.json(
        { error: "EMPTY_HTML", message: "Sayfa icerigi alinamadi." },
        { status: 400 }
      );
    }

    let trendyolApiData = null;
    if (url.toLowerCase().includes("trendyol.com")) {
      trendyolApiData = await fetchTrendyolApi(url);
    }

    const extraction = extractFieldsWithFallback({ url, html });
    const completion = completeMissingFields({
      platform: extraction.platform,
      extracted: extraction.mergedFields,
      genericFields: extraction.genericFields,
      platformFields: extraction.platformFields,
      trendyolApiData,
    });
    const extracted = completion.extracted;
    const learningStatus = getLearningStatus({
      extracted,
      report: completion.report,
      sourceType: "real",
    });
    const platform = extraction.platform;

    const category =
      extracted.category ||
      detectCategory({
        url,
        title: extracted.title,
        h1: extracted.h1,
        brand: extracted.brand,
        product_name: extracted.product_name,
      }) ||
      "General";

    const analysis = buildAnalysis({
      platform,
      url,
      extracted: { ...extracted, category: extracted.category || category },
      planContext: accessPlan,
    });

    const learningContext = await getLearningContext({
      platform,
      category: extracted.category || category,
      brand: extracted.brand,
      extracted: analysis.extractedData,
    });

    const aiResult = await analyzeWithAi({
      packet: analysis.decisionSupportPacket,
      extracted: analysis.extractedData,
      url,
      learningContext,
      missingDataReport: completion.report,
    });

    if (aiResult) {
      if (hasText(aiResult.summary)) {
        analysis.summary = aiResult.summary;
      }

      if (aiResult.strengths.length > 0) {
        analysis.strengths = aiResult.strengths;
      }

      if (aiResult.weaknesses.length > 0) {
        analysis.weaknesses = aiResult.weaknesses;
      }

      if (aiResult.suggestions.length > 0) {
        analysis.suggestions = aiResult.suggestions;
      }

      if (shouldUseAiScore(aiResult.seo_score, analysis.seoScore)) {
        analysis.seoScore = aiResult.seo_score;
      }

      if (shouldUseAiScore(aiResult.conversion_score, analysis.conversionScore)) {
        analysis.conversionScore = aiResult.conversion_score;
      }

      if (shouldUseAiScore(aiResult.overall_score, analysis.overallScore)) {
        analysis.overallScore = aiResult.overall_score;
      }
    }

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
        },
      });
    }

    try {
      await recordLearningArtifacts({
        reportId: savedReport?.id ?? null,
        platform,
        category: extracted.category || category,
        extracted: analysis.extractedData,
        summary: analysis.summary,
        overallScore: analysis.overallScore,
        sourceType: "real",
        missingDataReport: completion.report,
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

    return NextResponse.json({
      success: true,
      result: {
        ...shapedResult,
        missingDataReport: completion.report,
        learningStatus,
        url,
      },
      report: savedReport,
      usage: updatedUsage,
      autoSaved: usageTarget.type === "user",
    });
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
