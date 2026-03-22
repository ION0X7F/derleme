import fs from "node:fs";
import path from "node:path";
import { runAnalysisPipeline } from "@/lib/run-analysis";

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

async function run() {
  loadLocalEnv();

  const url = process.argv[2];

  if (!url) {
    console.error("Kullanim: npx tsx scripts/test-ai-pipeline.ts <url>");
    process.exit(1);
  }

  console.log("URL:", url);

  const pipeline = await runAnalysisPipeline({
    url,
    planContext: "pro",
    learningSourceType: "real",
  });

  console.log("EXTRACTED:");
  console.dir(pipeline.analysis.extractedData, { depth: null });

  console.log("MISSING DATA REPORT:");
  console.dir(pipeline.missingDataReport, { depth: null });

  console.log("LEARNING CONTEXT:");
  console.dir(pipeline.learningContext, { depth: null });

  console.log("FINAL ANALYSIS:");
  console.dir(
    {
      category: pipeline.category,
      learningStatus: pipeline.learningStatus,
      analysis: pipeline.analysis,
    },
    { depth: null }
  );
}

run().catch((error) => {
  console.error("TEST ERROR:");
  console.error(error);
  process.exit(1);
});
