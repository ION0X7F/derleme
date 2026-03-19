import type { CheerioAPI } from "cheerio";
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

function safeJsonParse<T = unknown>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeBrand(value: string | null) {
  if (!value) return null;

  const normalized = cleanText(
    value
      .replace(/^marka[:\s-]*/i, "")
      .replace(/^brand[:\s-]*/i, "")
  );

  if (!normalized) return null;
  if (normalized.length > 60) return null;

  return normalized;
}

function normalizeSeller(value: string | null) {
  if (!value) return null;

  const normalized = cleanText(
    value
      .replace(/^satıcı[:\s-]*/i, "")
      .replace(/^seller[:\s-]*/i, "")
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
    /^(ürün\s*kodu|model\s*kodu|model\s*numarası|model|stok\s*kodu|stok\s*no|sku|mpn|parça\s*numarası|part\s*number)[:\s-]*/i,
    ""
  );

  if (!normalized) return null;
  if (normalized.length < 2) return null;
  if (normalized.length > 100) return null;
  if (!/[a-zA-Z0-9]/.test(normalized)) return null;

  return normalized;
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
  if (amount < 1 && hasTryCurrency) return null;

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
  if (/sprite|icon|logo|placeholder|transparent|avatar/i.test(cleaned)) {
    return null;
  }

  return cleaned.replace(/\?.*$/, "");
}

function pickFirstValid(values: Array<string | null>) {
  return values.find((value) => !!value && value.length >= 2) ?? null;
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

function collectStateObjects(html: string) {
  const objects: unknown[] = [];

  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/i,
    /window\.__NUXT__\s*=\s*({[\s\S]*?});/i,
    /window\.__NEXT_DATA__\s*=\s*({[\s\S]*?})<\/script>/i,
    /window\.__data\s*=\s*({[\s\S]*?});/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;

    const parsed = safeJsonParse(match[1]);
    if (parsed) objects.push(parsed);
  }

  return objects;
}

function extractBrandFromJsonLd(objects: unknown[]) {
  for (const obj of objects) {
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

function extractPriceFromJsonLd(objects: unknown[]) {
  for (const obj of objects) {
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
        const lowPrice = (offer as Record<string, unknown>).lowPrice;
        const highPrice = (offer as Record<string, unknown>).highPrice;
        const currency = (offer as Record<string, unknown>).priceCurrency;

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
  }

  return null;
}

function extractImagesFromJsonLd(objects: unknown[]) {
  const images = new Set<string>();

  for (const obj of objects) {
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
    ["productDetail", "images"],
    ["product", "imageList"],
    ["productDetail", "imageList"],
    ["props", "pageProps", "product", "images"],
    ["props", "pageProps", "productDetail", "images"],
    ["data", "product", "images"],
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
          imageRecord.fullPath,
          imageRecord.original,
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
    ["product", "sellerSku"],
    ["product", "stockCode"],
    ["product", "mpn"],
    ["productDetail", "productCode"],
    ["productDetail", "modelCode"],
    ["productDetail", "sellerSku"],
    ["productDetail", "stockCode"],
    ["productDetail", "mpn"],
    ["props", "pageProps", "product", "productCode"],
    ["props", "pageProps", "product", "modelCode"],
    ["data", "product", "productCode"],
    ["data", "product", "modelCode"],
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
  const labels = [
    "Marka Model",
    "Model",
    "Model Kodu",
    "Ürün Kodu",
    "Stok Kodu",
    "SKU",
    "MPN",
    "Parça Numarası",
  ];

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
          $('[class*="spec"], [class*="attribute"], [class*="detail"]')
            .filter((_: number, el: unknown) => {
              const text = cleanText($(el).text()) || "";
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

function chooseBestModelCode(values: Array<string | null>) {
  const unique = Array.from(new Set(values.filter(Boolean))) as string[];

  const filtered = unique.filter((value) => {
    if (value.length < 3 || value.length > 100) return false;
    if (!/[a-zA-Z0-9]/.test(value)) return false;

    const lower = value.toLowerCase();

    if (
      lower === "n11" ||
      lower.includes("garanti") ||
      lower.includes("teslimat") ||
      lower.includes("satıcı") ||
      lower.includes("mağaza") ||
      lower.includes("değerlendirme") ||
      lower.includes("yorum")
    ) {
      return false;
    }

    return /[A-Za-z]/.test(value) && /\d/.test(value);
  });

  if (filtered.length === 0) return null;

  filtered.sort((a, b) => {
    const aScore =
      (/[A-Z]/.test(a) ? 2 : 0) +
      (/\d/.test(a) ? 2 : 0) +
      (/[-_/]/.test(a) ? 1 : 0);
    const bScore =
      (/[A-Z]/.test(b) ? 2 : 0) +
      (/\d/.test(b) ? 2 : 0) +
      (/[-_/]/.test(b) ? 1 : 0);

    if (bScore !== aScore) return bScore - aScore;
    return a.length - b.length;
  });

  return filtered[0] ?? null;
}

function extractPriceCandidatesFromHtml(html: string) {
  const candidates: string[] = [];

  const patterns = [
    /"price"\s*:\s*"([0-9]+(?:[.,][0-9]{1,2})?)"/gi,
    /"price"\s*:\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi,
    /"salePrice"\s*:\s*"([0-9]+(?:[.,][0-9]{1,2})?)"/gi,
    /"salePrice"\s*:\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi,
    /"discountedPrice"\s*:\s*"([0-9]+(?:[.,][0-9]{1,2})?)"/gi,
    /"displayPrice"\s*:\s*"([^"]{1,30})"/gi,
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

function extractSellerFromHtml($: CheerioAPI, decodedHtml: string) {
  const candidates: Array<string | null> = [
    normalizeSeller(cleanText($('a[href*="/magaza/"]').first().text())),
    normalizeSeller(cleanText($('[class*="seller"]').first().text())),
    normalizeSeller(cleanText($('[class*="merchant"]').first().text())),
    normalizeSeller(cleanText($('[class*="store"]').first().text())),
    normalizeSeller(
      cleanText(
        (
          decodedHtml.match(
            /"(?:sellerName|merchantName|storeName|seller)"\s*:\s*"([^"]+)"/i
          ) || [])[1]
      )
    ),
  ];

  return pickFirstValid(
    candidates.filter((value) => {
      if (!value) return false;
      const lower = value.toLowerCase();
      return (
        !lower.includes("takip et") &&
        !lower.includes("puan") &&
        !lower.includes("değerlendirme")
      );
    })
  );
}

export const extractN11Fields: PlatformExtractor = ({ $, html }) => {
  const decodedHtml = decodeUnicode(html);
  const jsonLdObjects = collectJsonLdObjects(decodedHtml);
  const stateObjects = collectStateObjects(decodedHtml);

  const brandCandidates: Array<string | null> = [
    extractBrandFromJsonLd(jsonLdObjects),
    normalizeBrand(cleanText($('meta[property="product:brand"]').attr("content") || null)),
    normalizeBrand(cleanText($('meta[name="twitter:data1"]').attr("content") || null)),
    normalizeBrand(cleanText($('[class*="brand"]').first().text())),
    normalizeBrand(cleanText($('a[href*="/marka/"]').first().text())),
    normalizeBrand(
      cleanText(
        (decodedHtml.match(/"(?:brand|brandName|manufacturer)"\s*:\s*"([^"]+)"/i) ||
          [])[1]
      )
    ),
  ];

  const sellerName = extractSellerFromHtml($, decodedHtml);

  const imageCandidates = new Set<string>();

  for (const image of extractImagesFromJsonLd(jsonLdObjects)) {
    imageCandidates.add(image);
  }

  for (const image of extractImagesFromStateObjects(stateObjects)) {
    imageCandidates.add(image);
  }

  $(
    [
      "img",
      '[class*="gallery"] img',
      '[class*="image"] img',
      '[class*="slider"] img',
      '[class*="carousel"] img',
      '[class*="swiper"] img',
    ].join(",")
  ).each((_, el) => {
    const attrs = [
      $(el).attr("src"),
      $(el).attr("data-src"),
      $(el).attr("data-original"),
      $(el).attr("data-image"),
      $(el).attr("data-lazy-src"),
      $(el).attr("data-full"),
      $(el).attr("data-zoom-image"),
    ];

    for (const attr of attrs) {
      const normalized = normalizeImageUrl(attr || null);
      if (!normalized) continue;

      if (/banner|logo|avatar|icon|campaign|store/i.test(normalized)) {
        continue;
      }

      imageCandidates.add(normalized);
    }

    const srcset = $(el).attr("srcset");
    if (srcset) {
      const parts = srcset
        .split(",")
        .map((item) => cleanText(item.split(" ")[0] || null))
        .filter(Boolean) as string[];

      for (const part of parts) {
        const normalized = normalizeImageUrl(part);
        if (!normalized) continue;
        if (/banner|logo|avatar|icon|campaign|store/i.test(normalized)) {
          continue;
        }
        imageCandidates.add(normalized);
      }
    }
  });

  const modelCodeCandidates: Array<string | null> = [
    ...extractModelCodeFromStateObjects(stateObjects),
    ...extractModelCodeFromTables($),
    normalizeModelCode(
      cleanText(
        (decodedHtml.match(
          /"(?:modelCode|productCode|sellerSku|stockCode|mpn|partNumber)"\s*:\s*"([^"]+)"/i
        ) || [])[1]
      )
    ),
  ];

  const priceCandidates: Array<string | null> = [
    extractPriceFromJsonLd(jsonLdObjects),
    normalizePriceValue(cleanText($('[class*="newPrice"]').first().text()), "TRY"),
    normalizePriceValue(cleanText($('[class*="price"]').first().text()), "TRY"),
    normalizePriceValue(cleanText($('[data-testid="price-current"]').first().text()), "TRY"),
    normalizePriceValue(cleanText($('meta[property="product:price:amount"]').attr("content") || null), "TRY"),
    normalizePriceValue(
      cleanText(
        (
          decodedHtml.match(
            /"(?:price|salePrice|discountedPrice|finalPrice)"\s*:\s*"?([0-9.,]+)"?/i
          ) || [])[1]
      ),
      "TRY"
    ),
  ];

  for (const candidate of extractPriceCandidatesFromHtml(decodedHtml)) {
    priceCandidates.push(candidate);
  }

  const brand = pickFirstValid(
    brandCandidates.filter((value) => {
      if (!value) return false;
      const lower = value.toLowerCase();
      return lower !== "n11";
    })
  );

  const modelCode = chooseBestModelCode(modelCodeCandidates);
  const imageCount = imageCandidates.size > 0 ? Math.min(imageCandidates.size, 20) : 0;
  const price = pickFirstValid(priceCandidates);

  return {
    brand,
    seller_name: sellerName,
    image_count: imageCount,
    model_code: modelCode,
    price,
  };
};
