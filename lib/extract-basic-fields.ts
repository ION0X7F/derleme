import * as cheerio from "cheerio";
import type { ExtractedProductFields } from "@/types/analysis";

type ModelCodeSource =
  | "title"
  | "h1"
  | "jsonld"
  | "description"
  | "specs"
  | "text"
  | null;

type Confidence = "high" | "medium" | "low" | null;

// ── Global model kodu blacklist ──────────────────────────────
const GLOBAL_MODEL_CODE_BLACKLIST = new Set([
  "GTM-NH5WDM3",
  "AND-PHN-SMG-A07",
  "GTM-NH5WDM3".toLowerCase(),
  "AND-PHN-SMG-A07".toLowerCase(),
]);

function isBlacklistedModelCode(value: string) {
  if (GLOBAL_MODEL_CODE_BLACKLIST.has(value)) return true;
  if (GLOBAL_MODEL_CODE_BLACKLIST.has(value.toLowerCase())) return true;
  // GTM-XXXXXXXX formatı — tracking kodu
  if (/^GTM-[A-Z0-9]{6,}$/i.test(value)) return true;
  // AND-XXX-XXX-XXX formatı — kategori path kodu
  if (/^AND-[A-Z]{2,5}-[A-Z]{2,5}-[A-Z0-9]{2,10}$/i.test(value)) return true;
  // AND / IOS / WIN ile başlayan kategori kodları
  if (/^(AND|IOS|WIN|MAC|LNX)-/i.test(value)) return true;
  return false;
}

function cleanText(value: string | undefined | null) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function toLowerSafe(value: string | null | undefined) {
  return (value || "").toLowerCase();
}

function parseNumberLoose(raw: string | null | undefined) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, "").trim();
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
    if (commaDigits === 2) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastDot > -1) {
    const dotDigits = cleaned.length - lastDot - 1;
    if (dotDigits === 3 && cleaned.indexOf(".") === lastDot) {
      normalized = cleaned.replace(/\./g, "");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else {
    normalized = cleaned;
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function formatPrice(amount: number, currency: string | null) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const currencyLabel = currency || "TL";
  return `${amount.toLocaleString("tr-TR", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} ${currencyLabel}`;
}

function detectCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.toUpperCase();
  if (text.includes("TRY") || text.includes("TL") || text.includes("₺")) return "TL";
  if (text.includes("USD") || text.includes("$")) return "USD";
  if (text.includes("EUR") || text.includes("€")) return "EUR";
  if (text.includes("GBP") || text.includes("£")) return "GBP";
  return null;
}

function normalizePrice(value: string | null) {
  if (!value) return null;
  const text = cleanText(value);
  if (!text) return null;
  const amount = parseNumberLoose(text);
  if (!amount || amount < 1) return null;
  const currency = detectCurrency(text) || "TL";
  return {
    amount,
    currency,
    formatted: formatPrice(amount, currency),
  };
}

function extractJson(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) return obj["@graph"] as unknown[];
    return [obj];
  }
  return [];
}

function getStructuredDataNodes($: cheerio.CheerioAPI) {
  const scripts = $('script[type="application/ld+json"]');
  const nodes: Record<string, unknown>[] = [];
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const extracted = extractJson(parsed);
      for (const node of extracted) {
        if (node && typeof node === "object") {
          nodes.push(node as Record<string, unknown>);
        }
      }
    } catch {
      // ignore invalid json-ld
    }
  }
  return nodes;
}

function getStructuredDataTypes(nodes: Record<string, unknown>[]) {
  const types: string[] = [];
  for (const node of nodes) {
    const nodeType = node["@type"];
    if (typeof nodeType === "string") {
      types.push(nodeType);
    } else if (Array.isArray(nodeType)) {
      for (const item of nodeType) {
        if (typeof item === "string") types.push(item);
      }
    }
  }
  return [...new Set(types)];
}

function looksLikeModelCode(value: string) {
  const text = value.trim();
  if (text.length < 4 || text.length > 40) return false;
  if (!/[A-Za-z]/.test(text) || !/\d/.test(text)) return false;
  if (isBlacklistedModelCode(text)) return false;

  // Tarih formatı kontrolü
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return false;
  if (/^\d+-\d+-\d+/.test(text)) return false;

  // Küçük harf ağırlıklı değerler genellikle teknik özellik, model kodu değil
  // Gerçek model kodları büyük harf veya mixed case olur
  const lowerRatio = (text.match(/[a-z]/g) || []).length / text.length;
  if (lowerRatio > 0.6) return false;

  // Bilinen teknik özellik pattern'leri
  const techSpecs = [
    /^\d+\s*gb$/i,    // 128gb, 256gb
    /^\d+\s*mb$/i,    // 512mb
    /^\d+\s*tb$/i,    // 1tb
    /^\d+\s*mah$/i,   // 5000mah
    /^\d+\s*mp$/i,    // 108mp
    /^\d+\s*hz$/i,    // 120hz
    /^\d+\s*w$/i,     // 65w
    /^\d+\s*inch$/i,  // 6inch
    /^\d+-\s*gb$/i,   // 128-gb
    /^\d+-\s*mb$/i,
    /^\d+-\s*tb$/i,
  ];
  if (techSpecs.some((pattern) => pattern.test(text))) return false;

  const upper = text.toUpperCase();
  const blocked = [
    "2024", "2025", "2026",
    "1920X1080", "1080P", "2160P", "4K",
    "5G", "WIFI6", "BLUETOOTH", "TYPE-C", "USB-C",
  ];
  if (blocked.includes(upper)) return false;

  const patterns = [
    /^[A-Z0-9]+(?:-[A-Z0-9]+){1,5}$/,
    /^[A-Z]{1,6}\d{2,}[A-Z0-9-]{0,20}$/,
    /^\d{2,}[A-Z]{1,6}[A-Z0-9-]{0,20}$/,
    /^[A-Z0-9]{4,20}\/[A-Z0-9-]{2,20}$/,
  ];

  return patterns.some((pattern) => pattern.test(upper));
}


function extractModelCodesFromText(text: string | null) {
  if (!text) return [];
  const matches = text.match(
    /\b[A-Za-z0-9]{2,}(?:[-/][A-Za-z0-9]{2,})+\b|\b[A-Za-z]{1,6}\d{2,}[A-Za-z0-9-]{0,20}\b|\b\d{2,}[A-Za-z]{1,6}[A-Za-z0-9-]{0,20}\b/g
  );
  if (!matches) return [];
  return [...new Set(matches.map((item) => item.trim()).filter(looksLikeModelCode))];
}

function pickBestModelCode(candidates: string[]) {
  if (candidates.length === 0) return null;
  const scored = candidates
    .filter((item) => !isBlacklistedModelCode(item))
    .map((item) => {
      let score = 0;
      if (/[A-Za-z]/.test(item) && /\d/.test(item)) score += 3;
      if (item.includes("-") || item.includes("/")) score += 2;
      if (item === item.toUpperCase()) score += 1;
      if (item.length >= 6 && item.length <= 18) score += 1;
      return { item, score };
    });
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score || a.item.length - b.item.length);
  return scored[0]?.item || null;
}

function findModelCodeFromLabeledText(text: string | null) {
  if (!text) return null;
  const patterns = [
    /model(?:\s*no|\s*numarası|\s*kodu)?[:\s]+([A-Za-z0-9-/]{4,40})/i,
    /ürün\s*kodu[:\s]+([A-Za-z0-9-/]{4,40})/i,
    /sku[:\s]+([A-Za-z0-9-/]{4,40})/i,
    /mpn[:\s]+([A-Za-z0-9-/]{4,40})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && looksLikeModelCode(match[1])) {
      return match[1].trim();
    }
  }
  return null;
}

function extractBrand($: cheerio.CheerioAPI, nodes: Record<string, unknown>[]) {
  for (const node of nodes) {
    const brand = node.brand;
    if (typeof brand === "string") return cleanText(brand);
    if (brand && typeof brand === "object") {
      const brandObj = brand as Record<string, unknown>;
      const candidate =
        typeof brandObj.name === "string"
          ? brandObj.name
          : typeof brandObj["@name"] === "string"
          ? brandObj["@name"]
          : null;
      if (candidate) return cleanText(candidate);
    }
  }
  return (
    cleanText($('meta[property="product:brand"]').attr("content")) ||
    cleanText($('meta[name="brand"]').attr("content")) ||
    cleanText($('[itemprop="brand"]').first().text()) ||
    null
  );
}

function extractProductName(
  title: string | null,
  h1: string | null,
  nodes: Record<string, unknown>[]
) {
  for (const node of nodes) {
    if (typeof node.name === "string" && cleanText(node.name)) {
      return cleanText(node.name);
    }
  }
  return h1 || title || null;
}

function extractJsonLdProductSignals(nodes: Record<string, unknown>[]) {
  let price: string | null = null;
  let oldPrice: string | null = null;
  let currency: string | null = null;
  let sku: string | null = null;
  let mpn: string | null = null;
  let gtin: string | null = null;
  let ratingValue: number | null = null;
  let reviewCount: number | null = null;
  let sellerName: string | null = null;
  let stockStatus: string | null = null;

  for (const node of nodes) {
    const offers = node.offers;
    const offerList = Array.isArray(offers)
      ? offers
      : offers && typeof offers === "object"
      ? [offers]
      : [];

    if (typeof node.sku === "string" && !sku) sku = cleanText(node.sku);
    if (typeof node.mpn === "string" && !mpn) mpn = cleanText(node.mpn);

    const gtinKeys = ["gtin", "gtin8", "gtin12", "gtin13", "gtin14"];
    for (const key of gtinKeys) {
      const value = node[key as keyof typeof node];
      if (typeof value === "string" && !gtin) gtin = cleanText(value);
    }

    const aggregateRating = node.aggregateRating;
    if (aggregateRating && typeof aggregateRating === "object") {
      const ratingObj = aggregateRating as Record<string, unknown>;
      if (ratingValue == null && ratingObj.ratingValue != null) {
        const parsed = parseNumberLoose(String(ratingObj.ratingValue));
        if (parsed) ratingValue = parsed;
      }
      if (reviewCount == null && ratingObj.reviewCount != null) {
        const parsed = parseNumberLoose(String(ratingObj.reviewCount));
        if (parsed != null) reviewCount = Math.round(parsed);
      }
      if (reviewCount == null && ratingObj.ratingCount != null) {
        const parsed = parseNumberLoose(String(ratingObj.ratingCount));
        if (parsed != null) reviewCount = Math.round(parsed);
      }
    }

    for (const offer of offerList) {
      if (!offer || typeof offer !== "object") continue;
      const offerObj = offer as Record<string, unknown>;
      const rawCurrency =
        typeof offerObj.priceCurrency === "string"
          ? offerObj.priceCurrency
          : typeof node.priceCurrency === "string"
          ? node.priceCurrency
          : null;

      const candidateValues = [
        offerObj.price,
        offerObj.lowPrice,
        offerObj.highPrice,
        node.price,
      ];

      for (const candidate of candidateValues) {
        if (candidate == null || price) continue;
        const amount = parseNumberLoose(String(candidate));
        if (!amount || amount < 1) continue;
        currency = detectCurrency(rawCurrency || "") || rawCurrency || "TL";
        price = formatPrice(amount, currency);
      }

      const oldPriceCandidates = [
        offerObj.priceBeforeDiscount,
        offerObj.listPrice,
        offerObj.highPrice,
      ];
      for (const candidate of oldPriceCandidates) {
        if (candidate == null || oldPrice) continue;
        const amount = parseNumberLoose(String(candidate));
        if (!amount || amount < 1) continue;
        oldPrice = formatPrice(amount, currency || "TL");
      }

      if (!sellerName) {
        const seller = offerObj.seller;
        if (seller && typeof seller === "object") {
          const sellerObj = seller as Record<string, unknown>;
          if (typeof sellerObj.name === "string") {
            sellerName = cleanText(sellerObj.name);
          }
        }
      }

      if (!stockStatus && typeof offerObj.availability === "string") {
        stockStatus = cleanText(offerObj.availability);
      }
    }
  }

  return { price, oldPrice, currency, sku, mpn, gtin, ratingValue, reviewCount, sellerName, stockStatus };
}

function isLikelyBadPriceText(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("taksit") ||
    lower.includes("kupon") ||
    lower.includes("indirim") ||
    lower.includes("kazanç") ||
    lower.includes("kargo") ||
    lower.includes("teslimat") ||
    lower.includes("shipping") ||
    lower.includes("değerlendirme") ||
    lower.includes("yorum") ||
    lower.includes("review") ||
    lower.includes("rating") ||
    lower.includes("puan") ||
    lower.includes("star") ||
    lower.includes("%")
  );
}

function pickBestPrice(candidates: string[]) {
  const parsed = candidates
    .map((item) => {
      const normalized = normalizePrice(item);
      return normalized ? { text: normalized.formatted!, value: normalized.amount } : null;
    })
    .filter((item): item is { text: string; value: number } => item !== null)
    .filter((item) => item.value >= 1);

  if (parsed.length === 0) return null;

  const unique = Array.from(new Map(parsed.map((item) => [item.text, item])).values());
  unique.sort((a, b) => b.value - a.value);

  const realistic = unique.filter((item) => item.value >= 10);
  if (realistic.length > 0) return realistic[0].text;

  return unique[0].text;
}

function findPrice($: cheerio.CheerioAPI, jsonLdPrice: string | null) {
  if (jsonLdPrice) return jsonLdPrice;

  const selectors = [
    '[itemprop="price"]',
    'meta[property="product:price:amount"]',
    'meta[property="product:price"]',
    'meta[property="og:price:amount"]',
    '[data-test-id="price-current-price"]',
    '[data-testid="price-current-price"]',
    '[data-price]',
    ".prc-dsc",
    ".product-price",
    ".sale-price",
    ".current-price",
    ".discountedPrice",
    ".price__current",
    ".product-detail-price",
    ".productDetailPrice",
    ".new-price",
    ".special-price",
    ".final-price",
    ".a-price .a-offscreen",
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    "#priceblock_saleprice",
    "#corePrice_feature_div .a-offscreen",
    "#corePriceDisplay_desktop_feature_div .a-offscreen",
  ];

  const candidates: string[] = [];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const node = $(el);
      const raw =
        node.attr("content") ||
        node.attr("value") ||
        node.attr("data-price") ||
        node.text();
      const text = cleanText(raw);
      if (!text) return;
      if (isLikelyBadPriceText(text)) return;
      const normalized = normalizePrice(text);
      if (normalized?.formatted) candidates.push(normalized.formatted);
    });
  }

  const bestSelectorPrice = pickBestPrice(candidates);
  if (bestSelectorPrice) return bestSelectorPrice;

  const html = $.html();
  const scriptPatterns = [
    /"discountedPrice"\s*:\s*"([^"]+)"/gi,
    /"salePrice"\s*:\s*"([^"]+)"/gi,
    /"finalPrice"\s*:\s*"([^"]+)"/gi,
    /"priceToPay"\s*:\s*"([^"]+)"/gi,
    /"displayPrice"\s*:\s*"([^"]+)"/gi,
    /"price"\s*:\s*"([^"]+)"/gi,
    /"price"\s*:\s*([0-9]+(?:[.,][0-9]+)?)/gi,
  ];
  const scriptCandidates: string[] = [];

  for (const pattern of scriptPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const raw = cleanText(match[1]);
      if (!raw) continue;
      if (isLikelyBadPriceText(raw)) continue;
      const normalized = normalizePrice(raw);
      if (normalized?.formatted) scriptCandidates.push(normalized.formatted);
    }
  }

  const bestScriptPrice = pickBestPrice(scriptCandidates);
  if (bestScriptPrice) return bestScriptPrice;

  const bodyText = cleanText($("body").text());
  if (bodyText) {
    const regexes = [/₺\s*([\d.,]+)/gi, /([\d.,]+)\s*TL\b/gi];
    const bodyCandidates: string[] = [];
    for (const regex of regexes) {
      const matches = bodyText.matchAll(regex);
      for (const match of matches) {
        const raw = match[1];
        const normalized = normalizePrice(raw ? `${raw} TL` : null);
        if (!normalized?.formatted) continue;
        if (normalized.amount < 10) continue;
        bodyCandidates.push(normalized.formatted);
      }
    }
    const bestBodyPrice = pickBestPrice(bodyCandidates);
    if (bestBodyPrice) return bestBodyPrice;
  }

  return null;
}

function findDescription($: cheerio.CheerioAPI) {
  const selectors = [
    '[data-testid="product-description"]',
    '[data-test-id="product-description"]',
    ".product-description",
    ".productDetailDescription",
    ".product-detail-description",
    ".description",
    ".detail-description",
    "#description",
    '[itemprop="description"]',
  ];
  for (const selector of selectors) {
    const text = cleanText($(selector).first().text());
    if (text && text.length >= 40) return text;
  }
  return (
    cleanText($('meta[name="description"]').attr("content")) ||
    cleanText($('meta[property="og:description"]').attr("content")) ||
    null
  );
}

function hasFaq($: cheerio.CheerioAPI, structuredDataTypes: string[]) {
  if (structuredDataTypes.some((type) => type.toLowerCase().includes("faq"))) return true;
  const bodyText = toLowerSafe(cleanText($("body").text()));
  return (
    bodyText.includes("sıkça sorulan sorular") ||
    bodyText.includes("faq") ||
    bodyText.includes("soru cevap")
  );
}

function extractSpecsText($: cheerio.CheerioAPI) {
  const candidates: string[] = [];
  $("table").each((_, el) => {
    const text = cleanText($(el).text());
    if (text) candidates.push(text);
  });
  const specSelectors = [
    ".specs", ".specifications", ".technical-specifications",
    ".product-specs", ".urun-ozellikleri", ".teknik-ozellikler",
  ];
  for (const selector of specSelectors) {
    const text = cleanText($(selector).text());
    if (text) candidates.push(text);
  }
  return candidates.join(" ");
}

function hasSpecsTable($: cheerio.CheerioAPI) {
  if ($("table").length > 0) return true;
  const bodyText = toLowerSafe(cleanText($("body").text()));
  return (
    bodyText.includes("teknik özellik") ||
    bodyText.includes("özellikler") ||
    bodyText.includes("specifications") ||
    bodyText.includes("ürün özellikleri")
  );
}

function detectBooleanSignal(
  $: cheerio.CheerioAPI,
  selectors: string[],
  keywords: string[]
) {
  for (const selector of selectors) {
    if ($(selector).length > 0) return true;
  }
  const bodyText = toLowerSafe(cleanText($("body").text()));
  return keywords.some((keyword) => bodyText.includes(keyword));
}

function extractModelCode(
  title: string | null,
  h1: string | null,
  description: string | null,
  specsText: string | null,
  bodyText: string | null,
  jsonLdSignals: { sku: string | null; mpn: string | null; gtin: string | null }
): {
  model_code: string | null;
  model_code_source: ModelCodeSource;
  model_code_confidence: Confidence;
} {
  if (jsonLdSignals.mpn && looksLikeModelCode(jsonLdSignals.mpn)) {
    return { model_code: jsonLdSignals.mpn, model_code_source: "jsonld", model_code_confidence: "high" };
  }
  if (jsonLdSignals.sku && looksLikeModelCode(jsonLdSignals.sku)) {
    return { model_code: jsonLdSignals.sku, model_code_source: "jsonld", model_code_confidence: "high" };
  }

  const titleLabeled = findModelCodeFromLabeledText(title);
  if (titleLabeled) return { model_code: titleLabeled, model_code_source: "title", model_code_confidence: "high" };

  const titleCodes = extractModelCodesFromText(title);
  const bestTitle = pickBestModelCode(titleCodes);
  if (bestTitle) return { model_code: bestTitle, model_code_source: "title", model_code_confidence: "medium" };

  const h1Labeled = findModelCodeFromLabeledText(h1);
  if (h1Labeled) return { model_code: h1Labeled, model_code_source: "h1", model_code_confidence: "high" };

  const h1Codes = extractModelCodesFromText(h1);
  const bestH1 = pickBestModelCode(h1Codes);
  if (bestH1) return { model_code: bestH1, model_code_source: "h1", model_code_confidence: "medium" };

  const specsLabeled = findModelCodeFromLabeledText(specsText);
  if (specsLabeled) return { model_code: specsLabeled, model_code_source: "specs", model_code_confidence: "high" };

  const specsCodes = extractModelCodesFromText(specsText);
  const bestSpecs = pickBestModelCode(specsCodes);
  if (bestSpecs) return { model_code: bestSpecs, model_code_source: "specs", model_code_confidence: "medium" };

  const descriptionLabeled = findModelCodeFromLabeledText(description);
  if (descriptionLabeled) return { model_code: descriptionLabeled, model_code_source: "description", model_code_confidence: "medium" };

  const descriptionCodes = extractModelCodesFromText(description);
  const bestDescription = pickBestModelCode(descriptionCodes);
  if (bestDescription) return { model_code: bestDescription, model_code_source: "description", model_code_confidence: "low" };

  

  return { model_code: null, model_code_source: null, model_code_confidence: null };
}

function findSellerName($: cheerio.CheerioAPI, jsonLdSellerName: string | null) {
  if (jsonLdSellerName) return jsonLdSellerName;
  const html = $.html();
  const patterns = [
    /"sellerName"\s*:\s*"([^"]+)"/i,
    /"merchantName"\s*:\s*"([^"]+)"/i,
    /"seller"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  const selectors = [
    ".seller-name", ".merchant-name", ".store-name",
    '[data-testid="seller-name"]',
  ];
  for (const selector of selectors) {
    const text = cleanText($(selector).first().text());
    if (text) return text;
  }
  return null;
}

function findStockStatus($: cheerio.CheerioAPI, jsonLdStockStatus: string | null) {
  if (jsonLdStockStatus) return jsonLdStockStatus;
  const bodyText = toLowerSafe(cleanText($("body").text()));
  if (
    bodyText.includes("stokta yok") ||
    bodyText.includes("tükendi") ||
    bodyText.includes("tukendi") ||
    bodyText.includes("out of stock")
  ) {
    return "out_of_stock";
  }
  if (
    bodyText.includes("stokta") ||
    bodyText.includes("hemen teslim") ||
    bodyText.includes("in stock")
  ) {
    return "in_stock";
  }
  return null;
}

function getImageCount($: cheerio.CheerioAPI) {
  const urls = new Set<string>();
  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-original") ||
      $(el).attr("data-lazy-src");
    if (!src) return;
    if (src.startsWith("data:")) return;
    urls.add(src);
  });
  return urls.size;
}

export function extractBasicFields(html: string): ExtractedProductFields {
  const $ = cheerio.load(html);
  const structuredNodes = getStructuredDataNodes($);
  const structured_data_types = getStructuredDataTypes(structuredNodes);

  const title =
    cleanText($("title").first().text()) ||
    cleanText($('meta[property="og:title"]').attr("content")) ||
    cleanText($('meta[name="twitter:title"]').attr("content"));

  const meta_description =
    cleanText($('meta[name="description"]').attr("content")) ||
    cleanText($('meta[property="og:description"]').attr("content")) ||
    cleanText($('meta[name="twitter:description"]').attr("content"));

  const h1 =
    cleanText($("h1").first().text()) ||
    cleanText($('[itemprop="name"]').first().text()) ||
    cleanText($('meta[property="og:title"]').attr("content"));

  const brand = extractBrand($, structuredNodes);
  const product_name = extractProductName(title, h1, structuredNodes);
  const jsonLdSignals = extractJsonLdProductSignals(structuredNodes);

  const price = findPrice($, jsonLdSignals.price);
  const priceMeta = normalizePrice(price);
  const normalized_price = priceMeta?.amount ?? null;
  const currency =
    jsonLdSignals.currency ||
    priceMeta?.currency ||
    detectCurrency(price) ||
    null;

  const image_count = getImageCount($);
  const description = findDescription($);
  const specsText = cleanText(extractSpecsText($));
  const bodyText = cleanText($("body").text());

  const { model_code } = extractModelCode(
    title, h1, description, specsText, bodyText,
    { sku: jsonLdSignals.sku, mpn: jsonLdSignals.mpn, gtin: jsonLdSignals.gtin }
  );

  const rating_value =
    jsonLdSignals.ratingValue ??
    (() => {
      const selectors = [
        '[itemprop="ratingValue"]', '[data-rating]', '[data-score]',
        ".rating-value", ".review-rating",
      ];
      for (const selector of selectors) {
        const raw =
          $(selector).first().attr("content") ||
          $(selector).first().attr("data-rating") ||
          $(selector).first().text();
        const parsed = parseNumberLoose(raw);
        if (parsed && parsed > 0 && parsed <= 5) return parsed;
      }
      return null;
    })();

  const review_count =
    jsonLdSignals.reviewCount ??
    (() => {
      const selectors = [
        '[itemprop="reviewCount"]', '[itemprop="ratingCount"]',
        ".review-count", ".comments-count", ".rating-count",
      ];
      for (const selector of selectors) {
        const raw = $(selector).first().attr("content") || $(selector).first().text();
        const parsed = parseNumberLoose(raw);
        if (parsed != null && parsed >= 0) return Math.round(parsed);
      }
      return null;
    })();

  const has_add_to_cart = detectBooleanSignal(
    $,
    ['button[name="add"]', '[data-testid="add-to-cart"]', '[data-test-id="add-to-cart"]',
      ".add-to-cart", ".addToCart", ".btn-add-basket", ".add-basket"],
    ["sepete ekle", "add to cart", "add basket", "add-basket"]
  );

  const has_shipping_info = detectBooleanSignal(
    $,
    [".cargo", ".shipping", ".delivery", ".kargo"],
    ["kargo", "aynı gün kargo", "ücretsiz kargo", "teslimat", "shipping", "delivery"]
  );

  const has_return_info = detectBooleanSignal(
    $,
    [".return", ".returns", ".iade"],
    ["iade", "kolay iade", "14 gün", "30 gün", "return", "returns"]
  );

  const has_specs = hasSpecsTable($);
  const has_faq = hasFaq($, structured_data_types);
  const stock_status = findStockStatus($, jsonLdSignals.stockStatus);
  const seller_name = findSellerName($, jsonLdSignals.sellerName);

  return {
    title: title || null,
    meta_description: meta_description || null,
    h1: h1 || null,
    brand: brand || null,
    product_name: product_name || null,
    model_code: model_code || null,
    sku: jsonLdSignals.sku || null,
    mpn: jsonLdSignals.mpn || null,
    gtin: jsonLdSignals.gtin || null,
    price: price || null,
    normalized_price,
    original_price: null,
    discount_rate: null,
    currency: currency || null,
    image_count,
    has_video: false,
    rating_value,
    rating_breakdown: null,
    review_count,
    review_snippets: null,
    qa_snippets: null,
    review_summary: null,
    review_themes: null,
    top_positive_review_hits: null,
    top_negative_review_hits: null,
    question_count: null,
    description_length: description ? description.length : null,
    bullet_point_count: null,
    has_add_to_cart,
    has_shipping_info,
    has_free_shipping: false,
    shipping_days: null,
    has_return_info,
    has_specs,
    has_faq,
    variant_count: null,
    stock_quantity: null,
    stock_status,
    seller_name,
    merchant_id: null,
    listing_id: null,
    seller_badges: null,
    seller_score: null,
    follower_count: null,
    favorite_count: null,
    other_sellers_count: null,
    other_seller_offers: null,
    other_sellers_summary: null,
    has_brand_page: false,
    official_seller: false,
    has_campaign: false,
    campaign_label: null,
    promotion_labels: null,
    delivery_type: null,
    is_best_seller: false,
    best_seller_rank: null,
    best_seller_badge: null,
    category: null,
    extractor_status: "fallback",
    platform: null,
  };
}
