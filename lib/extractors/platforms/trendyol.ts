import type { CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import type { PlatformExtractor } from "@/lib/extractors/types";
import type {
  OtherSellerOffer,
  OtherSellersSummary,
  ReviewSnippet,
  ReviewRatingBreakdown,
  ReviewSummary,
  QuestionAnswerSnippet,
} from "@/types/analysis";

function cleanText(value: string | undefined | null) {
  if (!value) return null;
  const normalized = value.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function decodeUnicode(value: string) {
  return value.replace(/\\u[\dA-Fa-f]{4}/g, (match) => {
    try {
      return String.fromCharCode(parseInt(match.replace("\\u", ""), 16));
    } catch {
      return match;
    }
  });
}

function safeJsonParse<T = unknown>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeBrand(value: string | null) {
  if (!value) return null;
  const normalized = cleanText(
    value.replace(/^marka[:\s-]*/i, "").replace(/^brand[:\s-]*/i, "")
  );
  if (!normalized) return null;
  if (normalized.length > 60) return null;
  return normalized;
}

function slugifyText(value: string | null) {
  if (!value) return null;
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıi]/g, "i")
    .replace(/[ğg]/g, "g")
    .replace(/[üu]/g, "u")
    .replace(/[şs]/g, "s")
    .replace(/[öo]/g, "o")
    .replace(/[çc]/g, "c")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSeller(value: string | null) {
  if (!value) return null;
  const normalized = cleanText(
    value
      .replace(/^satıcı[:\s-]*/i, "")
      .replace(/^seller[:\s-]*/i, "")
      .replace(/^(?:satıcı|satici)[:\s-]*/i, "")
      .replace(/^(?:mağaza|magaza)[:\s-]*/i, "")
      .replace(/^mağaza[:\s-]*/i, "")
  );
  if (!normalized) return null;
  if (normalized.length > 80) return null;
  return normalized;
}

function normalizeModelCode(value: string | null) {
  if (!value) return null;
  let normalized = value
    .replace(/&quot;/gi, "")
    .replace(/&#39;/gi, "")
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  normalized = normalized.replace(
    /^(?:urun\s*kodu|ürün\s*kodu|model\s*numarasi|model\s*numarası|urun\s*no|ürün\s*no)[:\s-]*/i,
    ""
  );
  normalized = normalized.replace(
    /^(ürün\s*kodu|model\s*kodu|model\s*numarası|model|sku|stok\s*kodu|stok\s*no|mpn|ürün\s*no|urun\s*kodu|urun\s*no)[:\s-]*/i,
    ""
  );
  if (!normalized) return null;
  if (normalized.length < 2) return null;
  if (normalized.length > 100) return null;
  if (!/[a-zA-Z0-9]/.test(normalized)) return null;
  return normalized;
}

function normalizePriceValue(raw: string | number | null | undefined) {
  if (raw === null || raw === undefined) return null;
  let text = String(raw).replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  text = text.replace(/(?:Turk|Türk)\s*Liras(?:i|ı)/gi, "TL");
  text = text.replace(/Türk\s*Lirası/gi, "TL").replace(/[^\d.,]/g, "").trim();
  if (!text || !/[\d]/.test(text)) return null;

  let numeric = text;
  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      numeric = numeric.replace(/\./g, "").replace(",", ".");
    } else {
      numeric = numeric.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    const commaDigits = numeric.length - lastComma - 1;
    if (commaDigits === 2) {
      numeric = numeric.replace(/\./g, "").replace(",", ".");
    } else {
      numeric = numeric.replace(/,/g, "");
    }
  } else if (lastDot > -1) {
    const dotDigits = numeric.length - lastDot - 1;
    if (dotDigits === 3 && numeric.indexOf(".") === lastDot) {
      numeric = numeric.replace(/\./g, "");
    }
  }

  const amount = Number(numeric);
  if (!Number.isFinite(amount) || amount <= 0 || amount < 1) return null;

  return `${amount.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function normalizeImageUrl(url: string | null) {
  if (!url) return null;
  const cleaned = cleanText(url);
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) return null;
  if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(cleaned)) return null;
  if (/sprite|icon|logo|placeholder|transparent|avatar/i.test(cleaned)) return null;
  return cleaned.replace(/\?.*$/, "");
}

function pickFirstValid(values: Array<string | null>) {
  return values.find((value) => !!value && value.length >= 2) ?? null;
}

function collectJsonBlocks(html: string) {
  const blocks: unknown[] = [];
  const scriptMatches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];
  for (const match of scriptMatches) {
    const raw = cleanText(match[1]);
    if (!raw) continue;
    const parsed = safeJsonParse(raw);
    if (!parsed) continue;
    if (Array.isArray(parsed)) {
      blocks.push(...parsed);
    } else {
      blocks.push(parsed);
    }
  }
  return blocks;
}

function getNestedValue(input: unknown, path: Array<string | number>): unknown {
  let current: unknown = input;
  for (const key of path) {
    if (current === null || current === undefined) return null;
    if (typeof key === "number") {
      if (!Array.isArray(current)) return null;
      current = current[key];
      continue;
    }
    if (typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function collectProductObjectsFromState(html: string) {
  const objects: unknown[] = [];

  const patterns = [
    /window\.__PRODUCT_DETAIL_APP_INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:window|var|let|const|<\/script>)/i,
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:window|var|let|const|<\/script>)/i,
    /window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const parsed = safeJsonParse(match[1]);
    if (parsed) objects.push(parsed);
  }

  const inlineMatches = [
    ...html.matchAll(
      /"(?:productCode|merchantSku|modelCode)"\s*:\s*"([^"]{3,60})"/gi
    ),
  ];
  if (inlineMatches.length > 0) {
    const inlineObj: Record<string, string> = {};
    for (const m of inlineMatches) {
      const key = m[0].split('"')[1];
      inlineObj[key] = m[1];
    }
    objects.push({ product: inlineObj });
  }

  return objects;
}

function collectTrendyolEnvoyProps(html: string) {
  const blocks: unknown[] = [];
  const matches = [
    ...html.matchAll(
      /window\["__envoy_product-detail__PROPS"\]\s*=\s*(\{[\s\S]*?\})\s*<\/script>/gi
    ),
  ];

  for (const match of matches) {
    const raw = cleanText(match[1]);
    if (!raw) continue;
    const parsed = safeJsonParse(raw);
    if (parsed) blocks.push(parsed);
  }

  return blocks;
}

function getTrendyolEnvoyProductRecord(envoyBlocks: unknown[]) {
  for (const block of envoyBlocks) {
    const product = getNestedValue(block, ["product"]);
    if (product && typeof product === "object") {
      return product as Record<string, unknown>;
    }
  }

  return null;
}

function getPriceRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseOfferPrice(priceRecord: Record<string, unknown> | null) {
  if (!priceRecord) {
    return { price: null, original_price: null, discount_rate: null };
  }

  const price =
    toFiniteNumber(getNestedValue(priceRecord, ["discountedPrice", "value"])) ??
    toFiniteNumber(getNestedValue(priceRecord, ["sellingPrice", "value"])) ??
    toFiniteNumber(priceRecord.discountedPrice) ??
    toFiniteNumber(priceRecord.sellingPrice);

  const original_price =
    toFiniteNumber(getNestedValue(priceRecord, ["originalPrice", "value"])) ??
    toFiniteNumber(getNestedValue(priceRecord, ["listPrice", "value"])) ??
    toFiniteNumber(priceRecord.originalPrice) ??
    toFiniteNumber(priceRecord.listPrice);

  const discount_rate =
    typeof original_price === "number" &&
    typeof price === "number" &&
    original_price > price
      ? Math.round(((original_price - price) / original_price) * 100)
      : null;

  return {
    price,
    original_price,
    discount_rate,
  };
}

function parseMerchantBadges(value: unknown) {
  if (!Array.isArray(value)) return null;

  const badges = value
    .map((item) => {
      if (typeof item === "string") return cleanText(item);
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return (
        cleanText(record.displayName as string | null) ||
        cleanText(record.name as string | null) ||
        cleanText(record.type as string | null)
      );
    })
    .filter((item): item is string => !!item);

  return badges.length > 0 ? Array.from(new Set(badges)) : null;
}

function mergeUniqueStrings(...values: Array<string[] | null | undefined>) {
  const merged = values
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .map((item) => cleanText(item))
    .filter((item): item is string => !!item);

  return merged.length > 0 ? Array.from(new Set(merged)) : null;
}

function parsePromotionLabels(value: unknown) {
  if (!Array.isArray(value)) return null;

  const labels = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return (
        cleanText(record.shortName as string | null) ||
        cleanText(record.name as string | null)
      );
    })
    .filter((item): item is string => !!item);

  return labels.length > 0 ? Array.from(new Set(labels)) : null;
}

function parsePromotionLabel(value: unknown) {
  return parsePromotionLabels(value)?.[0] ?? null;
}

function getCountFromRecord(
  record: Record<string, unknown> | null,
  candidates: string[]
) {
  if (!record) return null;

  for (const key of candidates) {
    const value = toFiniteNumber(record[key]);
    if (value != null) return value;
  }

  return null;
}

function parseRatingBreakdown(
  ratingScoreRecord: Record<string, unknown> | null
): ReviewRatingBreakdown | null {
  if (!ratingScoreRecord) return null;

  const direct = {
    one_star: getCountFromRecord(ratingScoreRecord, [
      "oneStarCount",
      "star1Count",
      "rate1Count",
      "count1",
      "reviewCount1",
      "rating1Count",
    ]),
    two_star: getCountFromRecord(ratingScoreRecord, [
      "twoStarCount",
      "star2Count",
      "rate2Count",
      "count2",
      "reviewCount2",
      "rating2Count",
    ]),
    three_star: getCountFromRecord(ratingScoreRecord, [
      "threeStarCount",
      "star3Count",
      "rate3Count",
      "count3",
      "reviewCount3",
      "rating3Count",
    ]),
    four_star: getCountFromRecord(ratingScoreRecord, [
      "fourStarCount",
      "star4Count",
      "rate4Count",
      "count4",
      "reviewCount4",
      "rating4Count",
    ]),
    five_star: getCountFromRecord(ratingScoreRecord, [
      "fiveStarCount",
      "star5Count",
      "rate5Count",
      "count5",
      "reviewCount5",
      "rating5Count",
    ]),
  };

  const nestedCandidates = [
    getNestedValue(ratingScoreRecord, ["ratingDistribution"]),
    getNestedValue(ratingScoreRecord, ["distribution"]),
    getNestedValue(ratingScoreRecord, ["starCounts"]),
    getNestedValue(ratingScoreRecord, ["scoreBreakdown"]),
    getNestedValue(ratingScoreRecord, ["reviewCountByRate"]),
  ];

  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const rate =
          toFiniteNumber(record.rate) ??
          toFiniteNumber(record.rating) ??
          toFiniteNumber(record.score) ??
          toFiniteNumber(record.star);
        const count =
          toFiniteNumber(record.count) ??
          toFiniteNumber(record.totalCount) ??
          toFiniteNumber(record.reviewCount) ??
          toFiniteNumber(record.commentCount);
        if (rate == null || count == null) continue;
        if (rate === 1) direct.one_star = direct.one_star ?? count;
        if (rate === 2) direct.two_star = direct.two_star ?? count;
        if (rate === 3) direct.three_star = direct.three_star ?? count;
        if (rate === 4) direct.four_star = direct.four_star ?? count;
        if (rate === 5) direct.five_star = direct.five_star ?? count;
      }
    } else if (candidate && typeof candidate === "object") {
      const nestedRecord = candidate as Record<string, unknown>;
      direct.one_star =
        direct.one_star ??
        getCountFromRecord(nestedRecord, ["1", "one", "oneStar", "star1", "rate1"]);
      direct.two_star =
        direct.two_star ??
        getCountFromRecord(nestedRecord, ["2", "two", "twoStar", "star2", "rate2"]);
      direct.three_star =
        direct.three_star ??
        getCountFromRecord(nestedRecord, ["3", "three", "threeStar", "star3", "rate3"]);
      direct.four_star =
        direct.four_star ??
        getCountFromRecord(nestedRecord, ["4", "four", "fourStar", "star4", "rate4"]);
      direct.five_star =
        direct.five_star ??
        getCountFromRecord(nestedRecord, ["5", "five", "fiveStar", "star5", "rate5"]);
    }
  }

  if (
    direct.one_star == null &&
    direct.two_star == null &&
    direct.three_star == null &&
    direct.four_star == null &&
    direct.five_star == null
  ) {
    return null;
  }

  const knownCounts = [
    direct.one_star,
    direct.two_star,
    direct.three_star,
    direct.four_star,
    direct.five_star,
  ].filter((value): value is number => typeof value === "number");

  return {
    ...direct,
    total:
      knownCounts.length > 0
        ? knownCounts.reduce((sum, count) => sum + count, 0)
        : null,
  };
}

function parseReviewSnippets(
  envoyProduct: Record<string, unknown> | null
): {
  snippets: ReviewSnippet[] | null;
  summary: ReviewSummary | null;
} {
  if (!envoyProduct) {
    return {
      snippets: null,
      summary: null,
    };
  }

  const sources = [
    getNestedValue(envoyProduct, ["reviews"]),
    getNestedValue(envoyProduct, ["comments"]),
    getNestedValue(envoyProduct, ["commentSummary"]),
    getNestedValue(envoyProduct, ["customerReviews"]),
    getNestedValue(envoyProduct, ["reviewSummary", "topReviews"]),
    getNestedValue(envoyProduct, ["ratingScore", "topReviews"]),
    getNestedValue(envoyProduct, ["productReviews"]),
    getNestedValue(envoyProduct, ["ratingScore", "reviews"]),
  ];

  const collected: ReviewSnippet[] = [];
  const seen = new Set<string>();

  const pushSnippet = (rating: number | null, text: string | null) => {
    const cleanedText = cleanText(text);
    if (!cleanedText || cleanedText.length < 8) return;
    const key = cleanedText.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) return;
    seen.add(key);
    collected.push({
      rating:
        typeof rating === "number" && Number.isFinite(rating) && rating >= 1 && rating <= 5
          ? rating
          : null,
      text: cleanedText,
    });
  };

  const walk = (input: unknown, depth = 0) => {
    if (depth > 6 || input == null || collected.length >= 8) return;

    if (Array.isArray(input)) {
      for (const item of input.slice(0, 20)) {
        walk(item, depth + 1);
      }
      return;
    }

    if (typeof input !== "object") return;

    const record = input as Record<string, unknown>;
    const text =
      cleanText(record.comment as string | null) ||
      cleanText(record.commentText as string | null) ||
      cleanText(record.reviewText as string | null) ||
      cleanText(record.review as string | null) ||
      cleanText(record.text as string | null) ||
      cleanText(record.content as string | null);
    const rating =
      toFiniteNumber(record.rate) ??
      toFiniteNumber(record.rating) ??
      toFiniteNumber(record.score) ??
      toFiniteNumber(record.star);

    if (text) {
      pushSnippet(rating, text);
    }

    for (const value of Object.values(record)) {
      walk(value, depth + 1);
    }
  };

  for (const source of sources) {
    walk(source, 0);
  }

  if (collected.length === 0) {
    return {
      snippets: null,
      summary: null,
    };
  }

  const lowRatedCount = collected.filter(
    (item) => typeof item.rating === "number" && item.rating <= 2
  ).length;
  const positiveCount = collected.filter(
    (item) => typeof item.rating === "number" && item.rating >= 4
  ).length;
  const negativeCount = collected.filter(
    (item) => typeof item.rating === "number" && item.rating <= 2
  ).length;

  return {
    snippets: collected.slice(0, 5),
    summary: {
      sampled_count: collected.length,
      low_rated_count: lowRatedCount,
      positive_count: positiveCount,
      negative_count: negativeCount,
    },
  };
}

function parseQaSnippets(
  envoyProduct: Record<string, unknown> | null
): QuestionAnswerSnippet[] | null {
  if (!envoyProduct) return null;

  const sources = [
    getNestedValue(envoyProduct, ["questions"]),
    getNestedValue(envoyProduct, ["qna"]),
    getNestedValue(envoyProduct, ["qa"]),
    getNestedValue(envoyProduct, ["questionsAnswers"]),
    getNestedValue(envoyProduct, ["questionAnswers"]),
    getNestedValue(envoyProduct, ["productQuestions"]),
    getNestedValue(envoyProduct, ["faq"]),
  ];

  const collected: QuestionAnswerSnippet[] = [];
  const seen = new Set<string>();

  const pushSnippet = (question: string | null, answer: string | null) => {
    const cleanedQuestion = cleanText(question);
    const cleanedAnswer = cleanText(answer);
    if (!cleanedQuestion || cleanedQuestion.length < 6) return;

    const key = `${cleanedQuestion.toLocaleLowerCase("tr-TR")}::${(cleanedAnswer || "").toLocaleLowerCase("tr-TR")}`;
    if (seen.has(key)) return;
    seen.add(key);

    collected.push({
      question: cleanedQuestion,
      answer: cleanedAnswer,
    });
  };

  const walk = (input: unknown, depth = 0) => {
    if (depth > 6 || input == null || collected.length >= 6) return;

    if (Array.isArray(input)) {
      for (const item of input.slice(0, 20)) {
        walk(item, depth + 1);
      }
      return;
    }

    if (typeof input !== "object") return;

    const record = input as Record<string, unknown>;
    const question =
      cleanText(record.question as string | null) ||
      cleanText(record.questionText as string | null) ||
      cleanText(record.title as string | null);
    const answer =
      cleanText(record.answer as string | null) ||
      cleanText(record.answerText as string | null) ||
      cleanText(record.response as string | null);

    if (question) {
      pushSnippet(question, answer);
    }

    for (const value of Object.values(record)) {
      walk(value, depth + 1);
    }
  };

  for (const source of sources) {
    walk(source);
  }

  return collected.length > 0 ? collected : null;
}

function parseOtherSellerOffers(
  envoyProduct: Record<string, unknown> | null,
  currentPrice: number | null
) {
  if (!envoyProduct) {
    return {
      seller_name: null,
      seller_badges: null,
      seller_score: null,
      follower_count: null,
      official_seller: false,
      has_video: false,
      question_count: null as number | null,
      review_count: null as number | null,
      rating_value: null as number | null,
      rating_breakdown: null as ReviewRatingBreakdown | null,
      has_campaign: false,
      campaign_label: null as string | null,
      promotion_labels: null as string[] | null,
      review_snippets: null as ReviewSnippet[] | null,
      qa_snippets: null as QuestionAnswerSnippet[] | null,
      review_summary: null as ReviewSummary | null,
      has_free_shipping: false,
      has_return_info: false,
      has_specs: false,
      variant_count: null as number | null,
      image_count: null as number | null,
      stock_quantity: null as number | null,
      stock_status: null as string | null,
      category: null as string | null,
      favorite_count: null as number | null,
      merchant_id: null as number | null,
      listing_id: null as string | null,
      is_best_seller: false,
      best_seller_rank: null as number | null,
      best_seller_badge: null as string | null,
      other_seller_offers: null as OtherSellerOffer[] | null,
      other_sellers_summary: null as OtherSellersSummary | null,
    };
  }

  const merchantListing = getNestedValue(envoyProduct, ["merchantListing"]);
  const merchantListingRecord =
    merchantListing && typeof merchantListing === "object"
      ? (merchantListing as Record<string, unknown>)
      : null;

  const mainMerchant = getNestedValue(envoyProduct, ["merchantListing", "merchant"]);
  const mainMerchantRecord =
    mainMerchant && typeof mainMerchant === "object"
      ? (mainMerchant as Record<string, unknown>)
      : null;

  const otherMerchants = getNestedValue(envoyProduct, ["merchantListing", "otherMerchants"]);
  const otherMerchantList = Array.isArray(otherMerchants)
    ? otherMerchants
    : [];
  const winnerVariant = getNestedValue(envoyProduct, ["merchantListing", "winnerVariant"]);
  const winnerVariantRecord =
    winnerVariant && typeof winnerVariant === "object"
      ? (winnerVariant as Record<string, unknown>)
      : null;
  const ratingScore = getNestedValue(envoyProduct, ["ratingScore"]);
  const ratingScoreRecord =
    ratingScore && typeof ratingScore === "object"
      ? (ratingScore as Record<string, unknown>)
      : null;
  const promotions = getNestedValue(envoyProduct, ["merchantListing", "promotions"]);
  const promotionLabel = parsePromotionLabel(promotions);
  const promotionLabels = parsePromotionLabels(promotions);
  const productPromotions = parsePromotionLabel(getNestedValue(envoyProduct, ["promotions"]));
  const productPromotionLabels = parsePromotionLabels(
    getNestedValue(envoyProduct, ["promotions"])
  );
  const questionCount =
    toFiniteNumber(getNestedValue(envoyProduct, ["questionCount"])) ??
    toFiniteNumber(getNestedValue(envoyProduct, ["merchantListing", "questionCount"])) ??
    null;
  const reviewCount =
    toFiniteNumber(getNestedValue(ratingScoreRecord, ["commentCount"])) ??
    toFiniteNumber(getNestedValue(ratingScoreRecord, ["totalCount"])) ??
    null;
  const ratingValue =
    toFiniteNumber(getNestedValue(ratingScoreRecord, ["averageRating"])) ?? null;
  const ratingBreakdown = parseRatingBreakdown(ratingScoreRecord);
  const reviewSnippets = parseReviewSnippets(envoyProduct);
  const qaSnippets = parseQaSnippets(envoyProduct);
  const winnerHasFreeShipping = Boolean(
    getNestedValue(winnerVariantRecord, ["freeCargo"]) ??
      getNestedValue(winnerVariantRecord, ["hasFreeCargo"])
  );
  const stockQuantity =
    toFiniteNumber(getNestedValue(winnerVariantRecord, ["quantity"])) ??
    toFiniteNumber(getNestedValue(envoyProduct, ["stockQuantity"])) ??
    null;
  const favoriteCount =
    toFiniteNumber(getNestedValue(envoyProduct, ["favoriteCount"])) ?? null;
  const imageCount = Array.isArray(getNestedValue(envoyProduct, ["images"]))
    ? (getNestedValue(envoyProduct, ["images"]) as unknown[]).length
    : null;
  const merchantId =
    toFiniteNumber(getNestedValue(mainMerchantRecord, ["id"])) ??
    toFiniteNumber(getNestedValue(mainMerchantRecord, ["sellerId"])) ??
    null;
  const listingId = cleanText(
    getNestedValue(winnerVariantRecord, ["listingId"]) as string | null
  );
  const inStock = getNestedValue(envoyProduct, ["inStock"]);
  const stockStatus =
    typeof stockQuantity === "number"
      ? stockQuantity > 0
        ? "in_stock"
        : "out_of_stock"
      : typeof inStock === "boolean"
        ? inStock
          ? "in_stock"
          : "out_of_stock"
        : null;
  const variantCount =
    Array.isArray(getNestedValue(envoyProduct, ["variants"]))
      ? (getNestedValue(envoyProduct, ["variants"]) as unknown[]).length
      : null;
  const attributes = getNestedValue(envoyProduct, ["attributes"]);
  const hasSpecs = Array.isArray(attributes) && attributes.length > 0;
  const categoryPath =
    cleanText(getNestedValue(envoyProduct, ["category", "hierarchy"]) as string | null) ||
    (
      Array.isArray(getNestedValue(envoyProduct, ["categoryTree"]))
        ? (getNestedValue(envoyProduct, ["categoryTree"]) as Array<Record<string, unknown>>)
            .map((item) => cleanText(item?.name as string | null))
            .filter((item): item is string => !!item)
            .join(" / ")
        : null
    ) ||
    (
      Array.isArray(getNestedValue(envoyProduct, ["webCategoryTree"]))
        ? (getNestedValue(envoyProduct, ["webCategoryTree"]) as Array<Record<string, unknown>>)
            .map((item) => cleanText(item?.name as string | null))
            .filter((item): item is string => !!item)
            .join(" / ")
        : null
    ) ||
    cleanText(getNestedValue(envoyProduct, ["category", "name"]) as string | null);
  const hasReturnInfo = Boolean(getNestedValue(envoyProduct, ["isRefundable"]));
  const categoryTopRankings = getNestedValue(envoyProduct, ["categoryTopRankings"]);
  let bestSellerRank: number | null = null;

  if (Array.isArray(categoryTopRankings)) {
    for (const item of categoryTopRankings) {
      if (!item || typeof item !== "object") continue;
      const ranking = item as Record<string, unknown>;
      const rankingName = cleanText(ranking.name as string | null)?.toLocaleLowerCase("tr-TR");
      const rankingOrder = toFiniteNumber(ranking.order);
      if (rankingName === "bestseller" || rankingName === "bestseller") {
        bestSellerRank = rankingOrder ?? bestSellerRank;
        break;
      }
    }
  }

  const offers = otherMerchantList
    .slice(0, 10)
    .map((merchant) => {
      if (!merchant || typeof merchant !== "object") return null;
      const record = merchant as Record<string, unknown>;
      const priceData = parseOfferPrice(getPriceRecord(record.price));
      const variantRecord =
        Array.isArray(record.variants) &&
        record.variants[0] &&
        typeof record.variants[0] === "object"
          ? (record.variants[0] as Record<string, unknown>)
          : null;
      const offer: OtherSellerOffer = {
        merchant_id:
          toFiniteNumber(getNestedValue(record, ["id"])) ??
          toFiniteNumber(getNestedValue(record, ["sellerId"])) ??
          null,
        listing_id:
          cleanText(getNestedValue(variantRecord, ["listingId"]) as string | null) ||
          cleanText(getNestedValue(record, ["listingId"]) as string | null),
        seller_name: cleanText(record.name as string | null),
        seller_badges: mergeUniqueStrings(
          parseMerchantBadges(record.merchantBadges),
          parseMerchantBadges(record.merchantMarkers)
        ),
        seller_score:
          toFiniteNumber(getNestedValue(record, ["sellerScore", "value"])) ??
          toFiniteNumber(record.sellerScore),
        is_official: Boolean(false),
        has_fast_delivery: Boolean(record.rushDelivery),
        has_free_shipping: Boolean(record.freeCargo),
        follower_count: null,
        stock_quantity:
          toFiniteNumber(getNestedValue(variantRecord, ["quantity"])) ??
          toFiniteNumber(getNestedValue(record, ["quantity"])) ??
          null,
        price: priceData.price,
        original_price: priceData.original_price,
        discount_rate: priceData.discount_rate,
        promotion_labels:
          parsePromotionLabels(record.promotions) ||
          parsePromotionLabels(getNestedValue(variantRecord, ["promotions"])),
        listing_url: cleanText(record.url as string | null),
      };

      return offer;
    })
    .filter((offer): offer is OtherSellerOffer => !!offer && !!offer.seller_name);

  const scoredSellers = offers.filter(
    (offer) => typeof offer.seller_score === "number" && Number.isFinite(offer.seller_score)
  );
  const pricedSellers = offers.filter(
    (offer) => typeof offer.price === "number" && Number.isFinite(offer.price)
  );

  const minPrice =
    pricedSellers.length > 0
      ? Number(Math.min(...pricedSellers.map((offer) => offer.price as number)).toFixed(2))
      : null;
  const maxPrice =
    pricedSellers.length > 0
      ? Number(Math.max(...pricedSellers.map((offer) => offer.price as number)).toFixed(2))
      : null;
  const avgPrice =
    pricedSellers.length > 0
      ? Number(
          (
            pricedSellers.reduce((total, offer) => total + (offer.price as number), 0) /
            pricedSellers.length
          ).toFixed(2)
        )
      : null;

  const summary: OtherSellersSummary | null =
    offers.length > 0
      ? {
          count: offers.length,
          scored_count: scoredSellers.length,
          avg_score:
            scoredSellers.length > 0
              ? Number(
                  (
                    scoredSellers.reduce(
                      (total, offer) => total + (offer.seller_score as number),
                      0
                    ) / scoredSellers.length
                  ).toFixed(1)
                )
              : null,
          top_score:
            scoredSellers.length > 0
              ? Number(
                  Math.max(...scoredSellers.map((offer) => offer.seller_score as number)).toFixed(1)
                )
              : null,
          official_count: offers.filter((offer) => offer.is_official).length,
          fast_delivery_count: offers.filter((offer) => offer.has_fast_delivery).length,
          high_follower_count: offers.filter(
            (offer) => typeof offer.follower_count === "number" && offer.follower_count >= 1000
          ).length,
          seller_names: offers
            .map((offer) => offer.seller_name)
            .filter((name): name is string => !!name)
            .slice(0, 3),
          min_price: minPrice,
          max_price: maxPrice,
          avg_price: avgPrice,
          cheapest_seller_name:
            minPrice == null
              ? null
              : offers.find((offer) => offer.price === minPrice)?.seller_name ?? null,
          same_price_count:
            typeof currentPrice === "number"
              ? offers.filter((offer) => offer.price === currentPrice).length
              : 0,
          cheaper_count:
            typeof currentPrice === "number"
              ? offers.filter((offer) => typeof offer.price === "number" && offer.price < currentPrice)
                  .length
              : 0,
          more_expensive_count:
            typeof currentPrice === "number"
              ? offers.filter((offer) => typeof offer.price === "number" && offer.price > currentPrice)
                  .length
              : 0,
        }
      : null;

  return {
    seller_name: cleanText(mainMerchantRecord?.name as string | null),
    seller_badges: mergeUniqueStrings(
      parseMerchantBadges(mainMerchantRecord?.merchantBadges),
      parseMerchantBadges(mainMerchantRecord?.merchantMarkers)
    ),
    seller_score:
      toFiniteNumber(getNestedValue(mainMerchantRecord, ["sellerScore", "value"])) ??
      toFiniteNumber(getNestedValue(mainMerchantRecord, ["sellerScore"])) ??
      null,
    follower_count: null,
    official_seller: Boolean(
      getNestedValue(mainMerchantRecord, ["officialName"]) ||
        (parseMerchantBadges(mainMerchantRecord?.merchantMarkers)?.some((badge) =>
          /yetkili|official/i.test(badge)
        ) ?? false)
    ),
    has_video: Boolean(mainMerchantRecord?.videoContentId || merchantListingRecord?.videoContentId),
    question_count: questionCount,
    review_count: reviewCount,
    rating_value: ratingValue,
    rating_breakdown: ratingBreakdown,
    review_snippets: reviewSnippets.snippets,
    qa_snippets: qaSnippets,
    review_summary: reviewSnippets.summary,
    has_campaign: Boolean(promotionLabel || productPromotions),
    campaign_label: promotionLabel || productPromotions,
    promotion_labels: promotionLabels || productPromotionLabels,
    has_free_shipping: winnerHasFreeShipping,
    has_return_info: hasReturnInfo,
    has_specs: hasSpecs,
    variant_count: typeof variantCount === "number" && variantCount > 1 ? variantCount : null,
    image_count: imageCount,
    stock_quantity: stockQuantity,
    stock_status: stockStatus,
    category: categoryPath,
    favorite_count: favoriteCount,
    merchant_id: merchantId,
    listing_id: listingId,
    is_best_seller: typeof bestSellerRank === "number",
    best_seller_rank: bestSellerRank,
    best_seller_badge:
      typeof bestSellerRank === "number" ? `En Cok Satilan #${bestSellerRank}` : null,
    other_seller_offers: offers.length > 0 ? offers : null,
    other_sellers_summary: summary,
  };
}

function extractBrandFromJson(jsonBlocks: unknown[]) {
  for (const obj of jsonBlocks) {
    if (!obj || typeof obj !== "object") continue;
    const record = obj as Record<string, unknown>;
    if (
      record["@type"] === "Product" ||
      (Array.isArray(record["@type"]) && record["@type"].includes("Product"))
    ) {
      const brand = record.brand;
      if (typeof brand === "string") {
        const normalized = normalizeBrand(cleanText(brand));
        if (normalized) return normalized;
      }
      if (brand && typeof brand === "object") {
        const brandName = (brand as Record<string, unknown>).name;
        if (typeof brandName === "string") {
          const normalized = normalizeBrand(cleanText(brandName));
          if (normalized) return normalized;
        }
      }
    }
  }
  return null;
}

function extractPriceFromJson(jsonBlocks: unknown[]) {
  for (const obj of jsonBlocks) {
    if (!obj || typeof obj !== "object") continue;
    const record = obj as Record<string, unknown>;
    if (
      record["@type"] === "Product" ||
      (Array.isArray(record["@type"]) && record["@type"].includes("Product"))
    ) {
      const offers = record.offers;
      const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
      for (const offer of offerList) {
        if (!offer || typeof offer !== "object") continue;
        const price = (offer as Record<string, unknown>).price;
        if (typeof price === "string" || typeof price === "number") {
          const normalized = normalizePriceValue(price);
          if (normalized) return normalized;
        }
      }
    }
  }
  return null;
}

function parsePriceNumber(raw: string | number | null | undefined) {
  const normalized = normalizePriceValue(raw);
  if (!normalized) return null;

  const amountText = normalized.replace(/[^\d.,]/g, "").trim();
  if (!amountText) return null;

  let numeric = amountText;
  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      numeric = numeric.replace(/\./g, "").replace(",", ".");
    } else {
      numeric = numeric.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    const commaDigits = numeric.length - lastComma - 1;
    numeric =
      commaDigits === 2
        ? numeric.replace(/\./g, "").replace(",", ".")
        : numeric.replace(/,/g, "");
  } else if (lastDot > -1) {
    const dotDigits = numeric.length - lastDot - 1;
    if (dotDigits === 3 && numeric.indexOf(".") === lastDot) {
      numeric = numeric.replace(/\./g, "");
    }
  }

  const amount = Number(numeric);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseLooseNumber(raw: string | number | null | undefined) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).replace(/[^\d.,]/g, "").trim();
  if (!text) return null;
  const normalized = text.replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function extractOriginalPriceFromJson(jsonBlocks: unknown[]) {
  for (const obj of jsonBlocks) {
    if (!obj || typeof obj !== "object") continue;
    const record = obj as Record<string, unknown>;
    if (
      record["@type"] === "Product" ||
      (Array.isArray(record["@type"]) && record["@type"].includes("Product"))
    ) {
      const offers = record.offers;
      const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
      for (const offer of offerList) {
        if (!offer || typeof offer !== "object") continue;
        const offerRecord = offer as Record<string, unknown>;
        const candidates = [
          offerRecord.priceBeforeDiscount,
          offerRecord.listPrice,
          offerRecord.highPrice,
        ];

        for (const candidate of candidates) {
          const amount = parsePriceNumber(
            typeof candidate === "string" || typeof candidate === "number"
              ? candidate
              : null
          );
          if (amount) return amount;
        }
      }
    }
  }

  return null;
}

function extractPriceNumberFromStateObjects(
  stateObjects: unknown[],
  candidatePaths: Array<Array<string | number>>
) {
  const amounts: number[] = [];

  for (const obj of stateObjects) {
    for (const path of candidatePaths) {
      const value = getNestedValue(obj, path);
      if (typeof value !== "string" && typeof value !== "number") continue;
      const amount = parsePriceNumber(value);
      if (amount) amounts.push(amount);
    }
  }

  if (amounts.length === 0) return null;
  return Math.max(...amounts);
}

function extractCurrentPriceNumber(
  jsonBlocks: unknown[],
  stateObjects: unknown[],
  html: string
) {
  const jsonPrice = extractPriceFromJson(jsonBlocks);
  const parsedJsonPrice = parsePriceNumber(jsonPrice);
  if (parsedJsonPrice) return parsedJsonPrice;

  const statePrice = extractPriceNumberFromStateObjects(stateObjects, [
    ["product", "price", "sellingPrice"],
    ["product", "price", "discountedPrice"],
    ["product", "sellingPrice"],
    ["product", "discountedPrice"],
    ["productDetail", "price", "sellingPrice"],
    ["productDetail", "price", "discountedPrice"],
    ["result", "price", "sellingPrice"],
    ["result", "price", "discountedPrice"],
    ["props", "pageProps", "product", "price", "sellingPrice"],
    ["props", "pageProps", "product", "price", "discountedPrice"],
  ]);
  if (statePrice) return statePrice;

  const raw = (
    html.match(/"(?:sellingPrice|price|discountedPrice|salePrice)"\s*:\s*"?([0-9.,]+)"?/i) ||
    []
  )[1];

  return parsePriceNumber(cleanText(raw));
}

function extractOriginalPrice(
  $: CheerioAPI,
  decodedHtml: string,
  jsonBlocks: unknown[],
  stateObjects: unknown[],
  currentPrice: number | null
) {
  const candidates: number[] = [];

  const jsonOriginalPrice = extractOriginalPriceFromJson(jsonBlocks);
  if (jsonOriginalPrice) candidates.push(jsonOriginalPrice);

  const stateOriginalPrice = extractPriceNumberFromStateObjects(stateObjects, [
    ["product", "price", "originalPrice"],
    ["product", "price", "listPrice"],
    ["product", "originalPrice"],
    ["product", "listPrice"],
    ["productDetail", "price", "originalPrice"],
    ["productDetail", "price", "listPrice"],
    ["result", "price", "originalPrice"],
    ["result", "price", "listPrice"],
    ["props", "pageProps", "product", "price", "originalPrice"],
    ["props", "pageProps", "product", "price", "listPrice"],
  ]);
  if (stateOriginalPrice) candidates.push(stateOriginalPrice);

  const selectorCandidates = [
    cleanText($('[data-testid="price-original-price"]').first().text()),
    cleanText($('[class*="prc-org"]').first().text()),
    cleanText($('[class*="original-price"]').first().text()),
    cleanText($('[class*="crossed"]').first().text()),
  ];

  for (const candidate of selectorCandidates) {
    const amount = parsePriceNumber(candidate);
    if (amount) candidates.push(amount);
  }

  const regexCandidates = [
    (decodedHtml.match(/"(?:originalPrice|listPrice|priceBeforeDiscount|marketPrice)"\s*:\s*"?([0-9.,]+)"?/i) || [])[1],
  ];

  for (const candidate of regexCandidates) {
    const amount = parsePriceNumber(cleanText(candidate));
    if (amount) candidates.push(amount);
  }

  const validCandidates = candidates.filter((candidate) => {
    if (currentPrice == null) return true;
    return candidate > currentPrice;
  });

  if (validCandidates.length === 0) return null;
  return Math.max(...validCandidates);
}

function calculateDiscountRate(
  originalPrice: number | null,
  currentPrice: number | null
) {
  if (
    originalPrice == null ||
    currentPrice == null ||
    originalPrice <= currentPrice ||
    originalPrice <= 0
  ) {
    return null;
  }

  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

function detectFreeShipping($: CheerioAPI, decodedHtml: string) {
  const selectorText = cleanText(
    [
      $('[data-testid*="cargo"]').text(),
      $('[class*="cargo"]').text(),
      $('[class*="shipping"]').text(),
      $('[class*="delivery"]').text(),
    ].join(" ")
  );

  const combinedText = `${selectorText || ""} ${decodedHtml}`.toLowerCase();

  return (
    combinedText.includes("ücretsiz kargo") ||
    combinedText.includes("ucretsiz kargo") ||
    combinedText.includes("bedava kargo") ||
    /"hasfreecargo"\s*:\s*true/i.test(decodedHtml) ||
    /"freecargo"\s*:\s*true/i.test(decodedHtml)
  );
}

function extractShippingDaysFromJson(jsonBlocks: unknown[]) {
  const candidates: number[] = [];

  for (const obj of jsonBlocks) {
    if (!obj || typeof obj !== "object") continue;
    const record = obj as Record<string, unknown>;
    if (
      record["@type"] !== "Product" &&
      !(Array.isArray(record["@type"]) && record["@type"].includes("Product")) &&
      record["@type"] !== "ProductGroup"
    ) {
      continue;
    }

    const offers = record.offers;
    const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];

    for (const offer of offerList) {
      if (!offer || typeof offer !== "object") continue;
      const offerRecord = offer as Record<string, unknown>;
      const shippingDetails = offerRecord.shippingDetails;
      const shippingList = Array.isArray(shippingDetails)
        ? shippingDetails
        : shippingDetails
        ? [shippingDetails]
        : [];

      for (const shipping of shippingList) {
        if (!shipping || typeof shipping !== "object") continue;
        const shippingRecord = shipping as Record<string, unknown>;
        const deliveryTime = shippingRecord.deliveryTime;
        if (!deliveryTime || typeof deliveryTime !== "object") continue;

        const deliveryRecord = deliveryTime as Record<string, unknown>;
        const handlingTime =
          deliveryRecord.handlingTime && typeof deliveryRecord.handlingTime === "object"
            ? (deliveryRecord.handlingTime as Record<string, unknown>)
            : null;
        const transitTime =
          deliveryRecord.transitTime && typeof deliveryRecord.transitTime === "object"
            ? (deliveryRecord.transitTime as Record<string, unknown>)
            : null;

        const handlingMax =
          handlingTime && typeof handlingTime.maxValue !== "undefined"
            ? parseLooseNumber(handlingTime.maxValue as string | number)
            : null;
        const transitMax =
          transitTime && typeof transitTime.maxValue !== "undefined"
            ? parseLooseNumber(transitTime.maxValue as string | number)
            : null;
        const transitMin =
          transitTime && typeof transitTime.minValue !== "undefined"
            ? parseLooseNumber(transitTime.minValue as string | number)
            : null;

        if (transitMax != null) {
          const totalDays = Math.round((handlingMax ?? 0) + transitMax);
          if (totalDays > 0) candidates.push(totalDays);
          continue;
        }

        if (transitMin != null) {
          const totalDays = Math.round((handlingMax ?? 0) + transitMin);
          if (totalDays > 0) candidates.push(totalDays);
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

function extractStockStatus(
  $: CheerioAPI,
  decodedHtml: string,
  stateObjects: unknown[]
) {
  const combinedText = [
    cleanText($('[class*="stock"]').text()),
    cleanText($('[class*="availability"]').text()),
    cleanText($('[data-testid*="stock"]').text()),
    cleanText(decodedHtml),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  if (
    combinedText.includes("stokta yok") ||
    combinedText.includes("tukendi") ||
    combinedText.includes("out of stock")
  ) {
    return "out_of_stock";
  }

  if (
    combinedText.includes("stokta") ||
    combinedText.includes("hemen teslim") ||
    combinedText.includes("in stock")
  ) {
    return "in_stock";
  }

  const candidatePaths: Array<Array<string | number>> = [
    ["product", "stockStatus"],
    ["product", "availability"],
    ["productDetail", "stockStatus"],
    ["productDetail", "availability"],
    ["result", "stockStatus"],
    ["props", "pageProps", "product", "stockStatus"],
  ];

  for (const obj of stateObjects) {
    for (const path of candidatePaths) {
      const value = getNestedValue(obj, path);
      if (typeof value !== "string") continue;
      const normalized = value.toLowerCase();
      if (normalized.includes("outofstock") || normalized.includes("out_of_stock")) {
        return "out_of_stock";
      }
      if (normalized.includes("instock") || normalized.includes("in_stock")) {
        return "in_stock";
      }
    }
  }

  return null;
}

function extractQuestionCount(
  $: CheerioAPI,
  decodedHtml: string,
  stateObjects: unknown[]
) {
  const counts: number[] = [];
  const seen = new Set<number>();

  const pushCount = (value: number | null) => {
    if (value == null) return;
    if (!Number.isFinite(value) || value < 0 || value > 50000) return;
    const rounded = Math.round(value);
    if (seen.has(rounded)) return;
    seen.add(rounded);
    counts.push(rounded);
  };

  const walkQuestionNodes = (input: unknown, depth = 0) => {
    if (depth > 7 || input == null) return;

    if (Array.isArray(input)) {
      for (const item of input.slice(0, 50)) {
        walkQuestionNodes(item, depth + 1);
      }
      return;
    }

    if (typeof input !== "object") return;

    const record = input as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      if (/^(?:questionCount|totalQuestionCount|qaCount|questionsCount)$/i.test(key)) {
        if (typeof value === "number" || typeof value === "string") {
          pushCount(parseLooseNumber(value));
        }
      }

      if (
        /^(?:questions?|questionAnswer|qa|qna)$/i.test(key) &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        const nestedRecord = value as Record<string, unknown>;
        const nestedCandidates = [
          nestedRecord.totalCount,
          nestedRecord.count,
          nestedRecord.total,
          nestedRecord.size,
          nestedRecord.length,
        ];

        for (const candidate of nestedCandidates) {
          if (typeof candidate === "number" || typeof candidate === "string") {
            pushCount(parseLooseNumber(candidate));
          }
        }
      }

      walkQuestionNodes(value, depth + 1);
    }
  };

  const regexMatches = [
    ...decodedHtml.matchAll(/"(?:questionCount|totalQuestionCount|qaCount)"\s*:\s*(\d+)/gi),
    ...decodedHtml.matchAll(
      /(?:(?:toplam|tum)\s*)?(\d+)\s*(?:soru|soru\s*&\s*cevap|soru-cevap|question(?:s)?)/gi
    ),
    ...decodedHtml.matchAll(
      /(?:soru|soru\s*&\s*cevap|soru-cevap|question(?:s)?)\s*\(?\s*(\d+)\s*\)?/gi
    ),
  ];

  for (const match of regexMatches) {
    pushCount(Number(match[1]));
  }

  const selectorTexts = new Set<string>();

  $(
    [
      '[data-testid*="question"]',
      '[data-testid*="qa"]',
      '[class*="question"]',
      '[class*="qa"]',
      'a[href*="question"]',
      'a[href*="soru"]',
      'button[data-testid*="question"]',
      '[id*="question"]',
    ].join(",")
  ).each((_, el) => {
    const text = cleanText($(el).text());
    if (text) selectorTexts.add(text);
  });

  for (const text of selectorTexts) {
    const lower = text.toLocaleLowerCase("tr-TR");
    if (
      !lower.includes("soru") &&
      !lower.includes("cevap") &&
      !lower.includes("question")
    ) {
      continue;
    }

    const matches = [
      ...text.matchAll(/(\d+)\s*(?:soru|cevap|question)/gi),
      ...text.matchAll(/(?:soru|cevap|question)[^\d]{0,10}(\d+)/gi),
      ...text.matchAll(/\((\d+)\)/g),
    ];

    for (const match of matches) {
      if (match[1]) pushCount(Number(match[1]));
    }
  }

  const candidatePaths: Array<Array<string | number>> = [
    ["product", "questionCount"],
    ["product", "questions", "totalCount"],
    ["product", "questions", "count"],
    ["product", "qa", "totalCount"],
    ["product", "qa", "count"],
    ["product", "socialProof", "questionCount"],
    ["productDetail", "questionCount"],
    ["productDetail", "questions", "totalCount"],
    ["productDetail", "questions", "count"],
    ["productDetail", "qa", "totalCount"],
    ["productDetail", "qa", "count"],
    ["result", "questionCount"],
    ["result", "questions", "totalCount"],
    ["result", "qa", "totalCount"],
    ["props", "pageProps", "product", "questionCount"],
    ["props", "pageProps", "product", "questions", "totalCount"],
    ["props", "pageProps", "productDetail", "questionCount"],
    ["props", "pageProps", "productDetail", "questions", "totalCount"],
  ];

  for (const obj of stateObjects) {
    for (const path of candidatePaths) {
      const value = getNestedValue(obj, path);
      if (typeof value === "number" || typeof value === "string") {
        pushCount(parseLooseNumber(value));
      }
    }

    walkQuestionNodes(obj);
  }

  const stateCount = extractPriceNumberFromStateObjects(stateObjects, candidatePaths);
  pushCount(stateCount);

  if (counts.length === 0) return null;
  return Math.max(...counts);
}

function extractVariantCount(
  $: CheerioAPI,
  decodedHtml: string,
  stateObjects: unknown[]
) {
  const counts: number[] = [];

  for (const obj of stateObjects) {
    const candidatePaths: Array<Array<string | number>> = [
      ["product", "variants"],
      ["product", "variantOptions"],
      ["product", "allVariants"],
      ["productDetail", "variants"],
      ["productDetail", "variantOptions"],
      ["result", "variants"],
      ["props", "pageProps", "product", "variants"],
    ];

    for (const path of candidatePaths) {
      const value = getNestedValue(obj, path);
      if (!Array.isArray(value)) continue;
      if (value.length > 0) counts.push(value.length);
    }
  }

  const selectorGroups = [
    $('[data-testid*="variant"] button, [data-testid*="variant"] a').length,
    $('[class*="variant"] button, [class*="variant"] a').length,
    $('[class*="size"] button, [class*="size"] a').length,
    $('[class*="color"] button, [class*="color"] a').length,
  ].filter((count) => count > 1);

  counts.push(...selectorGroups);

  const regexMatches = [
    ...decodedHtml.matchAll(/"(?:variants|variantOptions)"\s*:\s*\[(.*?)\]/gi),
  ];

  for (const match of regexMatches) {
    const raw = match[1];
    if (!raw) continue;
    const itemCount = (raw.match(/\{/g) || []).length;
    if (itemCount > 1) counts.push(itemCount);
  }

  if (counts.length === 0) return null;
  return Math.max(...counts);
}

function detectVideo(
  $: CheerioAPI,
  decodedHtml: string,
  stateObjects: unknown[]
) {
  if ($("video").length > 0) return true;

  const mediaSelectors = [
    '[data-testid*="video"]',
    '[class*="video"]',
    'source[type*="mp4"]',
    'iframe[src*="youtube.com"]',
    'iframe[src*="youtu.be"]',
  ];

  for (const selector of mediaSelectors) {
    if ($(selector).length > 0) return true;
  }

  if (
    /"(?:videoUrl|productVideoUrl|videoUrls|hasVideo)"\s*:\s*(?:true|"[^"]+")/i.test(
      decodedHtml
    )
  ) {
    return true;
  }

  for (const obj of stateObjects) {
    const candidatePaths: Array<Array<string | number>> = [
      ["product", "videoUrl"],
      ["product", "videoUrls"],
      ["product", "media", "videos"],
      ["productDetail", "videoUrl"],
      ["productDetail", "videoUrls"],
      ["result", "videoUrl"],
      ["props", "pageProps", "product", "videoUrl"],
    ];

    for (const path of candidatePaths) {
      const value = getNestedValue(obj, path);
      if (typeof value === "string" && cleanText(value)) return true;
      if (Array.isArray(value) && value.length > 0) return true;
      if (typeof value === "boolean" && value) return true;
    }
  }

  return false;
}

function detectBrandPage(
  $: CheerioAPI,
  decodedHtml: string,
  brand: string | null
) {
  const brandSlug = slugifyText(brand);
  const candidateHrefs = new Set<string>();

  $('a[href*="-x-b"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) candidateHrefs.add(href);
  });

  const regexMatches = decodedHtml.match(/https?:\/\/www\.trendyol\.com\/[^"\s<>]*-x-b\d+/gi) || [];
  for (const match of regexMatches) {
    candidateHrefs.add(match);
  }

  const normalizedLinks = Array.from(candidateHrefs)
    .map((href) => cleanText(href))
    .filter((href): href is string => !!href);

  if (normalizedLinks.length === 0) return false;
  if (!brandSlug) return true;

  return normalizedLinks.some((href) => href.toLocaleLowerCase("tr-TR").includes(`/${brandSlug}-x-b`));
}

function extractCategory(
  jsonBlocks: unknown[],
  decodedHtml: string
) {
  for (const obj of jsonBlocks) {
    if (!obj || typeof obj !== "object") continue;
    const record = obj as Record<string, unknown>;

    if (record["@type"] === "WebPage") {
      const breadcrumb = record.breadcrumb;
      if (breadcrumb && typeof breadcrumb === "object") {
        const breadcrumbRecord = breadcrumb as Record<string, unknown>;
        const items = Array.isArray(breadcrumbRecord.itemListElement)
          ? breadcrumbRecord.itemListElement
          : [];

        const names = items
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const itemRecord = item as Record<string, unknown>;
            const nestedItem =
              itemRecord.item && typeof itemRecord.item === "object"
                ? (itemRecord.item as Record<string, unknown>)
                : null;
            const name =
              typeof nestedItem?.name === "string"
                ? cleanText(nestedItem.name)
                : null;
            return name;
          })
          .filter((value): value is string => !!value);

        if (names.length >= 3) {
          return names[names.length - 2] || names[names.length - 1] || null;
        }
      }
    }
  }

  const categoryFromTree = cleanText(
    (
      decodedHtml.match(/"product_cat_tree"\s*:\s*"([^"]+)"/i) ||
      decodedHtml.match(/"categoryTree"\s*:\s*"([^"]+)"/i) ||
      []
    )[1]
  );

  if (categoryFromTree) {
    const parts = categoryFromTree
      .split("/")
      .map((part) => cleanText(part))
      .filter((part): part is string => !!part);

    if (parts.length > 0) {
      return parts[parts.length - 1] || parts[0] || null;
    }
  }

  const categoryName = cleanText(
    (
      decodedHtml.match(/"product_categoryname"\s*:\s*"([^"]+)"/i) ||
      decodedHtml.match(/"categoryName"\s*:\s*"([^"]+)"/i) ||
      []
    )[1]
  );

  return categoryName || null;
}

function detectOfficialSeller($: CheerioAPI, decodedHtml: string) {
  const combinedText = [
    cleanText($('[class*="seller"]').text()),
    cleanText($('[class*="merchant"]').text()),
    cleanText($('[data-testid*="seller"]').text()),
    cleanText(decodedHtml),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  return (
    combinedText.includes("resmi satici") ||
    combinedText.includes("yetkili satici") ||
    combinedText.includes("official seller") ||
    /"(?:isOfficialSeller|officialSeller|authorizedSeller)"\s*:\s*true/i.test(
      decodedHtml
    )
  );
}

function detectCampaignSignal($: CheerioAPI, decodedHtml: string) {
  const combinedText = [
    cleanText($('[class*="campaign"]').text()),
    cleanText($('[class*="coupon"]').text()),
    cleanText($('[class*="kupon"]').text()),
    cleanText($('[data-testid*="campaign"]').text()),
    cleanText(decodedHtml),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  return (
    combinedText.includes("kupon") ||
    combinedText.includes("kampanya") ||
    combinedText.includes("sepette indirim") ||
    combinedText.includes("indirim kuponu") ||
    /"(?:hasCoupon|hasCampaign|couponAvailable|campaignAvailable)"\s*:\s*true/i.test(
      decodedHtml
    )
  );
}

function extractCampaignLabel($: CheerioAPI, decodedHtml: string) {
  const selectorTexts = [
    cleanText($('[class*="campaign"]').first().text()),
    cleanText($('[class*="coupon"]').first().text()),
    cleanText($('[class*="kupon"]').first().text()),
    cleanText($('[data-testid*="campaign"]').first().text()),
    cleanText($('[data-testid*="coupon"]').first().text()),
  ].filter((value): value is string => !!value);

  for (const text of selectorTexts) {
    if (text.length >= 4 && text.length <= 120) {
      return text;
    }
  }

  const regexPatterns = [
    /"campaignText"\s*:\s*"([^"]{4,120})"/i,
    /"couponText"\s*:\s*"([^"]{4,120})"/i,
    /"campaignName"\s*:\s*"([^"]{4,120})"/i,
    /"promotionText"\s*:\s*"([^"]{4,120})"/i,
    /"badgeText"\s*:\s*"([^"]{4,120}(?:kupon|kampanya|indirim)[^"]*)"/i,
  ];

  for (const pattern of regexPatterns) {
    const match = decodedHtml.match(pattern);
    const value = cleanText(match?.[1] || null);
    if (value && value.length >= 4 && value.length <= 120) {
      return value;
    }
  }

  const textMatches = [
    ...decodedHtml.matchAll(
      /((?:sepette\s+indirim|indirim\s+kuponu|kupon|kampanya)[^<"\n]{0,80})/gi
    ),
  ];

  for (const match of textMatches) {
    const value = cleanText(match[1] || null);
    if (value && value.length >= 4 && value.length <= 120) {
      return value;
    }
  }

  return null;
}

function extractDeliveryType($: CheerioAPI, decodedHtml: string) {
  const combinedText = [
    cleanText($('[class*="delivery"]').text()),
    cleanText($('[class*="cargo"]').text()),
    cleanText($('[data-testid*="cargo"]').text()),
    cleanText(decodedHtml),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  if (
    combinedText.includes("bugun kargoda") ||
    combinedText.includes("aynı gün kargo") ||
    combinedText.includes("ayni gun kargo")
  ) {
    return "same_day";
  }

  if (
    combinedText.includes("yarin kargoda") ||
    combinedText.includes("ertesi gun") ||
    combinedText.includes("ertesi gün")
  ) {
    return "next_day";
  }

  if (
    combinedText.includes("hizli teslimat") ||
    combinedText.includes("hızlı teslimat")
  ) {
    return "fast_delivery";
  }

  if (
    combinedText.includes("standart teslimat") ||
    combinedText.includes("standart kargo")
  ) {
    return "standard";
  }

  return null;
}

function extractBulletPointCount(
  $: CheerioAPI,
  decodedHtml: string,
  stateObjects: unknown[]
) {
  const counts: number[] = [];

  for (const obj of stateObjects) {
    const candidatePaths: Array<Array<string | number>> = [
      ["product", "attributes"],
      ["product", "starredAttributes"],
      ["productDetail", "attributes"],
      ["productDetail", "starredAttributes"],
      ["result", "attributes"],
      ["props", "pageProps", "product", "attributes"],
    ];

    for (const path of candidatePaths) {
      const value = getNestedValue(obj, path);
      if (!Array.isArray(value)) continue;
      if (value.length > 0) counts.push(value.length);
    }
  }

  const regexMatches = [
    ...decodedHtml.matchAll(/"attributes"\s*:\s*\[(.*?)\]/gi),
  ];

  for (const match of regexMatches) {
    const raw = match[1];
    if (!raw) continue;
    const itemCount = (raw.match(/"key"\s*:/g) || []).length;
    if (itemCount > 0) counts.push(itemCount);
  }

  const selectorCounts = [
    $('[class*="attribute"] li').length,
    $('[class*="attributes"] li').length,
    $('[class*="feature"] li').length,
    $('[class*="description"] li').length,
    $('#product-description li').length,
  ].filter((count) => count > 0 && count <= 30);

  counts.push(...selectorCounts);

  if (counts.length === 0) return null;
  return Math.max(...counts);
}

function extractImagesFromJson(jsonBlocks: unknown[]) {
  const images = new Set<string>();
  for (const obj of jsonBlocks) {
    if (!obj || typeof obj !== "object") continue;
    const record = obj as Record<string, unknown>;
    const image = record.image;
    if (typeof image === "string") {
      const normalized = normalizeImageUrl(image);
      if (normalized) images.add(normalized);
    } else if (Array.isArray(image)) {
      for (const item of image) {
        if (typeof item !== "string") continue;
        const normalized = normalizeImageUrl(item);
        if (normalized) images.add(normalized);
      }
    }
  }
  return Array.from(images);
}

function extractImagesFromStateObjects(stateObjects: unknown[]) {
  const images = new Set<string>();
  const candidatePaths: Array<Array<string | number>> = [
    ["product", "images"],
    ["product", "allImages"],
    ["productDetail", "images"],
    ["productDetail", "allImages"],
    ["result", "images"],
    ["props", "pageProps", "product", "images"],
    ["props", "pageProps", "productDetail", "images"],
  ];
  for (const obj of stateObjects) {
    for (const path of candidatePaths) {
      const value = getNestedValue(obj, path);
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        if (typeof item === "string") {
          const normalized = normalizeImageUrl(item);
          if (normalized) images.add(normalized);
          continue;
        }
        if (!item || typeof item !== "object") continue;
        const imageRecord = item as Record<string, unknown>;
        const possibleValues = [
          imageRecord.url,
          imageRecord.imageUrl,
          imageRecord.src,
          imageRecord.bigImageUrl,
          imageRecord.zoomableUrl,
        ];
        for (const possible of possibleValues) {
          if (typeof possible !== "string") continue;
          const normalized = normalizeImageUrl(possible);
          if (normalized) images.add(normalized);
        }
      }
    }
  }
  return Array.from(images);
}

function extractModelCodeFromStateObjects(stateObjects: unknown[]) {
  const candidates: Array<string | null> = [];
  const candidatePaths: Array<Array<string | number>> = [
    ["product", "productCode"],
    ["product", "modelCode"],
    ["product", "merchantSku"],
    ["product", "stockCode"],
    ["product", "productMainId"],
    ["productDetail", "productCode"],
    ["productDetail", "modelCode"],
    ["productDetail", "merchantSku"],
    ["productDetail", "stockCode"],
    ["result", "product", "modelCode"],
    ["result", "product", "merchantSku"],
    ["data", "product", "modelCode"],
    ["data", "product", "merchantSku"],
    ["props", "pageProps", "product", "productCode"],
    ["props", "pageProps", "product", "modelCode"],
    ["props", "pageProps", "productDetail", "productCode"],
    ["props", "pageProps", "productDetail", "modelCode"],
  ];
  for (const obj of stateObjects) {
    for (const path of candidatePaths) {
      const value = getNestedValue(obj, path);
      if (typeof value === "string" || typeof value === "number") {
        candidates.push(normalizeModelCode(String(value)));
      }
    }
  }
  return candidates;
}

function extractModelCodeFromTables($: CheerioAPI) {
  const labels = ["Model Kodu", "Model", "Ürün Kodu", "Stok Kodu", "SKU", "Kod"];
  const candidates: Array<string | null> = [];
  for (const label of labels) {
    candidates.push(
      normalizeModelCode(
        cleanText(
          $(`tr:contains("${label}") td, th:contains("${label}") + td`)
            .first()
            .text()
        )
      )
    );
    candidates.push(
      normalizeModelCode(
        cleanText(
          $(`[class*="detail"], [class*="attribute"], [class*="spec"]`)
            .filter((_: number, el: unknown) => {
              const text = cleanText($(el as Element).text()) || "";
              return text.toLowerCase().includes(label.toLowerCase());
            })
            .first()
            .text()
        )
      )
    );
  }
  return candidates;
}

// Trendyol'a özgü geçersiz değerler
const TRENDYOL_BLACKLIST = new Set([
  "GTM-NH5WDM3",
  "GTM-NH5WDM3".toLowerCase(),
  "AND-PHN-SMG-A07",
  "AND-PHN-SMG-A07".toLowerCase(),
]);

function isTrendyolCategoryCode(value: string) {
  // AND-XXX-XXX-XXX formatı — Trendyol kategori path kodu
  if (/^AND-[A-Z]{2,5}-[A-Z]{2,5}-[A-Z0-9]{2,10}$/i.test(value)) return true;
  // GTM-XXXXXXXX formatı — Trendyol tracking kodu
  if (/^GTM-[A-Z0-9]{6,}$/i.test(value)) return true;
  // AND / IOS / WIN ile başlayan kategori kodları
  if (/^(AND|IOS|WIN|MAC|LNX)-/i.test(value)) return true;
  return false;
}

function looksLikeNaturalProductPhrase(value: string) {
  const normalized = value.trim();
  if (!normalized) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  const digitCount = (normalized.match(/\d/g) || []).length;
  const upperCount = (normalized.match(/[A-Z]/g) || []).length;

  if (/[-_/]/.test(normalized)) return false;
  if (/^[A-Z0-9]{3,}$/.test(normalized)) return false;
  if (/^[A-Z]{1,4}\d{2,}[A-Z0-9]*$/i.test(normalized)) return false;
  if (/^\d+[A-Z-]+$/i.test(normalized)) return false;

  const titleCaseWords = words.filter((word) => /^[A-Z][a-z]+$/.test(word)).length;

  if (words.length >= 3 && digitCount <= 1) return true;
  if (words.length >= 2 && digitCount === 0) return true;
  if (words.length >= 2 && titleCaseWords === words.length && digitCount <= 1) {
    return true;
  }
  if (words.length >= 2 && upperCount <= 2 && digitCount <= 1) return true;

  return false;
}

function chooseBestModelCode(values: Array<string | null>): string | null {
  for (const value of values) {
    const candidate = normalizeModelCode(value);
    if (!candidate) continue;

    if (candidate.length < 4 || candidate.length > 50) continue;
    if (TRENDYOL_BLACKLIST.has(candidate) || TRENDYOL_BLACKLIST.has(candidate.toUpperCase())) continue;
    if (isTrendyolCategoryCode(candidate)) continue;

    const lower = candidate.toLowerCase();
    if (
      lower === "trendyol" ||
      lower.startsWith("ty") ||
      lower.includes("garanti") ||
      lower.includes("teslimat") ||
      lower.includes("satıcı") ||
      lower.includes("değerlendirme") ||
      lower.includes("yorum") ||
      lower.includes("model")
    ) continue;

    if (looksLikeNaturalProductPhrase(candidate)) continue;
    if (/^\d+$/.test(candidate)) continue;
    if (!/[a-zA-Z]/.test(candidate)) continue;
    if (!/\d/.test(candidate)) continue;

    return candidate;
  }

  return null;
}

function extractSellerFromHtml($: CheerioAPI, decodedHtml: string) {
  const candidates: Array<string | null> = [
    // Trendyol JSON içinden
    normalizeSeller(
      cleanText(
        (decodedHtml.match(/"sellerName"\s*:\s*"([^"]+)"/i) || [])[1]
      )
    ),
    normalizeSeller(
      cleanText(
        (decodedHtml.match(/"merchantName"\s*:\s*"([^"]+)"/i) || [])[1]
      )
    ),
    normalizeSeller(
      cleanText(
        (decodedHtml.match(/"storeName"\s*:\s*"([^"]+)"/i) || [])[1]
      )
    ),
    normalizeSeller(cleanText($('[data-testid="seller-name"]').first().text())),
    normalizeSeller(cleanText($('a[href*="/magaza/"]').first().text())),
    normalizeSeller(cleanText($('[class*="seller"]').first().text())),
  ];

  return pickFirstValid(
    candidates.filter((value) => {
      if (!value) return false;
      const lower = value.toLowerCase();
      return (
        !lower.includes("takip et") &&
        !lower.includes("puan") &&
        !lower.includes("trendyol") &&
        lower.length >= 2
      );
    })
  );
}

export const extractTrendyolFields: PlatformExtractor = ({ $, html }) => {
  // 1. Tüm potansiyel veri kaynaklarını topla
  const decodedHtml = decodeUnicode(html);
  const jsonBlocks = collectJsonBlocks(decodedHtml);
  const stateObjects = collectProductObjectsFromState(decodedHtml);
  const envoyBlocks = collectTrendyolEnvoyProps(decodedHtml);
  const envoyProduct = getTrendyolEnvoyProductRecord(envoyBlocks);

  // 2. En güvenilir kaynak olan "envoy" verisinden öncelikli çıkarım yap
  const currentPriceNumber =
    toFiniteNumber(getNestedValue(envoyProduct, ["price", "discountedPrice", "value"])) ??
    toFiniteNumber(getNestedValue(envoyProduct, ["price", "sellingPrice", "value"])) ??
    extractCurrentPriceNumber(jsonBlocks, stateObjects, decodedHtml);

  const envoySignals = parseOtherSellerOffers(envoyProduct, currentPriceNumber);

  // 3. Veri önceliklendirme ve geri çekilme (fallback) mantığı ile nihai nesneyi oluştur
  // Öncelik Sırası: Envoy Sinyalleri -> Diğer Gömülü JSON'lar -> HTML Kazıma

  const brand =
    normalizeBrand(cleanText(getNestedValue(envoyProduct, ["brand", "name"]) as string)) ??
    extractBrandFromJson(jsonBlocks) ??
    normalizeBrand(cleanText($('meta[property="og:brand"]').attr("content") || null)) ??
    normalizeBrand(cleanText($('[data-testid="brand-name"]').first().text())) ??
    normalizeBrand(cleanText($('a[href*="/marka/"]').first().text())) ??
    normalizeBrand(
      cleanText((decodedHtml.match(/"(?:brand|brandName)"\s*:\s*"([^"]+)"/i) || [])[1])
    );

  const price =
    normalizePriceValue(currentPriceNumber) ??
    extractPriceFromJson(jsonBlocks) ??
    normalizePriceValue(cleanText($('[data-testid="price-current-price"]').first().text())) ??
    normalizePriceValue(cleanText($('[class*="prc-dsc"]').first().text()));

  const originalPrice =
    toFiniteNumber(getNestedValue(envoyProduct, ["price", "originalPrice", "value"])) ??
    extractOriginalPrice($, decodedHtml, jsonBlocks, stateObjects, currentPriceNumber);

  const imageCandidates = new Set<string>();
  (
    (getNestedValue(envoyProduct, ["images"]) as string[]) ||
    extractImagesFromStateObjects(stateObjects) ||
    extractImagesFromJson(jsonBlocks)
  ).forEach((img) => {
    const normalized = normalizeImageUrl(img);
    if (normalized) imageCandidates.add(normalized);
  });

  if (imageCandidates.size < 1) {
    $(
      [
        "img",
        '[class*="gallery"] img',
        '[class*="image"] img',
        '[class*="slider"] img',
        '[class*="carousel"] img',
      ].join(",")
    ).each((_, el) => {
      const element = el as Element;
      const attrs = [
        $(element).attr("src"),
        $(element).attr("data-src"),
        $(element).attr("data-original"),
        $(element).attr("data-image"),
        $(element).attr("data-lazy-src"),
      ];
      for (const attr of attrs) {
        const normalized = normalizeImageUrl(attr || null);
        if (!normalized) continue;
        if (/ty-display|boutique|banners?|logo|avatar/i.test(normalized)) continue;
        imageCandidates.add(normalized);
      }
    });
  }

  const modelCode = chooseBestModelCode([
    getNestedValue(envoyProduct, ["productCode"]) as string,
    getNestedValue(envoyProduct, ["merchantSku"]) as string,
    ...extractModelCodeFromStateObjects(stateObjects),
    ...extractModelCodeFromTables($),
  ]);

  const questionCount = envoySignals.question_count; // Sadece envoy'dan gelen, daha güvenilir.

  return {
    // En güvenilir kaynaktan (envoy) gelenler
    seller_name: envoySignals.seller_name ?? extractSellerFromHtml($, decodedHtml),
    seller_score: envoySignals.seller_score,
    seller_badges: envoySignals.seller_badges,
    review_count: envoySignals.review_count,
    rating_value: envoySignals.rating_value,
    rating_breakdown: envoySignals.rating_breakdown,
    stock_quantity: envoySignals.stock_quantity,
    favorite_count: envoySignals.favorite_count,
    other_seller_offers: envoySignals.other_seller_offers,
    other_sellers_summary: envoySignals.other_sellers_summary,
    merchant_id: envoySignals.merchant_id,
    listing_id: envoySignals.listing_id,
    is_best_seller: envoySignals.is_best_seller,
    best_seller_rank: envoySignals.best_seller_rank,
    best_seller_badge: envoySignals.best_seller_badge,
    review_snippets: envoySignals.review_snippets,
    qa_snippets: envoySignals.qa_snippets,
    review_summary: envoySignals.review_summary,

    // Birden çok kaynaktan, öncelik sırasına göre doldurulanlar
    brand: brand,
    price: price,
    original_price: originalPrice,
    discount_rate: calculateDiscountRate(originalPrice, currentPriceNumber),
    image_count:
      envoySignals.image_count ?? (imageCandidates.size > 0 ? Math.min(imageCandidates.size, 20) : 0),

    // Güvenilirliği artırılmış veya sadeleştirilmiş alanlar
    question_count: typeof questionCount === "number" && questionCount > 0 ? questionCount : null,
    model_code: modelCode, // Daha tutucu `chooseBestModelCode` fonksiyonundan gelir.

    // Fallback'li diğer alanlar
    category: envoySignals.category ?? extractCategory(jsonBlocks, decodedHtml),
    has_free_shipping: envoySignals.has_free_shipping || detectFreeShipping($, decodedHtml),
    shipping_days: extractShippingDaysFromJson(jsonBlocks), // Genellikle sadece JSON-LD'de var.
    variant_count: envoySignals.variant_count ?? extractVariantCount($, decodedHtml, stateObjects),
    has_video: envoySignals.has_video || detectVideo($, decodedHtml, stateObjects),
    has_brand_page: detectBrandPage($, decodedHtml, brand),
    bullet_point_count: extractBulletPointCount($, decodedHtml, stateObjects),
    has_return_info: envoySignals.has_return_info || undefined,
    has_specs: envoySignals.has_specs || undefined,
    stock_status: envoySignals.stock_status ?? extractStockStatus($, decodedHtml, stateObjects),
    official_seller: envoySignals.official_seller || detectOfficialSeller($, decodedHtml),
    has_campaign: envoySignals.has_campaign || detectCampaignSignal($, decodedHtml),
    campaign_label: envoySignals.campaign_label ?? extractCampaignLabel($, decodedHtml),
    promotion_labels: envoySignals.promotion_labels,
    delivery_type: extractDeliveryType($, decodedHtml),
  };
};
