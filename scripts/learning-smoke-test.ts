import "dotenv/config";
import { prisma } from "../lib/prisma";
import { getLearningContext, recordLearningArtifacts } from "../lib/learning-engine";
import { analyzeWithAi } from "../lib/ai-analysis";
import { buildAnalysis } from "../lib/build-analysis";
import type { ExtractedProductFields } from "../types/analysis";

function createExtracted(overrides: Partial<ExtractedProductFields>): ExtractedProductFields {
  return {
    title: "Test Elektronik Urun",
    meta_description: "Test urun aciklamasi",
    h1: "Test Elektronik Urun",
    brand: "TestBrand",
    product_name: "Test Urun",
    model_code: "TB-1234",
    sku: null,
    mpn: null,
    gtin: null,
    price: "999 TL",
    normalized_price: 999,
    original_price: 1199,
    discount_rate: 17,
    currency: "TRY",
    image_count: 10,
    has_video: true,
    rating_value: 4.7,
    rating_breakdown: null,
    review_count: 2500,
    review_snippets: null,
    qa_snippets: null,
    review_summary: null,
    review_themes: null,
    top_positive_review_hits: null,
    top_negative_review_hits: null,
    question_count: 12,
    description_length: 420,
    bullet_point_count: 6,
    has_add_to_cart: true,
    has_shipping_info: true,
    has_free_shipping: true,
    shipping_days: 2,
    has_return_info: true,
    has_specs: true,
    has_faq: true,
    variant_count: 2,
    stock_quantity: 100,
    stock_status: "in_stock",
    seller_name: "Test Satici",
    merchant_id: 1,
    listing_id: "test-listing",
    seller_badges: ["Hizli Satici"],
    seller_score: 9.2,
    follower_count: 5000,
    favorite_count: 120000,
    other_sellers_count: 5,
    other_seller_offers: null,
    other_sellers_summary: {
      count: 5,
      scored_count: 5,
      avg_score: 8.9,
      top_score: 9.4,
      official_count: 1,
      fast_delivery_count: 3,
      high_follower_count: 1,
      seller_names: ["A", "B", "C"],
      min_price: 950,
      max_price: 1100,
      avg_price: 1010,
      cheapest_seller_name: "A",
      same_price_count: 0,
      cheaper_count: 1,
      more_expensive_count: 4,
    },
    has_brand_page: true,
    official_seller: true,
    has_campaign: true,
    campaign_label: "Kargo Bedava",
    promotion_labels: ["Kargo Bedava"],
    delivery_type: "fast_delivery",
    is_best_seller: false,
    best_seller_rank: null,
    best_seller_badge: null,
    category: "__TEST_Elektronik",
    extractor_status: "ok",
    platform: "trendyol",
    ...overrides,
  };
}

async function main() {
  const category = "__TEST_Elektronik";
  const platform = "trendyol";

  await prisma.learnedRule.deleteMany({ where: { platform, category } });
  await prisma.categoryBenchmark.deleteMany({ where: { platform, category } });
  await prisma.learningMemory.deleteMany({ where: { platform, category } });

  const trainingSet = [
    createExtracted({ normalized_price: 1099, shipping_days: 2, image_count: 11, has_video: true, official_seller: true }),
    createExtracted({ normalized_price: 1199, shipping_days: 2, image_count: 12, has_video: true, official_seller: true }),
    createExtracted({ normalized_price: 999, shipping_days: 1, image_count: 10, has_video: true, official_seller: false, is_best_seller: true, best_seller_rank: 1, best_seller_badge: "En Cok Satilan #1" }),
    createExtracted({ normalized_price: 1299, shipping_days: 3, image_count: 9, has_video: true, official_seller: true }),
    createExtracted({ normalized_price: 1049, shipping_days: 2, image_count: 10, has_video: false, official_seller: false }),
  ];

  for (const extracted of trainingSet) {
    await recordLearningArtifacts({
      platform,
      category,
      extracted,
      summary:
        "[KRITIK TESHIS]: Test lider urun.\n[VERI CARPISTIRMA]: Test veri.\n[STRATEJIK RECETE]:\n1. Test.\n2. Test.\n3. Test.\n[SISTEM OGRENISI]: Test bellegi.",
      overallScore: 86,
      sourceType: "synthetic",
    });
  }

  const currentExtracted = createExtracted({
    normalized_price: 999,
    shipping_days: 8,
    image_count: 4,
    has_video: false,
    official_seller: false,
    favorite_count: 600000,
    review_count: 80,
    review_summary: {
      sampled_count: 4,
      low_rated_count: 2,
      positive_count: 2,
      negative_count: 2,
    },
  });

  const learningContext = await getLearningContext({
    platform,
    category,
    brand: currentExtracted.brand,
    extracted: currentExtracted,
    includeSynthetic: true,
  });

  const analysis = buildAnalysis({
    platform,
    url: "https://www.trendyol.com/test",
    extracted: currentExtracted,
    planContext: "pro",
  });

  const ai = await analyzeWithAi({
    packet: analysis.decisionSupportPacket,
    extracted: currentExtracted,
    url: "https://www.trendyol.com/test",
    learningContext,
  });

  console.log(
    JSON.stringify(
      {
        learningContext,
        summary: ai?.summary,
        suggestions: ai?.suggestions,
      },
      null,
      2
    )
  );

  await prisma.learnedRule.deleteMany({ where: { platform, category } });
  await prisma.categoryBenchmark.deleteMany({ where: { platform, category } });
  await prisma.learningMemory.deleteMany({ where: { platform, category } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
