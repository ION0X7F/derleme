import { parseAnalysisSummary } from "@/lib/analysis-summary";
import type {
  AccessPlan,
  AnalysisSuggestion,
  AnalysisTrace,
  AnalysisTraceMetricSnapshot,
  AnalysisTraceSignal,
  AnalysisTraceStep,
  AnalysisTraceTheme,
  DecisionSupportPacket,
  DerivedMetrics,
  ExtractedProductFields,
  LearningContext,
  MissingDataReport,
} from "@/types/analysis";

const METRIC_LABELS: Record<keyof DerivedMetrics, string> = {
  productQuality: "Urun Kalitesi",
  sellerTrust: "Satici Guveni",
  marketPosition: "Pazar Konumu",
};

function normalizeTraceText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampWeight(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function detectDiagnosisTheme(value: string | null | undefined): AnalysisTraceTheme | null {
  const text = normalizeTraceText(value || "");

  if (!text) return null;
  if (/(stok|envanter|varyant)/.test(text)) return "stock";
  if (/(fiyat|rakip|min fiyat|indirim|kupon)/.test(text)) return "price";
  if (/(teslim|kargo|sevkiyat|shipping|delivery)/.test(text)) return "delivery";
  if (/(icerik|aciklama|ozellik|teknik|detay sayfasi|title|h1|meta)/.test(text)) {
    return "content";
  }
  if (/(gorsel|video|goruntu|fotograf|vitrin)/.test(text)) return "visual";
  if (/(guven|satici|magaza|garanti|iade)/.test(text)) return "trust";
  if (/(yorum|yildiz|sosyal kanit|review|sepet)/.test(text)) return "reviews";
  if (/(soru|cevap|sss|faq)/.test(text)) return "faq";
  if (/(kampanya|promosyon)/.test(text)) return "campaign";
  return "mixed";
}

function inferPrimaryTheme(
  primaryDiagnosis: string | null,
  topSignals: AnalysisTraceSignal[]
) {
  const diagnosisTheme = detectDiagnosisTheme(primaryDiagnosis);

  if (diagnosisTheme && diagnosisTheme !== "mixed") {
    return diagnosisTheme;
  }

  const strongestWarning = topSignals.find((item) => item.tone === "warning");

  if (strongestWarning) {
    return (
      detectDiagnosisTheme(`${strongestWarning.label} ${strongestWarning.detail}`) ||
      diagnosisTheme
    );
  }

  return diagnosisTheme;
}

function createSignal(params: Omit<AnalysisTraceSignal, "weight"> & { weight?: number }) {
  return {
    ...params,
    weight: clampWeight(params.weight ?? 50),
  } satisfies AnalysisTraceSignal;
}

function dedupeSignals(items: AnalysisTraceSignal[], limit: number) {
  const seen = new Set<string>();
  const next: AnalysisTraceSignal[] = [];

  for (const item of items.sort((left, right) => right.weight - left.weight)) {
    const fingerprint = `${item.source}:${normalizeTraceText(item.label)}`;

    if (seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    next.push(item);

    if (next.length >= limit) {
      break;
    }
  }

  return next;
}

function buildMetricSnapshot(metrics: DerivedMetrics): AnalysisTraceMetricSnapshot[] {
  return (Object.keys(metrics) as Array<keyof DerivedMetrics>).map((key) => ({
    key,
    label: METRIC_LABELS[key],
    score: metrics[key].score,
    status: metrics[key].label,
    evidence: metrics[key].evidence.slice(0, 3),
  }));
}

function getLowRatedSampleRatio(extracted: ExtractedProductFields) {
  if (
    !extracted.review_summary ||
    extracted.review_summary.sampled_count <= 0 ||
    extracted.review_summary.low_rated_count < 0
  ) {
    return null;
  }

  return Number(
    (
      extracted.review_summary.low_rated_count / extracted.review_summary.sampled_count
    ).toFixed(2)
  );
}

function buildMetricSignals(
  extracted: ExtractedProductFields,
  metrics: DerivedMetrics
) {
  const items: AnalysisTraceSignal[] = [];
  const lowRatedRatio = getLowRatedSampleRatio(extracted);
  const lowReviewVolume =
    typeof extracted.review_count === "number" && extracted.review_count >= 0 && extracted.review_count < 50;
  const favoriteHigh = (extracted.favorite_count ?? 0) >= 500000;
  const cheaperCount = extracted.other_sellers_summary?.cheaper_count ?? 0;

  if (metrics.productQuality.label === "weak") {
    items.push(
      createSignal({
        key: "content-weak",
        label: "Urun kalitesi zayif",
        detail: "Aciklama, gorsel veya ozellik tarafinda karar vermeyi destekleyen unsurlar eksik.",
        tone: "warning",
        source: "metric",
        weight: 82,
        relatedFields: ["description_length", "has_specs", "bullet_point_count", "image_count"],
      })
    );
  }

  if (metrics.marketPosition.label === "weak") {
    items.push(
      createSignal({
        key: "offer-weak",
        label: "Pazar konumu baski altinda",
        detail: "Fiyat, teslimat veya kampanya tarafi rakip karsisinda zayif kaliyor.",
        tone: "warning",
        source: "metric",
        weight: 84,
        relatedFields: ["normalized_price", "shipping_days", "has_free_shipping"],
      })
    );
  }

  if (metrics.sellerTrust.label === "weak") {
    items.push(
      createSignal({
        key: "trust-weak",
        label: "Satici guveni zayif",
        detail: "Satici puani, yorumlar veya sosyal kanit tarafinda tereddut yaratan alanlar var.",
        tone: "warning",
        source: "metric",
        weight: 80,
        relatedFields: ["seller_score", "has_return_info", "review_count"],
      })
    );
  }



  if (
    metrics.sellerTrust.label === "weak" ||
    lowReviewVolume ||
    (lowRatedRatio != null && lowRatedRatio >= 0.4)
  ) {
    items.push(
      createSignal({
        key: "review-proof-weak",
        label: favoriteHigh && lowReviewVolume
          ? "Ilgi var ama sosyal kanit zayif"
          : "Yorum guveni bariyer olusturuyor",
        detail:
          favoriteHigh && lowReviewVolume
            ? "Urun ilgi cekiyor ancak yorum hacmi karar aninda guven tasimakta yetersiz kaliyor."
            : "Yorum puani, hacmi veya dusuk yildizli geri bildirimler sepet oncesi guven kaybi uretiyor.",
        tone: "warning",
        source: "metric",
        weight:
          favoriteHigh && lowReviewVolume
            ? 90
            : lowRatedRatio != null && lowRatedRatio >= 0.5
              ? 88
              : 82,
        relatedFields: ["rating_value", "review_count", "review_summary", "favorite_count"],
      })
    );
  }

  if (
    Array.isArray(extracted.qa_snippets) &&
    extracted.qa_snippets.length > 0 &&
    extracted.has_faq === false
  ) {
    items.push(
      createSignal({
        key: "faq-gap",
        label: "Tekrarlanan sorular ustte kapanmiyor",
        detail: "Musteri sorulari var ancak bunu toparlayan net bir SSS katmani gorunmuyor.",
        tone: "warning",
        source: "metric",
        weight: 68,
        relatedFields: ["qa_snippets", "has_faq", "description_length"],
      })
    );
  }

  if (cheaperCount > 0) {
    items.push(
      createSignal({
        key: "competitor-price-pressure",
        label: "Rakip fiyat baskisi var",
        detail:
          cheaperCount >= 3
            ? `${cheaperCount} rakip daha dusuk fiyatla gorunuyor; teklif farki karar aninda rakibe alan acabilir.`
            : "Daha ucuz rakipler oldugu icin fiyat toleransi zayiflayabilir.",
        tone: "warning",
        source: "market",
        weight: Math.min(92, 72 + cheaperCount * 5),
        relatedFields: ["normalized_price", "other_sellers_summary"],
      })
    );
  }

  if (
    typeof extracted.rating_value === "number" &&
    extracted.rating_value >= 4.4 &&
    (extracted.review_count ?? 0) >= 100
  ) {
    items.push(
      createSignal({
        key: "review-proof-strong",
        label: "Yorum guveni destekliyor",
        detail: "Yorum hacmi ve puan seviyesi temel sosyal kaniti guclendiriyor.",
        tone: "positive",
        source: "metric",
        weight: 58,
        relatedFields: ["rating_value", "review_count"],
      })
    );
  }

  if (extracted.has_campaign || !!extracted.campaign_label) {
    items.push(
      createSignal({
        key: "campaign-active",
        label: "Kampanya sinyali aktif",
        detail: extracted.campaign_label
          ? `Kampanya gorunuyor: ${extracted.campaign_label}.`
          : "Kampanya veya kupon sinyali teklif gucune destek veriyor.",
        tone: "positive",
        source: "market",
        weight: 50,
        relatedFields: ["has_campaign", "campaign_label", "promotion_labels"],
      })
    );
  }

  if (extracted.official_seller) {
    items.push(
      createSignal({
        key: "official-seller",
        label: "Resmi satici sinyali var",
        detail: "Resmi satici etiketi guven ve fiyat toleransina destek olabilir.",
        tone: "positive",
        source: "market",
        weight: 52,
        relatedFields: ["official_seller"],
      })
    );
  }

  if (extracted.has_free_shipping) {
    items.push(
      createSignal({
        key: "free-shipping",
        label: "Ucretsiz kargo gorunuyor",
        detail: "Teklif gucunu destekleyen ek avantaj sinyali mevcut.",
        tone: "positive",
        source: "market",
        weight: 48,
        relatedFields: ["has_free_shipping"],
      })
    );
  }

  if (
    extracted.stock_status?.toLocaleLowerCase("tr-TR").includes("stokta yok") ||
    extracted.stock_quantity === 0
  ) {
    items.push(
      createSignal({
        key: "stock-out",
        label: "Stok erisilebilirligi kritik",
        detail: "Stok kesintisi satis akisini dogrudan durdurur.",
        tone: "warning",
        source: "market",
        weight: 100,
        relatedFields: ["stock_status", "stock_quantity"],
      })
    );
  }

  return items;
}

function buildBenchmarkSignals(
  extracted: ExtractedProductFields,
  learningContext?: LearningContext | null
) {
  const benchmark = learningContext?.benchmark;

  if (!benchmark || benchmark.sampleSize < 5) {
    return [];
  }

  const items: AnalysisTraceSignal[] = [];

  if (
    typeof extracted.shipping_days === "number" &&
    typeof benchmark.avgShippingDays === "number" &&
    benchmark.avgShippingDays > 0 &&
    extracted.shipping_days > benchmark.avgShippingDays * 1.25
  ) {
    items.push(
      createSignal({
        key: "benchmark-delivery-gap",
        label: "Teslimat benchmark gerisinde",
        detail: `Mevcut teslimat ${extracted.shipping_days} gun, kategori ortalamasi ${benchmark.avgShippingDays} gun.`,
        tone: "warning",
        source: "benchmark",
        weight: extracted.shipping_days / benchmark.avgShippingDays * 30,
        relatedFields: ["shipping_days"],
      })
    );
  }

  if (
    typeof extracted.image_count === "number" &&
    typeof benchmark.avgImageCount === "number" &&
    benchmark.avgImageCount > 0 &&
    extracted.image_count < benchmark.avgImageCount * 0.8
  ) {
    items.push(
      createSignal({
        key: "benchmark-visual-gap",
        label: "Gorsel benchmark gerisinde",
        detail: `Mevcut gorsel sayisi ${extracted.image_count}, kategori ortalamasi ${benchmark.avgImageCount}.`,
        tone: "warning",
        source: "benchmark",
        weight: benchmark.avgImageCount / Math.max(extracted.image_count, 1) * 25,
        relatedFields: ["image_count"],
      })
    );
  }

  if (
    typeof extracted.description_length === "number" &&
    typeof benchmark.avgDescriptionLength === "number" &&
    benchmark.avgDescriptionLength > 0 &&
    extracted.description_length < benchmark.avgDescriptionLength * 0.8
  ) {
    items.push(
      createSignal({
        key: "benchmark-content-gap",
        label: "Aciklama derinligi benchmark gerisinde",
        detail: `Mevcut aciklama ${extracted.description_length} karakter, kategori ortalamasi ${benchmark.avgDescriptionLength}.`,
        tone: "warning",
        source: "benchmark",
        weight:
          benchmark.avgDescriptionLength / Math.max(extracted.description_length, 40) * 20,
        relatedFields: ["description_length"],
      })
    );
  }

  if (
    typeof extracted.seller_score === "number" &&
    typeof benchmark.avgSellerScore === "number" &&
    extracted.seller_score < benchmark.avgSellerScore - 0.3
  ) {
    items.push(
      createSignal({
        key: "benchmark-trust-gap",
        label: "Satici guveni benchmark gerisinde",
        detail: `Mevcut satici puani ${extracted.seller_score}, kategori ortalamasi ${benchmark.avgSellerScore}.`,
        tone: "warning",
        source: "benchmark",
        weight: (benchmark.avgSellerScore - extracted.seller_score) * 20,
        relatedFields: ["seller_score"],
      })
    );
  }

  if (
    typeof extracted.normalized_price === "number" &&
    typeof benchmark.avgPrice === "number" &&
    benchmark.avgPrice > 0 &&
    extracted.normalized_price > benchmark.avgPrice * 1.15
  ) {
    items.push(
      createSignal({
        key: "benchmark-price-gap",
        label: "Fiyat benchmark ustunde",
        detail: `Mevcut fiyat ${extracted.normalized_price}, kategori ortalamasi ${benchmark.avgPrice}.`,
        tone: "warning",
        source: "benchmark",
        weight: extracted.normalized_price / benchmark.avgPrice * 20,
        relatedFields: ["normalized_price"],
      })
    );
  }

  return dedupeSignals(items, 4);
}

function buildLearningSignals(learningContext?: LearningContext | null) {
  const items = [
    ...(learningContext?.rules
      .filter((item) => item.confidence >= 0.55)
      .map((item) => item.insight)
      .slice(0, 2) ?? []),
    ...(learningContext?.memorySnippets?.slice(0, 1) ?? []),
  ].filter(Boolean);

  return Array.from(new Set(items));
}

function buildCoverageSignals(params: {
  packet: DecisionSupportPacket;
  missingDataReport?: MissingDataReport | null;
}) {
  const items: AnalysisTraceSignal[] = [];
  const missingFields =
    params.missingDataReport?.unresolvedCriticalFields?.length
      ? params.missingDataReport.unresolvedCriticalFields
      : params.packet.coverage.missingFields.slice(0, 4);

  if (params.packet.coverage.confidence === "low") {
    items.push(
      createSignal({
        key: "coverage-low",
        label: "Kapsam dusuk, yorum korumali kuruldu",
        detail: missingFields.length
          ? `Kritik veri eksikleri suruyor: ${missingFields.join(", ")}.`
          : "Kritik alanlarin bir bolumu eksik oldugu icin yorum daha temkinli kuruldu.",
        tone: "warning",
        source: "coverage",
        weight: 94,
        relatedFields: missingFields,
      })
    );
  } else if (params.packet.coverage.confidence === "medium") {
    items.push(
      createSignal({
        key: "coverage-medium",
        label: "Kapsam orta seviyede",
        detail: missingFields.length
          ? `Bazi karar alanlari eksik veriyle okunuyor: ${missingFields.join(", ")}.`
          : "Karar mevcut sinyaller uzerinden kuruldu ancak tum alanlar tamam degil.",
        tone: "neutral",
        source: "coverage",
        weight: 42,
        relatedFields: missingFields,
      })
    );
  }

  if (
    params.missingDataReport?.unresolvedCriticalFields?.length &&
    params.packet.coverage.confidence !== "low"
  ) {
    items.push(
      createSignal({
        key: "critical-fields-missing",
        label: "Kritik veri eksigi suruyor",
        detail: `Analiz disi kalan alanlar: ${params.missingDataReport.unresolvedCriticalFields.join(", ")}.`,
        tone: "warning",
        source: "coverage",
        weight: 78,
        relatedFields: params.missingDataReport.unresolvedCriticalFields,
      })
    );
  }

  return dedupeSignals(items, 2);
}

function buildDecisionFlow(params: {
  primaryDiagnosis: string | null;
  confidence: DecisionSupportPacket["coverage"]["confidence"];
  learningContext?: LearningContext | null;
  missingDataReport?: MissingDataReport | null;
  recommendedFocus: string[];
}) {
  const steps: AnalysisTraceStep[] = [
    {
      key: "coverage",
      title: "Kapsam kontrolu",
      detail:
        params.confidence === "high"
          ? "Kritik alanlarin buyuk kismi mevcut, karar daha guvenli kuruldu."
          : params.confidence === "medium"
            ? "Bazi alanlar eksik, karar mevcut sinyaller ustunden kuruldu."
            : "Eksik veri nedeniyle karar korumali mantikla kuruldu.",
      status:
        params.confidence === "low"
          ? "limited"
          : params.confidence === "medium"
            ? "considered"
            : "selected",
    },
  ];

  if (params.primaryDiagnosis) {
    steps.push({
      key: "diagnosis",
      title: "Ana darbozag secimi",
      detail: params.primaryDiagnosis,
      status: "selected",
    });
  }

  if (params.learningContext?.benchmark || params.learningContext?.rules.length) {
    steps.push({
      key: "learning",
      title: "Benchmark ve ogrenim katmani",
      detail:
        params.learningContext?.systemLearning ||
        "Kategori benchmarki veya ogrenilmis kurallar karar sirasina dahil edildi.",
      status: "considered",
    });
  }

  if (params.missingDataReport?.unresolvedCriticalFields?.length) {
    steps.push({
      key: "missing-data",
      title: "Eksik veri siniri",
      detail: `Analiz disi kalan kritik alanlar: ${params.missingDataReport.unresolvedCriticalFields.join(", ")}.`,
      status: "limited",
    });
  }

  if (params.recommendedFocus.length > 0) {
    steps.push({
      key: "focus",
      title: "Oncelikli uygulama rotasi",
      detail: params.recommendedFocus.slice(0, 2).join(" | "),
      status: "selected",
    });
  }

  return steps.slice(0, 5);
}

export function buildAnalysisTrace(params: {
  mode: "deterministic" | "ai_enriched";
  summary: string | null | undefined;
  suggestions: AnalysisSuggestion[];
  packet: DecisionSupportPacket;
  extracted: ExtractedProductFields;
  derivedMetrics: DerivedMetrics;
  seoScore: number;
  conversionScore: number;
  overallScore: number;
  learningContext?: LearningContext | null;
  missingDataReport?: MissingDataReport | null;
}) {
  const parsedSummary = parseAnalysisSummary(params.summary);
  const primaryDiagnosis =
    parsedSummary.criticalDiagnosis || params.summary || null;
  const recommendedFocus =
    parsedSummary.strategicRecipe.length > 0
      ? parsedSummary.strategicRecipe.slice(0, 3)
      : params.suggestions.slice(0, 3).map((item) => item.title);
  const metricSnapshot = buildMetricSnapshot(params.derivedMetrics);
  const metricSignals = buildMetricSignals(params.extracted, params.derivedMetrics);
  const benchmarkSignals = buildBenchmarkSignals(params.extracted, params.learningContext);
  const coverageSignals = buildCoverageSignals({
    packet: params.packet,
    missingDataReport: params.missingDataReport,
  });
  const topSignals = dedupeSignals(
    [...coverageSignals, ...benchmarkSignals, ...metricSignals],
    5
  );

  return {
    version: 2,
    mode: params.mode,
    primaryDiagnosis,
    primaryTheme: inferPrimaryTheme(primaryDiagnosis, topSignals),
    confidence: params.packet.coverage.confidence,
    scoreSummary: {
      seo: params.seoScore,
      conversion: params.conversionScore,
      overall: params.overallScore,
    },
    metricSnapshot,
    topSignals,
    benchmarkSignals,
    learningSignals: buildLearningSignals(params.learningContext),
    recommendedFocus,
    blockedByData: params.missingDataReport?.unresolvedCriticalFields ?? [],
    decisionFlow: buildDecisionFlow({
      primaryDiagnosis,
      confidence: params.packet.coverage.confidence,
      learningContext: params.learningContext,
      missingDataReport: params.missingDataReport,
      recommendedFocus,
    }),
  } satisfies AnalysisTrace;
}

export function sanitizeAnalysisTraceForAccess(
  trace: AnalysisTrace | null | undefined,
  plan: AccessPlan
) {
  if (!trace) {
    return null;
  }

  if (plan === "guest") {
    return {
      version: trace.version,
      mode: trace.mode,
      primaryDiagnosis: trace.primaryDiagnosis,
      primaryTheme: trace.primaryTheme,
      confidence: trace.confidence,
      scoreSummary: trace.scoreSummary,
      metricSnapshot: trace.metricSnapshot.slice(0, 2),
      topSignals: trace.topSignals.slice(0, 2),
      benchmarkSignals: [],
      learningSignals: [],
      recommendedFocus: trace.recommendedFocus.slice(0, 1),
      blockedByData: trace.blockedByData.slice(0, 2),
      decisionFlow: trace.decisionFlow.slice(0, 2),
    } satisfies AnalysisTrace;
  }

  if (plan === "free") {
    return {
      ...trace,
      metricSnapshot: trace.metricSnapshot.slice(0, 3),
      topSignals: trace.topSignals.slice(0, 3),
      benchmarkSignals: trace.benchmarkSignals.slice(0, 1),
      learningSignals: trace.learningSignals.slice(0, 1),
      recommendedFocus: trace.recommendedFocus.slice(0, 2),
      blockedByData: trace.blockedByData.slice(0, 3),
      decisionFlow: trace.decisionFlow.slice(0, 3),
    } satisfies AnalysisTrace;
  }

  return trace;
}
