import * as cheerio from "cheerio";

type ExtractedData = {
  title?: string;
  meta_description?: string;
  meta_description_source?: string;
  search_snippet_fallback?: string;
  h1?: string;
  raw_h1?: string;
  resolved_primary_heading?: string;
  heading_source?: string;
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

function extractMetaDescription($: cheerio.CheerioAPI) {
  const candidates: Array<{ value: string | null; source: string }> = [
    {
      value: cleanText($('meta[name="description"]').attr("content")),
      source: "meta_description",
    },
    {
      value: cleanText($('meta[property="og:description"]').attr("content")),
      source: "og_description",
    },
    {
      value: cleanText($('meta[name="twitter:description"]').attr("content")),
      source: "twitter_description",
    },
    {
      value: cleanText($('meta[itemprop="description"]').attr("content")),
      source: "itemprop_description",
    },
    {
      value: cleanText($('[itemprop="description"]').first().text()),
      source: "itemprop_text",
    },
  ];

  for (const candidate of candidates) {
    if (candidate.value) {
      return candidate;
    }
  }

  return { value: null, source: null as string | null };
}

function cleanHeadingCandidate(value?: string | null) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  const trimmed = cleaned
    .replace(/\s*[|\-–—]\s*(Trendyol|Hepsiburada|Amazon|n11)(\s.*)?$/i, "")
    .replace(/\s*\|\s*Online Alisveris.*$/i, "")
    .trim();

  return trimmed || cleaned;
}

function extractPrimaryHeading($: cheerio.CheerioAPI, title: string | null) {
  const rawH1 = cleanText($("h1").first().text());
  const candidates: Array<{ value: string | null; source: string }> = [
    { value: rawH1, source: "raw_h1" },
    {
      value: cleanHeadingCandidate($('[itemprop="name"]').first().text()),
      source: "itemprop_name",
    },
    {
      value: cleanHeadingCandidate($('[data-testid="product-title"]').first().text()),
      source: "visible_product_title",
    },
    {
      value: cleanHeadingCandidate($('[data-testid="product-name"]').first().text()),
      source: "visible_product_name",
    },
    {
      value: cleanHeadingCandidate($(".product-title").first().text()),
      source: "visible_product_title",
    },
    {
      value: cleanHeadingCandidate($(".product-name").first().text()),
      source: "visible_product_name",
    },
    {
      value: cleanHeadingCandidate($('meta[property="og:title"]').attr("content")),
      source: "og_title",
    },
    {
      value: cleanHeadingCandidate($('meta[name="twitter:title"]').attr("content")),
      source: "twitter_title",
    },
    { value: cleanHeadingCandidate(title), source: "html_title" },
  ];

  for (const candidate of candidates) {
    if (candidate.value) {
      return {
        rawH1,
        resolved: candidate.value,
        source: candidate.source,
      };
    }
  }

  return { rawH1, resolved: null, source: null as string | null };
}

export function extractPageData(html: string): ExtractedData {
  const $ = cheerio.load(html);

  const title =
    cleanText($("title").first().text()) ||
    cleanText($('meta[property="og:title"]').attr("content"));

  const metaDescription = extractMetaDescription($);

  const heading = extractPrimaryHeading($, title);

  const price = detectPrice($);

  const imageCount = $("img").length;

  return {
    title: title || undefined,
    meta_description: metaDescription.value || undefined,
    meta_description_source: metaDescription.source || undefined,
    search_snippet_fallback: undefined,
    h1: heading.resolved || undefined,
    raw_h1: heading.rawH1 || undefined,
    resolved_primary_heading: heading.resolved || undefined,
    heading_source: heading.source || undefined,
    price: price || undefined,
    image_count: imageCount || 0,
  };
}
