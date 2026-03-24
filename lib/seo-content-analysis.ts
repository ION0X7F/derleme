type SeoSignalLevel = "strong" | "medium" | "weak" | "unclear";
type SeoOriginalityRisk = "low" | "medium" | "high" | "unclear";
type SeoConfidence = "high" | "medium" | "low" | "unclear";
type SeoIssueSeverity = "high" | "medium" | "low";
type SeoRecommendationPriority = "high" | "medium" | "low";

type AnalyzeSeoContentParams = {
  title: string | null | undefined;
  description: string | null | undefined;
  bulletPoints?: string[] | null | undefined;
  brand?: string | null | undefined;
  productName?: string | null | undefined;
  keyword?: string | null | undefined;
};

export type SeoIssue = {
  key: string;
  severity: SeoIssueSeverity;
  title: string;
  reason: string;
};

export type SeoRecommendation = {
  key: string;
  priority: SeoRecommendationPriority;
  title: string;
  reason: string;
};

export type SeoContentAnalysis = {
  score: number;
  level: SeoSignalLevel;
  titleQuality: SeoSignalLevel;
  titleLength: number;
  titleNotes: string[];
  descriptionQuality: SeoSignalLevel;
  keywordAlignment: SeoSignalLevel;
  originalityRisk: SeoOriginalityRisk;
  issues: string[];
  recommendations: string[];
  notes: string[];
  title_length: number;
  title_quality_score: number | null;
  title_quality_reasons: string[];
  description_quality_score: number | null;
  description_quality_reasons: string[];
  keyword_alignment_score: number | null;
  keyword_alignment_reasons: string[];
  originality_risk_level: SeoOriginalityRisk;
  originality_risk_reasons: string[];
  seo_issues: SeoIssue[];
  seo_recommendations: SeoRecommendation[];
  seo_confidence: SeoConfidence;
};

const SEO_RULE_WEIGHTS = {
  title: {
    base: 35,
    idealLength: 24,
    goodLength: 16,
    brandPresence: 12,
    productTypeClarity: 16,
    keywordCoverageStrong: 18,
    keywordCoveragePartial: 10,
    duplicatePenalty: 16,
    genericPenalty: 10,
  },
  description: {
    base: 24,
    longForm: 22,
    mediumForm: 12,
    bulletCoverageStrong: 18,
    bulletCoveragePartial: 8,
    structuralRichnessStrong: 16,
    structuralRichnessPartial: 8,
    keywordCoverageStrong: 14,
    keywordCoveragePartial: 8,
    duplicatePenalty: 18,
    genericPenalty: 14,
  },
  keyword: {
    titleCoverage: 0.55,
    descriptionCoverage: 0.45,
  },
} as const;

const GENERIC_TITLE_PHRASES = [
  "kaliteli",
  "uygun fiyat",
  "firsat urunu",
  "cok kullanisli",
  "modern tasarim",
  "sik gorunum",
] as const;

const GENERIC_DESCRIPTION_PHRASES = [
  "kaliteli malzeme",
  "gunluk kullanima uygun",
  "uzun omurlu kullanim",
  "sik tasarim",
  "modern gorunum",
  "kolay temizlenebilir",
  "her ortamda kullanima uygun",
  "dekoratif gorunum",
  "fiyat performans urunu",
] as const;

const PRODUCT_TYPE_HINTS = [
  "telefon",
  "kilif",
  "mat",
  "minder",
  "makine",
  "bornoz",
  "mama",
  "tablet",
  "kulaklik",
  "set",
  "paleti",
  "sweatshirt",
  "kediler",
  "kedi",
  "bulasik",
  "camasir",
  "yoga",
  "pilates",
  "sut",
  "magnezyum",
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function tokenize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function levelFromScore(score: number | null): SeoSignalLevel {
  if (score == null) return "unclear";
  if (score >= 75) return "strong";
  if (score >= 45) return "medium";
  return "weak";
}

function originalityRiskFromScore(score: number | null): SeoOriginalityRisk {
  if (score == null) return "unclear";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function getDuplicateRatio(tokens: string[]) {
  if (tokens.length === 0) return 1;
  const unique = new Set(tokens);
  return 1 - unique.size / tokens.length;
}

function countGenericPhraseHits(text: string, phrases: readonly string[]) {
  const lowered = text.toLocaleLowerCase("tr-TR");
  return phrases.reduce((sum, phrase) => sum + (lowered.includes(phrase) ? 1 : 0), 0);
}

function getKeywordCoverage(text: string, keyword: string) {
  const keywordTokens = tokenize(keyword);
  if (keywordTokens.length === 0) return null;
  const lowered = text.toLocaleLowerCase("tr-TR");
  const covered = keywordTokens.filter((token) => lowered.includes(token)).length;
  return clamp(Math.round((covered / keywordTokens.length) * 100), 0, 100);
}

function hasProductTypeSignal(title: string, productName: string) {
  const titleLower = title.toLocaleLowerCase("tr-TR");
  const productTokens = tokenize(productName).filter((token) => token.length >= 4);

  if (productTokens.some((token) => titleLower.includes(token))) {
    return true;
  }

  return PRODUCT_TYPE_HINTS.some((token) => titleLower.includes(token));
}

function scoreTitle(params: {
  title: string;
  brand: string;
  keyword: string;
  productName: string;
}) {
  if (!params.title) {
    return { score: null as number | null, reasons: ["Baslik verisi yok."] };
  }

  const reasons: string[] = [];
  let score = SEO_RULE_WEIGHTS.title.base;
  const tokens = tokenize(params.title);
  const duplicateRatio = getDuplicateRatio(tokens);
  const genericPhraseHits = countGenericPhraseHits(params.title, GENERIC_TITLE_PHRASES);
  const titleLower = params.title.toLocaleLowerCase("tr-TR");
  const length = params.title.length;

  if (length >= 45 && length <= 110) {
    score += SEO_RULE_WEIGHTS.title.idealLength;
    reasons.push("Baslik uzunlugu arama ve okunabilirlik icin dengeli.");
  } else if (length >= 30 && length <= 130) {
    score += SEO_RULE_WEIGHTS.title.goodLength;
    reasons.push("Baslik uzunlugu kabul edilebilir seviyede.");
  } else if (length < 30) {
    reasons.push("Baslik kisa kaldigi icin urunu yeterince tarif etmiyor.");
  } else {
    reasons.push("Baslik fazla uzun oldugu icin okunabilirlik dusuyor.");
  }

  if (params.brand && titleLower.includes(params.brand.toLocaleLowerCase("tr-TR"))) {
    score += SEO_RULE_WEIGHTS.title.brandPresence;
    reasons.push("Marka baslikta geciyor.");
  } else if (params.brand) {
    reasons.push("Marka baslikta belirgin degil.");
  }

  if (hasProductTypeSignal(params.title, params.productName)) {
    score += SEO_RULE_WEIGHTS.title.productTypeClarity;
    reasons.push("Urun tipi baslikta net sekilde anlasiliyor.");
  } else {
    reasons.push("Baslik urun tipini yeterince net anlatmiyor.");
  }

  const keywordCoverage = getKeywordCoverage(params.title, params.keyword);
  if (keywordCoverage != null) {
    if (keywordCoverage >= 70) {
      score += SEO_RULE_WEIGHTS.title.keywordCoverageStrong;
      reasons.push("Hedef anahtar kelime baslikta guclu sekilde destekleniyor.");
    } else if (keywordCoverage >= 35) {
      score += SEO_RULE_WEIGHTS.title.keywordCoveragePartial;
      reasons.push("Hedef anahtar kelime baslikta kismen geciyor.");
    } else {
      reasons.push("Hedef anahtar kelime baslikta zayif kaliyor.");
    }
  }

  if (duplicateRatio >= 0.3) {
    score -= SEO_RULE_WEIGHTS.title.duplicatePenalty;
    reasons.push("Baslikta kelime tekrari yuksek.");
  }

  if (genericPhraseHits >= 2) {
    score -= SEO_RULE_WEIGHTS.title.genericPenalty;
    reasons.push("Baslik fazla jenerik ve ayirt edici gucu dusuk.");
  }

  return { score: clamp(score, 0, 100), reasons: uniqueStrings(reasons) };
}

function scoreDescription(params: {
  description: string;
  bulletPoints: string[];
  keyword: string;
}) {
  if (!params.description) {
    return {
      score: null as number | null,
      reasons: ["Aciklama verisi yok."],
      duplicateRatio: null,
      genericPhraseHits: 0,
      structureScore: 0,
    };
  }

  const reasons: string[] = [];
  let score = SEO_RULE_WEIGHTS.description.base;
  const length = params.description.length;
  const tokens = tokenize(params.description);
  const duplicateRatio = getDuplicateRatio(tokens);
  const genericPhraseHits = countGenericPhraseHits(
    params.description,
    GENERIC_DESCRIPTION_PHRASES
  );
  const sentenceCount = params.description
    .split(/[.!?]+/)
    .map((item) => item.trim())
    .filter(Boolean).length;
  const bulletCount = params.bulletPoints.length;
  const hasColon = params.description.includes(":");
  const hasLineBreak = /\n/.test(params.description);
  let structureScore = 0;

  if (length >= 320) {
    score += SEO_RULE_WEIGHTS.description.longForm;
    reasons.push("Aciklama derinligi iyi seviyede.");
  } else if (length >= 180) {
    score += SEO_RULE_WEIGHTS.description.mediumForm;
    reasons.push("Aciklama uzunlugu kabul edilebilir.");
  } else {
    reasons.push("Aciklama kisa kaldigi icin faydayi zayif anlatiyor.");
  }

  if (bulletCount >= 4) {
    score += SEO_RULE_WEIGHTS.description.bulletCoverageStrong;
    reasons.push("Madde yapisi urun ozelliklerini destekliyor.");
    structureScore += 2;
  } else if (bulletCount >= 2) {
    score += SEO_RULE_WEIGHTS.description.bulletCoveragePartial;
    reasons.push("Kismi madde yapisi var.");
    structureScore += 1;
  } else {
    reasons.push("Madde yapisi zayif veya yok.");
  }

  if (sentenceCount >= 4 && (hasColon || hasLineBreak)) {
    score += SEO_RULE_WEIGHTS.description.structuralRichnessStrong;
    reasons.push("Aciklama yapisal olarak zengin gorunuyor.");
    structureScore += 2;
  } else if (sentenceCount >= 3) {
    score += SEO_RULE_WEIGHTS.description.structuralRichnessPartial;
    reasons.push("Aciklama kismen yapisal zenginlik tasiyor.");
    structureScore += 1;
  } else {
    reasons.push("Aciklama tek parca ve yapi olarak zayif.");
  }

  const keywordCoverage = getKeywordCoverage(params.description, params.keyword);
  if (keywordCoverage != null) {
    if (keywordCoverage >= 75) {
      score += SEO_RULE_WEIGHTS.description.keywordCoverageStrong;
      reasons.push("Hedef anahtar kelime aciklamada guclu sekilde destekleniyor.");
    } else if (keywordCoverage >= 35) {
      score += SEO_RULE_WEIGHTS.description.keywordCoveragePartial;
      reasons.push("Hedef anahtar kelime aciklamada kismen destekleniyor.");
    } else {
      reasons.push("Hedef anahtar kelime aciklamada zayif.");
    }
  }

  if (duplicateRatio >= 0.38) {
    score -= SEO_RULE_WEIGHTS.description.duplicatePenalty;
    reasons.push("Aciklamada tekrar orani yuksek.");
  }

  if (genericPhraseHits >= 3) {
    score -= SEO_RULE_WEIGHTS.description.genericPenalty;
    reasons.push("Aciklama fazla jenerik kaliyor.");
  }

  return {
    score: clamp(score, 0, 100),
    reasons: uniqueStrings(reasons),
    duplicateRatio,
    genericPhraseHits,
    structureScore,
  };
}

function buildKeywordAlignment(params: {
  title: string;
  description: string;
  keyword: string;
}) {
  if (!params.keyword) {
    return {
      score: null as number | null,
      reasons: ["Hedef anahtar kelime verilmedigi icin uyum puani hesaplanmadi."],
    };
  }

  const titleCoverage = getKeywordCoverage(params.title, params.keyword) ?? 0;
  const descriptionCoverage = getKeywordCoverage(params.description, params.keyword) ?? 0;
  const score = clamp(
    Math.round(
      titleCoverage * SEO_RULE_WEIGHTS.keyword.titleCoverage +
        descriptionCoverage * SEO_RULE_WEIGHTS.keyword.descriptionCoverage
    ),
    0,
    100
  );

  const reasons: string[] = [];
  if (titleCoverage >= 70) {
    reasons.push("Anahtar kelimenin ana parcasi baslikta yer aliyor.");
  } else if (titleCoverage >= 35) {
    reasons.push("Anahtar kelime baslikta kismen destekleniyor.");
  } else {
    reasons.push("Anahtar kelime baslikta zayif kaliyor.");
  }

  if (descriptionCoverage >= 75) {
    reasons.push("Anahtar kelime aciklama boyunca dogal sekilde geciyor.");
  } else if (descriptionCoverage >= 35) {
    reasons.push("Anahtar kelime aciklamada sinirli sekilde destekleniyor.");
  } else {
    reasons.push("Anahtar kelime aciklama tarafinda yeterince desteklenmiyor.");
  }

  return { score, reasons: uniqueStrings(reasons) };
}

function buildOriginalityRisk(params: {
  description: string;
  duplicateRatio: number | null;
  genericPhraseHits: number;
  bulletCount: number;
  structureScore: number;
}) {
  if (!params.description) {
    return {
      score: null as number | null,
      level: "unclear" as SeoOriginalityRisk,
      reasons: ["Aciklama olmadigi icin ozgunluk riski olculemedi."],
    };
  }

  const duplicateComponent = (params.duplicateRatio ?? 0) * 100;
  const genericComponent = params.genericPhraseHits * 11;
  const structureRelief = params.structureScore >= 2 ? 12 : params.structureScore === 1 ? 6 : 0;
  const bulletRelief = params.bulletCount >= 4 ? 8 : params.bulletCount >= 2 ? 4 : 0;
  const riskScore = clamp(
    Math.round(duplicateComponent + genericComponent - structureRelief - bulletRelief),
    0,
    100
  );

  const reasons: string[] = [
    "Bu alan kesin intihal tespiti degil, metin benzerligi ve jeneriklik riskidir.",
  ];

  if ((params.duplicateRatio ?? 0) >= 0.38) {
    reasons.push("Kelime tekrar orani yuksek oldugu icin metin benzerligi riski artiyor.");
  }
  if (params.genericPhraseHits >= 3) {
    reasons.push("Jenerik kaliplar fazlalasiyor.");
  }
  if (params.structureScore >= 2 || params.bulletCount >= 4) {
    reasons.push("Yapisal detay metni bir miktar ozellestiriyor.");
  }

  return {
    score: riskScore,
    level: originalityRiskFromScore(riskScore),
    reasons: uniqueStrings(reasons),
  };
}

function buildSeoIssues(params: {
  title: string;
  description: string;
  titleScore: number | null;
  descriptionScore: number | null;
  keywordScore: number | null;
  originalityLevel: SeoOriginalityRisk;
  titleReasons: string[];
  descriptionReasons: string[];
  bulletCount: number;
}) {
  const issues: SeoIssue[] = [];

  if (!params.title) {
    issues.push({
      key: "missing-title",
      severity: "high",
      title: "Urun basligi eksik",
      reason: "Baslik olmadigi icin arama gorunurlugu ve urun anlasilirligi ciddi sekilde zayiflar.",
    });
  } else if ((params.titleScore ?? 0) < 45) {
    issues.push({
      key: "weak-title",
      severity: "high",
      title: "Baslik kalitesi zayif",
      reason: params.titleReasons.join(" "),
    });
  } else if ((params.titleScore ?? 0) < 65) {
    issues.push({
      key: "average-title",
      severity: "medium",
      title: "Baslik iyilestirilebilir",
      reason: params.titleReasons.join(" "),
    });
  }

  if (!params.description) {
    issues.push({
      key: "missing-description",
      severity: "high",
      title: "Aciklama eksik",
      reason: "Aciklama olmadigi icin urunun faydasi ve anahtar kelime kapsami zayif kalir.",
    });
  } else if ((params.descriptionScore ?? 0) < 45) {
    issues.push({
      key: "weak-description",
      severity: "high",
      title: "Aciklama kalitesi zayif",
      reason: params.descriptionReasons.join(" "),
    });
  } else if ((params.descriptionScore ?? 0) < 65) {
    issues.push({
      key: "average-description",
      severity: "medium",
      title: "Aciklama daha netlestirilebilir",
      reason: params.descriptionReasons.join(" "),
    });
  }

  if (params.keywordScore != null && params.keywordScore < 45) {
    issues.push({
      key: "weak-keyword-alignment",
      severity: "high",
      title: "Anahtar kelime uyumu zayif",
      reason: "Baslik ve aciklama hedef kelimeyi birlikte yeterince desteklemiyor.",
    });
  } else if (params.keywordScore != null && params.keywordScore < 65) {
    issues.push({
      key: "partial-keyword-alignment",
      severity: "medium",
      title: "Anahtar kelime uyumu orta seviyede",
      reason: "Anahtar kelime kapsami var ama daha netlestirilebilir.",
    });
  }

  if (params.originalityLevel === "high") {
    issues.push({
      key: "high-originality-risk",
      severity: "medium",
      title: "Metin benzerligi riski yuksek",
      reason: "Aciklama fazla tekrar eden ve jenerik bir yapi gosteriyor olabilir.",
    });
  } else if (params.originalityLevel === "medium") {
    issues.push({
      key: "medium-originality-risk",
      severity: "low",
      title: "Metin daha ozgun hale getirilebilir",
      reason: "Aciklamada bazi jenerik kaliplar belirgin.",
    });
  }

  if (params.bulletCount < 2 && params.description) {
    issues.push({
      key: "weak-bullet-structure",
      severity: "medium",
      title: "Ozellik maddeleri yetersiz",
      reason: "Madde yapisi az oldugu icin ozellikler taranabilir sekilde ayrismiyor.",
    });
  }

  return issues.slice(0, 8);
}

function buildSeoRecommendations(issues: SeoIssue[]) {
  const recommendations: SeoRecommendation[] = [];

  for (const issue of issues) {
    if (issue.key === "missing-title" || issue.key === "weak-title") {
      recommendations.push({
        key: "improve-title",
        priority: "high",
        title: "Basligi urun tipi ve ayirt edici ozelliklerle yeniden kur",
        reason: "Baslik hem arama hem de tiklama karari icin temel alandir.",
      });
    }

    if (issue.key === "missing-description" || issue.key === "weak-description") {
      recommendations.push({
        key: "expand-description",
        priority: "high",
        title: "Aciklamayi fayda, kullanim ve ozellik ekseninde genislet",
        reason: "Kisa veya zayif aciklama hem SEO hem de ikna gucunu dusurur.",
      });
    }

    if (
      issue.key === "weak-keyword-alignment" ||
      issue.key === "partial-keyword-alignment"
    ) {
      recommendations.push({
        key: "align-keyword",
        priority: issue.severity === "high" ? "high" : "medium",
        title: "Hedef kelimeyi baslik ve aciklamada dogal sekilde guclendir",
        reason: "Kelime uyumu dağınık kaldiginda arama niyetiyle sayfa uyumu zayiflar.",
      });
    }

    if (
      issue.key === "high-originality-risk" ||
      issue.key === "medium-originality-risk"
    ) {
      recommendations.push({
        key: "rewrite-generic-copy",
        priority: "medium",
        title: "Jenerik cumleleri azaltip urune ozel anlatima gec",
        reason: "Ozgun ve net ifade hem kalite algisini hem arama uyumunu destekler.",
      });
    }

    if (issue.key === "weak-bullet-structure") {
      recommendations.push({
        key: "add-bullets",
        priority: "medium",
        title: "Teknik ve kullanim ozelliklerini madde madde ayir",
        reason: "Taranabilir yapi hem kullanici hem arama kalitesi icin faydalidir.",
      });
    }
  }

  return uniqueStrings(
    recommendations.map((item) => JSON.stringify(item))
  ).map((item) => JSON.parse(item) as SeoRecommendation);
}

function resolveSeoConfidence(params: {
  title: string;
  description: string;
  keyword: string;
  bulletCount: number;
}) {
  let score = 0;
  if (params.title) score += 1;
  if (params.description) score += 2;
  if (params.keyword) score += 1;
  if (params.bulletCount >= 2) score += 1;

  if (score >= 4) return "high" as SeoConfidence;
  if (score >= 2) return "medium" as SeoConfidence;
  if (score >= 1) return "low" as SeoConfidence;
  return "unclear" as SeoConfidence;
}

export function analyzeSeoContent(params: AnalyzeSeoContentParams): SeoContentAnalysis {
  const title = cleanText(params.title);
  const description = cleanText(params.description);
  const brand = cleanText(params.brand);
  const keyword = cleanText(params.keyword);
  const productName = cleanText(params.productName);
  const bulletPoints = (params.bulletPoints ?? [])
    .map((item) => cleanText(item ?? ""))
    .filter(Boolean);

  if (!title && !description) {
    return {
      score: 0,
      level: "unclear",
      titleQuality: "unclear",
      titleLength: 0,
      titleNotes: [],
      descriptionQuality: "unclear",
      keywordAlignment: "unclear",
      originalityRisk: "unclear",
      issues: ["SEO analizi icin yeterli baslik veya aciklama verisi yok."],
      recommendations: ["Baslik ve aciklama verisi gelmeden SEO yorumu yapilmasin."],
      notes: [],
      title_length: 0,
      title_quality_score: null,
      title_quality_reasons: ["Baslik verisi yok."],
      description_quality_score: null,
      description_quality_reasons: ["Aciklama verisi yok."],
      keyword_alignment_score: null,
      keyword_alignment_reasons: ["Hedef anahtar kelime verilmedigi icin uyum puani hesaplanmadi."],
      originality_risk_level: "unclear",
      originality_risk_reasons: ["Aciklama olmadigi icin ozgunluk riski olculemedi."],
      seo_issues: [
        {
          key: "insufficient-seo-data",
          severity: "high",
          title: "SEO icin veri yetersiz",
          reason: "Baslik ve aciklama olmadan rule-based SEO analizi kurulamaz.",
        },
      ],
      seo_recommendations: [
        {
          key: "collect-core-copy",
          priority: "high",
          title: "Baslik ve aciklama verisini sagla",
          reason: "SEO yorumunun saglikli olmasi icin temel metin alanlari gereklidir.",
        },
      ],
      seo_confidence: "unclear",
    };
  }

  const titleResult = scoreTitle({ title, brand, keyword, productName });
  const descriptionResult = scoreDescription({ description, bulletPoints, keyword });
  const keywordAlignment = buildKeywordAlignment({ title, description, keyword });
  const originalityRisk = buildOriginalityRisk({
    description,
    duplicateRatio: descriptionResult.duplicateRatio,
    genericPhraseHits: descriptionResult.genericPhraseHits,
    bulletCount: bulletPoints.length,
    structureScore: descriptionResult.structureScore,
  });

  const scoreParts = [titleResult.score, descriptionResult.score].filter(
    (value): value is number => value != null
  );
  const weightedScore =
    titleResult.score == null && descriptionResult.score == null
      ? 0
      : Math.round(
          (titleResult.score ?? 0) * 0.4 +
            (descriptionResult.score ?? 0) * 0.45 +
            ((keywordAlignment.score ?? 0) * 0.15)
        );
  const score = scoreParts.length === 0 ? 0 : clamp(weightedScore, 0, 100);

  const seoIssues = buildSeoIssues({
    title,
    description,
    titleScore: titleResult.score,
    descriptionScore: descriptionResult.score,
    keywordScore: keywordAlignment.score,
    originalityLevel: originalityRisk.level,
    titleReasons: titleResult.reasons,
    descriptionReasons: descriptionResult.reasons,
    bulletCount: bulletPoints.length,
  });
  const seoRecommendations = buildSeoRecommendations(seoIssues);
  const seoConfidence = resolveSeoConfidence({
    title,
    description,
    keyword,
    bulletCount: bulletPoints.length,
  });

  return {
    score,
    level: levelFromScore(score),
    titleQuality: levelFromScore(titleResult.score),
    titleLength: title.length,
    titleNotes: titleResult.reasons.slice(0, 4),
    descriptionQuality: levelFromScore(descriptionResult.score),
    keywordAlignment: levelFromScore(keywordAlignment.score),
    originalityRisk: originalityRisk.level,
    issues: seoIssues.map((item) => item.title),
    recommendations: seoRecommendations.map((item) => item.title),
    notes: uniqueStrings([
      ...titleResult.reasons,
      ...descriptionResult.reasons,
      ...keywordAlignment.reasons,
      ...originalityRisk.reasons,
    ]).slice(0, 8),
    title_length: title.length,
    title_quality_score: titleResult.score,
    title_quality_reasons: titleResult.reasons,
    description_quality_score: descriptionResult.score,
    description_quality_reasons: descriptionResult.reasons,
    keyword_alignment_score: keywordAlignment.score,
    keyword_alignment_reasons: keywordAlignment.reasons,
    originality_risk_level: originalityRisk.level,
    originality_risk_reasons: originalityRisk.reasons,
    seo_issues: seoIssues,
    seo_recommendations: seoRecommendations,
    seo_confidence: seoConfidence,
  };
}
