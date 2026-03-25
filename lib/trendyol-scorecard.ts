import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyzeSeoContent } from "@/lib/seo-content-analysis";
import { buildAiLearningPromptSection } from "@/lib/ai-learning-memory";
import type {
  ConsolidatedAnalysisInput,
  ExtractedProductFields,
  TrendyolIssue,
  TrendyolKeywordEntitySet,
  TrendyolKeywordInsight,
  TrendyolRecommendation,
  TrendyolScoreDimension,
  TrendyolScorecard,
  TrendyolScoreLabel,
} from "@/types/analysis";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const TURKISH_STOPWORDS = new Set([
  "ve",
  "ile",
  "icin",
  "için",
  "uygun",
  "yeni",
  "plus",
  "super",
  "süper",
  "orjinal",
  "orijinal",
  "adet",
  "paket",
  "set",
  "tekli",
  "model",
  "renk",
  "beyaz",
  "siyah",
  "mavi",
  "kirmizi",
  "kırmızı",
  "mor",
  "yesil",
  "yeşil",
  "gri",
  "pembe",
]);

const TARGET_AUDIENCE_HINTS = [
  "kadin",
  "kadın",
  "erkek",
  "cocuk",
  "çocuk",
  "unisex",
  "bebek",
  "yetiskin",
  "yetişkin",
];

const USE_CASE_HINTS = [
  "gunluk",
  "günlük",
  "ofis",
  "spor",
  "kosu",
  "koşu",
  "yoga",
  "pilates",
  "kamp",
  "seyahat",
  "ev",
  "mutfak",
  "bakim",
  "bakım",
  "profesyonel",
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function levelFromScore(score: number): TrendyolScoreLabel {
  if (!Number.isFinite(score)) return "unclear";
  if (score >= 75) return "strong";
  if (score >= 45) return "medium";
  return "weak";
}

function tokenize(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getTitleText(extracted: ExtractedProductFields) {
  return (
    extracted.resolved_primary_heading ||
    extracted.h1 ||
    extracted.product_name ||
    extracted.title ||
    ""
  );
}

function normalizeKeywordPhrase(phrase: string) {
  return phrase
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase("tr-TR"));
}

function getPrimaryKeywordCandidate(extracted: ExtractedProductFields) {
  const title = getTitleText(extracted);
  const brand = extracted.brand?.toLocaleLowerCase("tr-TR") ?? "";
  const tokens = tokenize(title).filter(
    (token) => !TURKISH_STOPWORDS.has(token) && token !== brand
  );

  const primary = tokens.slice(0, Math.min(tokens.length, 4)).join(" ").trim();
  return primary ? normalizeKeywordPhrase(primary) : null;
}

function getSecondaryKeywordCandidates(extracted: ExtractedProductFields) {
  const title = tokenize(getTitleText(extracted));
  const category = tokenize(extracted.category);
  const model = tokenize(extracted.model_code);

  const candidates: string[] = [];
  if (title.length >= 3) {
    candidates.push(normalizeKeywordPhrase(title.slice(0, 2).join(" ")));
    candidates.push(normalizeKeywordPhrase(title.slice(0, 3).join(" ")));
  }
  if (category.length > 0 && title.length > 0) {
    candidates.push(normalizeKeywordPhrase([...title.slice(0, 2), category[0]].join(" ")));
  }
  if (model.length > 0 && title.length > 0) {
    candidates.push(normalizeKeywordPhrase([...title.slice(0, 2), model[0]].join(" ")));
  }
  if (extracted.has_free_shipping) {
    candidates.push("Ücretsiz Kargo");
  }

  return uniqueStrings(candidates).filter((item) => item.length >= 4).slice(0, 6);
}

function inferEntities(extracted: ExtractedProductFields): TrendyolKeywordEntitySet {
  const titleTokens = tokenize(getTitleText(extracted));
  const categoryTokens = tokenize(extracted.category);

  const productType =
    normalizeKeywordPhrase(
      uniqueStrings([...titleTokens.slice(0, 2), ...categoryTokens.slice(0, 1)]).join(" ")
    ) || null;

  const targetAudience =
    uniqueStrings(titleTokens.filter((token) => TARGET_AUDIENCE_HINTS.includes(token)))
      .map((item) => normalizeKeywordPhrase(item))
      .join(", ") || null;

  const useCases = uniqueStrings(
    titleTokens.filter((token) => USE_CASE_HINTS.includes(token)).map((item) => normalizeKeywordPhrase(item))
  ).slice(0, 4);

  const attributes = uniqueStrings(
    [
      extracted.brand,
      extracted.model_code,
      extracted.best_seller_badge,
      ...(extracted.promotion_labels ?? []),
    ]
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => normalizeKeywordPhrase(item))
  ).slice(0, 5);

  const format = extracted.variant_count && extracted.variant_count > 1
    ? "Varyantlı"
    : getTitleText(extracted).toLocaleLowerCase("tr-TR").includes("set")
      ? "Set"
      : getTitleText(extracted).toLocaleLowerCase("tr-TR").includes("paket")
        ? "Paket"
        : "Tekli";

  return {
    productType,
    problemOrNeed: null,
    targetAudience,
    format,
    attributes,
    useCases,
  };
}

function buildDeterministicKeywordInsight(
  extracted: ExtractedProductFields
): TrendyolKeywordInsight {
  const primaryKeyword = getPrimaryKeywordCandidate(extracted);
  const secondaryKeywords = getSecondaryKeywordCandidates(extracted);
  const entities = inferEntities(extracted);
  const suggestedTitle = uniqueStrings(
    [
      extracted.brand,
      primaryKeyword,
      extracted.model_code,
      entities.targetAudience,
    ].filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  ).join(" ");

  return {
    primaryKeyword,
    secondaryKeywords,
    source: "deterministic",
    confidence: primaryKeyword ? "medium" : "low",
    entities,
    suggestedTitle: suggestedTitle || null,
  };
}

function getAttributeCompleteness(extracted: ExtractedProductFields) {
  const checks = [
    !!extracted.brand,
    !!extracted.category,
    !!extracted.product_name,
    !!extracted.model_code,
    extracted.has_specs,
    extracted.has_faq,
  ];
  return (checks.filter(Boolean).length / checks.length) * 100;
}

function buildDimension(score: number, evidence: string[]): TrendyolScoreDimension {
  return {
    score: clamp(score),
    label: levelFromScore(score),
    evidence: evidence.filter(Boolean).slice(0, 6),
  };
}

function buildIssuesAndRecommendations(params: {
  contentFit: TrendyolScoreDimension;
  listingQuality: TrendyolScoreDimension;
  commercialStrength: TrendyolScoreDimension;
  performanceSignal: TrendyolScoreDimension;
  operationalTrust: TrendyolScoreDimension;
  seoIssues: string[];
  extracted: ExtractedProductFields;
  keywordInsight: TrendyolKeywordInsight;
}) {
  const issues: TrendyolIssue[] = [];
  const recommendations: TrendyolRecommendation[] = [];

  if (params.contentFit.score < 60) {
    issues.push({
      key: "content-fit-low",
      severity: "high",
      title: "İçerik uyumu zayıf",
      detail: "Başlık, açıklama ve özellik alanları Trendyol arama niyetini tam karşılamıyor.",
    });
    recommendations.push({
      key: "content-fit-improve",
      priority: "high",
      title: "Başlık ve açıklama uyumunu güçlendir",
      detail: `Primary keyword "${params.keywordInsight.primaryKeyword ?? "ürün ifadesi"}" etrafında başlık ve açıklama daha net hizalanmalı.`,
    });
  }

  if (params.listingQuality.score < 60) {
    issues.push({
      key: "listing-quality-low",
      severity: "high",
      title: "Listeleme kalitesi düşük",
      detail: "Görseller, attribute doluluğu veya içerik yapısı listeleme gücünü sınırlıyor.",
    });
    recommendations.push({
      key: "listing-quality-improve",
      priority: "high",
      title: "Görsel ve özellik alanlarını tamamla",
      detail: "Görsel çeşitliliği, ürün özellikleri ve video desteği artırıldığında görünürlük tarafı güçlenir.",
    });
  }

  if (params.commercialStrength.score < 55) {
    issues.push({
      key: "commercial-strength-low",
      severity: "medium",
      title: "Ticari rekabet baskısı var",
      detail: "Fiyat, indirim veya teklif gücü rakiplere karşı yeterince ayrışmıyor olabilir.",
    });
    recommendations.push({
      key: "commercial-strength-improve",
      priority: "medium",
      title: "Fiyat ve teklif gücünü gözden geçir",
      detail: "İndirim, kampanya etiketi veya ücretsiz kargo desteği teklif gücünü yukarı çekebilir.",
    });
  }

  if (params.performanceSignal.score < 55) {
    issues.push({
      key: "performance-signal-low",
      severity: "medium",
      title: "Performans sinyali zayıf",
      detail: "Yorum, favori, puan veya etkileşim sinyalleri görünürlüğü besleyecek kadar güçlü değil.",
    });
    recommendations.push({
      key: "performance-signal-improve",
      priority: "medium",
      title: "Yorum ve favori sinyallerini güçlendir",
      detail: "Yorum hacmi, favori ve soru sinyalleri Trendyol görünürlüğünü destekleyen ana katmanlardan biri.",
    });
  }

  if (params.operationalTrust.score < 60) {
    issues.push({
      key: "operational-trust-low",
      severity: "medium",
      title: "Operasyonel güven alanı zayıf",
      detail: "Teslimat, satıcı puanı veya iade/kargo netliği müşteride güven kaybı yaratabilir.",
    });
    recommendations.push({
      key: "operational-trust-improve",
      priority: "medium",
      title: "Teslimat ve güven sinyallerini iyileştir",
      detail: "Hızlı teslimat, net iade bilgisi ve güçlü satıcı puanı dönüşüm potansiyelini destekler.",
    });
  }

  if (params.extracted.has_faq === false && (params.extracted.question_count ?? 0) >= 3) {
    recommendations.push({
      key: "faq-from-questions",
      priority: "medium",
      title: "Sık soruları içerikte görünür hale getir",
      detail: "Mevcut soru yoğunluğu, içerikte eksik kalan karar destek alanları olduğuna işaret ediyor.",
    });
  }

  for (const issueText of params.seoIssues.slice(0, 3)) {
    issues.push({
      key: `seo-${issues.length + 1}`,
      severity: "low",
      title: "İçerik iyileştirme alanı",
      detail: issueText,
    });
  }

  return {
    issues: issues.slice(0, 8),
    recommendations: recommendations.slice(0, 8),
  };
}

export function buildTrendyolScorecard(params: {
  extracted: ExtractedProductFields;
  consolidatedInput: ConsolidatedAnalysisInput;
}): TrendyolScorecard {
  const { extracted, consolidatedInput } = params;
  const keywordInsight = buildDeterministicKeywordInsight(extracted);
  const seoAnalysis = analyzeSeoContent({
    title: getTitleText(extracted),
    description: extracted.meta_description,
    brand: extracted.brand,
    productName: extracted.product_name,
    keyword: keywordInsight.primaryKeyword ?? extracted.product_name ?? extracted.category ?? undefined,
  });

  const attributeCompleteness = getAttributeCompleteness(extracted);
  const titleConfidence = Math.round(consolidatedInput.title.confidence * 100);
  const imageScore = clamp(
    extracted.image_count >= 8 ? 92 : extracted.image_count >= 5 ? 74 : extracted.image_count >= 3 ? 58 : 36
  );
  const videoBonus = extracted.has_video ? 8 : 0;
  const faqBonus = extracted.has_faq ? 6 : 0;
  const specBonus = extracted.has_specs ? 12 : 0;
  const descriptionScore = clamp(
    extracted.description_length == null
      ? 40
      : extracted.description_length >= 800
        ? 88
        : extracted.description_length >= 300
          ? 68
          : extracted.description_length >= 120
            ? 52
            : 34
  );

  const contentFit = buildDimension(
    seoAnalysis.score * 0.7 + attributeCompleteness * 0.3,
    [
      `Primary keyword: ${keywordInsight.primaryKeyword ?? "üretilmedi"}`,
      ...seoAnalysis.notes,
      `Attribute doluluk: ${Math.round(attributeCompleteness)}/100`,
    ]
  );

  const listingQuality = buildDimension(
    average([contentFit.score, imageScore, descriptionScore, specBonus * 4 + faqBonus * 3 + videoBonus * 2, titleConfidence]),
    [
      `Görsel skoru: ${imageScore}/100`,
      `Açıklama yeterliliği: ${descriptionScore}/100`,
      extracted.has_video ? "Video desteği mevcut." : "Video desteği görünmüyor.",
      extracted.has_specs ? "Özellik alanı mevcut." : "Özellik alanı zayıf.",
    ]
  );

  const priceStrength = clamp(
    typeof extracted.discount_rate === "number"
      ? extracted.discount_rate >= 20
        ? 90
        : extracted.discount_rate >= 10
          ? 78
          : extracted.discount_rate > 0
            ? 64
            : 52
      : 50
  );
  const competitorPriceSignal = clamp(
    extracted.other_sellers_summary?.cheaper_count === 0
      ? 82
      : typeof extracted.other_sellers_summary?.cheaper_count === "number"
        ? Math.max(30, 78 - extracted.other_sellers_summary.cheaper_count * 10)
        : 55
  );
  const commercialStrength = buildDimension(
    average([
      priceStrength,
      competitorPriceSignal,
      extracted.has_free_shipping ? 82 : 48,
      extracted.has_campaign ? 76 : 52,
    ]),
    [
      extracted.has_free_shipping ? "Ücretsiz kargo var." : "Ücretsiz kargo görünmüyor.",
      typeof extracted.discount_rate === "number"
        ? `İndirim oranı: %${Math.round(extracted.discount_rate)}`
        : "İndirim bilgisi sınırlı.",
      typeof extracted.other_sellers_summary?.cheaper_count === "number"
        ? `${extracted.other_sellers_summary.cheaper_count} daha ucuz rakip görünüyor.`
        : "Rakip fiyat sinyali sınırlı.",
    ]
  );

  const ratingSignal = clamp(
    typeof extracted.rating_value === "number" ? ((extracted.rating_value - 1) / 4) * 100 : 45
  );
  const reviewSignal = clamp(
    typeof extracted.review_count === "number"
      ? extracted.review_count >= 1000
        ? 92
        : extracted.review_count >= 200
          ? 80
          : extracted.review_count >= 50
            ? 64
            : extracted.review_count >= 10
              ? 48
              : 34
      : 40
  );
  const favoriteSignal = clamp(
    typeof extracted.favorite_count === "number"
      ? extracted.favorite_count >= 5000
        ? 92
        : extracted.favorite_count >= 1000
          ? 80
          : extracted.favorite_count >= 200
            ? 62
            : extracted.favorite_count >= 50
              ? 48
              : 35
      : 42
  );
  const questionSignal = clamp(
    typeof extracted.question_count === "number"
      ? extracted.question_count >= 20
        ? 76
        : extracted.question_count >= 5
          ? 60
          : extracted.question_count > 0
            ? 48
            : 35
      : 40
  );
  const bestSellerSignal = extracted.is_best_seller ? 88 : 52;

  const performanceSignal = buildDimension(
    average([ratingSignal, reviewSignal, favoriteSignal, questionSignal, bestSellerSignal]),
    [
      typeof extracted.rating_value === "number"
        ? `Puan ortalaması: ${extracted.rating_value}`
        : "Puan verisi sınırlı.",
      typeof extracted.review_count === "number"
        ? `Yorum hacmi: ${extracted.review_count}`
        : "Yorum hacmi sınırlı.",
      typeof extracted.favorite_count === "number"
        ? `Favori sayısı: ${extracted.favorite_count}`
        : "Favori verisi sınırlı.",
    ]
  );

  const sellerScoreSignal = clamp(
    typeof extracted.seller_score === "number" ? (extracted.seller_score / 10) * 100 : 48
  );
  const shippingSignal = clamp(
    typeof extracted.shipping_days === "number"
      ? extracted.shipping_days <= 1
        ? 92
        : extracted.shipping_days <= 2
          ? 82
          : extracted.shipping_days <= 4
            ? 62
            : 40
      : 48
  );
  const stockSignal = clamp(
    typeof extracted.stock_quantity === "number"
      ? extracted.stock_quantity > 10
        ? 80
        : extracted.stock_quantity > 0
          ? 60
          : 28
      : extracted.stock_status?.toLocaleLowerCase("tr-TR").includes("stok")
        ? 60
        : 48
  );

  const operationalTrust = buildDimension(
    average([
      sellerScoreSignal,
      shippingSignal,
      stockSignal,
      extracted.official_seller ? 88 : 52,
      extracted.has_return_info ? 78 : 42,
      extracted.has_shipping_info ? 74 : 46,
    ]),
    [
      typeof extracted.seller_score === "number"
        ? `Satıcı puanı: ${extracted.seller_score}`
        : "Satıcı puanı sınırlı.",
      extracted.official_seller ? "Resmi satıcı sinyali var." : "Resmi satıcı sinyali yok.",
      extracted.has_return_info ? "İade bilgisi mevcut." : "İade bilgisi zayıf.",
      typeof extracted.shipping_days === "number"
        ? `Teslimat süresi: ${extracted.shipping_days} gün`
        : "Teslimat süresi sınırlı.",
    ]
  );

  const searchVisibility = buildDimension(
    average([
      contentFit.score * 1.05,
      listingQuality.score,
      commercialStrength.score * 0.9,
      performanceSignal.score,
    ]),
    [
      `Primary keyword odağı: ${keywordInsight.primaryKeyword ?? "belirsiz"}`,
      ...contentFit.evidence.slice(0, 2),
      ...performanceSignal.evidence.slice(0, 2),
    ]
  );

  const conversionPotential = buildDimension(
    average([
      listingQuality.score * 0.95,
      commercialStrength.score,
      performanceSignal.score,
      operationalTrust.score,
    ]),
    [
      ...commercialStrength.evidence.slice(0, 2),
      ...operationalTrust.evidence.slice(0, 2),
    ]
  );

  const overall = buildDimension(
    searchVisibility.score * 0.3 +
      conversionPotential.score * 0.25 +
      operationalTrust.score * 0.2 +
      performanceSignal.score * 0.15 +
      commercialStrength.score * 0.1,
    [
      `Arama görünürlüğü: ${searchVisibility.score}`,
      `Dönüşüm potansiyeli: ${conversionPotential.score}`,
      `Operasyonel güven: ${operationalTrust.score}`,
    ]
  );

  const { issues, recommendations } = buildIssuesAndRecommendations({
    contentFit,
    listingQuality,
    commercialStrength,
    performanceSignal,
    operationalTrust,
    seoIssues: seoAnalysis.issues,
    extracted,
    keywordInsight,
  });

  return {
    keywordInsight,
    contentFit,
    listingQuality,
    commercialStrength,
    performanceSignal,
    operationalTrust,
    searchVisibility,
    conversionPotential,
    overall,
    issues,
    recommendations,
  };
}

function sanitizeAiKeywordInsight(
  raw: unknown,
  fallback: TrendyolKeywordInsight
): TrendyolKeywordInsight {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;
  const secondaryKeywords = Array.isArray(candidate.secondaryKeywords)
    ? uniqueStrings(
        candidate.secondaryKeywords.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0
        )
      ).slice(0, 8)
    : fallback.secondaryKeywords;

  const entitiesRaw =
    candidate.entities && typeof candidate.entities === "object" && !Array.isArray(candidate.entities)
      ? (candidate.entities as Record<string, unknown>)
      : {};

  return {
    primaryKeyword:
      typeof candidate.primaryKeyword === "string" && candidate.primaryKeyword.trim().length > 0
        ? candidate.primaryKeyword.trim()
        : fallback.primaryKeyword,
    secondaryKeywords,
    source: "ai_enriched",
    confidence:
      candidate.confidence === "high" || candidate.confidence === "medium" || candidate.confidence === "low"
        ? candidate.confidence
        : "medium",
    entities: {
      productType:
        typeof entitiesRaw.productType === "string" && entitiesRaw.productType.trim().length > 0
          ? entitiesRaw.productType.trim()
          : fallback.entities.productType,
      problemOrNeed:
        typeof entitiesRaw.problemOrNeed === "string" && entitiesRaw.problemOrNeed.trim().length > 0
          ? entitiesRaw.problemOrNeed.trim()
          : fallback.entities.problemOrNeed,
      targetAudience:
        typeof entitiesRaw.targetAudience === "string" && entitiesRaw.targetAudience.trim().length > 0
          ? entitiesRaw.targetAudience.trim()
          : fallback.entities.targetAudience,
      format:
        typeof entitiesRaw.format === "string" && entitiesRaw.format.trim().length > 0
          ? entitiesRaw.format.trim()
          : fallback.entities.format,
      attributes: Array.isArray(entitiesRaw.attributes)
        ? uniqueStrings(
            entitiesRaw.attributes.filter(
              (item): item is string => typeof item === "string" && item.trim().length > 0
            )
          ).slice(0, 6)
        : fallback.entities.attributes,
      useCases: Array.isArray(entitiesRaw.useCases)
        ? uniqueStrings(
            entitiesRaw.useCases.filter(
              (item): item is string => typeof item === "string" && item.trim().length > 0
            )
          ).slice(0, 6)
        : fallback.entities.useCases,
    },
    suggestedTitle:
      typeof candidate.suggestedTitle === "string" && candidate.suggestedTitle.trim().length > 0
        ? candidate.suggestedTitle.trim()
        : fallback.suggestedTitle,
  };
}

export async function enrichTrendyolScorecardWithAi(params: {
  extracted: ExtractedProductFields;
  scorecard: TrendyolScorecard;
}): Promise<TrendyolScorecard> {
  if (!genAI) {
    return params.scorecard;
  }

  try {
    const learningMemory = await buildAiLearningPromptSection({ area: "icerik", limit: 4 });
    const model = genAI.getGenerativeModel({
      model: geminiModel,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const prompt = [
      learningMemory,
      "Sen Trendyol ürün listeleme mantığına göre keyword ve niyet çıkarımı yapan bir asistansın.",
      "Aşağıdaki ürün verisinden sadece JSON döndür.",
      "Gerçek satış veya dönüşüm uydurma. Sadece keyword/niyet/title önerisi üret.",
      "",
      JSON.stringify(
        {
          title: getTitleText(params.extracted),
          category: params.extracted.category,
          brand: params.extracted.brand,
          productName: params.extracted.product_name,
          modelCode: params.extracted.model_code,
          price: params.extracted.normalized_price,
          imageCount: params.extracted.image_count,
          ratingValue: params.extracted.rating_value,
          reviewCount: params.extracted.review_count,
          favoriteCount: params.extracted.favorite_count,
          questionCount: params.extracted.question_count,
          metaDescription: params.extracted.meta_description,
          promotionLabels: params.extracted.promotion_labels,
        },
        null,
        2
      ),
      "",
      "JSON schema:",
      JSON.stringify(
        {
          primaryKeyword: "string",
          secondaryKeywords: ["string"],
          confidence: "high|medium|low",
          suggestedTitle: "string",
          entities: {
            productType: "string|null",
            problemOrNeed: "string|null",
            targetAudience: "string|null",
            format: "string|null",
            attributes: ["string"],
            useCases: ["string"],
          },
        },
        null,
        2
      ),
    ].join("\n");

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as unknown;
    const keywordInsight = sanitizeAiKeywordInsight(parsed, params.scorecard.keywordInsight);

    return {
      ...params.scorecard,
      keywordInsight,
    };
  } catch {
    return params.scorecard;
  }
}
