import { runAnalysisPipeline } from "@/lib/run-analysis";

type ProductCheck = {
  url: string;
  platform?: string | null;
  title?: string | null;
  overallScore?: number | null;
  seoScore?: number | null;
  conversionScore?: number | null;
  dataCompletenessScore?: number | null;
  metaFound?: boolean;
  metaSource?: string | null;
  headingFound?: boolean;
  headingSource?: string | null;
  skuFound?: boolean;
  skuSource?: string | null;
  mpnFound?: boolean;
  mpnSource?: string | null;
  gtinFound?: boolean;
  gtinSource?: string | null;
  dataSource?: string | null;
  summary?: string | null;
  error?: string;
};

const urls = [
  "https://www.trendyol.com/apple/iphone-16-pro-max-256gb-siyah-titanyum-p-857296077",
  "https://www.trendyol.com/xiaomi/redmi-buds-6-play-siyah-kulakici-kulaklik-gurultu-onleme-bt5-4-ios-android-xiaomi-tr-garantili-p-855229295?boutiqueId=61",
  "https://www.trendyol.com/caykur/rize-turist-cay-500gr-p-4409228",
  "https://www.trendyol.com/cocuk-akademi/7-den-70-e-turkiye-atlasi-p-937160613?boutiqueId=61",
  "https://www.trendyol.com/zbclub/beyaz-unisex-running-sneaker-ayakkabi-p-1118369786",
  "https://www.trendyol.com/apple/iphone-16e-128gb-siyah-p-900754126",
  "https://www.trendyol.com/royal-canin/sterilised-37-kisirlastirilmis-yetiskin-kedi-mamasi-15-kg-p-73292418",
  "https://www.trendyol.com/regal/cm-60100-camasir-makinesi-p-917432292?boutiqueId=61&merchantId=144831",
  "https://www.trendyol.com/delta/konfor-zemin-10-mm-tasima-askili-pilates-minderi-yoga-mati-mor-p-3701455?boutiqueId=61",
  "https://www.trendyol.com/teksmoda-her-moda-onda/kapsonlu-kiz-erkek-cocuk-bornozu-pamuklu-dino-p-832924317?boutiqueId=61",
];

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length === 0) return null;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1));
}

async function run() {
  const results: ProductCheck[] = [];

  for (const [index, url] of urls.entries()) {
    console.log(`[${index + 1}/${urls.length}] Test ediliyor: ${url}`);

    try {
      const pipeline = await runAnalysisPipeline({
        url,
        planContext: "pro",
        learningSourceType: "real",
      });

      const extracted = pipeline.analysis.extractedData ?? {};

      results.push({
        url,
        platform: pipeline.platform,
        title:
          (typeof extracted.resolved_primary_heading === "string" &&
            extracted.resolved_primary_heading) ||
          (typeof extracted.h1 === "string" && extracted.h1) ||
          (typeof extracted.title === "string" && extracted.title) ||
          null,
        overallScore: pipeline.analysis.overallScore ?? null,
        seoScore: pipeline.analysis.seoScore ?? null,
        conversionScore: pipeline.analysis.conversionScore ?? null,
        dataCompletenessScore: pipeline.analysis.dataCompletenessScore ?? null,
        metaFound: Boolean(extracted.meta_description),
        metaSource:
          typeof extracted.meta_description_source === "string"
            ? extracted.meta_description_source
            : null,
        headingFound: Boolean(extracted.resolved_primary_heading || extracted.h1),
        headingSource:
          typeof extracted.heading_source === "string" ? extracted.heading_source : null,
        skuFound: Boolean(extracted.sku),
        skuSource:
          typeof extracted.sku_source === "string" ? extracted.sku_source : null,
        mpnFound: Boolean(extracted.mpn),
        mpnSource:
          typeof extracted.mpn_source === "string" ? extracted.mpn_source : null,
        gtinFound: Boolean(extracted.gtin),
        gtinSource:
          typeof extracted.gtin_source === "string" ? extracted.gtin_source : null,
        dataSource: pipeline.analysis.dataSource ?? null,
        summary: pipeline.analysis.summary ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      results.push({
        url,
        error: message,
      });
    }
  }

  const succeeded = results.filter((item) => !item.error);
  const failed = results.filter((item) => item.error);

  const aggregate = {
    total: results.length,
    succeeded: succeeded.length,
    failed: failed.length,
    avgOverallScore: average(succeeded.map((item) => item.overallScore)),
    avgSeoScore: average(succeeded.map((item) => item.seoScore)),
    avgConversionScore: average(succeeded.map((item) => item.conversionScore)),
    avgDataCompletenessScore: average(
      succeeded.map((item) => item.dataCompletenessScore)
    ),
    metaFoundCount: succeeded.filter((item) => item.metaFound).length,
    headingFoundCount: succeeded.filter((item) => item.headingFound).length,
    skuFoundCount: succeeded.filter((item) => item.skuFound).length,
    mpnFoundCount: succeeded.filter((item) => item.mpnFound).length,
    gtinFoundCount: succeeded.filter((item) => item.gtinFound).length,
  };

  console.log("\n=== AGGREGATE ===");
  console.log(JSON.stringify(aggregate, null, 2));
  console.log("\n=== RESULTS ===");
  console.log(JSON.stringify(results, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
