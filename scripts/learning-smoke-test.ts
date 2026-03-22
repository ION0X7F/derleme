import "dotenv/config";
import { buildAnalysisTrace } from "../lib/analysis-trace";
import { prisma } from "../lib/prisma";
import { getLearningContext, recordLearningArtifacts } from "../lib/learning-engine";
import { analyzeWithAi } from "../lib/ai-analysis";
import { isAiAnalysisEligible } from "../lib/ai-eligibility";
import { buildAnalysis } from "../lib/build-analysis";
import { prepareAnalysisInput } from "../lib/prepare-analysis-input";
import {
  createExtracted,
  TEST_CATEGORY,
  TEST_PLATFORM,
  TEST_STRUCTURED_SUMMARY,
  TEST_URL,
} from "./analysis-fixtures";

async function main() {
  const category = TEST_CATEGORY;
  const platform = TEST_PLATFORM;

  await prisma.learnedRule.deleteMany({ where: { platform, category } });
  await prisma.categoryBenchmark.deleteMany({ where: { platform, category } });
  await prisma.learningMemory.deleteMany({ where: { platform, category } });

  const trainingSet = [
    createExtracted({
      normalized_price: 1099,
      shipping_days: 2,
      image_count: 11,
      has_video: true,
      official_seller: true,
    }),
    createExtracted({
      normalized_price: 1199,
      shipping_days: 2,
      image_count: 12,
      has_video: true,
      official_seller: true,
    }),
    createExtracted({
      normalized_price: 999,
      shipping_days: 1,
      image_count: 10,
      has_video: true,
      official_seller: false,
      is_best_seller: true,
      best_seller_rank: 1,
      best_seller_badge: "En Cok Satilan #1",
    }),
    createExtracted({
      normalized_price: 1299,
      shipping_days: 3,
      image_count: 9,
      has_video: true,
      official_seller: true,
    }),
    createExtracted({
      normalized_price: 1049,
      shipping_days: 2,
      image_count: 10,
      has_video: false,
      official_seller: false,
    }),
  ];

  for (const extracted of trainingSet) {
    await recordLearningArtifacts({
      reportId: null,
      platform,
      category,
      extracted,
      summary: TEST_STRUCTURED_SUMMARY,
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
  const consolidatedInput = prepareAnalysisInput(currentExtracted, undefined);

  const analysis = buildAnalysis({
    platform,
    url: TEST_URL,
    consolidatedInput,
    extracted: currentExtracted,
    planContext: "pro",
  });
  const eligibility = isAiAnalysisEligible(consolidatedInput);

  const ai = await analyzeWithAi({
    consolidatedInput,
    packet: analysis.decisionSupportPacket,
    extracted: currentExtracted,
    url: TEST_URL,
    learningContext,
    eligibility,
  });
  const analysisTrace =
    ai
      ? buildAnalysisTrace({
          mode: "deterministic",
          summary: ai.summary,
          suggestions: ai.suggestions,
          packet: analysis.decisionSupportPacket,
          extracted: analysis.extractedData,
          derivedMetrics: analysis.derivedMetrics,
          seoScore: ai.seo_score,
          conversionScore: ai.conversion_score,
          overallScore: ai.overall_score,
          learningContext,
        })
      : null;

  console.log(
    JSON.stringify(
      {
        learningContext,
        summary: ai?.summary,
        suggestions: ai?.suggestions,
        analysisTrace,
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
