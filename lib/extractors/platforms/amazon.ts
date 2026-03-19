import type { PlatformExtractor } from "@/lib/extractors/types";

function cleanText(value: string | undefined | null) {
  if (!value) return null;

  const normalized = value
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

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

function normalizeBrand(value: string | null) {
  if (!value) return null;

  const normalized = cleanText(
    value
      .replace(/^marka[:\s-]*/i, "")
      .replace(/^brand[:\s-]*/i, "")
      .replace(/^visit the\s+/i, "")
      .replace(/\s+store$/i, "")
      .replace(/\s+store'u ziyaret edin$/i, "")
      .replace(/\s+store’u ziyaret edin$/i, "")
      .replace(/\s+mağazası$/i, "")
  );

  if (!normalized) return null;
  if (normalized.length > 60) return null;

  return normalized;
}

function normalizeSeller(value: string | null) {
  if (!value) return null;

  let normalized = cleanText(
    value
      .replace(/^satıcı[:\s-]*/i, "")
      .replace(/^seller[:\s-]*/i, "")
      .replace(/^sold by[:\s-]*/i, "")
      .replace(/^dispatches from[:\s-]*/i, "")
      .replace(/^gönderici[:\s/|,-]*/i, "")
      .replace(/^gönderen[:\s/|,-]*/i, "")
  );

  if (!normalized) return null;

  normalized = normalized
    .replace(/\bAmazon\.com\.tr\s+Amazon\.com\.tr\b/gi, "Amazon.com.tr")
    .replace(/\bGönderici\s*\/\s*Satıcı\b/gi, "")
    .replace(/\bShips from\b/gi, "")
    .replace(/\bSold by\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

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
    /^(ürün\s*kodu|model\s*numarası|model\s*number|sku|asin|mpn|part\s*number|manufacturer\s*part\s*number)[:\s-]*/i,
    ""
  );

  if (!normalized) return null;
  if (normalized.length < 2) return null;
  if (normalized.length > 80) return null;
  if (!/[a-zA-Z0-9]/.test(normalized)) return null;

  return normalized;
}

function safeJsonParse<T = unknown>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function collectJsonLdObjects(html: string) {
  const matches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];

  const objects: unknown[] = [];

  for (const match of matches) {
    const raw = cleanText(match[1]);
    if (!raw) continue;

    const parsed = safeJsonParse(raw);
    if (!parsed) continue;

    if (Array.isArray(parsed)) {
      objects.push(...parsed);
    } else {
      objects.push(parsed);
    }
  }

  return objects;
}

function extractBrandFromJsonLd(objects: unknown[]) {
  for (const obj of objects) {
    if (!obj || typeof obj !== "object") continue;

    const product = obj as Record<string, unknown>;

    if (
      product["@type"] === "Product" ||
      (Array.isArray(product["@type"]) && product["@type"].includes("Product"))
    ) {
      const brand = product.brand;

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

function extractImagesFromJsonLd(objects: unknown[]) {
  const images: string[] = [];

  for (const obj of objects) {
    if (!obj || typeof obj !== "object") continue;

    const product = obj as Record<string, unknown>;
    const image = product.image;

    if (typeof image === "string") {
      images.push(image);
    } else if (Array.isArray(image)) {
      for (const item of image) {
        if (typeof item === "string") images.push(item);
      }
    }
  }

  return images;
}

function extractPriceFromJsonLd(objects: unknown[]) {
  for (const obj of objects) {
    if (!obj || typeof obj !== "object") continue;

    const product = obj as Record<string, unknown>;
    const offers = product.offers;

    const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];

    for (const offer of offerList) {
      if (!offer || typeof offer !== "object") continue;

      const record = offer as Record<string, unknown>;
      const price = record.price;
      const lowPrice = record.lowPrice;
      const highPrice = record.highPrice;
      const currency = record.priceCurrency;

      const candidate =
        typeof price === "string" || typeof price === "number"
          ? String(price)
          : typeof lowPrice === "string" || typeof lowPrice === "number"
          ? String(lowPrice)
          : typeof highPrice === "string" || typeof highPrice === "number"
          ? String(highPrice)
          : null;

      if (!candidate) continue;

      const normalized = normalizePriceValue(candidate, currency);
      if (normalized) return normalized;
    }
  }

  return null;
}

function pickFirstValid(values: Array<string | null>) {
  return values.find((value) => !!value && value.length >= 2) ?? null;
}

function isProbablySellerNoise(value: string | null) {
  if (!value) return true;

  const lower = value.toLowerCase();

  return (
    lower.includes("returns policy") ||
    lower.includes("iade") ||
    lower.includes("teslimat") ||
    lower.includes("gönderici / satıcı") ||
    lower.includes("dispatches from") ||
    lower.includes("sold by amazon.com.tr amazon.com.tr")
  );
}

function extractAmazonSellerFromMerchantBlock(value: string | null) {
  if (!value) return null;

  const text = cleanText(value);
  if (!text) return null;

  const amazonMatch =
    text.match(
      /(?:gönderici\s*\/\s*satıcı|satıcı|sold by|ships from)\s*(Amazon\.com\.tr)/i
    ) || text.match(/\b(Amazon\.com\.tr)\b/i);

  if (amazonMatch?.[1]) {
    return normalizeSeller(amazonMatch[1]);
  }

  const genericMatch =
    text.match(/satıcı\s*[:\-]?\s*([^.|]+?)(?:\s{2,}|$)/i) ||
    text.match(/sold by\s+([^.|]+?)(?:\.\s|$)/i) ||
    text.match(/ships from\s+([^.|]+?)(?:\.\s|$)/i);

  return normalizeSeller(genericMatch?.[1] || null);
}

function normalizeAmazonImageUrl(url: string | null) {
  if (!url) return null;

  const cleaned = cleanText(url);
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) return null;
  if (!/amazon|media-amazon|images-amazon/i.test(cleaned)) return null;
  if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(cleaned)) return null;
  if (/sprite|icon|logo|gif|transparent/i.test(cleaned)) return null;

  return cleaned.replace(/\._[^.]+_\./, ".").replace(/\?.*$/, "");
}

function normalizePriceValue(
  raw: string | number | null | undefined,
  currencyHint?: unknown
) {
  if (raw === null || raw === undefined) return null;

  let text = String(raw)
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;

  const currencyText = String(currencyHint || "").toUpperCase();
  const hasTryCurrency =
    /₺|TL|TRY/i.test(text) || currencyText === "TRY" || currencyText === "TL";

  text = text
    .replace(/Türk\s*Lirası/gi, "TL")
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!text) return null;
  if (!/[\d]/.test(text)) return null;

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

  if (!Number.isFinite(amount)) return null;
  if (amount <= 0) return null;
  if (amount < 10 && hasTryCurrency) return null;

  return `${amount.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function extractPriceFromWholeFraction(
  wholeRaw: string | null,
  fractionRaw: string | null
) {
  const whole = cleanText(wholeRaw)?.replace(/[^\d]/g, "") || "";
  const fraction = cleanText(fractionRaw)?.replace(/[^\d]/g, "") || "";

  if (!whole) return null;

  const merged = fraction ? `${whole}.${fraction.slice(0, 2)}` : whole;
  return normalizePriceValue(merged, "TRY");
}

function isBadPriceContext(text: string) {
  const lower = text.toLowerCase();

  return (
    lower.includes("taksit") ||
    lower.includes("teslimat") ||
    lower.includes("kargo") ||
    lower.includes("shipping") ||
    lower.includes("coupon") ||
    lower.includes("kupon") ||
    lower.includes("indirim") ||
    lower.includes("discount") ||
    lower.includes("puan") ||
    lower.includes("yıldız") ||
    lower.includes("star") ||
    lower.includes("değerlendirme") ||
    lower.includes("review") ||
    lower.includes("reviews") ||
    lower.includes("rating") ||
    lower.includes("adet") ||
    lower.includes("%")
  );
}

function extractPriceCandidatesFromHtml(html: string) {
  const candidates: string[] = [];

  const patterns = [
    /"priceToPay"\s*:\s*\{[\s\S]{0,400}?"priceAmount"\s*:\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi,
    /"priceAmount"\s*:\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi,
    /"displayPrice"\s*:\s*"([^"]{1,30})"/gi,
    /"price"\s*:\s*"([0-9]+(?:[.,][0-9]{1,2})?)"/gi,
    /"price"\s*:\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi,
    /"priceToPay"\s*:\s*"([^"]{1,30})"/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const value = cleanText(match[1]);
      if (!value) continue;

      const normalized = normalizePriceValue(value, "TRY");
      if (normalized) candidates.push(normalized);
    }
  }

  return candidates;
}

function extractPriceNearCurrencyText(html: string) {
  const candidates: string[] = [];

  const patterns = [
    /([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)\s*(?:₺|TL)\b/gi,
    /(?:₺|TL)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)/gi,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:₺|TL)\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const full = cleanText(match[0]);
      const value = cleanText(match[1]);

      if (!full || !value) continue;
      if (isBadPriceContext(full)) continue;

      const normalized = normalizePriceValue(value, "TRY");
      if (normalized) candidates.push(normalized);
    }
  }

  return candidates;
}

function chooseBestPriceCandidate(values: Array<string | null>) {
  const unique = Array.from(new Set(values.filter(Boolean))) as string[];

  if (unique.length === 0) return null;

  const parsed = unique
    .map((value) => {
      const amount = Number(
        value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")
      );

      return {
        value,
        amount,
      };
    })
    .filter((item) => Number.isFinite(item.amount) && item.amount > 0);

  if (parsed.length === 0) return null;

  parsed.sort((a, b) => b.amount - a.amount);

  return parsed[0]?.value ?? null;
}

export const extractAmazonFields: PlatformExtractor = ({ $, html }) => {
  const jsonLdObjects = collectJsonLdObjects(html);
  const decodedHtml = decodeUnicode(html);

  const brandCandidates: Array<string | null> = [
    extractBrandFromJsonLd(jsonLdObjects),
    normalizeBrand(cleanText($("#bylineInfo").first().text())),
    normalizeBrand(cleanText($("#brand").first().text())),
    normalizeBrand(cleanText($('a[id="bylineInfo"]').first().text())),
    normalizeBrand(
      cleanText(
        $('tr:contains("Marka") td, th:contains("Marka") + td').first().text()
      )
    ),
    normalizeBrand(
      cleanText(
        $('tr:contains("Brand") td, th:contains("Brand") + td').first().text()
      )
    ),
    normalizeBrand(
      cleanText(
        (decodedHtml.match(/"(?:brand|manufacturer|Brand)"\s*:\s*"([^"]+)"/i) ||
          [])[1]
      )
    ),
  ];

  const merchantBlockText = cleanText(
    $("#merchantInfoFeature_feature_div").first().text()
  );

  const sellerCandidates: Array<string | null> = [
    normalizeSeller(cleanText($("#sellerProfileTriggerId").first().text())),
    extractAmazonSellerFromMerchantBlock(merchantBlockText),
    normalizeSeller(cleanText($("#tabular-buybox-truncate-1").first().text())),
    normalizeSeller(
      cleanText($('[data-feature-name="merchantInfo"]').first().text())
    ),
    normalizeSeller(
      cleanText(
        (
          decodedHtml.match(
            /"(?:sellerName|seller|merchantName|merchant)"\s*:\s*"([^"]+)"/i
          ) || [])[1]
      )
    ),
  ];

  const imageCandidates = new Set<string>();

  for (const image of extractImagesFromJsonLd(jsonLdObjects)) {
    const normalized = normalizeAmazonImageUrl(image);
    if (normalized) imageCandidates.add(normalized);
  }

  $(
    [
      "#altImages img",
      "#main-image-container img",
      "#imageBlock img",
      "#ebooksImgBlkFront",
      "#imgBlkFront",
      "#main-image",
      '#landingImage',
      'img[data-a-dynamic-image]',
      'img[src*="images-amazon.com"]',
      'img[src*="ssl-images-amazon.com"]',
      'img[src*="media-amazon.com"]',
      'img[data-old-hires]',
    ].join(",")
  ).each((_, el) => {
    const attrs = [
      $(el).attr("src"),
      $(el).attr("data-src"),
      $(el).attr("data-old-hires"),
    ];

    for (const attr of attrs) {
      const value = normalizeAmazonImageUrl(attr || null);
      if (value) imageCandidates.add(value);
    }

    const dynamicImage = $(el).attr("data-a-dynamic-image");
    if (dynamicImage) {
      const urls = [...dynamicImage.matchAll(/"([^"]+)":\s*\[/g)].map(
        (match) => match[1]
      );

      for (const url of urls) {
        const normalized = normalizeAmazonImageUrl(url);
        if (normalized) imageCandidates.add(normalized);
      }
    }
  });

  const modelCodeCandidates: Array<string | null> = [
    normalizeModelCode(cleanText($("#ASIN").val()?.toString() || null)),
    normalizeModelCode(
      cleanText(
        $('tr:contains("ASIN") td, th:contains("ASIN") + td').first().text()
      )
    ),
    normalizeModelCode(
      cleanText(
        $('tr:contains("Model Numarası") td, th:contains("Model Numarası") + td')
          .first()
          .text()
      )
    ),
    normalizeModelCode(
      cleanText(
        $('tr:contains("Model Number") td, th:contains("Model Number") + td')
          .first()
          .text()
      )
    ),
    normalizeModelCode(
      cleanText(
        $('tr:contains("Parça Numarası") td, th:contains("Parça Numarası") + td')
          .first()
          .text()
      )
    ),
    normalizeModelCode(
      cleanText(
        $('tr:contains("Part Number") td, th:contains("Part Number") + td')
          .first()
          .text()
      )
    ),
    normalizeModelCode(
      cleanText((decodedHtml.match(/"asin"\s*:\s*"([^"]+)"/i) || [])[1])
    ),
    normalizeModelCode(
      cleanText(
        (
          decodedHtml.match(
            /"(?:modelNumber|model_number|partNumber|mpn|sku)"\s*:\s*"([^"]+)"/i
          ) || [])[1]
      )
    ),
  ];

  const priceCandidates: Array<string | null> = [
    extractPriceFromJsonLd(jsonLdObjects),

    extractPriceFromWholeFraction(
      cleanText($(".a-price.aok-align-center .a-price-whole").first().text()),
      cleanText($(".a-price.aok-align-center .a-price-fraction").first().text())
    ),
    extractPriceFromWholeFraction(
      cleanText($("#corePrice_feature_div .a-price-whole").first().text()),
      cleanText($("#corePrice_feature_div .a-price-fraction").first().text())
    ),
    extractPriceFromWholeFraction(
      cleanText(
        $("#corePriceDisplay_desktop_feature_div .a-price-whole").first().text()
      ),
      cleanText(
        $("#corePriceDisplay_desktop_feature_div .a-price-fraction")
          .first()
          .text()
      )
    ),
    extractPriceFromWholeFraction(
      cleanText($("#corePriceDisplay_desktop_feature_div .a-offscreen").first().text()),
      null
    ),

    normalizePriceValue(
      cleanText($("#corePrice_feature_div .a-offscreen").first().text()),
      "TRY"
    ),
    normalizePriceValue(
      cleanText(
        $("#corePriceDisplay_desktop_feature_div .a-offscreen").first().text()
      ),
      "TRY"
    ),
    normalizePriceValue(
      cleanText($("#tp_price_block_total_price_ww .a-offscreen").first().text()),
      "TRY"
    ),
    normalizePriceValue(
      cleanText($("#price_inside_buybox").first().text()),
      "TRY"
    ),
    normalizePriceValue(
      cleanText($("#newBuyBoxPrice").first().text()),
      "TRY"
    ),
    normalizePriceValue(
      cleanText($("#priceblock_ourprice").first().text()),
      "TRY"
    ),
    normalizePriceValue(
      cleanText($("#priceblock_dealprice").first().text()),
      "TRY"
    ),
    normalizePriceValue(
      cleanText($("#priceblock_saleprice").first().text()),
      "TRY"
    ),
    normalizePriceValue(
      cleanText($('span[data-a-color="price"]').first().text()),
      "TRY"
    ),
    normalizePriceValue(
      cleanText($('span.a-price[data-a-size="xl"] .a-offscreen').first().text()),
      "TRY"
    ),
    normalizePriceValue(
      cleanText($('span.a-price .a-offscreen').first().text()),
      "TRY"
    ),
    normalizePriceValue(
      cleanText(
        $('[data-csa-c-type="widget"] .a-price .a-offscreen').first().text()
      ),
      "TRY"
    ),
  ];

  for (const candidate of extractPriceCandidatesFromHtml(decodedHtml)) {
    priceCandidates.push(candidate);
  }

  for (const candidate of extractPriceNearCurrencyText(decodedHtml)) {
    priceCandidates.push(candidate);
  }

  const brand = pickFirstValid(
    brandCandidates.filter((value) => {
      if (!value) return false;
      const lower = value.toLowerCase();
      return !lower.includes("ziyaret edin");
    })
  );

  let sellerName = pickFirstValid(
    sellerCandidates.filter((value) => !isProbablySellerNoise(value))
  );

  if (!sellerName) {
    sellerName = extractAmazonSellerFromMerchantBlock(merchantBlockText);
  }

  const modelCode =
    modelCodeCandidates.find(
      (value) =>
        !!value &&
        value.length >= 3 &&
        value.length <= 80 &&
        /[a-zA-Z0-9]/.test(value) &&
        (/[A-Z]/.test(value) || /\d/.test(value))
    ) ?? null;

  const imageCount =
    imageCandidates.size > 0 ? Math.min(imageCandidates.size, 20) : 0;

  const price = chooseBestPriceCandidate(priceCandidates);

  return {
    brand,
    seller_name: sellerName,
    image_count: imageCount,
    model_code: modelCode,
    price,
  };
};