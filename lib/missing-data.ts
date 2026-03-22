import type {
  ExtractedProductFields,
  ExtractedFieldMetadata,
  LearningStatus,
  MissingDataReport,
  MissingFieldReason,
  MissingFieldSnapshot,
  OtherSellerOffer,
  OtherSellersSummary,
  ReviewRatingBreakdown,
  ReviewSummary,
} from "@/types/analysis";
import type { TrendyolApiResult } from "@/lib/fetch-trendyol-api";

type MissingFieldPriority = "critical" | "important" | "optional";

type CompleteMissingFieldsParams = {
  platform: string | null | undefined;
  extracted: ExtractedProductFields;
  genericFields: ExtractedProductFields;
  platformFields: Partial<ExtractedProductFields>;
  trendyolApiData: TrendyolApiResult | null;
};

type FieldDefinition = {
  name: string;
  priority: MissingFieldPriority;
  applicable?: (extracted: ExtractedProductFields) => boolean;
  available: (extracted: ExtractedProductFields) => boolean;
};

function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
}

function cleanText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function pickString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return null;
}

function pickNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function pickStringArray(...values: Array<string[] | null | undefined>) {
  for (const value of values) {
    if (!Array.isArray(value) || value.length === 0) continue;
    const cleaned = value
      .map((item) => cleanText(item))
      .filter((item): item is string => !!item);
    if (cleaned.length > 0) {
      return Array.from(new Set(cleaned));
    }
  }
  return null;
}

function parseNormalizedPrice(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.replace(/[^\d.,]/g, "").trim();
  if (!cleaned || !/[\d]/.test(cleaned)) return null;

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
    normalized =
      commaDigits === 2
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastDot > -1) {
    const dotDigits = cleaned.length - lastDot - 1;
    normalized =
      dotDigits === 3 && cleaned.indexOf(".") === lastDot
        ? cleaned.replace(/\./g, "")
        : cleaned.replace(/,/g, "");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function formatPrice(value: number, currency: string | null | undefined) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} ${currency || "TL"}`;
}

function hasOtherSellerContext(extracted: ExtractedProductFields) {
  return (
    (typeof extracted.other_sellers_count === "number" &&
      extracted.other_sellers_count > 0) ||
    (Array.isArray(extracted.other_seller_offers) &&
      extracted.other_seller_offers.length > 0) ||
    (typeof extracted.other_sellers_summary?.count === "number" &&
      extracted.other_sellers_summary.count > 0)
  );
}

function buildReviewSummaryFromSnippets(
  snippets: ExtractedProductFields["review_snippets"]
): ReviewSummary | null {
  if (!Array.isArray(snippets) || snippets.length === 0) return null;

  const normalized = snippets.filter(
    (item) => item && hasText(item.text)
  );

  if (normalized.length === 0) return null;

  const lowRatedCount = normalized.filter(
    (item) => typeof item.rating === "number" && item.rating <= 2
  ).length;
  const positiveCount = normalized.filter(
    (item) => typeof item.rating === "number" && item.rating >= 4
  ).length;

  return {
    sampled_count: normalized.length,
    low_rated_count: lowRatedCount,
    positive_count: positiveCount,
    negative_count: lowRatedCount,
  };
}

function buildReviewSummaryFromBreakdown(
  breakdown: ReviewRatingBreakdown | null | undefined
): ReviewSummary | null {
  if (!breakdown) return null;

  const oneStar = breakdown.one_star ?? 0;
  const twoStar = breakdown.two_star ?? 0;
  const threeStar = breakdown.three_star ?? 0;
  const fourStar = breakdown.four_star ?? 0;
  const fiveStar = breakdown.five_star ?? 0;
  const total = breakdown.total ?? oneStar + twoStar + threeStar + fourStar + fiveStar;

  if (total <= 0) return null;

  return {
    sampled_count: total,
    low_rated_count: oneStar + twoStar,
    positive_count: fourStar + fiveStar,
    negative_count: oneStar + twoStar,
  };
}

function deriveRatingValueFromSnippets(
  snippets: ExtractedProductFields["review_snippets"]
) {
  if (!Array.isArray(snippets) || snippets.length === 0) return null;

  const rated = snippets
    .map((item) => item?.rating)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (rated.length < 3) return null;

  return Number(
    (rated.reduce((sum, value) => sum + value, 0) / rated.length).toFixed(1)
  );
}

function deriveRatingValueFromBreakdown(
  breakdown: ReviewRatingBreakdown | null | undefined
) {
  if (!breakdown) return null;

  const oneStar = breakdown.one_star ?? 0;
  const twoStar = breakdown.two_star ?? 0;
  const threeStar = breakdown.three_star ?? 0;
  const fourStar = breakdown.four_star ?? 0;
  const fiveStar = breakdown.five_star ?? 0;
  const total = breakdown.total ?? oneStar + twoStar + threeStar + fourStar + fiveStar;

  if (total <= 0) return null;

  const weightedTotal =
    oneStar * 1 + twoStar * 2 + threeStar * 3 + fourStar * 4 + fiveStar * 5;

  return Number((weightedTotal / total).toFixed(1));
}

function deriveDeliveryType(extracted: ExtractedProductFields) {
  const badgeText = (extracted.seller_badges ?? [])
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  if (/ayni gun|aynigun|same day/.test(badgeText)) {
    return "same_day";
  }

  if (/ertesi gun|next day/.test(badgeText)) {
    return "next_day";
  }

  if (/hizli teslimat|hizli kargo|fast delivery/.test(badgeText)) {
    return "fast_delivery";
  }

  if (typeof extracted.shipping_days === "number") {
    if (extracted.shipping_days <= 1) return "same_day";
    if (extracted.shipping_days <= 2) return "next_day";
    if (extracted.shipping_days <= 3) return "fast_delivery";
    return "standard";
  }

  return null;
}

function buildOtherSellersSummary(
  offers: OtherSellerOffer[],
  currentPrice: number | null
): OtherSellersSummary | null {
  if (offers.length === 0) return null;

  const scored = offers.filter(
    (offer) =>
      typeof offer.seller_score === "number" &&
      Number.isFinite(offer.seller_score)
  );
  const priced = offers.filter(
    (offer) => typeof offer.price === "number" && Number.isFinite(offer.price)
  );

  const avgScore =
    scored.length > 0
      ? Number(
          (
            scored.reduce(
              (sum, offer) => sum + (offer.seller_score as number),
              0
            ) / scored.length
          ).toFixed(1)
        )
      : null;

  const topScore =
    scored.length > 0
      ? Number(
          Math.max(...scored.map((offer) => offer.seller_score as number)).toFixed(1)
        )
      : null;

  const avgPrice =
    priced.length > 0
      ? Number(
          (
            priced.reduce((sum, offer) => sum + (offer.price as number), 0) /
            priced.length
          ).toFixed(2)
        )
      : null;

  const minPrice =
    priced.length > 0
      ? Number(Math.min(...priced.map((offer) => offer.price as number)).toFixed(2))
      : null;

  const maxPrice =
    priced.length > 0
      ? Number(Math.max(...priced.map((offer) => offer.price as number)).toFixed(2))
      : null;

  const cheapestSellerName =
    minPrice == null
      ? null
      : priced.find((offer) => offer.price === minPrice)?.seller_name ?? null;

  const samePriceCount =
    typeof currentPrice === "number"
      ? priced.filter((offer) => offer.price === currentPrice).length
      : 0;

  const cheaperCount =
    typeof currentPrice === "number"
      ? priced.filter((offer) => (offer.price as number) < currentPrice).length
      : 0;

  const moreExpensiveCount =
    typeof currentPrice === "number"
      ? priced.filter((offer) => (offer.price as number) > currentPrice).length
      : 0;

  return {
    count: offers.length,
    scored_count: scored.length,
    avg_score: avgScore,
    top_score: topScore,
    official_count: offers.filter((offer) => offer.is_official).length,
    fast_delivery_count: offers.filter((offer) => offer.has_fast_delivery).length,
    high_follower_count: offers.filter(
      (offer) =>
        typeof offer.follower_count === "number" && offer.follower_count >= 1000
    ).length,
    min_price: minPrice,
    max_price: maxPrice,
    avg_price: avgPrice,
    cheapest_seller_name: cheapestSellerName,
    same_price_count: samePriceCount,
    cheaper_count: cheaperCount,
    more_expensive_count: moreExpensiveCount,
    seller_names: offers
      .map((offer) => offer.seller_name)
      .filter((item): item is string => hasText(item))
      .slice(0, 3),
  };
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  { name: "title", priority: "critical", available: (e) => hasText(e.title) },
  { name: "h1", priority: "critical", available: (e) => hasText(e.h1) },
  { name: "brand", priority: "critical", available: (e) => hasText(e.brand) },
  {
    name: "product_name",
    priority: "critical",
    available: (e) => hasText(e.product_name),
  },
  {
    name: "normalized_price",
    priority: "critical",
    available: (e) => typeof e.normalized_price === "number",
  },
  {
    name: "image_count",
    priority: "critical",
    available: (e) => typeof e.image_count === "number" && e.image_count > 0,
  },
  {
    name: "description_length",
    priority: "critical",
    available: (e) => typeof e.description_length === "number" && e.description_length > 0,
  },
  {
    name: "seller_name",
    priority: "critical",
    available: (e) => hasText(e.seller_name),
  },
  {
    name: "rating_value",
    priority: "critical",
    applicable: (e) => (e.review_count ?? 0) > 0 || !!e.rating_breakdown,
    available: (e) => typeof e.rating_value === "number",
  },
  {
    name: "review_count",
    priority: "critical",
    available: (e) => typeof e.review_count === "number",
  },
  {
    name: "shipping_days",
    priority: "critical",
    available: (e) => typeof e.shipping_days === "number",
  },
  {
    name: "stock_status",
    priority: "critical",
    available: (e) => hasText(e.stock_status),
  },
  {
    name: "original_price",
    priority: "important",
    applicable: (e) =>
      typeof e.normalized_price === "number" || typeof e.discount_rate === "number",
    available: (e) => typeof e.original_price === "number",
  },
  {
    name: "discount_rate",
    priority: "important",
    applicable: (e) =>
      typeof e.normalized_price === "number" || typeof e.original_price === "number",
    available: (e) => typeof e.discount_rate === "number",
  },
  {
    name: "question_count",
    priority: "important",
    available: (e) => typeof e.question_count === "number",
  },
  {
    name: "seller_score",
    priority: "important",
    available: (e) => typeof e.seller_score === "number",
  },
  {
    name: "favorite_count",
    priority: "important",
    available: (e) => typeof e.favorite_count === "number",
  },
  {
    name: "other_sellers_count",
    priority: "important",
    available: (e) => typeof e.other_sellers_count === "number",
  },
  {
    name: "other_seller_offers",
    priority: "important",
    applicable: (e) => hasOtherSellerContext(e),
    available: (e) =>
      Array.isArray(e.other_seller_offers) && e.other_seller_offers.length > 0,
  },
  {
    name: "other_sellers_summary",
    priority: "important",
    applicable: (e) => hasOtherSellerContext(e),
    available: (e) => !!e.other_sellers_summary,
  },
  {
    name: "merchant_id",
    priority: "optional",
    applicable: (e) => hasText(e.seller_name),
    available: (e) => typeof e.merchant_id === "number",
  },
  {
    name: "listing_id",
    priority: "optional",
    applicable: (e) => hasText(e.seller_name),
    available: (e) => hasText(e.listing_id),
  },
  {
    name: "variant_count",
    priority: "optional",
    available: (e) => typeof e.variant_count === "number",
  },
  {
    name: "stock_quantity",
    priority: "optional",
    available: (e) => typeof e.stock_quantity === "number",
  },
  {
    name: "review_snippets",
    priority: "optional",
    applicable: (e) => (e.review_count ?? 0) > 0,
    available: (e) =>
      Array.isArray(e.review_snippets) && e.review_snippets.length > 0,
  },
  {
    name: "review_summary",
    priority: "optional",
    applicable: (e) => (e.review_count ?? 0) > 0,
    available: (e) => !!e.review_summary,
  },
  {
    name: "rating_breakdown",
    priority: "optional",
    applicable: (e) => (e.review_count ?? 0) > 0,
    available: (e) => !!e.rating_breakdown,
  },
  {
    name: "campaign_label",
    priority: "optional",
    applicable: (e) =>
      e.has_campaign ||
      (Array.isArray(e.promotion_labels) && e.promotion_labels.length > 0),
    available: (e) => hasText(e.campaign_label),
  },
  {
    name: "promotion_labels",
    priority: "optional",
    applicable: (e) => e.has_campaign || hasText(e.campaign_label),
    available: (e) =>
      Array.isArray(e.promotion_labels) && e.promotion_labels.length > 0,
  },
  {
    name: "best_seller_rank",
    priority: "optional",
    applicable: (e) => e.is_best_seller === true,
    available: (e) => typeof e.best_seller_rank === "number",
  },
  {
    name: "best_seller_badge",
    priority: "optional",
    applicable: (e) => e.is_best_seller === true,
    available: (e) => hasText(e.best_seller_badge),
  },
];

function buildMissingFieldSnapshot(
  extracted: ExtractedProductFields
): MissingFieldSnapshot {
  const availableFields: string[] = [];
  const missingFields: string[] = [];
  const criticalMissingFields: string[] = [];
  const importantMissingFields: string[] = [];
  const optionalMissingFields: string[] = [];

  for (const definition of FIELD_DEFINITIONS) {
    if (definition.applicable && !definition.applicable(extracted)) {
      continue;
    }

    if (definition.available(extracted)) {
      availableFields.push(definition.name);
      continue;
    }

    missingFields.push(definition.name);

    if (definition.priority === "critical") {
      criticalMissingFields.push(definition.name);
    } else if (definition.priority === "important") {
      importantMissingFields.push(definition.name);
    } else {
      optionalMissingFields.push(definition.name);
    }
  }

  return {
    availableFields,
    missingFields,
    criticalMissingFields,
    importantMissingFields,
    optionalMissingFields,
  };
}

function getMissingFieldReason(
  field: string,
  extracted: ExtractedProductFields,
  trendyolApiData: TrendyolApiResult | null
) {
  const hasApiSeller = !!trendyolApiData?.seller;
  const hasApiOtherSellers =
    Array.isArray(trendyolApiData?.other_sellers) &&
    trendyolApiData.other_sellers.length > 0;

  switch (field) {
    case "title":
      return "Sayfa basligi HTML veya meta etiketlerinde bulunamadi.";
    case "h1":
      return "Urunun H1 basligi SSR HTML icinde yer almiyor olabilir.";
    case "brand":
      return "Marka bilgisi HTML, JSON-LD ve Trendyol state kaynaklarinda ayrisamadi.";
    case "product_name":
      return "Urun adi baslik ve state bloklarindan net sekilde ayrisamadi.";
    case "normalized_price":
      return "Gecerli fiyat metni veya API fiyat kaydi bulunamadi.";
    case "image_count":
      return "Urun gorselleri kaynak HTML icinde yeterince expose edilmedi.";
    case "description_length":
      return "Aciklama blogu sayfada gec yukleniyor olabilir veya SSR icinde yer almiyor.";
    case "seller_name":
      return "Satici bilgisi HTML ve Trendyol API kaynaklarinda acik gorunmedi.";
    case "rating_value":
      return "Yildiz puani review widget'i ile ayri yukleniyor olabilir; sayfa state'inde yok.";
    case "review_count":
      return "Yorum sayisi sayfa state'inde veya API kaydinda bulunamadi.";
    case "shipping_days":
      return "Teslimat suresi net sayi olarak expose edilmiyor; metin veya dinamik widget olarak geliyor olabilir.";
    case "stock_status":
      return "Stok durumu HTML icinde net etiketlenmedi ve sayfa state'i acik sinyal vermedi.";
    case "original_price":
      return "Uzeri cizili fiyat bu urunde yayinlanmiyor olabilir.";
    case "discount_rate":
      return "Indirim orani hesaplanacak ikinci fiyat bulunamadi.";
    case "question_count":
      return "Soru-cevap sayisi ayri servisle yukleniyor olabilir; HTML/API icinde yok.";
    case "seller_score":
      return hasApiSeller
        ? "API satici kaydi var ancak puan alanini expose etmiyor."
        : "Satici puani bu urun detayinda yayinlanmiyor.";
    case "favorite_count":
      return "Favori sayisi her urunde public state icinde yer almiyor.";
    case "other_sellers_count":
      return hasApiOtherSellers
        ? "Diger saticilar geldi ama toplam sayi alani net degildi."
        : "Bu urun tek saticili olabilir veya diger saticilar public kaynaga cikmiyor.";
    case "other_seller_offers":
      return hasApiOtherSellers
        ? "Rakip teklif listesi kisitli ya da state disinda yukleniyor."
        : "Ayni urunu satan diger saticilar public kaynakta bulunamadi.";
    case "other_sellers_summary":
      return hasApiOtherSellers
        ? "Rakip teklif ozeti hesaplanacak tam fiyat listesi olusmadi."
        : "Rakip satici verisi olmadigi icin ozet cikartilamadi.";
    case "merchant_id":
    case "listing_id":
      return "Merchant/listing kimligi public HTML veya API yanitinda yok.";
    case "variant_count":
      return "Varyant yapisi bu urun icin sayfa state'inde acik gelmiyor.";
    case "stock_quantity":
      return "Exact stok adedi Trendyol tarafinda cogu urunde public olarak expose edilmiyor.";
    case "review_snippets":
    case "review_summary":
    case "rating_breakdown":
      return "Yorum detaylari ayri review servisi ile yukleniyor; sayfa kaynak kodunda bulunamadi.";
    case "campaign_label":
    case "promotion_labels":
      return "Kampanya bilgisi oturum/sepete gore dinamik olabilir; sayfa kaynak kodunda net degil.";
    case "best_seller_rank":
    case "best_seller_badge":
      return "Urunun kategori siralama rozeti public state'te yayinlanmiyor olabilir.";
    default:
      return "Alan mevcut kaynaklarda bulunamadi.";
  }
}

function buildUnresolvedReasons(params: {
  snapshot: MissingFieldSnapshot;
  extracted: ExtractedProductFields;
  trendyolApiData: TrendyolApiResult | null;
}): MissingFieldReason[] {
  const priorityMap = new Map(FIELD_DEFINITIONS.map((item) => [item.name, item.priority]));

  return params.snapshot.missingFields.map((field) => ({
    field,
    priority: priorityMap.get(field) ?? "optional",
    reason: getMissingFieldReason(field, params.extracted, params.trendyolApiData),
  }));
}

export function getLearningStatus(params: {
  extracted: ExtractedProductFields;
  report: MissingDataReport;
  sourceType?: "real" | "synthetic";
}): LearningStatus {
  const sourceType = params.sourceType ?? "real";

  if (sourceType !== "real") {
    return {
      sourceType,
      eligible: false,
      reason: "Sentetik veya test verisi benchmark ogrenimine dahil edilmiyor.",
    };
  }

  if (params.extracted.extractor_status === "blocked") {
    return {
      sourceType,
      eligible: false,
      reason: "Extractor engellendigi icin veri benchmark ogrenimi icin yetersiz.",
    };
  }

  const hardCritical = ["title", "product_name", "normalized_price", "seller_name"];
  const unresolvedHardCritical = params.report.after.criticalMissingFields.filter((field) =>
    hardCritical.includes(field)
  );

  if (unresolvedHardCritical.length > 0) {
    return {
      sourceType,
      eligible: false,
      reason: `Temel alanlar eksik kaldigi icin ogrenim belleğine alinmadi: ${unresolvedHardCritical.join(", ")}.`,
    };
  }

  if (params.report.after.criticalMissingFields.length >= 4) {
    return {
      sourceType,
      eligible: false,
      reason: "Cok fazla kritik eksik veri kaldigi icin bu analiz benchmark kalitesine ulasmadi.",
    };
  }

  return {
    sourceType,
    eligible: true,
    reason: "Gercek kaynaklardan gelen ve benchmark icin yeterli kapsama sahip analiz.",
  };
}

export function completeMissingFields(params: CompleteMissingFieldsParams) {
  const completed: ExtractedProductFields = { ...params.extracted };
  const before = buildMissingFieldSnapshot(completed);
  const filledFields = new Set<string>();
  const strengthenedFields = new Set<string>();
  const appliedRules: string[] = [];

  const addRule = (message: string) => {
    if (!appliedRules.includes(message)) {
      appliedRules.push(message);
    }
  };

  const markField = (field: string, reason: string, strengthened = false) => {
    if (strengthened) {
      strengthenedFields.add(field);
    } else {
      filledFields.add(field);
    }
    addRule(`${field} <- ${reason}`);
  };

  const fillString = (field: keyof ExtractedProductFields, value: string | null, reason: string) => {
    if (!hasText(completed[field] as string | null | undefined) && hasText(value)) {
      completed[field] = cleanText(value) as never;
      markField(String(field), reason);
    }
  };

  const fillNumber = (field: keyof ExtractedProductFields, value: number | null, reason: string) => {
    if (typeof completed[field] !== "number" && typeof value === "number" && Number.isFinite(value)) {
      completed[field] = value as never;
      markField(String(field), reason);
    }
  };

  const fillArray = (
    field: keyof ExtractedProductFields,
    value: string[] | null,
    reason: string
  ) => {
    if (!Array.isArray(completed[field]) && Array.isArray(value) && value.length > 0) {
      completed[field] = value as never;
      markField(String(field), reason);
    }
  };

  const fillObject = <K extends keyof ExtractedProductFields>(
    field: K,
    value: ExtractedProductFields[K],
    reason: string
  ) => {
    if (!completed[field] && value) {
      completed[field] = value;
      markField(String(field), reason);
    }
  };

  const strengthenBoolean = (
    field: keyof ExtractedProductFields,
    value: boolean,
    reason: string
  ) => {
    if (value && completed[field] !== true) {
      completed[field] = true as never;
      markField(String(field), reason, true);
    }
  };

  const apiSeller = params.trendyolApiData?.seller ?? null;
  const apiOffers = params.trendyolApiData?.other_sellers ?? [];

  fillString(
    "brand",
    pickString(params.platformFields.brand, params.genericFields.brand),
    "html extractor"
  );
  fillString(
    "product_name",
    pickString(
      params.platformFields.product_name,
      params.genericFields.product_name,
      completed.h1,
      completed.title
    ),
    "html title/h1"
  );
  fillString(
    "seller_name",
    pickString(
      apiSeller?.seller_name,
      params.platformFields.seller_name,
      params.genericFields.seller_name
    ),
    apiSeller?.seller_name ? "trendyol api seller" : "html extractor"
  );
  fillString(
    "category",
    pickString(params.platformFields.category, params.genericFields.category),
    "html extractor"
  );

  const apiOrParsedPrice =
    pickNumber(
      completed.normalized_price,
      parseNormalizedPrice(completed.price),
      apiSeller?.price
    ) ?? null;

  fillNumber(
    "normalized_price",
    apiOrParsedPrice,
    typeof apiSeller?.price === "number" ? "trendyol api seller price" : "price text parse"
  );

  const derivedCurrency =
    pickString(
      completed.currency,
      params.platformFields.currency,
      params.genericFields.currency
    ) ??
    (params.platform === "trendyol" &&
    (typeof apiSeller?.price === "number" ||
      typeof completed.normalized_price === "number")
      ? "TL"
      : null);

  fillString(
    "currency",
    derivedCurrency,
    derivedCurrency === "TL" && params.platform === "trendyol"
      ? "trendyol storefront"
      : "html extractor"
  );

  const priceFromNumber = pickNumber(completed.normalized_price, apiSeller?.price);
  fillString(
    "price",
    typeof priceFromNumber === "number"
      ? formatPrice(priceFromNumber, completed.currency || derivedCurrency)
      : null,
    typeof apiSeller?.price === "number"
      ? "trendyol api seller price"
      : "normalized price format"
  );

  fillNumber(
    "original_price",
    pickNumber(
      params.platformFields.original_price,
      params.genericFields.original_price,
      apiSeller?.original_price,
      params.trendyolApiData?.original_price
    ),
    typeof apiSeller?.original_price === "number"
      ? "trendyol api original price"
      : "html extractor"
  );

  if (
    typeof completed.discount_rate !== "number" &&
    typeof pickNumber(
      params.platformFields.discount_rate,
      params.genericFields.discount_rate,
      apiSeller?.discount_rate,
      params.trendyolApiData?.discount_rate
    ) === "number"
  ) {
    completed.discount_rate = pickNumber(
      params.platformFields.discount_rate,
      params.genericFields.discount_rate,
      apiSeller?.discount_rate,
      params.trendyolApiData?.discount_rate
    ) as number;
    markField("discount_rate", "trendyol api or html extractor");
  } else if (
    typeof completed.discount_rate !== "number" &&
    typeof completed.original_price === "number" &&
    typeof completed.normalized_price === "number" &&
    completed.original_price > completed.normalized_price
  ) {
    completed.discount_rate = Math.round(
      ((completed.original_price - completed.normalized_price) /
        completed.original_price) *
        100
    );
    markField("discount_rate", "derived from real prices");
  }

  fillNumber(
    "image_count",
    pickNumber(params.platformFields.image_count, params.genericFields.image_count),
    "html extractor"
  );
  fillNumber(
    "description_length",
    pickNumber(
      params.platformFields.description_length,
      params.genericFields.description_length
    ),
    "html extractor"
  );
  fillNumber(
    "question_count",
    pickNumber(
      params.platformFields.question_count,
      params.trendyolApiData?.question_count,
      params.genericFields.question_count
    ),
    params.trendyolApiData?.question_count != null
      ? "trendyol api question count"
      : "html extractor"
  );

  if (
    typeof completed.question_count !== "number" &&
    Array.isArray(completed.qa_snippets) &&
    completed.qa_snippets.length > 0
  ) {
    completed.question_count = completed.qa_snippets.length;
    markField("question_count", "derived from qa snippets");
  }

  strengthenBoolean(
    "has_faq",
    Boolean(
      params.platformFields.has_faq ||
        completed.has_faq ||
        (Array.isArray(completed.qa_snippets) && completed.qa_snippets.length > 0) ||
        (typeof completed.question_count === "number" && completed.question_count > 0)
    ),
    "qa visibility signals"
  );

  fillNumber(
    "review_count",
    pickNumber(
      params.platformFields.review_count,
      params.genericFields.review_count,
      completed.rating_breakdown?.total ?? null
    ),
    completed.rating_breakdown?.total != null
      ? "rating breakdown total"
      : "html extractor"
  );

  fillNumber(
    "rating_value",
    pickNumber(params.platformFields.rating_value, params.genericFields.rating_value),
    "html extractor"
  );

  fillNumber(
    "rating_value",
    pickNumber(
      deriveRatingValueFromSnippets(completed.review_snippets),
      deriveRatingValueFromBreakdown(completed.rating_breakdown)
    ),
    Array.isArray(completed.review_snippets) && completed.review_snippets.length > 0
      ? "derived from real review snippets"
      : "derived from rating breakdown"
  );

  fillNumber(
    "seller_score",
    pickNumber(
      params.platformFields.seller_score,
      apiSeller?.seller_score,
      params.genericFields.seller_score
    ),
    typeof apiSeller?.seller_score === "number"
      ? "trendyol api seller score"
      : "html extractor"
  );
  fillNumber(
    "follower_count",
    pickNumber(
      params.platformFields.follower_count,
      apiSeller?.follower_count,
      params.genericFields.follower_count
    ),
    typeof apiSeller?.follower_count === "number"
      ? "trendyol api follower count"
      : "html extractor"
  );
  fillNumber(
    "favorite_count",
    pickNumber(params.platformFields.favorite_count, params.genericFields.favorite_count),
    "html extractor"
  );
  fillNumber(
    "merchant_id",
    pickNumber(
      params.platformFields.merchant_id,
      apiSeller?.merchant_id,
      params.genericFields.merchant_id
    ),
    typeof apiSeller?.merchant_id === "number"
      ? "trendyol api merchant id"
      : "html extractor"
  );
  fillString(
    "listing_id",
    pickString(
      params.platformFields.listing_id,
      apiSeller?.listing_id,
      params.genericFields.listing_id
    ),
    apiSeller?.listing_id ? "trendyol api listing id" : "html extractor"
  );
  fillArray(
    "seller_badges",
    pickStringArray(
      params.platformFields.seller_badges,
      apiSeller?.seller_badges,
      params.genericFields.seller_badges
    ),
    apiSeller?.seller_badges?.length ? "trendyol api seller badges" : "html extractor"
  );

  fillString(
    "delivery_type",
    pickString(
      params.platformFields.delivery_type,
      params.genericFields.delivery_type,
      deriveDeliveryType(completed)
    ),
    hasText(params.platformFields.delivery_type) || hasText(params.genericFields.delivery_type)
      ? "html extractor"
      : "delivery signal inference"
  );
  fillNumber(
    "variant_count",
    pickNumber(
      params.platformFields.variant_count,
      params.trendyolApiData?.variant_count,
      params.genericFields.variant_count
    ),
    params.trendyolApiData?.variant_count != null
      ? "trendyol api variant count"
      : "html extractor"
  );
  fillNumber(
    "stock_quantity",
    pickNumber(
      params.platformFields.stock_quantity,
      params.genericFields.stock_quantity
    ),
    "html extractor"
  );

  if (
    !hasText(completed.stock_status) &&
    typeof completed.stock_quantity === "number"
  ) {
    completed.stock_status = completed.stock_quantity > 0 ? "in_stock" : "out_of_stock";
    markField("stock_status", "derived from stock quantity");
  }

  fillNumber(
    "other_sellers_count",
    pickNumber(
      params.platformFields.other_sellers_count,
      params.genericFields.other_sellers_count,
      params.trendyolApiData?.other_sellers.length ?? null,
      completed.other_sellers_summary?.count ?? null,
      completed.other_seller_offers?.length ?? null
    ),
    params.trendyolApiData?.other_sellers.length
      ? "trendyol api other sellers"
      : "other seller summary"
  );

  fillObject(
    "other_seller_offers",
    (Array.isArray(completed.other_seller_offers) &&
    completed.other_seller_offers.length > 0
      ? completed.other_seller_offers
      : apiOffers.length > 0
        ? apiOffers
        : null) as ExtractedProductFields["other_seller_offers"],
    "trendyol api other seller offers"
  );

  fillObject(
    "other_sellers_summary",
    (completed.other_sellers_summary ||
      (Array.isArray(completed.other_seller_offers) &&
      completed.other_seller_offers.length > 0
        ? buildOtherSellersSummary(
            completed.other_seller_offers,
            completed.normalized_price
          )
        : params.trendyolApiData?.other_sellers_summary)) as ExtractedProductFields["other_sellers_summary"],
    completed.other_seller_offers?.length
      ? "derived from real other seller offers"
      : "trendyol api other seller summary"
  );

  strengthenBoolean(
    "has_free_shipping",
    Boolean(
      params.platformFields.has_free_shipping ??
        apiSeller?.has_free_shipping ??
        params.trendyolApiData?.has_free_shipping
    ),
    apiSeller?.has_free_shipping || params.trendyolApiData?.has_free_shipping
      ? "trendyol api free shipping"
      : "html extractor"
  );

  strengthenBoolean(
    "has_shipping_info",
    Boolean(
      params.platformFields.has_shipping_info ||
        completed.has_free_shipping ||
        typeof completed.shipping_days === "number" ||
        hasText(completed.delivery_type)
    ),
    "shipping signals"
  );

  strengthenBoolean(
    "has_campaign",
    Boolean(
      params.platformFields.has_campaign ||
        (Array.isArray(completed.promotion_labels) &&
          completed.promotion_labels.length > 0) ||
        hasText(completed.campaign_label)
    ),
    "campaign labels"
  );

  fillString(
    "campaign_label",
    pickString(
      params.platformFields.campaign_label,
      params.genericFields.campaign_label,
      Array.isArray(completed.promotion_labels)
        ? completed.promotion_labels[0]
        : null
    ),
    "campaign labels"
  );

  fillArray(
    "promotion_labels",
    pickStringArray(
      params.platformFields.promotion_labels,
      params.genericFields.promotion_labels,
      hasText(completed.campaign_label) ? [completed.campaign_label as string] : null
    ),
    "campaign label normalization"
  );

  strengthenBoolean(
    "official_seller",
    Boolean(params.platformFields.official_seller || apiSeller?.is_official),
    apiSeller?.is_official ? "trendyol api official seller" : "html extractor"
  );

  strengthenBoolean(
    "is_best_seller",
    Boolean(
      params.platformFields.is_best_seller ||
        (typeof completed.best_seller_rank === "number" &&
          completed.best_seller_rank > 0) ||
        hasText(completed.best_seller_badge)
    ),
    "best seller ranking"
  );

  fillNumber(
    "best_seller_rank",
    pickNumber(
      params.platformFields.best_seller_rank,
      params.genericFields.best_seller_rank
    ),
    "html extractor"
  );
  fillString(
    "best_seller_badge",
    pickString(
      params.platformFields.best_seller_badge,
      params.genericFields.best_seller_badge
    ),
    "html extractor"
  );

  fillObject(
    "review_summary",
    (completed.review_summary ||
      buildReviewSummaryFromSnippets(completed.review_snippets) ||
      buildReviewSummaryFromBreakdown(completed.rating_breakdown)) as ExtractedProductFields["review_summary"],
    Array.isArray(completed.review_snippets) && completed.review_snippets.length > 0
      ? "derived from real review snippets"
      : "derived from rating breakdown"
  );

  const after = buildMissingFieldSnapshot(completed);
  const unresolvedReasons = buildUnresolvedReasons({
    snapshot: after,
    extracted: completed,
    trendyolApiData: params.trendyolApiData,
  });

  return {
    extracted: completed,
    report: {
      before,
      after,
      filledFields: Array.from(filledFields),
      strengthenedFields: Array.from(strengthenedFields),
      appliedRules,
      unresolvedCriticalFields: after.criticalMissingFields,
      unresolvedReasons,
    } satisfies MissingDataReport,
  };
}

/**
 * Extended version: completeMissingFields + field metadata tracking.
 * Phase 1: Augments missing data report with per-field source/derivation info.
 * @internal Used by build-analysis.ts in new pipeline
 */
export function completeMissingFieldsWithMetadata(
  params: CompleteMissingFieldsParams,
  baseMetadata: Record<string, ExtractedFieldMetadata>
): {
  extracted: ExtractedProductFields;
  report: MissingDataReport;
  fieldMetadata: Record<string, ExtractedFieldMetadata>;
} {
  const result = completeMissingFields(params);
  const fieldMetadata = { ...baseMetadata };

  // Update metadata for filled/derived fields
  for (const filledField of result.report.filledFields) {
    const rule = result.report.appliedRules.find((r) => r.startsWith(filledField + " <-"));
    if (rule) {
      // Extract reason from appliedRule (format: "field <- reason")
      const reason = rule.substring(filledField.length + 4);
      const isApiDerived = reason.includes("trendyol api");

      fieldMetadata[filledField] = {
        source: isApiDerived ? "api" : "derived",
        confidence: isApiDerived ? "high" : "medium",
        reason,
        timestamp: Date.now(),
      };
    }
  }

  // Update metadata for strengthened fields
  for (const strengthenedField of result.report.strengthenedFields) {
    const rule = result.report.appliedRules.find((r) => r.startsWith(strengthenedField + " <-"));
    if (rule) {
      const reason = rule.substring(strengthenedField.length + 4);
      fieldMetadata[strengthenedField] = {
        source: reason.includes("trendyol") ? "api" : "derived",
        confidence: "medium",
        reason,
        timestamp: Date.now(),
      };
    }
  }

  // Mark still-unresolved critical fields as blocked
  for (const blockedField of result.report.unresolvedCriticalFields) {
    if (!fieldMetadata[blockedField]) {
      fieldMetadata[blockedField] = {
        source: "null",
        confidence: "low",
        reason: "unresolved critical field",
        timestamp: Date.now(),
      };
    }
  }

  return {
    extracted: result.extracted,
    report: result.report,
    fieldMetadata,
  };
}
