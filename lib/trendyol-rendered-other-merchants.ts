import { runPythonJson } from "@/lib/python-runner";
import type { OtherSellerOffer } from "@/types/analysis";

type RenderedMerchantOffer = {
  merchant_id: number | null;
  listing_id: string | null;
  seller_name: string | null;
  delivery_text: string | null;
  shipping_days: number | null;
  has_fast_delivery: boolean | null;
  promotion_labels: string[] | null;
  listing_url: string | null;
};

const PYTHON_SCRIPT = String.raw`
import asyncio
import json
import re
import sys
from urllib.parse import parse_qs, urlparse
from playwright.async_api import async_playwright

url = sys.argv[1]

def clean_text(value):
    if not value:
        return None
    value = re.sub(r"\s+", " ", value).strip()
    return value or None

def parse_int(value):
    try:
        if value is None:
            return None
        return int(value)
    except Exception:
        return None

def parse_days(text):
    cleaned = clean_text(text)
    if not cleaned:
        return None
    lowered = cleaned.lower()
    match = re.search(r"(\d+)\s*g[üu]n", lowered)
    if match:
        return int(match.group(1))
    if "yarın" in lowered or "yarin" in lowered:
        return 1
    if "aynı gün" in lowered or "ayni gun" in lowered or "bugün" in lowered or "bugun" in lowered:
        return 0
    return None

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
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        try:
            await page.wait_for_selector("#side-other-seller, #other-merchants", timeout=12000)
        except Exception:
            pass
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        await page.wait_for_timeout(2000)
        try:
            see_all_button = page.locator('[data-testid="other-seller-button"]')
            if await see_all_button.count() > 0:
                await see_all_button.first().click()
                await page.wait_for_timeout(1500)
        except Exception:
            pass

        offers = await page.evaluate(
            """() => {
                const cleanText = (value) => {
                    if (!value) return null;
                    const normalized = String(value).replace(/\\s+/g, " ").trim();
                    return normalized || null;
                };
                const parseMerchantId = (href) => {
                    try {
                        const target = new URL(href, location.origin);
                        const merchantId = target.searchParams.get("merchantId") || target.searchParams.get("mid");
                        return merchantId ? Number(merchantId) : null;
                    } catch (error) {
                        return null;
                    }
                };
                const parseListingId = (href) => {
                    try {
                        const target = new URL(href, location.origin);
                        const listingId = target.searchParams.get("sav") || target.searchParams.get("listingId");
                        return cleanText(listingId);
                    } catch (error) {
                        return null;
                    }
                };
                const parsePromotionLabels = (root) => {
                    const labels = new Set();
                    root.querySelectorAll('.promotions-text, .side-other-seller-promotions p, .other-merchant-item-bottom-wrapper p, .other-merchant-item-bottom-wrapper span, [data-testid*="free-cargo"], [data-testid*="promotion"] p, [class*="coupon"] p, [class*="campaign"] p').forEach((node) => {
                        const text = cleanText(node.textContent);
                        if (!text) return;
                        if (text.length < 3 || text.length > 80) return;
                        labels.add(text);
                    });
                    return Array.from(labels);
                };
                const cards = Array.from(document.querySelectorAll('#side-other-seller [data-testid=\"other-seller-item\"], #side-other-seller .other-seller-item-total-container, #other-merchants section > div > div > div, #other-merchants .slider_slide, #other-merchants [class*=\"other-merchant-item-box\"]'));
                const seen = new Set();
                const results = [];
                for (const card of cards) {
                    const sellerName = cleanText(
                        card.querySelector('.other-seller-header-merchant-name')?.textContent ||
                        card.querySelector('[data-testid="merchant-header"]')?.textContent ||
                        card.querySelector('.other-seller-header-header-area')?.textContent ||
                        card.querySelector('.merchant-header-header-container')?.textContent ||
                        card.querySelector('[class*="merchant-header"]')?.textContent
                    );
                    const href =
                        card.querySelector('.other-seller-header-header-area a')?.getAttribute('href') ||
                        card.querySelector('a[data-testid="other-merchant-product-button"]')?.getAttribute('href') ||
                        card.querySelector('a[href*="merchantId="]')?.getAttribute('href') ||
                        card.querySelector('a[href*="mid="]')?.getAttribute('href') ||
                        null;
                    const deliveryText = cleanText(
                        card.querySelector('.side-other-seller-delivery-container')?.textContent ||
                        card.querySelector('.other-merchant-delivery-container')?.textContent ||
                        card.querySelector('[data-testid="normal-delivery"]')?.textContent ||
                        card.querySelector('[class*="delivery-container"]')?.textContent
                    );
                    const key = (sellerName || '') + '::' + (href || '') + '::' + (deliveryText || '');
                    if (!sellerName || seen.has(key)) continue;
                    seen.add(key);
                    const promotionLabels = parsePromotionLabels(card);
                    results.push({
                        seller_name: sellerName,
                        merchant_id: parseMerchantId(href),
                        listing_id: parseListingId(href),
                        delivery_text: deliveryText,
                        promotion_labels: promotionLabels.length ? promotionLabels : null,
                        listing_url: href ? new URL(href, location.origin).toString() : null,
                    });
                }
                return results;
            }"""
        )
        await browser.close()

    normalized = []
    for offer in offers:
        if not isinstance(offer, dict):
            continue
        delivery_text = clean_text(offer.get("delivery_text"))
        normalized.append({
            "merchant_id": parse_int(offer.get("merchant_id")),
            "listing_id": clean_text(offer.get("listing_id")),
            "seller_name": clean_text(offer.get("seller_name")),
            "delivery_text": delivery_text,
            "shipping_days": parse_days(delivery_text),
            "has_fast_delivery": True if parse_days(delivery_text) is not None and parse_days(delivery_text) <= 1 else None,
            "promotion_labels": [item for item in (offer.get("promotion_labels") or []) if clean_text(item)],
            "listing_url": clean_text(offer.get("listing_url")),
        })

    print(json.dumps(normalized, ensure_ascii=False))

asyncio.run(main())
`;

function cleanText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function normalizeSellerKey(value: string | null | undefined) {
  const normalized = cleanText(value);
  if (!normalized) return null;
  return normalized
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const collected: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const key = cleaned.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    collected.push(cleaned);
  }

  return collected.length > 0 ? collected : null;
}

function parseShippingDaysFromText(value: string | null | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const lowered = cleaned.toLocaleLowerCase("tr-TR");
  const dayMatch = lowered.match(/(\d+)\s*g[uü]n/);
  if (dayMatch) return Number(dayMatch[1]);
  if (lowered.includes("yarin")) return 1;
  if (lowered.includes("ayni gun") || lowered.includes("bugun")) return 0;
  return null;
}

function mergeOffer(base: OtherSellerOffer, rendered: RenderedMerchantOffer) {
  const mergedPromotionLabels = uniqueStrings([
    ...(base.promotion_labels ?? []),
    ...(rendered.promotion_labels ?? []),
  ]);
  const deliveryText = cleanText(base.delivery_text ?? rendered.delivery_text);
  const shippingDays =
    typeof base.shipping_days === "number"
      ? base.shipping_days
      : typeof rendered.shipping_days === "number"
        ? rendered.shipping_days
        : parseShippingDaysFromText(deliveryText);

  return {
    ...base,
    listing_url: base.listing_url ?? rendered.listing_url,
    delivery_text: deliveryText,
    shipping_days: shippingDays,
    has_fast_delivery:
      typeof base.has_fast_delivery === "boolean"
        ? base.has_fast_delivery
        : rendered.has_fast_delivery === true || (shippingDays != null && shippingDays <= 1),
    promotion_labels: mergedPromotionLabels,
  };
}

export function shouldFetchRenderedOtherMerchantData(
  offers: OtherSellerOffer[] | null | undefined
) {
  if (!Array.isArray(offers) || offers.length === 0) return false;

  return offers.some((offer) => {
    const hasDeliveryText = cleanText(offer.delivery_text);
    const hasShippingDays =
      typeof offer.shipping_days === "number" && Number.isFinite(offer.shipping_days);
    return !hasDeliveryText || !hasShippingDays;
  });
}

export async function fetchRenderedOtherMerchantData(
  url: string
): Promise<RenderedMerchantOffer[] | null> {
  try {
    const payload = await runPythonJson({
      script: PYTHON_SCRIPT,
      args: [url],
      cwd: process.cwd(),
    });

    if (!Array.isArray(payload)) return null;

    return payload
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        return {
          merchant_id:
            typeof record.merchant_id === "number" && Number.isFinite(record.merchant_id)
              ? record.merchant_id
              : null,
          listing_id: cleanText(record.listing_id as string | null),
          seller_name: cleanText(record.seller_name as string | null),
          delivery_text: cleanText(record.delivery_text as string | null),
          shipping_days:
            typeof record.shipping_days === "number" && Number.isFinite(record.shipping_days)
              ? record.shipping_days
              : null,
          has_fast_delivery:
            typeof record.has_fast_delivery === "boolean"
              ? record.has_fast_delivery
              : null,
          promotion_labels: Array.isArray(record.promotion_labels)
            ? uniqueStrings(
                record.promotion_labels.map((value) =>
                  typeof value === "string" ? value : null
                )
              )
            : null,
          listing_url: cleanText(record.listing_url as string | null),
        } satisfies RenderedMerchantOffer;
      })
      .filter((item): item is RenderedMerchantOffer => !!item && !!item.seller_name);
  } catch {
    return null;
  }
}

export function mergeRenderedOtherMerchantData(
  offers: OtherSellerOffer[] | null | undefined,
  renderedOffers: RenderedMerchantOffer[] | null | undefined
) {
  if (!Array.isArray(offers) || offers.length === 0) return offers ?? null;
  if (!Array.isArray(renderedOffers) || renderedOffers.length === 0) return offers;

  const byMerchantId = new Map<number, RenderedMerchantOffer>();
  const byListingId = new Map<string, RenderedMerchantOffer>();
  const bySellerKey = new Map<string, RenderedMerchantOffer>();

  for (const offer of renderedOffers) {
    if (typeof offer.merchant_id === "number") {
      byMerchantId.set(offer.merchant_id, offer);
    }
    if (offer.listing_id) {
      byListingId.set(offer.listing_id, offer);
    }
    const sellerKey = normalizeSellerKey(offer.seller_name);
    if (sellerKey) {
      bySellerKey.set(sellerKey, offer);
    }
  }

  return offers.map((offer) => {
    const sellerKey = normalizeSellerKey(offer.seller_name);
    const rendered =
      (typeof offer.merchant_id === "number" ? byMerchantId.get(offer.merchant_id) : null) ??
      (offer.listing_id ? byListingId.get(offer.listing_id) : null) ??
      (sellerKey ? bySellerKey.get(sellerKey) : null);

    if (!rendered) return offer;
    return mergeOffer(offer, rendered);
  });
}

const trendyolRenderedOtherMerchants = {
  shouldFetchRenderedOtherMerchantData,
  fetchRenderedOtherMerchantData,
  mergeRenderedOtherMerchantData,
};

export default trendyolRenderedOtherMerchants;
