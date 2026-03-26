import type { OtherSellerOffer, OtherSellersSummary } from "@/types/analysis";

type TrendyolSeller = {
  merchant_id: number | null;
  listing_id: string | null;
  seller_name: string | null;
  seller_badges: string[] | null;
  seller_score: number | null;
  is_official: boolean;
  has_fast_delivery: boolean;
  has_free_shipping: boolean;
  follower_count: number | null;
  stock_quantity: number | null;
  price: number | null;
  original_price: number | null;
  discount_rate: number | null;
  promotion_labels: string[] | null;
  listing_url: string | null;
};

export type TrendyolApiResult = {
  seller: TrendyolSeller | null;
  other_sellers: OtherSellerOffer[];
  other_sellers_summary: OtherSellersSummary | null;
  original_price: number | null;
  discount_rate: number | null;
  has_free_shipping: boolean;
  variant_count: number | null;
  question_count: number | null;
};

type TrendyolApiSellerRecord = {
  id?: number | null;
  sellerId?: number | null;
  name?: string | null;
  storeName?: string | null;
  score?: number | null;
  sellerScore?: number | null;
  isOfficial?: boolean | null;
  isFastDelivery?: boolean | null;
  freeCargo?: boolean | null;
  freeShipping?: boolean | null;
  hasFreeCargo?: boolean | null;
  followerCount?: number | null;
  url?: string | null;
  sellerBadges?: Array<{ type?: string | null } | string> | null;
  merchantBadges?: Array<{ type?: string | null } | string> | null;
  variants?: Array<{
    price?: TrendyolApiPriceRecord | null;
    freeCargo?: boolean | null;
    hasFreeCargo?: boolean | null;
    listingId?: string | null;
  }> | null;
  price?: TrendyolApiPriceRecord | null;
};

type TrendyolApiPriceRecord = {
  originalPrice?: number | null;
  listPrice?: number | null;
  discountedPrice?: number | null;
  sellingPrice?: number | null;
};

type TrendyolApiProductRecord = {
  seller?: TrendyolApiSellerRecord | null;
  otherSellers?: TrendyolApiSellerRecord[] | null;
  price?: TrendyolApiPriceRecord | null;
  hasFreeCargo?: boolean | null;
  variants?: unknown[] | null;
  questionCount?: number | null;
};

type TrendyolApiResponse = {
  result?: {
    product?: TrendyolApiProductRecord | null;
  } | null;
  seller?: TrendyolApiSellerRecord | null;
  otherSellers?: TrendyolApiSellerRecord[] | null;
  price?: TrendyolApiPriceRecord | null;
  hasFreeCargo?: boolean | null;
  variants?: unknown[] | null;
  questionCount?: number | null;
};

type TrendyolFollowerCountResponse = {
  result?: {
    count?: number | null;
    text?: string | null;
  } | null;
};

function extractContentId(url: string): string | null {
  // p-123456789 formatı
  const match = url.match(/[/-]p-?(\d+)/i);
  if (match?.[1]) return match[1];

  // /urun/...123456789 formatı
  const skuMatch = url.match(/\/(\d{6,12})(?:[?#]|$)/);
  if (skuMatch?.[1]) return skuMatch[1];

  return null;
}

function buildApiHeaders() {
  return {
    "User-Agent":
      "TYMobile/7.0 (Android 13; Samsung Galaxy S21)",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "tr-TR,tr;q=0.9",
    "x-requested-with": "com.trendyol.client",
    Origin: "https://www.trendyol.com",
    Referer: "https://www.trendyol.com/",
  };
}

export async function fetchTrendyolFollowerCountByMerchantId(
  merchantId: number
): Promise<number | null> {
  try {
    const followerUrl = `https://apigw.trendyol.com/discovery-storefront-trproductgw-service/api/sellerstore-follow/${merchantId}/follower-count?culture=tr-TR&channelId=1&checkCoupon=true`;
    const response = await fetch(followerUrl, {
      method: "GET",
      headers: buildApiHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = (await response.json()) as TrendyolFollowerCountResponse;
    const count = toFiniteNumber(data?.result?.count);
    return typeof count === "number" ? Math.round(count) : null;
  } catch {
    return null;
  }
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getPriceValue(price?: TrendyolApiPriceRecord | null) {
  if (!price) return { price: null, originalPrice: null, discountRate: null };

  const originalPrice =
    toFiniteNumber(price.originalPrice) ?? toFiniteNumber(price.listPrice);
  const sellingPrice =
    toFiniteNumber(price.discountedPrice) ?? toFiniteNumber(price.sellingPrice);

  const discountRate =
    typeof originalPrice === "number" &&
    typeof sellingPrice === "number" &&
    originalPrice > sellingPrice
      ? Math.round(((originalPrice - sellingPrice) / originalPrice) * 100)
      : null;

  return {
    price: sellingPrice,
    originalPrice,
    discountRate,
  };
}

function buildBadgeList(
  seller: Pick<
    TrendyolApiSellerRecord,
    "sellerBadges" | "merchantBadges" | "isOfficial" | "isFastDelivery"
  >
) {
  const badges = new Set<string>();

  for (const source of [seller.sellerBadges, seller.merchantBadges]) {
    if (!Array.isArray(source)) continue;
    for (const badge of source) {
      if (typeof badge === "string" && badge.trim()) {
        badges.add(badge.trim());
        continue;
      }
      if (badge && typeof badge === "object" && typeof badge.type === "string" && badge.type.trim()) {
        badges.add(badge.type.trim());
      }
    }
  }

  if (seller.isOfficial) badges.add("Resmi satici");
  if (seller.isFastDelivery) badges.add("Hizli teslimat");

  return Array.from(badges);
}

function normalizeSellerOffer(raw: TrendyolApiSellerRecord): TrendyolSeller {
  const variant = Array.isArray(raw.variants) && raw.variants.length > 0 ? raw.variants[0] : null;
  const priceInfo = getPriceValue(variant?.price ?? raw.price ?? null);
  const hasFreeShipping = Boolean(
    raw.hasFreeCargo ?? raw.freeCargo ?? raw.freeShipping ?? variant?.hasFreeCargo ?? variant?.freeCargo
  );

  return {
    merchant_id: toFiniteNumber(raw.id) ?? toFiniteNumber(raw.sellerId),
    listing_id: typeof variant?.listingId === "string" ? variant.listingId : null,
    seller_name: raw.name || raw.storeName || null,
    seller_badges: buildBadgeList(raw),
    seller_score: toFiniteNumber(raw.score) ?? toFiniteNumber(raw.sellerScore),
    is_official: Boolean(raw.isOfficial),
    has_fast_delivery: Boolean(raw.isFastDelivery),
    has_free_shipping: hasFreeShipping,
    follower_count: toFiniteNumber(raw.followerCount),
    stock_quantity: null,
    price: priceInfo.price,
    original_price: priceInfo.originalPrice,
    discount_rate: priceInfo.discountRate,
    promotion_labels: null,
    listing_url: typeof raw.url === "string" && raw.url.trim() ? raw.url : null,
  };
}

function buildOtherSellersSummary(
  otherSellers: OtherSellerOffer[],
  currentPrice: number | null
): OtherSellersSummary | null {
  if (otherSellers.length === 0) return null;

  const scoredSellers = otherSellers.filter(
    (seller) => typeof seller.seller_score === "number" && Number.isFinite(seller.seller_score)
  );
  const pricedSellers = otherSellers.filter(
    (seller) => typeof seller.price === "number" && Number.isFinite(seller.price)
  );

  const avgScore =
    scoredSellers.length > 0
      ? Number(
          (
            scoredSellers.reduce(
              (total, seller) => total + (seller.seller_score as number),
              0
            ) / scoredSellers.length
          ).toFixed(1)
        )
      : null;

  const topScore =
    scoredSellers.length > 0
      ? Number(
          Math.max(...scoredSellers.map((seller) => seller.seller_score as number)).toFixed(1)
        )
      : null;

  const avgPrice =
    pricedSellers.length > 0
      ? Number(
          (
            pricedSellers.reduce((total, seller) => total + (seller.price as number), 0) /
            pricedSellers.length
          ).toFixed(2)
        )
      : null;

  const minPrice =
    pricedSellers.length > 0
      ? Number(Math.min(...pricedSellers.map((seller) => seller.price as number)).toFixed(2))
      : null;

  const maxPrice =
    pricedSellers.length > 0
      ? Number(Math.max(...pricedSellers.map((seller) => seller.price as number)).toFixed(2))
      : null;

  const cheapestSeller =
    minPrice == null
      ? null
      : pricedSellers.find((seller) => seller.price === minPrice)?.seller_name ?? null;

  const samePriceCount =
    typeof currentPrice === "number"
      ? pricedSellers.filter((seller) => seller.price === currentPrice).length
      : 0;

  const cheaperCount =
    typeof currentPrice === "number"
      ? pricedSellers.filter((seller) => (seller.price as number) < currentPrice).length
      : 0;

  const moreExpensiveCount =
    typeof currentPrice === "number"
      ? pricedSellers.filter((seller) => (seller.price as number) > currentPrice).length
      : 0;

  return {
    count: otherSellers.length,
    scored_count: scoredSellers.length,
    avg_score: avgScore,
    top_score: topScore,
    official_count: otherSellers.filter((seller) => seller.is_official).length,
    fast_delivery_count: otherSellers.filter((seller) => seller.has_fast_delivery).length,
    high_follower_count: otherSellers.filter(
      (seller) =>
        typeof seller.follower_count === "number" && seller.follower_count >= 1000
    ).length,
    min_price: minPrice,
    max_price: maxPrice,
    avg_price: avgPrice,
    cheapest_seller_name: cheapestSeller,
    same_price_count: samePriceCount,
    cheaper_count: cheaperCount,
    more_expensive_count: moreExpensiveCount,
    seller_names: otherSellers
      .map((seller) => seller.seller_name)
      .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
      .slice(0, 3),
  };
}

export async function fetchTrendyolApi(url: string): Promise<TrendyolApiResult | null> {
  try {
    const contentId = extractContentId(url);
    if (!contentId) return null;

    const apiUrl = `https://apigw.trendyol.com/discovery-web-productgw-service/api/product-detail/v2/${contentId}?storefrontId=1&culture=tr-TR&channelId=1`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: buildApiHeaders(),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as TrendyolApiResponse;

    // Ana satıcı
    const sellerData = data?.result?.product?.seller || data?.seller || null;
    const seller: TrendyolSeller | null = sellerData ? normalizeSellerOffer(sellerData) : null;

    if (seller && typeof seller.merchant_id === "number" && seller.follower_count == null) {
      const followerCount = await fetchTrendyolFollowerCountByMerchantId(seller.merchant_id);
      if (typeof followerCount === "number") {
        seller.follower_count = followerCount;
      }
    }

    // Diğer satıcılar
    const otherSellersRaw =
      data?.result?.product?.otherSellers ||
      data?.otherSellers ||
      [];

    const other_sellers: OtherSellerOffer[] = otherSellersRaw
      .slice(0, 10)
      .map((s) => normalizeSellerOffer(s));

    // Fiyat bilgisi
    const priceData =
      data?.result?.product?.price ||
      data?.price ||
      null;

    const original_price =
      priceData?.originalPrice ||
      priceData?.listPrice ||
      null;

    const discounted_price =
      priceData?.discountedPrice ||
      priceData?.sellingPrice ||
      null;

    const discount_rate =
      original_price && discounted_price && original_price > discounted_price
        ? Math.round(((original_price - discounted_price) / original_price) * 100)
        : null;
    const other_sellers_summary = buildOtherSellersSummary(other_sellers, discounted_price);

    // Ücretsiz kargo
    const has_free_shipping =
      data?.result?.product?.hasFreeCargo ||
      data?.hasFreeCargo ||
      false;

    // Varyant sayısı
    const variants =
      data?.result?.product?.variants ||
      data?.variants ||
      [];
    const variant_count = Array.isArray(variants) && variants.length > 1
      ? variants.length
      : null;

    // Soru sayısı
    const question_count =
      data?.result?.product?.questionCount ||
      data?.questionCount ||
      null;

    return {
      seller,
      other_sellers,
      other_sellers_summary,
      original_price,
      discount_rate,
      has_free_shipping,
      variant_count,
      question_count,
    };
  } catch {
    return null;
  }
}
