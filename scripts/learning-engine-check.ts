import { getLearningContext, getLearningEngineState, recordLearningArtifacts } from "../lib/learning-engine";
import { createExtracted } from "./analysis-fixtures";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

async function run() {
  const checks: Check[] = [];

  const state = getLearningEngineState();
  checks.push({
    label: "learning engine state is explicit",
    passed:
      typeof state.enabled === "boolean" &&
      (state.mode === "active" || state.mode === "safe_noop"),
    detail: state,
  });

  const extracted = createExtracted({ extractor_status: "ok" });
  const context = await getLearningContext({
    platform: "trendyol",
    category: "Elektronik",
    brand: extracted.brand,
    extracted,
    includeSynthetic: true,
  });

  checks.push({
    label: "learning context is safe and minimal",
    passed:
      context.benchmark === null &&
      Array.isArray(context.rules) &&
      context.rules.length === 0 &&
      Array.isArray(context.memorySnippets) &&
      context.memorySnippets.length === 0,
    detail: context,
  });

  await recordLearningArtifacts({
    reportId: null,
    platform: "trendyol",
    category: "Elektronik",
    extracted,
    summary: "test",
    overallScore: 70,
    sourceType: "real",
  });

  checks.push({
    label: "recordLearningArtifacts resolves safely",
    passed: true,
  });

  const failed = checks.filter((item) => !item.passed);
  console.log(
    JSON.stringify(
      {
        total: checks.length,
        passed: checks.length - failed.length,
        failed: failed.length,
        checks,
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
