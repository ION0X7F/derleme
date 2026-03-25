import { runPythonJson } from "@/lib/python-runner";
import type {
  ReviewAnalysis,
  ReviewRatingBreakdown,
  ReviewRecordDetailed,
  ReviewScopeAnalysis,
  ReviewSummary,
  ReviewThemeHit,
  ReviewThemes,
  ReviewTimelinePoint,
} from "@/types/analysis";

type FetchReviewAnalysisParams = {
  url: string;
  merchantId: number | null;
  sellerName: string | null;
  otherSellersCount: number | null;
};

type PythonReviewSummary = {
  averageRating?: number | null;
  totalCommentCount?: number | null;
  totalRatingCount?: number | null;
  totalPages?: number | null;
  ratingCounts?: Array<Record<string, unknown>> | null;
  tags?: Array<Record<string, unknown>> | null;
};

type PythonReviewRecord = {
  rate?: number | null;
  rating?: number | null;
  comment?: string | null;
  createdAt?: number | null;
  sellerName?: string | null;
};

type PythonReviewPayload = {
  summary?: PythonReviewSummary | null;
  reviews?: PythonReviewRecord[] | null;
};

type PythonReviewResponse = {
  ok: boolean;
  reviewUrl: string;
  sellerFilterAvailable: boolean;
  general: PythonReviewPayload | null;
  seller: PythonReviewPayload | null;
};

const PYTHON_SCRIPT = String.raw`
import asyncio
import json
import sys
from playwright.async_api import async_playwright

review_url = sys.argv[1]
content_id = sys.argv[2]
merchant_id = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None

API_PREFIX = "https://apigw.trendyol.com/discovery-storefront-trproductgw-service/api/review-read/product-reviews/detailed"

async def fetch_json(page, url):
    return await page.evaluate(
        """async (u) => {
            const response = await fetch(u, { credentials: "include" });
            const text = await response.text();
            let json = null;
            try { json = JSON.parse(text); } catch (error) {}
            return { ok: response.ok, status: response.status, json };
        }""",
        url,
    )

def build_url(page_index, seller_only=False):
    base = f"{API_PREFIX}?contentId={content_id}&page={page_index}&pageSize=20&channelId=1&order=DESC&orderBy=CreatedDate"
    if seller_only and merchant_id:
        base += f"&onlySellerReviews=true&sellerId={merchant_id}"
    return base

async def collect_payload(page, seller_only=False):
    first = await fetch_json(page, build_url(0, seller_only))
    if not first.get("ok") or not isinstance(first.get("json"), dict):
        return None

    root = first["json"]
    result = root.get("result") if isinstance(root.get("result"), dict) else root
    summary = result.get("summary") if isinstance(result, dict) and isinstance(result.get("summary"), dict) else None
    reviews = []
    if isinstance(result, dict) and isinstance(result.get("reviews"), list):
        reviews.extend(result["reviews"])

    total_pages = 1
    if isinstance(summary, dict):
        raw_total_pages = summary.get("totalPages")
        if isinstance(raw_total_pages, int) and raw_total_pages > 0:
            total_pages = raw_total_pages

    max_pages = min(total_pages, 12)
    for page_index in range(1, max_pages):
        item = await fetch_json(page, build_url(page_index, seller_only))
        if not item.get("ok") or not isinstance(item.get("json"), dict):
            break
        item_root = item["json"]
        item_result = item_root.get("result") if isinstance(item_root.get("result"), dict) else item_root
        if isinstance(item_result, dict) and isinstance(item_result.get("reviews"), list):
            reviews.extend(item_result["reviews"])

    compact_reviews = []
    for review in reviews:
        if not isinstance(review, dict):
            continue
        seller = review.get("seller") if isinstance(review.get("seller"), dict) else {}
        compact_reviews.append({
            "rate": review.get("rate") or review.get("rating"),
            "comment": review.get("comment") or review.get("text"),
            "createdAt": review.get("createdAt") or review.get("lastModifiedAt"),
            "sellerName": seller.get("name") if isinstance(seller, dict) else None,
        })

    compact_summary = None
    if isinstance(summary, dict):
        compact_summary = {
            "averageRating": summary.get("averageRating"),
            "totalCommentCount": summary.get("totalCommentCount"),
            "totalRatingCount": summary.get("totalRatingCount"),
            "totalPages": summary.get("totalPages"),
            "ratingCounts": summary.get("ratingCounts") if isinstance(summary.get("ratingCounts"), list) else None,
            "tags": summary.get("tags") if isinstance(summary.get("tags"), list) else None,
        }

    return {
        "summary": compact_summary,
        "reviews": compact_reviews,
    }

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(
            locale="tr-TR",
            service_workers="block",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/146.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()
        await page.goto(review_url, wait_until="domcontentloaded", timeout=60000)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        await page.wait_for_timeout(1500)

        seller_filter_available = False
        try:
            seller_filter_available = await page.get_by_role("button", name="Bu Satıcıdan Alanlar").count() > 0
        except Exception:
            seller_filter_available = False

        general = await collect_payload(page, False)
        seller = None
        if seller_filter_available and merchant_id:
            try:
                await page.get_by_role("button", name="Bu Satıcıdan Alanlar").click()
                await page.wait_for_timeout(1500)
            except Exception:
                pass
            seller = await collect_payload(page, True)
        await browser.close()

    print(json.dumps({
        "ok": True,
        "reviewUrl": review_url,
        "sellerFilterAvailable": seller_filter_available,
        "general": general,
        "seller": seller,
    }, ensure_ascii=False))

asyncio.run(main())
`;

const STOPWORDS = new Set([
  "ve","ile","bir","bu","çok","cok","ama","gibi","için","icin","olan","olarak","daha",
  "hem","de","da","mi","mu","mü","muhteşem","mukemmel","ürün","urun","geldi","oldu",
  "güzel","guzel","iyi","kötü","kotu","harika","teşekkürler","tesekkurler","telefon",
  "cihaz","şey","sey","kadar","sonra","önce","once","bana","bence","olarak","ancak",
  "fakat","veya","ya","her","hiç","hic","biraz","olmuş","olmus","ettim","aldım","aldim",
  "aldık","aldik","ettik","icin","bile","yok","var","gayet","hızlı","hizli",
  "trendyol","teknosa","mediamarkt","medya","markt","turkcell","iletisim","içke",
  "magaza","mağaza","mağazası","magazasi","apple","iphone"
]);

function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
}

function cleanText(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseContentId(url: string) {
  const match = url.match(/-p-(\d+)/i);
  return match?.[1] ?? null;
}

function buildReviewUrl(productUrl: string, merchantId: number | null) {
  const target = new URL(productUrl.startsWith("http") ? productUrl : `https://${productUrl}`);
  const pathname = target.pathname.replace(/\/+$/, "");
  const reviewPath = pathname.endsWith("/yorumlar") ? pathname : `${pathname}/yorumlar`;
  const nextUrl = new URL(`${target.origin}${reviewPath}`);
  const boutiqueId = target.searchParams.get("boutiqueId") ?? "61";
  nextUrl.searchParams.set("boutiqueId", boutiqueId);
  if (merchantId != null) {
    nextUrl.searchParams.set("merchantId", String(merchantId));
  }
  return nextUrl.toString();
}

function normalizeMonthLabel(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toIsoDate(timestamp: number | null) {
  if (timestamp == null || !Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function buildRatingBreakdown(summary: PythonReviewSummary | null | undefined): ReviewRatingBreakdown | null {
  const empty: ReviewRatingBreakdown = {
    one_star: null,
    two_star: null,
    three_star: null,
    four_star: null,
    five_star: null,
    total: toNumber(summary?.totalRatingCount),
  };

  const counts = Array.isArray(summary?.ratingCounts) ? summary?.ratingCounts : null;
  if (!counts || counts.length === 0) {
    return empty.total != null ? empty : null;
  }

  for (const item of counts) {
    const rate = toNumber((item as Record<string, unknown>).rate ?? (item as Record<string, unknown>).rating);
    const count = toNumber((item as Record<string, unknown>).count ?? (item as Record<string, unknown>).totalCount);
    if (rate == null || count == null) continue;
    if (rate === 1) empty.one_star = count;
    if (rate === 2) empty.two_star = count;
    if (rate === 3) empty.three_star = count;
    if (rate === 4) empty.four_star = count;
    if (rate === 5) empty.five_star = count;
  }

  const total =
    (empty.one_star ?? 0) +
    (empty.two_star ?? 0) +
    (empty.three_star ?? 0) +
    (empty.four_star ?? 0) +
    (empty.five_star ?? 0);

  empty.total = empty.total ?? (total > 0 ? total : null);
  return empty;
}

function buildRatingBreakdownFromRecords(records: ReviewRecordDetailed[]): ReviewRatingBreakdown | null {
  if (records.length === 0) return null;
  const breakdown: ReviewRatingBreakdown = {
    one_star: 0,
    two_star: 0,
    three_star: 0,
    four_star: 0,
    five_star: 0,
    total: records.length,
  };

  for (const record of records) {
    if (record.rating === 1) breakdown.one_star = (breakdown.one_star ?? 0) + 1;
    if (record.rating === 2) breakdown.two_star = (breakdown.two_star ?? 0) + 1;
    if (record.rating === 3) breakdown.three_star = (breakdown.three_star ?? 0) + 1;
    if (record.rating === 4) breakdown.four_star = (breakdown.four_star ?? 0) + 1;
    if (record.rating === 5) breakdown.five_star = (breakdown.five_star ?? 0) + 1;
  }

  return breakdown;
}

function normalizeReviewRecords(reviews: PythonReviewRecord[] | null | undefined): ReviewRecordDetailed[] {
  if (!Array.isArray(reviews)) return [];
  return reviews
    .map((review) => {
      const rating = toNumber(review.rate ?? review.rating);
      const text = cleanText(review.comment);
      const createdAt = toNumber(review.createdAt);
      const sellerName = cleanText(review.sellerName);
      if (!text && rating == null) return null;
      return {
        rating,
        text,
        created_at: toIsoDate(createdAt),
        seller_name: sellerName,
      } satisfies ReviewRecordDetailed;
    })
    .filter((item): item is ReviewRecordDetailed => item !== null);
}

function buildReviewSummary(records: ReviewRecordDetailed[]): ReviewSummary | null {
  if (records.length === 0) return null;
  const low = records.filter((record) => typeof record.rating === "number" && record.rating <= 2).length;
  const positive = records.filter((record) => typeof record.rating === "number" && record.rating >= 4).length;
  const negative = records.filter((record) => typeof record.rating === "number" && record.rating <= 2).length;
  return {
    sampled_count: records.length,
    low_rated_count: low,
    positive_count: positive,
    negative_count: negative,
  };
}

function buildMonthlyTrend(records: ReviewRecordDetailed[]): ReviewTimelinePoint[] | null {
  if (records.length === 0) return null;
  const buckets = new Map<string, { count: number; low: number; ratingSum: number; ratingCount: number }>();

  for (const record of records) {
    if (!record.created_at) continue;
    const timestamp = Date.parse(record.created_at);
    if (!Number.isFinite(timestamp)) continue;
    const key = normalizeMonthLabel(timestamp);
    const current = buckets.get(key) ?? { count: 0, low: 0, ratingSum: 0, ratingCount: 0 };
    current.count += 1;
    if (typeof record.rating === "number" && record.rating <= 2) current.low += 1;
    if (typeof record.rating === "number") {
      current.ratingSum += record.rating;
      current.ratingCount += 1;
    }
    buckets.set(key, current);
  }

  const trend = Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, value]) => ({
      month,
      count: value.count,
      low_rated_count: value.low,
      average_rating:
        value.ratingCount > 0 ? Number((value.ratingSum / value.ratingCount).toFixed(2)) : null,
    }));

  return trend.length > 0 ? trend : null;
}

function tokenize(text: string) {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9çğıöşü\s]/gi, " ")
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 3 &&
        !STOPWORDS.has(token) &&
        !/^\d+$/.test(token) &&
        !/^[a-z]*\d+[a-z\d]*$/i.test(token)
    );
}

function extractPhraseHits(records: ReviewRecordDetailed[], mode: "positive" | "negative"): ReviewThemeHit[] | null {
  const filtered = records.filter((record) => {
    if (typeof record.rating !== "number") return false;
    return mode === "positive" ? record.rating >= 4 : record.rating <= 2;
  });

  if (filtered.length === 0) return null;

  const counts = new Map<string, number>();
  for (const record of filtered) {
    if (!record.text) continue;
    const tokens = tokenize(record.text);
    for (let index = 0; index < tokens.length; index += 1) {
      const unigram = tokens[index];
      counts.set(unigram, (counts.get(unigram) ?? 0) + 1);
      const next = tokens[index + 1];
      if (next) {
        const bigram = `${unigram} ${next}`;
        counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
      }
    }
  }

  const hits = Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));

  return hits.length > 0 ? hits : null;
}

function buildThemesFromHits(
  positiveHits: ReviewThemeHit[] | null,
  negativeHits: ReviewThemeHit[] | null
): ReviewThemes | null {
  const positive = positiveHits?.map((item) => item.label).slice(0, 4) ?? [];
  const negative = negativeHits?.map((item) => item.label).slice(0, 4) ?? [];
  if (positive.length === 0 && negative.length === 0) return null;
  return { positive, negative };
}

function buildScopeAnalysis(
  scope: "product" | "seller",
  payload: PythonReviewPayload | null,
  sellerName: string | null
): ReviewScopeAnalysis | null {
  if (!payload) return null;

  const records = normalizeReviewRecords(payload.reviews);
  const summary = payload.summary ?? null;
  const positiveHits = extractPhraseHits(records, "positive");
  const negativeHits = extractPhraseHits(records, "negative");
  const reviewSummary = buildReviewSummary(records);
  const sampleAverage =
    records.length > 0
      ? Number(
          (
            records.reduce((sum, record) => sum + (typeof record.rating === "number" ? record.rating : 0), 0) /
            Math.max(
              1,
              records.filter((record) => typeof record.rating === "number").length
            )
          ).toFixed(2)
        )
      : null;
  const sampleBreakdown = buildRatingBreakdownFromRecords(records);
  const preferSampleBackedValues = scope === "seller" && records.length > 0;

  return {
    scope,
    seller_name: sellerName,
    average_rating: preferSampleBackedValues ? sampleAverage : toNumber(summary?.averageRating),
    total_comment_count: preferSampleBackedValues ? records.length : toNumber(summary?.totalCommentCount),
    total_rating_count: preferSampleBackedValues ? records.length : toNumber(summary?.totalRatingCount),
    rating_breakdown: preferSampleBackedValues ? sampleBreakdown : buildRatingBreakdown(summary),
    review_summary: reviewSummary,
    review_themes: buildThemesFromHits(positiveHits, negativeHits),
    top_positive_review_hits: positiveHits,
    top_negative_review_hits: negativeHits,
    monthly_trend: buildMonthlyTrend(records),
    recent_reviews: records.slice(0, 40),
  };
}

export async function fetchTrendyolReviewAnalysis(
  params: FetchReviewAnalysisParams
): Promise<ReviewAnalysis | null> {
  const contentId = parseContentId(params.url);
  if (!contentId) return null;

  const reviewUrl = buildReviewUrl(params.url, params.merchantId);
  const payload = (await runPythonJson({
    script: PYTHON_SCRIPT,
    args: [reviewUrl, contentId, params.merchantId != null ? String(params.merchantId) : ""],
    cwd: process.cwd(),
  })) as PythonReviewResponse;

  const general = buildScopeAnalysis("product", payload.general, null);
  const seller = buildScopeAnalysis("seller", payload.seller, params.sellerName);

  const uniqueGeneralSellers = new Set(
    (general?.recent_reviews ?? [])
      .map((review) => review.seller_name)
      .filter((value): value is string => hasText(value))
  );

  const isSingleSeller =
    (typeof params.otherSellersCount === "number" && params.otherSellersCount <= 1) ||
    (!payload.sellerFilterAvailable && uniqueGeneralSellers.size <= 1);

  return {
    is_single_seller: isSingleSeller,
    seller_filter_available: payload.sellerFilterAvailable,
    seller_id: params.merchantId,
    seller_name: params.sellerName,
    general,
    seller:
      isSingleSeller && !seller && general
        ? {
            ...general,
            scope: "seller",
            seller_name: params.sellerName,
          }
        : seller,
  };
}
