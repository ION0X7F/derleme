import * as cheerio from "cheerio";
import { fetchPageHtml } from "@/lib/fetch-page-html";
import { detectPlatform } from "@/lib/detect-platform";
import { extractTrendyolFields } from "@/lib/extractors/platforms/trendyol";
import { extractHepsiburadaFields } from "@/lib/extractors/platforms/hepsiburada";
import { extractAmazonFields } from "@/lib/extractors/platforms/amazon";
import { extractN11Fields } from "@/lib/extractors/platforms/n11";

async function run() {
  const url = process.argv[2];

  if (!url) {
    console.error("Kullanim: npx tsx scripts/test-extractors.ts <url>");
    process.exit(1);
  }

  console.log("URL:", url);

  const platform = detectPlatform(url);
  console.log("PLATFORM:", platform);

  const html = await fetchPageHtml(url);

  console.log("HTML LENGTH:", html.length);
  console.log("HTML PREVIEW:", html.slice(0, 500).replace(/\s+/g, " "));

  const $ = cheerio.load(html);

  let result: Record<string, unknown> = {};

  if (platform === "trendyol") {
    result = extractTrendyolFields({ $, html, url });
  } else if (platform === "hepsiburada") {
    result = extractHepsiburadaFields({ $, html, url });
  } else if (platform === "amazon") {
    result = extractAmazonFields({ $, html, url });
  } else if (platform === "n11") {
    result = extractN11Fields({ $, html, url });
  } else {
    console.log(
      "Bu script su an sadece trendyol / hepsiburada / amazon / n11 test ediyor."
    );
    process.exit(0);
  }

  console.log("RESULT:");
  console.dir(result, { depth: null });
}

run().catch((error) => {
  console.error("TEST ERROR:");
  console.error(error);
  process.exit(1);
});
