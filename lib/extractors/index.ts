import { extractBasicFields } from "@/lib/extract-basic-fields";
import { detectPlatform, type SupportedPlatform } from "@/lib/detect-platform";
import type { ExtractedProductFields } from "@/types/analysis";
import * as cheerio from "cheerio";

import { extractTrendyolFields } from "@/lib/extractors/platforms/trendyol";
import { extractHepsiburadaFields } from "@/lib/extractors/platforms/hepsiburada";
import { extractAmazonFields } from "@/lib/extractors/platforms/amazon";
import { extractN11Fields } from "@/lib/extractors/platforms/n11";

function cleanText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function pickString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return null;
}

function pickNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function pickBoolean(...values: Array<boolean | null | undefined>): boolean {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
}

function pickStringArray(
  ...values: Array<string[] | null | undefined>
): string[] | null {
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    const cleaned = value
      .map((item) => cleanText(item))
      .filter((item): item is string => !!item);
    if (cleaned.length > 0) {
      return Array.from(new Set(cleaned));
    }
  }
  return null;
}

function pickOtherSellersSummary(
  ...values: Array<ExtractedProductFields["other_sellers_summary"] | null | undefined>
): ExtractedProductFields["other_sellers_summary"] {
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    if (typeof value.count !== "number" || value.count <= 0) continue;
    return {
      count: value.count,
      scored_count:
        typeof value.scored_count === "number" ? value.scored_count : 0,
      avg_score:
        typeof value.avg_score === "number" ? value.avg_score : null,
      top_score:
        typeof value.top_score === "number" ? value.top_score : null,
      official_count:
        typeof value.official_count === "number" ? value.official_count : 0,
      fast_delivery_count:
        typeof value.fast_delivery_count === "number" ? value.fast_delivery_count : 0,
      high_follower_count:
        typeof value.high_follower_count === "number" ? value.high_follower_count : 0,
      min_price:
        typeof value.min_price === "number" ? value.min_price : null,
      max_price:
        typeof value.max_price === "number" ? value.max_price : null,
      avg_price:
        typeof value.avg_price === "number" ? value.avg_price : null,
      cheapest_seller_name: cleanText(value.cheapest_seller_name),
      same_price_count:
        typeof value.same_price_count === "number" ? value.same_price_count : 0,
      cheaper_count:
        typeof value.cheaper_count === "number" ? value.cheaper_count : 0,
      more_expensive_count:
        typeof value.more_expensive_count === "number"
          ? value.more_expensive_count
          : 0,
      seller_names: Array.isArray(value.seller_names)
        ? value.seller_names
            .map((item) => cleanText(item))
            .filter((item): item is string => !!item)
            .slice(0, 3)
        : [],
    };
  }

  return null;
}

function pickRatingBreakdown(
  ...values: Array<ExtractedProductFields["rating_breakdown"] | null | undefined>
): ExtractedProductFields["rating_breakdown"] {
  for (const value of values) {
    if (!value || typeof value !== "object") continue;

    const normalized = {
      one_star: typeof value.one_star === "number" ? value.one_star : null,
      two_star: typeof value.two_star === "number" ? value.two_star : null,
      three_star: typeof value.three_star === "number" ? value.three_star : null,
      four_star: typeof value.four_star === "number" ? value.four_star : null,
      five_star: typeof value.five_star === "number" ? value.five_star : null,
      total: typeof value.total === "number" ? value.total : null,
    };

    if (
      normalized.one_star != null ||
      normalized.two_star != null ||
      normalized.three_star != null ||
      normalized.four_star != null ||
      normalized.five_star != null
    ) {
      return normalized;
    }
  }

  return null;
}

function pickReviewSnippets(
  ...values: Array<ExtractedProductFields["review_snippets"] | null | undefined>
): ExtractedProductFields["review_snippets"] {
  for (const value of values) {
    if (!Array.isArray(value) || value.length === 0) continue;

    const normalized = value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        return {
          rating: typeof item.rating === "number" ? item.rating : null,
          text: cleanText(item.text),
        };
      })
      .filter(
        (
          item
        ): item is NonNullable<ExtractedProductFields["review_snippets"]>[number] =>
          !!item && !!item.text
      );

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}

function pickReviewSummary(
  ...values: Array<ExtractedProductFields["review_summary"] | null | undefined>
): ExtractedProductFields["review_summary"] {
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    if (typeof value.sampled_count !== "number" || value.sampled_count <= 0) continue;

    return {
      sampled_count: value.sampled_count,
      low_rated_count:
        typeof value.low_rated_count === "number" ? value.low_rated_count : 0,
      positive_count:
        typeof value.positive_count === "number" ? value.positive_count : 0,
      negative_count:
        typeof value.negative_count === "number" ? value.negative_count : 0,
    };
  }

  return null;
}

function pickQaSnippets(
  ...values: Array<ExtractedProductFields["qa_snippets"] | null | undefined>
): ExtractedProductFields["qa_snippets"] {
  for (const value of values) {
    if (!Array.isArray(value) || value.length === 0) continue;

    const normalized = value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        return {
          question: cleanText(item.question),
          answer: cleanText(item.answer),
        };
      })
      .filter(
        (
          item
        ): item is NonNullable<ExtractedProductFields["qa_snippets"]>[number] =>
          !!item && !!item.question
      );

    if (normalized.length > 0) {
      return normalized.slice(0, 5);
    }
  }

  return null;
}

function pickReviewThemes(
  ...values: Array<ExtractedProductFields["review_themes"] | null | undefined>
): ExtractedProductFields["review_themes"] {
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const positive = Array.isArray(value.positive)
      ? value.positive.map((item) => cleanText(item)).filter((item): item is string => !!item)
      : [];
    const negative = Array.isArray(value.negative)
      ? value.negative.map((item) => cleanText(item)).filter((item): item is string => !!item)
      : [];

    if (positive.length > 0 || negative.length > 0) {
      return {
        positive: positive.slice(0, 5),
        negative: negative.slice(0, 5),
      };
    }
  }

  return null;
}

function pickReviewThemeHits(
  ...values: Array<
    ExtractedProductFields["top_positive_review_hits"] | null | undefined
  >
): ExtractedProductFields["top_positive_review_hits"] {
  for (const value of values) {
    if (!Array.isArray(value) || value.length === 0) continue;

    const normalized = value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        return {
          label: cleanText(item.label),
          count: typeof item.count === "number" ? item.count : 0,
        };
      })
      .filter(
        (
          item
        ): item is NonNullable<ExtractedProductFields["top_positive_review_hits"]>[number] =>
          !!item && !!item.label && item.count > 0
      );

    if (normalized.length > 0) {
      return normalized.slice(0, 3);
    }
  }

  return null;
}

function pickOtherSellerOffers(
  ...values: Array<ExtractedProductFields["other_seller_offers"] | null | undefined>
): ExtractedProductFields["other_seller_offers"] {
  for (const value of values) {
    if (!Array.isArray(value) || value.length === 0) continue;

    const normalized = value
      .map((offer) => {
        if (!offer || typeof offer !== "object") return null;
        return {
          merchant_id:
            typeof offer.merchant_id === "number" ? offer.merchant_id : null,
          listing_id: cleanText(offer.listing_id),
          seller_name: cleanText(offer.seller_name),
          seller_badges: pickStringArray(offer.seller_badges),
          seller_score:
            typeof offer.seller_score === "number" ? offer.seller_score : null,
          is_official: Boolean(offer.is_official),
          has_fast_delivery: Boolean(offer.has_fast_delivery),
          has_free_shipping: Boolean(offer.has_free_shipping),
          follower_count:
            typeof offer.follower_count === "number" ? offer.follower_count : null,
          stock_quantity:
            typeof offer.stock_quantity === "number" ? offer.stock_quantity : null,
          price: typeof offer.price === "number" ? offer.price : null,
          original_price:
            typeof offer.original_price === "number" ? offer.original_price : null,
          discount_rate:
            typeof offer.discount_rate === "number" ? offer.discount_rate : null,
          promotion_labels: pickStringArray(offer.promotion_labels),
          listing_url: cleanText(offer.listing_url),
        };
      })
      .filter(
        (
          offer
        ): offer is NonNullable<ExtractedProductFields["other_seller_offers"]>[number] =>
          !!offer && !!offer.seller_name
      );

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}

function parseNormalizedPrice(price: string | null | undefined) {
  if (!price) return null;

  const cleaned = price.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;
  if (!/[\d]/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized = cleaned;

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    const commaDigits = cleaned.length - lastComma - 1;

    normalized =
      commaDigits === 2
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastDot > -1) {
    const dotDigits = cleaned.length - lastDot - 1;

    normalized =
      dotDigits === 3 && cleaned.indexOf(".") === lastDot
        ? cleaned.replace(/\./g, "")
        : cleaned.replace(/,/g, "");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function looksWeakModelCode(value: string | null | undefined) {
  const text = cleanText(value);
  if (!text) return true;

  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  if (text.length < 3 || text.length > 100) return true;
  if (!/[a-zA-Z0-9]/.test(text)) return true;

  if (
    lower.includes("garanti") ||
    lower.includes("teslimat") ||
    lower.includes("satıcı") ||
    lower.includes("mağaza") ||
    lower.includes("değerlendirme") ||
    lower.includes("yorum")
  ) {
    return true;
  }

  if (!/[A-Za-z]/.test(text) || !/\d/.test(text)) {
    return true;
  }

  if (words.length >= 2 && !/[-_/]/.test(text)) {
    const phraseHints = [
      "buds",
      "play",
      "pro",
      "max",
      "ultra",
      "plus",
      "mini",
      "redmi",
      "xiaomi",
      "iphone",
      "siyah",
      "beyaz",
      "mavi",
      "kulaklık",
      "kulaklik",
      "telefon",
      "pantolon",
      "ayakkabı",
      "ayakkabi",
    ];

    const hitCount = phraseHints.filter((hint) => lower.includes(hint)).length;
    if (hitCount >= 1) return true;
  }

  return false;
}

function chooseBestModelCode(
  platformValue: string | null | undefined,
  basicValue: string | null | undefined
) {
  const platformCode = cleanText(platformValue);
  const basicCode = cleanText(basicValue);

  if (platformCode && !looksWeakModelCode(platformCode)) {
    return platformCode;
  }

  if (basicCode && !looksWeakModelCode(basicCode)) {
    return basicCode;
  }

  return platformCode || basicCode || null;
}

function chooseBestImageCount(
  platformValue: number | null | undefined,
  basicValue: number | null | undefined
) {
  const platformCount =
    typeof platformValue === "number" && Number.isFinite(platformValue)
      ? platformValue
      : 0;

  const basicCount =
    typeof basicValue === "number" && Number.isFinite(basicValue)
      ? basicValue
      : 0;

  return Math.max(platformCount, basicCount, 0);
}

function normalizePlatformFields(
  fields: Partial<ExtractedProductFields> | null | undefined
): Partial<ExtractedProductFields> {
  if (!fields) return {};

  return {
    ...fields,
    title: cleanText(fields.title),
    meta_description: cleanText(fields.meta_description),
    h1: cleanText(fields.h1),

    brand: cleanText(fields.brand),
    product_name: cleanText(fields.product_name),
    model_code: cleanText(fields.model_code),

    sku: cleanText(fields.sku),
    mpn: cleanText(fields.mpn),
    gtin: cleanText(fields.gtin),

    price: cleanText(fields.price),
    currency: cleanText(fields.currency),

    seller_name: cleanText(fields.seller_name),
    merchant_id:
      typeof fields.merchant_id === "number" ? fields.merchant_id : null,
    listing_id: cleanText(fields.listing_id),
    stock_status: cleanText(fields.stock_status),
    campaign_label: cleanText(fields.campaign_label),
    promotion_labels: pickStringArray(fields.promotion_labels),
    delivery_type: cleanText(fields.delivery_type),
    best_seller_badge: cleanText(fields.best_seller_badge),

    category: cleanText(fields.category),
    platform: cleanText(fields.platform),
  };
}

function getPlatformFields(params: {
  platform: SupportedPlatform;
  $: cheerio.CheerioAPI;
  html: string;
  url: string;
}): Partial<ExtractedProductFields> {
  const { platform, $, html, url } = params;

  switch (platform) {
    case "trendyol":
      return normalizePlatformFields(extractTrendyolFields({ $, html, url }));

    case "hepsiburada":
      return normalizePlatformFields(extractHepsiburadaFields({ $, html, url }));

    case "amazon":
      return normalizePlatformFields(extractAmazonFields({ $, html, url }));

    case "n11":
      return normalizePlatformFields(extractN11Fields({ $, html, url }));

    case "idefix":
      return {
        extractor_status: "fallback",
      };

    default:
      return {
        extractor_status: "fallback",
      };
  }
}

function mergeExtractedFields(params: {
  basicFields: ExtractedProductFields;
  platformFields: Partial<ExtractedProductFields>;
  platform: SupportedPlatform;
}): ExtractedProductFields {
  const { basicFields, platformFields, platform } = params;

  const mergedPrice = pickString(platformFields.price, basicFields.price);

  const merged: ExtractedProductFields = {
    title: pickString(platformFields.title, basicFields.title),
    meta_description: pickString(
      platformFields.meta_description,
      basicFields.meta_description
    ),
    h1: pickString(platformFields.h1, basicFields.h1),

    brand: pickString(platformFields.brand, basicFields.brand),
    product_name: pickString(platformFields.product_name, basicFields.product_name),
    model_code: chooseBestModelCode(
      platformFields.model_code,
      basicFields.model_code
    ),

    sku: pickString(platformFields.sku, basicFields.sku),
    mpn: pickString(platformFields.mpn, basicFields.mpn),
    gtin: pickString(platformFields.gtin, basicFields.gtin),

    price: mergedPrice,
    normalized_price: parseNormalizedPrice(mergedPrice),
    original_price: pickNumber(
      platformFields.original_price,
      basicFields.original_price
    ),
    discount_rate: pickNumber(
      platformFields.discount_rate,
      basicFields.discount_rate
    ),
    currency: pickString(platformFields.currency, basicFields.currency),

    image_count: chooseBestImageCount(
      platformFields.image_count,
      basicFields.image_count
    ),
    has_video: pickBoolean(platformFields.has_video, basicFields.has_video),

    rating_value: pickNumber(platformFields.rating_value, basicFields.rating_value),
    rating_breakdown: pickRatingBreakdown(
      platformFields.rating_breakdown,
      basicFields.rating_breakdown
    ),
    review_count: pickNumber(platformFields.review_count, basicFields.review_count),
    review_snippets: pickReviewSnippets(
      platformFields.review_snippets,
      basicFields.review_snippets
    ),
    qa_snippets: pickQaSnippets(
      platformFields.qa_snippets,
      basicFields.qa_snippets
    ),
    review_summary: pickReviewSummary(
      platformFields.review_summary,
      basicFields.review_summary
    ),
    review_themes: pickReviewThemes(
      platformFields.review_themes,
      basicFields.review_themes
    ),
    top_positive_review_hits: pickReviewThemeHits(
      platformFields.top_positive_review_hits,
      basicFields.top_positive_review_hits
    ),
    top_negative_review_hits: pickReviewThemeHits(
      platformFields.top_negative_review_hits,
      basicFields.top_negative_review_hits
    ),
    question_count: pickNumber(
      platformFields.question_count,
      basicFields.question_count
    ),
    description_length: pickNumber(
      platformFields.description_length,
      basicFields.description_length
    ),
    bullet_point_count: pickNumber(
      platformFields.bullet_point_count,
      basicFields.bullet_point_count
    ),

    has_add_to_cart: pickBoolean(
      platformFields.has_add_to_cart,
      basicFields.has_add_to_cart
    ),
    has_shipping_info: pickBoolean(
      platformFields.has_shipping_info,
      basicFields.has_shipping_info
    ),
    has_return_info: pickBoolean(
      platformFields.has_return_info,
      basicFields.has_return_info
    ),
    has_free_shipping: pickBoolean(
      platformFields.has_free_shipping,
      basicFields.has_free_shipping
    ),
    shipping_days: pickNumber(
      platformFields.shipping_days,
      basicFields.shipping_days
    ),
    has_specs: pickBoolean(platformFields.has_specs, basicFields.has_specs),
    has_faq: pickBoolean(platformFields.has_faq, basicFields.has_faq),
    variant_count: pickNumber(
      platformFields.variant_count,
      basicFields.variant_count
    ),
    stock_quantity: pickNumber(
      platformFields.stock_quantity,
      basicFields.stock_quantity
    ),

    stock_status: pickString(platformFields.stock_status, basicFields.stock_status),
    seller_name: pickString(platformFields.seller_name, basicFields.seller_name),
    merchant_id: pickNumber(platformFields.merchant_id, basicFields.merchant_id),
    listing_id: pickString(platformFields.listing_id, basicFields.listing_id),
    seller_badges: pickStringArray(
      platformFields.seller_badges,
      basicFields.seller_badges
    ),
    seller_score: pickNumber(
      platformFields.seller_score,
      basicFields.seller_score
    ),
    follower_count: pickNumber(
      platformFields.follower_count,
      basicFields.follower_count
    ),
    favorite_count: pickNumber(
      platformFields.favorite_count,
      basicFields.favorite_count
    ),
    other_sellers_count: pickNumber(
      platformFields.other_sellers_count,
      basicFields.other_sellers_count
    ),
    other_seller_offers: pickOtherSellerOffers(
      platformFields.other_seller_offers,
      basicFields.other_seller_offers
    ),
    other_sellers_summary: pickOtherSellersSummary(
      platformFields.other_sellers_summary,
      basicFields.other_sellers_summary
    ),
    has_brand_page: pickBoolean(
      platformFields.has_brand_page,
      basicFields.has_brand_page
    ),
    official_seller: pickBoolean(
      platformFields.official_seller,
      basicFields.official_seller
    ),
    has_campaign: pickBoolean(
      platformFields.has_campaign,
      basicFields.has_campaign
    ),
    campaign_label: pickString(
      platformFields.campaign_label,
      basicFields.campaign_label
    ),
    promotion_labels: pickStringArray(
      platformFields.promotion_labels,
      basicFields.promotion_labels
    ),
    delivery_type: pickString(
      platformFields.delivery_type,
      basicFields.delivery_type
    ),
    is_best_seller: pickBoolean(
      platformFields.is_best_seller,
      basicFields.is_best_seller
    ),
    best_seller_rank: pickNumber(
      platformFields.best_seller_rank,
      basicFields.best_seller_rank
    ),
    best_seller_badge: pickString(
      platformFields.best_seller_badge,
      basicFields.best_seller_badge
    ),

    category: pickString(platformFields.category, basicFields.category),

    extractor_status:
      platformFields.extractor_status ?? (platform ? "ok" : "fallback"),

    platform: platform ?? null,
  };

  if (
    merged.extractor_status === "ok" &&
    !platformFields.brand &&
    !platformFields.seller_name &&
    !platformFields.model_code &&
    (platformFields.image_count == null || platformFields.image_count === 0)
  ) {
    merged.extractor_status = "partial";
  }

  return merged;
}

export function extractFieldsWithFallback(params: {
  url: string;
  html: string;
}): {
  platform: SupportedPlatform;
  genericFields: ExtractedProductFields;
  platformFields: Partial<ExtractedProductFields>;
  mergedFields: ExtractedProductFields;
} {
  const { url, html } = params;

  const platform = detectPlatform(url);
  const $ = cheerio.load(html);

  const genericFields = extractBasicFields(html);
  const platformFields = getPlatformFields({
    platform,
    $,
    html,
    url,
  });

  const mergedFields = mergeExtractedFields({
    basicFields: genericFields,
    platformFields,
    platform,
  });

  return {
    platform,
    genericFields,
    platformFields,
    mergedFields,
  };
}
