import * as cheerio from "cheerio";

type ExtractedData = {
  title?: string;
  meta_description?: string;
  h1?: string;
  price?: string;
  image_count?: number;
};

function cleanText(value?: string | null) {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function detectPrice($: cheerio.CheerioAPI): string | null {
  const selectors = [
    '[itemprop="price"]',
    '[data-test-id="price-current-price"]',
    ".price",
    ".product-price",
    ".sale-price",
    ".current-price",
    ".discountedPrice",
    ".prc-dsc",
    ".price__current",
  ];

  for (const selector of selectors) {
    const el = $(selector).first();
    const text = cleanText(el.text());
    if (text && /\d/.test(text)) {
      return text;
    }

    const contentAttr = cleanText(el.attr("content"));
    if (contentAttr && /\d/.test(contentAttr)) {
      return contentAttr;
    }
  }

  const bodyText = cleanText($("body").text());
  if (!bodyText) return null;

  const match = bodyText.match(
    /(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?\s?(?:TL|₺)|₺\s?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?)/
  );

  return match?.[0] || null;
}

export function extractPageData(html: string): ExtractedData {
  const $ = cheerio.load(html);

  const title =
    cleanText($("title").first().text()) ||
    cleanText($('meta[property="og:title"]').attr("content"));

  const metaDescription =
    cleanText($('meta[name="description"]').attr("content")) ||
    cleanText($('meta[property="og:description"]').attr("content"));

  const h1 = cleanText($("h1").first().text());

  const price = detectPrice($);

  const imageCount = $("img").length;

  return {
    title: title || undefined,
    meta_description: metaDescription || undefined,
    h1: h1 || undefined,
    price: price || undefined,
    image_count: imageCount || 0,
  };
}