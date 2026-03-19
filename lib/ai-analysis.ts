import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  DecisionSupportPacket,
  ExtractedProductFields,
  LearningContext,
  MissingDataReport,
} from "@/types/analysis";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

type SupportedDependency =
  | "title"
  | "h1"
  | "meta_description"
  | "brand"
  | "product_name"
  | "model_code"
  | "normalized_price"
  | "original_price"
  | "discount_rate"
  | "image_count"
  | "has_video"
  | "rating_value"
  | "review_count"
  | "question_count"
  | "description_length"
  | "bullet_point_count"
  | "has_add_to_cart"
  | "has_shipping_info"
  | "has_free_shipping"
  | "shipping_days"
  | "has_return_info"
  | "has_specs"
  | "has_faq"
  | "variant_count"
  | "stock_quantity"
  | "stock_status"
  | "seller_name"
  | "seller_badges"
  | "seller_score"
  | "follower_count"
  | "favorite_count"
  | "other_sellers_count"
  | "other_sellers_summary"
  | "other_seller_offers"
  | "has_brand_page"
  | "official_seller"
  | "has_campaign"
  | "campaign_label"
  | "delivery_type"
  | "review_summary"
  | "review_themes"
  | "qa_snippets"
  | "is_best_seller"
  | "best_seller_rank"
  | "best_seller_badge";

type AiWeaknessItem = {
  text: string;
  depends_on: SupportedDependency[];
};

type AiSuggestionItem = {
  key: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  depends_on: SupportedDependency[];
};

export type AiAnalysisResult = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: {
    key: string;
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
  }[];
  seo_score: number;
  conversion_score: number;
  overall_score: number;
};

type RawAiAnalysisResult = {
  summary: string;
  strengths: string[];
  weaknesses: AiWeaknessItem[];
  suggestions: AiSuggestionItem[];
  seo_score: number;
  conversion_score: number;
  overall_score: number;
};

const SUPPORTED_DEPENDENCIES: SupportedDependency[] = [
  "title",
  "h1",
  "meta_description",
  "brand",
  "product_name",
  "model_code",
  "normalized_price",
  "original_price",
  "discount_rate",
  "image_count",
  "has_video",
  "rating_value",
  "review_count",
  "question_count",
  "description_length",
  "bullet_point_count",
  "has_add_to_cart",
  "has_shipping_info",
  "has_free_shipping",
  "shipping_days",
  "has_return_info",
  "has_specs",
  "has_faq",
  "variant_count",
  "stock_quantity",
  "stock_status",
  "seller_name",
  "seller_badges",
  "seller_score",
  "follower_count",
  "favorite_count",
  "other_sellers_count",
  "other_sellers_summary",
  "other_seller_offers",
  "has_brand_page",
  "official_seller",
  "has_campaign",
  "campaign_label",
  "delivery_type",
  "review_summary",
  "review_themes",
  "qa_snippets",
  "is_best_seller",
  "best_seller_rank",
  "best_seller_badge",
];

function hasText(value: string | null | undefined) {
  return !!value && value.trim().length > 0;
}

function scoreToRange(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function buildPrompt(
  packet: DecisionSupportPacket,
  url: string,
  learningContext: LearningContext | null | undefined,
  missingDataReport: MissingDataReport | null | undefined
) {
  const payload = {
    url,
    supported_dependencies: SUPPORTED_DEPENDENCIES,
    packet,
    learning_context: learningContext ?? null,
    missing_data_report: missingDataReport ?? null,
  };

  return `
Sen Trendyol ekosisteminde uzmanlasmis veri odakli bir "Pazar Yeri Stratejistisin".
Gorevin, sana saglanan karar destek paketini capraz sorgulama yontemiyle analiz edip "Neden satamiyorum?" sorusuna net cevap vermek.

ANALIZ AKISI:
1. Temel Varlik ve Erisilebilirlik:
- stock_status, stock_quantity, normalized_price, other_sellers_summary.min_price, other_sellers_summary.avg_price alanlarini kontrol et.
- Urun stokta degilse bunu tek basina kritik teshis yap.
- Fiyat rakip min veya rakip ortalamasinin cok ustundeyse bunu kritik bariyer olarak one al.

2. Algoritmik Gorunurluk:
- title, h1, description_length, bullet_point_count, has_specs alanlarini capraz sorgula.
- Baslik varken aciklama ve ozellik alani zayifsa "trafik var ama ikna yetersiz" mantigini kur.

3. Guven ve Sosyal Kanit:
- seller_score, review_count, rating_value, favorite_count, review_summary, review_themes alanlarini capraz sorgula.
- Favori yuksek ama review_count veya review_summary zayifsa "ilgi var ama sepet bariyeri var" teshisi kur.

4. Kritik Surtunme Analizi:
- normalized_price vs shipping_days vs delivery_type vs other_sellers_summary vs other_seller_offers capraz sorgusunu yap.
- Urun fiyat avantajliysa ama teslimat yavas veya rakipte hizli teslimat fazlaysa bunu acikca yaz.
- Rakipler daha ucuzsa fiyat baskisini acikca yaz.

5. Kendi Kendine Ogrenme ve Adaptasyon:
- learning_context icindeki benchmark, rules ve memorySnippets alanlarini kullan.
- Kategori benchmark'i varsa sabit esik kullanma; urunu kategori ortalamasi ve basarili orneklerle karsilastir.
- is_best_seller veya best_seller_rank sinyali varsa bunu ogretmen verisi gibi yorumla.
- Pahali ama guclu yorum/guven/hizli teslimat kombinasyonu varsa telafi faktorunu acikca not et.
- Her ucuz urunun kazanmadigini kabul et; guven zayifsa fiyat avantaji etkisiz kalabilir.

6. Eksik Veri Disiplini:
- missing_data_report.after.unresolvedReasons alanini oku.
- Bir alan eksikse ve o alan kararin merkezindeyse bunu acikca "Veri yetersizligi nedeniyle bu alan analiz disi birakildi." diye yaz.
- Eksik olan alanlar icin yorum yapma, tahmin uretme.

CIKTI KURALLARI:
1. Sadece eldeki veriye dayan.
2. Tahmin etme, uydurma yapma.
3. Eksik veri varsa ilgili alanda acikca "Veri yetersizligi nedeniyle bu alan analiz disi birakildi." de.
4. "Bence", "gorunuyor", "olabilir" gibi zayif ifadeler kullanma. "Veriler gosteriyor ki..." diliyle kesin konus.
5. Summary alani tam olarak su 3 bloktan olussun:
[KRITIK TESHIS]: ...
[VERI CARPISTIRMA]: ...
[STRATEJIK RECETE]:
1. ...
2. ...
3. ...
6. strengths en fazla 4 madde olsun.
7. weaknesses en fazla 5 madde olsun.
8. suggestions tam 3 maddeye yakin kalsin; en fazla 5 olabilir ama once en kritik 3 aksiyonu ver.
9. Her weakness ve suggestion icin depends_on doldurmak zorunlu.
10. depends_on icine sadece supported_dependencies listesindeki alanlari yaz.
11. Bir weakness veya suggestion ilgili veriye dayanmiyorsa o maddeyi hic yazma.
12. Summary icindeki KRITIK TESHIS tek ana darbozagi secsin.
13. VERI CARPISTIRMA bolumu en az iki veri grubunu birbirine karsilastirsin.
14. STRATEJIK RECETE maddeleri aksiyon odakli ve oncelik sirali olsun.
15. Summary sonuna su blok eklenmek zorunda:
[SISTEM OGRENISI]: ...
16. learning_context.benchmark?.sampleSize dusukse kesin kural yazma; "veri yetersizligi" de.

Veri:
${JSON.stringify(payload)}

Su JSON semasina tam uy:
{
  "summary": "string",
  "strengths": ["string"],
  "weaknesses": [
    {
      "text": "string",
      "depends_on": ["supported_dependency"]
    }
  ],
  "suggestions": [
    {
      "key": "kebab-case-string",
      "severity": "high | medium | low",
      "title": "string",
      "detail": "string",
      "depends_on": ["supported_dependency"]
    }
  ],
  "seo_score": 0,
  "conversion_score": 0,
  "overall_score": 0
}
`.trim();
}

function cleanJsonText(text: string) {
  return text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

function asStringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function sanitizeKey(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "-");

  return normalized || fallback;
}

function sanitizeDependsOn(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is SupportedDependency =>
        typeof item === "string" &&
        SUPPORTED_DEPENDENCIES.includes(item as SupportedDependency)
    )
    .slice(0, 4);
}

function hasDependencyData(
  dependency: SupportedDependency,
  extracted: ExtractedProductFields
) {
  switch (dependency) {
    case "title":
    case "h1":
    case "meta_description":
    case "brand":
    case "product_name":
    case "model_code":
    case "stock_status":
    case "seller_name":
    case "campaign_label":
    case "delivery_type":
    case "best_seller_badge":
      return hasText(extracted[dependency]);
    case "seller_badges":
      return Array.isArray(extracted.seller_badges) && extracted.seller_badges.length > 0;
    case "seller_score":
    case "follower_count":
    case "favorite_count":
    case "other_sellers_count":
    case "stock_quantity":
      return typeof extracted[dependency] === "number";
    case "other_seller_offers":
      return (
        Array.isArray(extracted.other_seller_offers) &&
        extracted.other_seller_offers.length > 0
      );
    case "other_sellers_summary":
      return !!extracted.other_sellers_summary;
    case "review_summary":
      return !!extracted.review_summary;
    case "review_themes":
      return !!extracted.review_themes;
    case "qa_snippets":
      return Array.isArray(extracted.qa_snippets) && extracted.qa_snippets.length > 0;
    case "normalized_price":
    case "original_price":
    case "discount_rate":
    case "rating_value":
    case "review_count":
    case "question_count":
    case "description_length":
    case "bullet_point_count":
    case "shipping_days":
    case "variant_count":
    case "best_seller_rank":
      return typeof extracted[dependency] === "number";
    case "image_count":
      return typeof extracted.image_count === "number" && extracted.image_count > 0;
    case "has_video":
    case "has_add_to_cart":
    case "has_shipping_info":
    case "has_free_shipping":
    case "has_return_info":
    case "has_specs":
    case "has_faq":
    case "has_brand_page":
    case "official_seller":
    case "has_campaign":
    case "is_best_seller":
      return typeof extracted[dependency] === "boolean";
    default:
      return false;
  }
}

function sanitizeWeaknesses(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text.trim() : "";
      const depends_on = sanitizeDependsOn(record.depends_on);

      if (!text || depends_on.length === 0) return null;

      return {
        text,
        depends_on,
      };
    })
    .filter(
      (
        item
      ): item is {
        text: string;
        depends_on: SupportedDependency[];
      } => item !== null
    )
    .slice(0, 5);
}

function sanitizeSuggestions(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title =
        typeof record.title === "string" ? record.title.trim() : "";
      const detail =
        typeof record.detail === "string" ? record.detail.trim() : "";
      const severity =
        record.severity === "high" ||
        record.severity === "medium" ||
        record.severity === "low"
          ? record.severity
          : "medium";
      const depends_on = sanitizeDependsOn(record.depends_on);

      if (!title || !detail || depends_on.length === 0) return null;

      return {
        key: sanitizeKey(record.key, `ai-suggestion-${index + 1}`),
        severity,
        title,
        detail,
        depends_on,
      };
    })
    .filter((item): item is AiSuggestionItem => item !== null)
    .slice(0, 5);
}

function sanitizeAiResult(raw: unknown): RawAiAnalysisResult | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const summary =
    typeof record.summary === "string" ? record.summary.trim() : "";
  const strengths = asStringArray(record.strengths, 4);
  const weaknesses = sanitizeWeaknesses(record.weaknesses);
  const suggestions = sanitizeSuggestions(record.suggestions);
  const seo_score = scoreToRange(record.seo_score);
  const conversion_score = scoreToRange(record.conversion_score);
  const overall_score = scoreToRange(record.overall_score);

  if (!summary) return null;
  if (seo_score == null || conversion_score == null || overall_score == null) {
    return null;
  }

  return {
    summary,
    strengths,
    weaknesses,
    suggestions,
    seo_score,
    conversion_score,
    overall_score,
  };
}

function postProcessAiResult(
  result: RawAiAnalysisResult,
  extracted: ExtractedProductFields,
  learningContext?: LearningContext | null
): AiAnalysisResult {
  const weaknesses = result.weaknesses
    .filter((item) =>
      item.depends_on.every((dependency) => hasDependencyData(dependency, extracted))
    )
    .map((item) => item.text)
    .slice(0, 5);

  const suggestions = result.suggestions
    .filter((item) =>
      item.depends_on.every((dependency) => hasDependencyData(dependency, extracted))
    )
    .map((item) => ({
      key: item.key,
      severity: item.severity,
      title: item.title,
      detail: item.detail,
    }))
    .slice(0, 5);

  const baseSummary = result.summary
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const summary =
    baseSummary.includes("[SISTEM OGRENISI]:")
      ? baseSummary
      : `${baseSummary}\n[SISTEM OGRENISI]: ${
          learningContext?.systemLearning ||
          "Bu kategoride yeterli tarihsel ogrenim birikmedigi icin sistem ilk benchmark setini olusturuyor."
        }`;

  return {
    summary,
    strengths: result.strengths,
    weaknesses,
    suggestions,
    seo_score: result.seo_score,
    conversion_score: result.conversion_score,
    overall_score: result.overall_score,
  };
}

function buildStrategicSections(params: {
  packet: DecisionSupportPacket;
  extracted: ExtractedProductFields;
  learningContext?: LearningContext | null;
  missingDataReport?: MissingDataReport | null;
}) {
  const { extracted, learningContext, missingDataReport } = params;
  const weaknesses: AiWeaknessItem[] = [];
  const suggestions: AiSuggestionItem[] = [];
  const strengths: string[] = [];

  const price = extracted.normalized_price;
  const cheapest = extracted.other_sellers_summary?.min_price ?? null;
  const avgCompetitor = extracted.other_sellers_summary?.avg_price ?? null;
  const cheaperCount = extracted.other_sellers_summary?.cheaper_count ?? null;
  const fastDeliveryCount = extracted.other_sellers_summary?.fast_delivery_count ?? null;
  const priceDelta =
    typeof price === "number" && typeof cheapest === "number"
      ? Number((price - cheapest).toFixed(2))
      : null;
  const avgDelta =
    typeof price === "number" && typeof avgCompetitor === "number"
      ? Number((price - avgCompetitor).toFixed(2))
      : null;
  const isOutOfStock =
    extracted.stock_status?.toLocaleLowerCase("tr-TR").includes("tuk") ||
    extracted.stock_status?.toLocaleLowerCase("tr-TR").includes("stokta yok") ||
    extracted.stock_quantity === 0;
  const titleStrong = hasText(extracted.title) && hasText(extracted.h1);
  const contentWeak =
    (extracted.description_length ?? 0) < 120 || extracted.has_specs === false;
  const favoriteHigh = (extracted.favorite_count ?? 0) >= 500000;
  const reviewWeak =
    (extracted.review_count ?? 0) < 50 ||
    (!!extracted.review_summary &&
      extracted.review_summary.sampled_count > 0 &&
      extracted.review_summary.low_rated_count >=
        Math.max(2, Math.ceil(extracted.review_summary.sampled_count * 0.4)));
  const slowDelivery = typeof extracted.shipping_days === "number" && extracted.shipping_days >= 6;
  const competitorDeliveryBetter = typeof fastDeliveryCount === "number" && fastDeliveryCount >= 2;
  const sellerTrustWeak =
    typeof extracted.seller_score === "number" && extracted.seller_score < 7.5;

  if (
    typeof extracted.rating_value === "number" &&
    extracted.rating_value >= 4.3 &&
    (extracted.review_count ?? 0) >= 100
  ) {
    strengths.push("Yorum hacmi ve puan seviyesi temel sosyal kaniti destekliyor.");
  }
  if (typeof priceDelta === "number" && priceDelta <= 0) {
    strengths.push("Rakip fiyat bandina gore fiyat avantaji gorunuyor.");
  }
  if (extracted.has_free_shipping) {
    strengths.push("Ucretsiz kargo sinyali teklif gucunu destekliyor.");
  }
  if (extracted.official_seller) {
    strengths.push("Resmi satici sinyali guven tarafini destekliyor.");
  }
  if (extracted.is_best_seller && typeof extracted.best_seller_rank === "number") {
    strengths.push(`Kategori liderligi sinyali mevcut: En Cok Satilan #${extracted.best_seller_rank}.`);
  }

  let criticalDiagnosis = "Veri yetersizligi nedeniyle ana darbozagin bir kismi analiz disi birakildi.";
  let dataCollision =
    "Veri yetersizligi nedeniyle capraz sorgu sinirli kapsama sahip.";

  if (isOutOfStock) {
    criticalDiagnosis =
      "Veriler gosteriyor ki urun stokta olmadigi icin satisin onundeki ana darbozag dogrudan erisilebilirlik problemi.";
    dataCollision =
      "Stok durumu satisi sifirlarken diger fiyat, yorum veya guven sinyalleri ikinci planda kaliyor.";
    weaknesses.push({
      text: "Stok olmadigi icin urun satin alma akisinin disina dusuyor.",
      depends_on: ["stock_status", "stock_quantity"],
    });
    suggestions.push({
      key: "restore-stock-first",
      severity: "high",
      title: "Stogu once geri acin",
      detail:
        "Veriler stok kesintisi gosteriyor; urun listede kalsa da satis akisi durur, bu nedenle once stok ve varyant erisilebilirligini normale dondurun.",
      depends_on: ["stock_status", "stock_quantity"],
    });
  } else if (
    typeof priceDelta === "number" &&
    priceDelta > 0 &&
    ((typeof avgCompetitor === "number" && typeof avgDelta === "number" && avgDelta / avgCompetitor >= 0.5) ||
      (typeof cheapest === "number" && priceDelta / cheapest >= 0.5))
  ) {
    criticalDiagnosis =
      `Veriler gosteriyor ki fiyat bariyeri ana darbozagi olusturuyor; mevcut teklif rakip bandinin belirgin sekilde ustunde konumlaniyor.`;
    dataCollision =
      `Kendi fiyatin ${formatPrice(price)} seviyesindeyken en dusuk rakip ${formatPrice(
        cheapest
      )} bandinda; fiyat algisi urun detayindan once satin alma istegini kiriyor.`;
    weaknesses.push({
      text: "Fiyat rakip bandinin belirgin ustunde kaldigi icin teklif rekabetci degil.",
      depends_on: ["normalized_price", "other_sellers_summary"],
    });
  } else if (typeof priceDelta === "number" && priceDelta <= 0 && slowDelivery) {
    criticalDiagnosis =
      "Veriler gosteriyor ki fiyat avantaji olmasina ragmen teslimat hizi satisi baskiliyor.";
    dataCollision =
      `Fiyat liderligi korunurken teslimat suresi ${extracted.shipping_days} gun seviyesine cikiyor; musteri benzer fiyat bandinda daha hizli teslim edilen rakibe kayabilir.`;
    weaknesses.push({
      text: "Fiyat avantaji teslimat yavasligi nedeniyle etkisini kaybediyor.",
      depends_on: ["normalized_price", "shipping_days", "other_sellers_summary"],
    });
  } else if (titleStrong && contentWeak) {
    criticalDiagnosis =
      "Veriler gosteriyor ki gorunurluk var ama urun detayi ikna etmeye yetmedigi icin karar asamasinda kopus yasaniyor.";
    dataCollision =
      "Baslik ve temel listeleme sinyali mevcutken aciklama ve ozellik alani zayif; trafik urune geliyor ama urun detayi sorulari kapatamiyor.";
    weaknesses.push({
      text: "Baslik calisiyor ancak aciklama ve ozellik alani karar vermeyi desteklemiyor.",
      depends_on: ["title", "h1", "description_length", "has_specs"],
    });
  } else if (favoriteHigh && reviewWeak) {
    criticalDiagnosis =
      "Veriler gosteriyor ki urun ilgi cekiyor ancak sepet oncesi guven veya teklif bariyeri satisa donusmeyi kesiyor.";
    dataCollision =
      `Favori hacmi yuksek kalirken yorum ve sosyal kanit hizi bunu takip etmiyor; musteri urunu istiyor ama satin alma asamasinda cekiniyor.`;
    weaknesses.push({
      text: "Yuksek ilgi satisa donusmedigi icin sepet oncesi surtunme olusuyor.",
      depends_on: ["favorite_count", "review_count", "review_summary"],
    });
  } else if (sellerTrustWeak) {
    criticalDiagnosis =
      "Veriler gosteriyor ki guven bariyeri fiyat ve icerik sinyallerinin onune geciyor.";
    dataCollision =
      "Urun verisi mevcut olsa da satici puani zayif kaldigi icin musteri satin alma kararinda risk algiliyor.";
    weaknesses.push({
      text: "Satici puani guven tarafinda karar kirici bir bariyer olusturuyor.",
      depends_on: ["seller_score"],
    });
  } else if (typeof cheaperCount === "number" && cheaperCount > 0) {
    criticalDiagnosis =
      "Veriler gosteriyor ki ayni urunde rakip fiyat baskisi ana darbozaga donusuyor.";
    dataCollision =
      `En az ${cheaperCount} rakip daha dusuk fiyatla gorunuyor; urun detayi yeterli olsa bile teklif farki karar aninda rakibe alan aciyor.`;
    weaknesses.push({
      text: "Daha ucuz rakipler nedeniyle teklif algisi zayif kaliyor.",
      depends_on: ["other_sellers_summary", "normalized_price"],
    });
  }

  if (titleStrong && contentWeak) {
    suggestions.push({
      key: "strengthen-detail-conviction",
      severity: "high",
      title: "Detay sayfasini ikna edici hale getirin",
      detail:
        "Baslik ve listeleme sinyali calisiyor ancak aciklama ve ozellik alani zayif kaldigi icin musteri karar veremiyor; ilk blokta kullanim, fark ve teknik ozellikleri daha net katmanlayin.",
      depends_on: ["title", "h1", "description_length", "has_specs"],
    });
  }

  if (favoriteHigh && reviewWeak) {
    suggestions.push({
      key: "unlock-cart-barrier",
      severity: "high",
      title: "Sepet oncesi bariyeri azaltin",
      detail:
        "Favori ilgisi yuksek ama satis hizi bunu izlemiyor; teslimat, iade, garanti ve en kritik itirazlari ust blokta daha gorunur vererek tereddudu azaltin.",
      depends_on: ["favorite_count", "review_count", "review_summary", "has_return_info"],
    });
  }

  if (typeof priceDelta === "number" && priceDelta > 0) {
    suggestions.push({
      key: "close-price-gap",
      severity: "high",
      title: "Rakip fiyat farkini kapatin",
      detail:
        `Veriler rakip min fiyat ile aranda ${formatPrice(priceDelta)} fark oldugunu gosteriyor; fiyat, kupon veya kargo paketini bu farki azaltacak sekilde yeniden konumlandirin.`,
      depends_on: ["normalized_price", "other_sellers_summary"],
    });
  }

  if (slowDelivery || competitorDeliveryBetter) {
    suggestions.push({
      key: "fix-delivery-penalty",
      severity: slowDelivery ? "high" : "medium",
      title: "Teslimat cezasini dusurun",
      detail:
        slowDelivery
          ? `Teslimat suresi ${extracted.shipping_days} gun bandinda oldugu icin fiyat avantaji eriyor; hizli sevk, net teslim vaadi veya ayni fiyat bandinda daha hizli alternatif paket sunun.`
          : "Rakiplerde hizli teslimat sinyali birikiyor; teslimat vaadini ust alanda daha netlestirip sevk hizini rekabetci hale getirin.",
      depends_on: slowDelivery
        ? ["shipping_days", "delivery_type", "other_sellers_summary"]
        : ["delivery_type", "other_sellers_summary"],
    });
  }

  if (sellerTrustWeak) {
    suggestions.push({
      key: "reinforce-trust-signals",
      severity: "medium",
      title: "Guven sinyallerini sertlestirin",
      detail:
        "Satici puani zayif kaldigi icin musteri risk algiliyor; resmi satici, garanti, iade ve olumlu yorum sinyallerini ilk karar alaninda daha gorunur hale getirin.",
      depends_on: ["seller_score", "official_seller", "has_return_info", "review_count"],
    });
  }

  if (Array.isArray(extracted.qa_snippets) && extracted.qa_snippets.length > 0) {
    suggestions.push({
      key: "promote-faq-answers",
      severity: "low",
      title: "En cok sorulanlari ustte cevaplayin",
      detail:
        "Soru-cevap ornekleri musteri tereddudunun tekrar ettigini gosteriyor; ayni sorulari aciklama ve SSS alanina tasiyarak karar suresini kisaltin.",
      depends_on: ["qa_snippets", "has_faq", "description_length"],
    });
  }

  const recipeLines = suggestions
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${item.title}: ${item.detail}`);

  while (recipeLines.length < 3) {
    recipeLines.push(
      `${recipeLines.length + 1}. Veri yetersizligi nedeniyle bu alan analiz disi birakildi.`
    );
  }

  const unresolvedCritical = missingDataReport?.unresolvedCriticalFields ?? [];
  const unresolvedCriticalText =
    unresolvedCritical.length > 0
      ? ` Veri yetersizligi nedeniyle su kritik alanlar analiz disi kaldi: ${unresolvedCritical.join(", ")}.`
      : "";

  const systemLearning =
    learningContext?.systemLearning ||
    "Bu kategoride yeterli tarihsel ogrenim birikmedigi icin sistem ilk benchmark setini olusturuyor.";

  const summary = [
    `[KRITIK TESHIS]: ${criticalDiagnosis}${unresolvedCriticalText}`,
    `[VERI CARPISTIRMA]: ${dataCollision}${unresolvedCriticalText}`,
    `[STRATEJIK RECETE]:`,
    ...recipeLines,
    `[SISTEM OGRENISI]: ${systemLearning}`,
  ].join("\n");

  return {
    summary,
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 5),
    suggestions: suggestions.slice(0, 5),
  };
}

function buildDeterministicFallback(params: {
  packet: DecisionSupportPacket;
  extracted: ExtractedProductFields;
  learningContext?: LearningContext | null;
  missingDataReport?: MissingDataReport | null;
}) {
  const strategic = buildStrategicSections(params);

  return {
    summary: strategic.summary,
    strengths: strategic.strengths,
    weaknesses: strategic.weaknesses.map((item) => item.text),
    suggestions: strategic.suggestions.map((item) => ({
      key: item.key,
      severity: item.severity,
      title: item.title,
      detail: item.detail,
    })),
    seo_score: scoreToRange(params.packet.metrics.contentQuality.score) ?? 0,
    conversion_score: scoreToRange(params.packet.metrics.offerStrength.score) ?? 0,
    overall_score:
      scoreToRange(
        ((params.packet.metrics.contentQuality.score ?? 0) +
          (params.packet.metrics.trustStrength.score ?? 0) +
          (params.packet.metrics.offerStrength.score ?? 0) +
          (params.packet.metrics.decisionClarity.score ?? 0)) /
          4
      ) ?? 0,
  } satisfies AiAnalysisResult;
}

export async function analyzeWithAi(params: {
  packet: DecisionSupportPacket;
  extracted: ExtractedProductFields;
  url: string;
  learningContext?: LearningContext | null;
  missingDataReport?: MissingDataReport | null;
}): Promise<AiAnalysisResult | null> {
  try {
    if (!genAI) {
      console.warn(
        "AI analysis fallback active: GEMINI_API_KEY is missing, deterministic strategy engine will be used."
      );
      return buildDeterministicFallback(params);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      } as never,
    });

    const prompt = buildPrompt(
      params.packet,
      params.url,
      params.learningContext,
      params.missingDataReport
    );
    const result = await model.generateContent(prompt);
    const text = cleanJsonText(result.response.text());
    const parsed = JSON.parse(text) as unknown;
    const sanitized = sanitizeAiResult(parsed);

    if (!sanitized) {
      return buildDeterministicFallback(params);
    }

    return postProcessAiResult(sanitized, params.extracted, params.learningContext);
  } catch (err) {
    console.error("AI analysis error:", err);
    return buildDeterministicFallback(params);
  }
}
