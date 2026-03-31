import { traceEvent, type DebugTraceHandle } from "@/lib/debug-observability";
import { extractFieldsWithFallback } from "@/lib/extractors";
import { mergeExtractedFieldsWithMetadata } from "@/lib/extractors/merge-extracted-fields";
import type {
  ExtractedFieldMetadata,
  ExtractedProductFields,
  MissingDataReport,
} from "@/types/analysis";
import type { TrendyolApiResult } from "@/lib/fetch-trendyol-api";
import { completeMissingFieldsWithMetadata } from "@/lib/missing-data";
import {
  fetchPythonBackfill,
  shouldRunPythonBackfill,
  applyPythonBackfill,
} from "@/lib/run-analysis-helpers";
import trendyolRenderedProductContent from "@/lib/trendyol-rendered-product-content";
import trendyolRenderedOtherMerchants from "@/lib/trendyol-rendered-other-merchants";
import { isTrendyolFreeShippingEligible } from "@/lib/trendyol-shipping";
import {
  fetchTrendyolFollowerCountByMerchantId,
} from "@/lib/fetch-trendyol-api";
import { fetchTrendyolReviewAnalysis } from "@/lib/trendyol-review-analysis";

type ExecuteExtractionPhaseParams = {
  url: string;
  html: string;
  isTrendyol: boolean;
  trendyolApiData: TrendyolApiResult | null;
  debugTrace: DebugTraceHandle;
};

type ExtractionPhaseResult = {
  extracted: ExtractedProductFields;
  fieldMetadata: Record<string, ExtractedFieldMetadata>;
  report: MissingDataReport;
};

function applyApiSellerOverrides(params: {
  mergedWithHtml: ExtractedProductFields;
  initialMetadata: Record<string, ExtractedFieldMetadata>;
  trendyolApiData: TrendyolApiResult | null;
}) {
  const { mergedWithHtml, initialMetadata, trendyolApiData } = params;
  const apiSeller = trendyolApiData?.seller;

  if (!apiSeller) return;

  const applyApiField = <K extends keyof ExtractedProductFields>(
    key: K,
    apiValue: ExtractedProductFields[K]
  ) => {
    if (apiValue == null) return;
    mergedWithHtml[key] = apiValue;
    initialMetadata[String(key)] = {
      source: "api",
      confidence: "high",
      timestamp: Date.now(),
      reason: "trendyol api seller payload",
    };
  };

  applyApiField("seller_score", apiSeller.seller_score);
  applyApiField("seller_name", apiSeller.seller_name);
  applyApiField("official_seller", apiSeller.is_official);
  applyApiField("has_free_shipping", apiSeller.has_free_shipping);
  applyApiField("listing_id", apiSeller.listing_id);
  applyApiField("merchant_id", apiSeller.merchant_id);
}

function addDerivedFreeShipping(params: {
  isTrendyol: boolean;
  mergedWithHtml: ExtractedProductFields;
  initialMetadata: Record<string, ExtractedFieldMetadata>;
}) {
  const { isTrendyol, mergedWithHtml, initialMetadata } = params;

  if (
    !isTrendyol ||
    mergedWithHtml.has_free_shipping != null ||
    !isTrendyolFreeShippingEligible(mergedWithHtml.normalized_price)
  ) {
    return;
  }

  mergedWithHtml.has_free_shipping = true;
  initialMetadata.has_free_shipping = {
    source: "derived",
    confidence: "high",
    timestamp: Date.now(),
    reason: "trendyol free shipping threshold",
  };
}

async function enrichRenderedProductContent(params: {
  url: string;
  result: ExtractionPhaseResult;
  debugTrace: DebugTraceHandle;
}) {
  const { url, result, debugTrace } = params;

  if (
    !trendyolRenderedProductContent.shouldFetchRenderedProductContent({
      platform: result.extracted.platform,
      description_text: result.extracted.description_text ?? null,
      description_length: result.extracted.description_length,
      view_count_24h: result.extracted.view_count_24h ?? null,
    })
  ) {
    return;
  }

  const renderedProductContent =
    await trendyolRenderedProductContent.fetchRenderedProductContent(url);

  if (!renderedProductContent) return;

  if (renderedProductContent.description_text) {
    result.extracted.description_text = renderedProductContent.description_text;
    result.extracted.description_length =
      renderedProductContent.description_length;
    result.fieldMetadata.description_text = {
      source: "html",
      confidence: "high",
      timestamp: Date.now(),
      reason: "trendyol rendered urun aciklamasi block",
    };
    result.fieldMetadata.description_length = {
      source: "html",
      confidence: "high",
      timestamp: Date.now(),
      reason: "trendyol rendered urun aciklamasi block",
    };
  }

  if (typeof renderedProductContent.view_count_24h === "number") {
    result.extracted.view_count_24h = renderedProductContent.view_count_24h;
    result.fieldMetadata.view_count_24h = {
      source: "html",
      confidence: "high",
      timestamp: Date.now(),
      reason: "trendyol rendered son 24 saatte goruntulenme block",
    };
  }

  traceEvent(debugTrace, {
    stage: "merge",
    code: "rendered_product_description_enriched",
    message:
      "Render edilmis Trendyol urun bloklari ile aciklama ve goruntulenme sinyali zenginlestirildi.",
    meta: {
      descriptionLength: renderedProductContent.description_length,
      viewCount24h: renderedProductContent.view_count_24h,
    },
  });
}

async function enrichRenderedOtherMerchants(params: {
  url: string;
  isTrendyol: boolean;
  result: ExtractionPhaseResult;
  debugTrace: DebugTraceHandle;
}) {
  const { url, isTrendyol, result, debugTrace } = params;

  if (
    !isTrendyol ||
    !trendyolRenderedOtherMerchants.shouldFetchRenderedOtherMerchantData(
      result.extracted.other_seller_offers
    )
  ) {
    return;
  }

  const renderedOffers =
    await trendyolRenderedOtherMerchants.fetchRenderedOtherMerchantData(url);

  if (renderedOffers && renderedOffers.length > 0) {
    result.extracted.other_seller_offers =
      trendyolRenderedOtherMerchants.mergeRenderedOtherMerchantData(
        result.extracted.other_seller_offers,
        renderedOffers
      );

    traceEvent(debugTrace, {
      stage: "merge",
      code: "rendered_other_merchants_enriched",
      message:
        "Render edilmis rakip kart verileri ile teslimat/promo alanlari zenginlestirildi.",
      meta: {
        renderedOfferCount: renderedOffers.length,
        extractedOfferCount: result.extracted.other_seller_offers?.length ?? 0,
      },
    });
    return;
  }

  traceEvent(debugTrace, {
    stage: "merge",
    level: "warn",
    code: "rendered_other_merchants_unavailable",
    message: "Render edilmis rakip kart verisi alinamadi.",
  });
}

export async function executeExtractionPhase(
  params: ExecuteExtractionPhaseParams
): Promise<ExtractionPhaseResult> {
  const { url, html, isTrendyol, trendyolApiData, debugTrace } = params;
  const htmlExtraction = extractFieldsWithFallback({
    url,
    html,
  });

  const {
    merged: mergedWithHtml,
    fieldMetadata: initialMetadata,
  } = mergeExtractedFieldsWithMetadata({
    genericFields: htmlExtraction.genericFields,
    platformFields: htmlExtraction.platformFields,
    platform: htmlExtraction.platform,
    trace: debugTrace,
  });

  applyApiSellerOverrides({
    mergedWithHtml,
    initialMetadata,
    trendyolApiData,
  });
  addDerivedFreeShipping({
    isTrendyol,
    mergedWithHtml,
    initialMetadata,
  });

  const result = completeMissingFieldsWithMetadata(
    {
      platform: htmlExtraction.platform,
      extracted: mergedWithHtml,
      genericFields: htmlExtraction.genericFields,
      platformFields: htmlExtraction.platformFields,
      trendyolApiData,
    },
    initialMetadata,
    debugTrace
  );

  if (isTrendyol && shouldRunPythonBackfill(result.extracted)) {
    const pythonData = await fetchPythonBackfill(url);
    if (pythonData) {
      applyPythonBackfill({
        extracted: result.extracted,
        pythonData,
        fieldMetadata: result.fieldMetadata,
        trace: debugTrace,
      });
    } else {
      traceEvent(debugTrace, {
        stage: "merge",
        level: "warn",
        code: "python_backfill_unavailable",
        message: "Python fallback denendi fakat veri alinamadi.",
      });
    }
  }

  await enrichRenderedProductContent({
    url,
    result,
    debugTrace,
  });
  await enrichRenderedOtherMerchants({
    url,
    isTrendyol,
    result,
    debugTrace,
  });

  return result;
}

type EnrichTrendyolReviewSignalsParams = {
  url: string;
  extracted: ExtractedProductFields;
  fieldMetadata: Record<string, ExtractedFieldMetadata>;
  debugTrace: DebugTraceHandle;
};

export async function enrichTrendyolReviewSignals(
  params: EnrichTrendyolReviewSignalsParams
) {
  const { url, extracted, fieldMetadata, debugTrace } = params;
  const shouldFetchFollowerCount =
    extracted.follower_count == null &&
    typeof extracted.merchant_id === "number";

  const [reviewAnalysis, followerCount] = await Promise.all([
    fetchTrendyolReviewAnalysis({
      url,
      merchantId: extracted.merchant_id ?? null,
      sellerName: extracted.seller_name ?? null,
      otherSellersCount: extracted.other_sellers_count ?? null,
    }),
    shouldFetchFollowerCount
      ? fetchTrendyolFollowerCountByMerchantId(extracted.merchant_id!)
      : Promise.resolve(null),
  ]);

  if (typeof followerCount === "number") {
    extracted.follower_count = followerCount;
    fieldMetadata.follower_count = {
      source: "api",
      confidence: "high",
      timestamp: Date.now(),
      reason: "trendyol sellerstore-follow api",
    };
    traceEvent(debugTrace, {
      stage: "merge",
      code: "follower_count_runtime_fallback_success",
      message: "follower_count runtime fallback ile dolduruldu.",
      field: "follower_count",
      meta: {
        merchantId: extracted.merchant_id,
        followerCount,
      },
    });
  } else if (shouldFetchFollowerCount) {
    traceEvent(debugTrace, {
      stage: "merge",
      level: "warn",
      code: "follower_count_runtime_fallback_missed",
      message: "follower_count runtime fallback denendi ama sonuc alinmadi.",
      field: "follower_count",
      meta: {
        merchantId: extracted.merchant_id,
      },
    });
  }

  if (!reviewAnalysis) return;

  extracted.review_analysis = reviewAnalysis;
  extracted.review_records = reviewAnalysis.general?.recent_reviews ?? null;
  extracted.rating_value =
    extracted.rating_value ?? reviewAnalysis.general?.average_rating ?? null;
  extracted.review_count =
    extracted.review_count ?? reviewAnalysis.general?.total_comment_count ?? null;
  extracted.rating_breakdown =
    extracted.rating_breakdown ?? reviewAnalysis.general?.rating_breakdown ?? null;
  extracted.review_summary =
    extracted.review_summary ?? reviewAnalysis.general?.review_summary ?? null;
  extracted.review_themes =
    extracted.review_themes ?? reviewAnalysis.general?.review_themes ?? null;
  extracted.top_positive_review_hits =
    extracted.top_positive_review_hits ??
    reviewAnalysis.general?.top_positive_review_hits ??
    null;
  extracted.top_negative_review_hits =
    extracted.top_negative_review_hits ??
    reviewAnalysis.general?.top_negative_review_hits ??
    null;

  if (!extracted.review_snippets && reviewAnalysis.general?.recent_reviews?.length) {
    extracted.review_snippets = reviewAnalysis.general.recent_reviews
      .slice(0, 8)
      .map((review) => ({
        rating: review.rating,
        text: review.text,
      }));
  }
}
