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
      .replace(/^by\s+/i, "")
  );

  if (!normalized) return null;
  if (normalized.length > 60) return null;

  const lower = normalized.toLowerCase();
  if (
    lower === "hepsiburada" ||
    lower === "hepsiburada.com" ||
    lower.includes("resmi satıcısı") ||
    lower.includes("mağazası")
  ) {
    return null;
  }

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

  normalized = normalized.replace(/[-_/]+$/g, "");

  normalized = normalized.replace(
    /^(stok\s*kodu|ürün\s*kodu|model\s*kodu|sku|mpn|product\s*code|üretici\s*kodu|parça\s*numarası)[:\s-]*/i,
    ""
  );

  if (!normalized) return null;
  if (normalized.length < 2) return null;
  if (normalized.length > 80) return null;
  if (!/[a-zA-Z0-9]/.test(normalized)) return null;

  return normalized;
}

function countUnique(values: Array<string | null | undefined>) {
  const set = new Set<string>();

  for (const value of values) {
    const normalized = cleanText(value);
    if (normalized) set.add(normalized);
  }

  return set.size;
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
    if (parsed) {
      if (Array.isArray(parsed)) {
        objects.push(...parsed);
      } else {
        objects.push(parsed);
      }
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

function extractSellerFromJsonLd(objects: unknown[]) {
  for (const obj of objects) {
    if (!obj || typeof obj !== "object") continue;

    const product = obj as Record<string, unknown>;
    const offers = product.offers;
    const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];

    for (const offer of offerList) {
      if (!offer || typeof offer !== "object") continue;

      const seller = (offer as Record<string, unknown>).seller;

      if (typeof seller === "string") {
        const normalized = normalizeSeller(cleanText(seller));
        if (normalized) return normalized;
      }

      if (seller && typeof seller === "object") {
        const sellerName = (seller as Record<string, unknown>).name;
        if (typeof sellerName === "string") {
          const normalized = normalizeSeller(cleanText(sellerName));
          if (normalized) return normalized;
        }
      }
    }
  }

  return null;
}

function extractModelCodeFromJsonLd(objects: unknown[]) {
  for (const obj of objects) {
    if (!obj || typeof obj !== "object") continue;

    const product = obj as Record<string, unknown>;
    const candidates = [
      product.mpn,
      product.sku,
      product.productID,
      product.productId,
      product.model,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const normalized = normalizeModelCode(cleanText(candidate));
        if (normalized && isAllowedModelCode(normalized)) return normalized;
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

function normalizeImageUrl(url: string | null) {
  if (!url) return null;

  const cleaned = cleanText(url);
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) return null;
  if (!/productimages\.hepsiburada\.net/i.test(cleaned)) return null;
  if (!/\.(jpg|jpeg|png|webp)(\/|$|\?)/i.test(cleaned)) return null;
  if (/svg|sprite|icon|logo|placeholder/i.test(cleaned)) return null;

  return cleaned
    .replace(/\/format:[^/?#]+/gi, "")
    .replace(/\?.*$/, "");
}

function extractBrandFromTitleLikeText(value: string | null) {
  const text = cleanText(value);
  if (!text) return null;

  const firstToken = text.split(/\s+/)[0];
  return normalizeBrand(firstToken);
}

function isAllowedModelCode(value: string) {
  const normalized = value.trim();
  const upper = normalized.toUpperCase();

  if (!/[a-zA-Z]/.test(normalized)) return false;
  if (!/\d/.test(normalized)) return false;
  if (normalized.length < 4 || normalized.length > 40) return false;

  if (/^HBV[0-9A-Z]+$/.test(upper)) return false;
  if (/^HB[A-Z0-9]{6,}$/.test(upper)) return false;
  if (/^HBCV[A-Z0-9]+$/.test(upper)) return false;
  if (/^P-HB[A-Z0-9-]+$/.test(upper)) return false;
  if (/^HBV[0-9A-Z]+[-_/]*$/.test(upper)) return false;
  if (/^HB[A-Z0-9]{6,}[-_/]*$/.test(upper)) return false;

  return true;
}

function extractStrongModelCandidatesFromText(value: string | null) {
  const text = cleanText(value);
  if (!text) return [];

  const matches = text.match(/\b[A-Z0-9]{2,}(?:[-_][A-Z0-9]+)*\b/gi) || [];

  return matches
    .map((item) => normalizeModelCode(item))
    .filter((item): item is string => !!item)
    .filter((item) => isAllowedModelCode(item));
}

function scoreModelCode(value: string | null, titleText: string | null) {
  if (!value) return -1;

  const normalized = value.trim();
  const upper = normalized.toUpperCase();
  const titleUpper = (titleText || "").toUpperCase();

  let score = 0;

  if (/[a-zA-Z]/.test(normalized)) score += 3;
  if (/\d/.test(normalized)) score += 3;
  if (/[-_]/.test(normalized)) score += 2;
  if (normalized.length >= 8) score += 3;
  if (normalized.length >= 10) score += 2;
  if (/^[A-Z0-9-_/]+$/i.test(normalized)) score += 1;
  if (titleUpper.includes(upper)) score += 6;
  if (/^[A-Z]{2,}\d{4,}[A-Z0-9-]*$/i.test(normalized)) score += 6;
  if (/^[A-Z]{1,3}\d[A-Z0-9]{4,}$/i.test(normalized)) score += 4;

  if (/^HBV[0-9A-Z]+$/i.test(normalized)) score -= 20;
  if (/^HB[A-Z0-9]{6,}$/i.test(normalized)) score -= 20;
  if (/^HBCV[A-Z0-9]+$/i.test(normalized)) score -= 20;
  if (/^P-HB[A-Z0-9-]+$/i.test(normalized)) score -= 20;
  if (/^[A-Z]?\d{2,4}$/i.test(normalized)) score -= 4;
  if (/^[A-Z]{0,2}\d{1,3}$/i.test(normalized)) score -= 3;

  return score;
}

function pickBestModelCode(values: Array<string | null>, titleText: string | null) {
  const unique = [...new Set(values.filter((value): value is string => !!value))].filter(
    isAllowedModelCode
  );

  if (unique.length === 0) return null;

  const sorted = unique.sort((a, b) => {
    const scoreDiff = scoreModelCode(b, titleText) - scoreModelCode(a, titleText);
    if (scoreDiff !== 0) return scoreDiff;
    return b.length - a.length;
  });

  return sorted[0] ?? null;
}

export const extractHepsiburadaFields: PlatformExtractor = ({ $, html }) => {
  const jsonLdObjects = collectJsonLdObjects(html);
  const htmlForRegex = decodeUnicode(html);

  const titleText =
    cleanText($("title").first().text()) ||
    cleanText($("meta[property='og:title']").attr("content")) ||
    cleanText($("meta[name='title']").attr("content")) ||
    cleanText($("h1").first().text());

  const h1Text = cleanText($("h1").first().text());

  const brandCandidates: Array<string | null> = [
    extractBrandFromJsonLd(jsonLdObjects),
    normalizeBrand(cleanText($('[data-test-id="product-brand-name"]').first().text())),
    normalizeBrand(cleanText($('[data-test-id="brand-name"]').first().text())),
    normalizeBrand(cleanText($('a[href*="/marka/"]').first().text())),
    normalizeBrand(cleanText($('a[href*="marka="]').first().text())),
    extractBrandFromTitleLikeText(titleText),
    normalizeBrand(
      cleanText(
        (
          htmlForRegex.match(
            /"(?:brand|brandName|manufacturer)"\s*:\s*"([^"]+)"/i
          ) || [])[1]
      )
    ),
  ];

  const sellerCandidates: Array<string | null> = [
    extractSellerFromJsonLd(jsonLdObjects),
    normalizeSeller(cleanText($('[data-test-id="seller-name"]').first().text())),
    normalizeSeller(cleanText($('[data-testid="merchant-name"]').first().text())),
    normalizeSeller(cleanText($('a[href*="/magaza/"]').first().text())),
    normalizeSeller(cleanText($('a[href*="merchantId="]').first().text())),
    normalizeSeller(
      cleanText(
        (
          htmlForRegex.match(
            /"(?:merchantName|sellerName|storeName)"\s*:\s*"([^"]+)"/i
          ) || [])[1]
      )
    ),
  ];

  const imageCandidates = new Set<string>();

  for (const image of extractImagesFromJsonLd(jsonLdObjects)) {
    const normalized = normalizeImageUrl(image);
    if (normalized) imageCandidates.add(normalized);
  }

  $(
    [
      'img[data-test-id="product-image"]',
      'img[data-test-id="default-image"]',
      'img[class*="productImage"]',
      'img[class*="product-image"]',
      'img[src*="productimages.hepsiburada.net"]',
      'img[data-src*="productimages.hepsiburada.net"]',
      '[class*="swiper"] img',
      '[class*="carousel"] img',
      'link[rel="preload"][as="image"][href*="productimages.hepsiburada.net"]',
    ].join(",")
  ).each((_, el) => {
    const attrs = [
      $(el).attr("src"),
      $(el).attr("data-src"),
      $(el).attr("data-original"),
      $(el).attr("data-zoom-image"),
      $(el).attr("href"),
    ];

    for (const attr of attrs) {
      const value = normalizeImageUrl(attr || null);
      if (value) imageCandidates.add(value);
    }
  });

  const titleModelCandidates = [
    ...extractStrongModelCandidatesFromText(titleText),
    ...extractStrongModelCandidatesFromText(h1Text),
  ];

  const regexModelCandidates: Array<string | null> = [
    normalizeModelCode(
      cleanText(
        (
          htmlForRegex.match(
            /"(?:merchantSku|sku|stockCode|stockcode|modelCode|modelKodu|mpn|manufacturerPartNumber|partNumber)"\s*:\s*"([^"]+)"/i
          ) || [])[1]
      )
    ),
  ];

  const explicitRegexMatches = [
    ...htmlForRegex.matchAll(/\b([A-Z]{2,}\d{4,}[A-Z0-9-]{1,})\b/g),
  ]
    .map((match) => normalizeModelCode(match[1]))
    .filter((item): item is string => !!item)
    .filter((item) => isAllowedModelCode(item));

  const tableModelCandidates: Array<string | null> = [
    normalizeModelCode(cleanText($('td:contains("Model Kodu")').next().text())),
    normalizeModelCode(cleanText($('th:contains("Model Kodu")').next().text())),
    normalizeModelCode(cleanText($('td:contains("Üretici Kodu")').next().text())),
    normalizeModelCode(cleanText($('th:contains("Üretici Kodu")').next().text())),
    normalizeModelCode(cleanText($('td:contains("Parça Numarası")').next().text())),
    normalizeModelCode(cleanText($('th:contains("Parça Numarası")').next().text())),
    normalizeModelCode(cleanText($('td:contains("MPN")').next().text())),
    normalizeModelCode(cleanText($('th:contains("MPN")').next().text())),
    normalizeModelCode(cleanText($('td:contains("Stok Kodu")').next().text())),
    normalizeModelCode(cleanText($('th:contains("Stok Kodu")').next().text())),
  ];

  const modelCandidates: Array<string | null> = [
    ...titleModelCandidates,
    ...explicitRegexMatches,
    ...tableModelCandidates,
    ...regexModelCandidates,
    extractModelCodeFromJsonLd(jsonLdObjects),
    normalizeModelCode(
      cleanText(
        $('[data-test-id="product-model"]').first().text() ||
          $('[data-test-id="model"]').first().text()
      )
    ),
  ];

  const brand =
    brandCandidates.find((value) => !!value && value.length >= 2) ?? null;

  const sellerName =
    sellerCandidates.find((value) => !!value && value.length >= 2) ?? null;

  const modelCode = pickBestModelCode(modelCandidates, titleText);

  const imageCount = countUnique([...imageCandidates]);

  return {
    brand,
    seller_name: sellerName,
    image_count: imageCount,
    model_code: modelCode,
  };
};