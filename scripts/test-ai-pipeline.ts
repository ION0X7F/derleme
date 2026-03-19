import fs from "node:fs";
import path from "node:path";
import { fetchPageHtml } from "@/lib/fetch-page-html";
import { extractFieldsWithFallback } from "@/lib/extractors";
import { fetchTrendyolApi } from "@/lib/fetch-trendyol-api";
import { buildAnalysis } from "@/lib/build-analysis";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, "$1");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function detectCategory(params: {
  url: string;
  title?: string | null;
  h1?: string | null;
  brand?: string | null;
  product_name?: string | null;
}) {
  const text = `${params.url} ${params.title || ""} ${params.h1 || ""} ${
    params.brand || ""
  } ${params.product_name || ""}`.toLowerCase();

  if (
    text.includes("ayakkabi") ||
    text.includes("sneaker") ||
    text.includes("bot") ||
    text.includes("terlik") ||
    text.includes("cizme")
  ) {
    return "Ayakkabi";
  }

  if (
    text.includes("tisort") ||
    text.includes("gomlek") ||
    text.includes("pantolon") ||
    text.includes("ceket") ||
    text.includes("elbise") ||
    text.includes("mont")
  ) {
    return "Giyim";
  }

  if (text.includes("kitap") || text.includes("roman") || text.includes("yazar")) {
    return "Kitap";
  }

  if (
    text.includes("telefon") ||
    text.includes("kulaklik") ||
    text.includes("tablet") ||
    text.includes("laptop") ||
    text.includes("bilgisayar")
  ) {
    return "Elektronik";
  }

  return "General";
}

async function run() {
  loadLocalEnv();

  const { analyzeWithAi } = await import("@/lib/ai-analysis");

  const url = process.argv[2];

  if (!url) {
    console.error("Kullanim: npx tsx scripts/test-ai-pipeline.ts <url>");
    process.exit(1);
  }

  console.log("URL:", url);

  const html = await fetchPageHtml(url);
  const extraction = extractFieldsWithFallback({ url, html });
  const extracted = extraction.mergedFields;

  if (url.toLowerCase().includes("trendyol.com")) {
    const apiData = await fetchTrendyolApi(url);

    if (apiData) {
      if (apiData.seller?.seller_name && !extracted.seller_name) {
        extracted.seller_name = apiData.seller.seller_name;
      }
      if (
        typeof apiData.original_price === "number" &&
        typeof extracted.original_price !== "number"
      ) {
        extracted.original_price = apiData.original_price;
      }
      if (
        typeof apiData.discount_rate === "number" &&
        typeof extracted.discount_rate !== "number"
      ) {
        extracted.discount_rate = apiData.discount_rate;
      }
      if (apiData.has_free_shipping) {
        extracted.has_free_shipping = true;
      }
      if (
        typeof apiData.variant_count === "number" &&
        typeof extracted.variant_count !== "number"
      ) {
        extracted.variant_count = apiData.variant_count;
      }
      if (
        typeof apiData.question_count === "number" &&
        typeof extracted.question_count !== "number"
      ) {
        extracted.question_count = apiData.question_count;
      }
    }
  }

  const category = detectCategory({
    url,
    title: extracted.title,
    h1: extracted.h1,
    brand: extracted.brand,
    product_name: extracted.product_name,
  });

  const analysis = buildAnalysis({
    platform: extraction.platform,
    url,
    extracted: { ...extracted, category },
    planContext: "pro",
  });

  const aiResult = await analyzeWithAi({
    packet: analysis.decisionSupportPacket,
    extracted: analysis.extractedData,
    url,
  });

  console.log("EXTRACTED:");
  console.dir({ ...extracted, category }, { depth: null });

  console.log("AI RESULT:");
  console.dir(aiResult, { depth: null });
}

run().catch((error) => {
  console.error("TEST ERROR:");
  console.error(error);
  process.exit(1);
});
