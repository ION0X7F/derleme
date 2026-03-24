import { evaluateAnalysisContract } from "../lib/analysis-contract";
import { isAiAnalysisEligible } from "../lib/ai-eligibility";
import { prepareAnalysisInput } from "../lib/prepare-analysis-input";
import type { ExtractedFieldMetadata, ExtractedProductFields } from "../types/analysis";
import { createExtracted } from "./analysis-fixtures";

function makeMetadata(
  extracted: ExtractedProductFields
): Record<string, ExtractedFieldMetadata> {
  const metadata: Record<string, ExtractedFieldMetadata> = {};

  for (const key of Object.keys(extracted) as Array<keyof ExtractedProductFields>) {
    const value = extracted[key];
    if (value == null || value === "") {
      metadata[String(key)] = {
        source: "null",
        confidence: "low",
        reason: "missing value",
        timestamp: Date.now(),
      };
      continue;
    }

    metadata[String(key)] = {
      source: "platform",
      confidence: "high",
      reason: "platform extractor",
      timestamp: Date.now(),
    };
  }

  return metadata;
}

type Check = { label: string; passed: boolean; detail?: unknown };

function runScenario(extracted: ExtractedProductFields) {
  const input = prepareAnalysisInput(extracted, makeMetadata(extracted));
  const aiEligibility = isAiAnalysisEligible(input);
  const contract = evaluateAnalysisContract({ input, aiEligibility });
  return { aiEligibility, contract };
}

function run() {
  const checks: Check[] = [];

  const strong = runScenario(createExtracted({ extractor_status: "ok" }));
  checks.push({
    label: "strong scenario -> full AI and strong coverage",
    passed:
      strong.contract.coverageTier === "strong" &&
      strong.contract.aiDecision.mode === "full" &&
      strong.contract.aiDecision.executed === true,
    detail: strong.contract,
  });

  const medium = runScenario(
    createExtracted({
      extractor_status: "partial",
      seller_score: undefined,
      review_count: 35,
      description_length: 120,
      image_count: 5,
    })
  );
  checks.push({
    label: "medium scenario -> cautious AI",
    passed:
      medium.contract.aiDecision.mode === "cautious" &&
      medium.contract.aiDecision.executed === true,
    detail: medium.contract,
  });

  const weakByCoverage = runScenario(
    createExtracted({
      extractor_status: "partial",
      title: "Test urun",
      normalized_price: 999,
      brand: undefined,
      image_count: undefined,
      description_length: undefined,
      seller_score: undefined,
      review_count: undefined,
    })
  );
  checks.push({
    label: "weak coverage -> skip AI",
    passed:
      weakByCoverage.contract.coverageTier === "weak" &&
      weakByCoverage.contract.aiDecision.mode === "skip" &&
      weakByCoverage.contract.aiDecision.executed === false,
    detail: weakByCoverage.contract,
  });

  const blocked = runScenario(
    createExtracted({
      extractor_status: "blocked",
    })
  );
  checks.push({
    label: "blocked extractor always yields weak+skip",
    passed:
      blocked.contract.coverageTier === "weak" &&
      blocked.contract.aiDecision.mode === "skip" &&
      blocked.contract.aiDecision.executed === false,
    detail: blocked.contract,
  });

  checks.push({
    label: "blocking fields contain expected core labels",
    passed:
      weakByCoverage.contract.blockingFields.includes("brand") &&
      weakByCoverage.contract.blockingFields.includes("image_count") &&
      weakByCoverage.contract.blockingFields.includes("description_length") &&
      weakByCoverage.contract.blockingFields.includes("seller_score") &&
      weakByCoverage.contract.blockingFields.includes("review_count"),
    detail: weakByCoverage.contract.blockingFields,
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

run();
