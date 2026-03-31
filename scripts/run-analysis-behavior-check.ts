import { buildAnalysis } from "../lib/build-analysis";
import { prepareAnalysisInput } from "../lib/prepare-analysis-input";
import {
  applyPythonBackfill,
  buildCategoryAverages,
  resolvePriorityActions,
  shouldRunPythonBackfill,
} from "../lib/run-analysis-helpers";
import {
  attachDeterministicMetadata,
  enrichAnalysisForDelivery,
} from "../lib/run-analysis-finalize";
import type {
  ExtractedFieldMetadata,
  ExtractedProductFields,
  MissingDataReport,
} from "../types/analysis";
import {
  createExtracted,
  createLearningContext,
  TEST_PLATFORM,
  TEST_URL,
} from "./analysis-fixtures";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function makeMetadata(
  extracted: ExtractedProductFields
): Record<string, ExtractedFieldMetadata> {
  const metadata: Record<string, ExtractedFieldMetadata> = {};

  for (const key of Object.keys(extracted) as Array<keyof ExtractedProductFields>) {
    const value = extracted[key];
    metadata[String(key)] = value == null || value === ""
      ? {
          source: "null",
          confidence: "low",
          reason: "missing value",
          timestamp: Date.now(),
        }
      : {
          source: "platform",
          confidence: "high",
          reason: "platform extractor",
          timestamp: Date.now(),
        };
  }

  return metadata;
}

function createMissingDataReport(): MissingDataReport {
  return {
    before: {
      availableFields: ["title"],
      missingFields: [],
      criticalMissingFields: [],
      importantMissingFields: [],
      optionalMissingFields: [],
    },
    after: {
      availableFields: ["title"],
      missingFields: [],
      criticalMissingFields: [],
      importantMissingFields: [],
      optionalMissingFields: [],
    },
    filledFields: [],
    strengthenedFields: [],
    appliedRules: [],
    unresolvedCriticalFields: [],
    unresolvedReasons: [],
  };
}

async function run() {
  const checks: Check[] = [];

  const backfillTarget = createExtracted({
    original_price: null,
    discount_rate: null,
    follower_count: null,
  });
  checks.push({
    label: "python backfill runs when critical fallback fields are missing",
    passed: shouldRunPythonBackfill(backfillTarget) === true,
  });

  const metadata = makeMetadata(backfillTarget);
  applyPythonBackfill({
    extracted: backfillTarget,
    pythonData: {
      original_price: 1299,
      discount_rate: 23,
      follower_count: 7000,
    },
    fieldMetadata: metadata,
    trace: null,
  });
  checks.push({
    label: "python backfill fills only missing values and marks runtime metadata",
    passed:
      backfillTarget.original_price === 1299 &&
      backfillTarget.discount_rate === 23 &&
      backfillTarget.follower_count === 7000 &&
      metadata.original_price?.source === "runtime_xhr" &&
      metadata.follower_count?.confidence === "medium",
    detail: {
      original_price: backfillTarget.original_price,
      discount_rate: backfillTarget.discount_rate,
      follower_count: backfillTarget.follower_count,
      metadata: {
        original_price: metadata.original_price,
        follower_count: metadata.follower_count,
      },
    },
  });

  const deterministicExtracted = createExtracted({});
  const deterministicInput = prepareAnalysisInput(
    deterministicExtracted,
    makeMetadata(deterministicExtracted)
  );
  const deterministicAnalysis = buildAnalysis({
    platform: TEST_PLATFORM,
    url: TEST_URL,
    consolidatedInput: deterministicInput,
    extracted: deterministicExtracted,
    planContext: "pro",
  });

  const aiOnlyActionAnalysis = {
    ...deterministicAnalysis,
    suggestions: [
      {
        key: "fix-title",
        severity: "high" as const,
        title: "Basligi guclendir",
        detail: "Daha net anahtar kelime kullan.",
      },
    ],
  };
  const resolvedActions = resolvePriorityActions({
    extractedData: aiOnlyActionAnalysis.extractedData,
    derivedMetrics: aiOnlyActionAnalysis.derivedMetrics,
    suggestions: aiOnlyActionAnalysis.suggestions,
    marketComparison: deterministicInput.marketComparison,
  });
  checks.push({
    label: "priority action resolver prefers AI suggestions when present",
    passed:
      resolvedActions.length > 0 &&
      resolvedActions[0]?.title === "Basligi guclendir" &&
      resolvedActions[0]?.priority === 1,
    detail: resolvedActions,
  });

  const blockedExtracted = createExtracted({
    extractor_status: "blocked",
    title: null,
    normalized_price: null,
    price: null,
    review_count: null,
    rating_value: null,
    description_length: null,
    seller_score: null,
  });
  const blockedMetadata = makeMetadata(blockedExtracted);
  const blockedInput = prepareAnalysisInput(blockedExtracted, blockedMetadata);
  const blockedAnalysis = buildAnalysis({
    platform: TEST_PLATFORM,
    url: TEST_URL,
    consolidatedInput: blockedInput,
    extracted: blockedExtracted,
    planContext: "pro",
  });
  blockedAnalysis.trendyolScorecard = null;

  attachDeterministicMetadata({
    analysis: blockedAnalysis,
    fieldMetadata: blockedMetadata,
    normalizedFieldMetadata: blockedInput._fieldMetadata,
    extractorHealth: {
      platformDetected: TEST_PLATFORM,
      primarySourceUsed: "platform",
      criticalFieldsFound: 2,
      allFieldsAvailable: 5,
      sourceBreakdown: {
        platform: 5,
        generic: 0,
        api: 0,
        derived: 0,
        synthetic: 0,
      },
      fallbacksUsed: [],
      blockedFields: ["title", "normalized_price"],
      apiCallAttempted: false,
      apiCallSucceeded: false,
      errors: [],
    },
  });

  const progressEvents: Array<{ stage: string; label: string }> = [];
  const finalizeResult = await enrichAnalysisForDelivery({
    analysis: blockedAnalysis,
    consolidatedInput: blockedInput,
    url: TEST_URL,
    learningContext: createLearningContext(),
    missingDataReport: createMissingDataReport(),
    debugTrace: null,
    emitProgress(update) {
      progressEvents.push({ stage: update.stage, label: update.label });
    },
  });

  checks.push({
    label: "finalize keeps AI skipped on blocked deterministic path",
    passed:
      finalizeResult.aiResult === null &&
      finalizeResult.aiEligibility.mode === "skip" &&
      finalizeResult.contract.aiDecision.executed === false &&
      finalizeResult.aiMs === 0,
    detail: {
      aiEligibility: finalizeResult.aiEligibility,
      contract: finalizeResult.contract,
      aiMs: finalizeResult.aiMs,
    },
  });

  checks.push({
    label: "finalize still attaches averages and trace without emitting AI progress",
    passed:
      blockedAnalysis.categoryAverages?.source === "learning_benchmark" &&
      blockedAnalysis.analysisTrace?.mode === "deterministic" &&
      progressEvents.length === 0,
    detail: {
      categoryAverages: blockedAnalysis.categoryAverages,
      traceMode: blockedAnalysis.analysisTrace?.mode,
      progressEvents,
    },
  });

  checks.push({
    label: "category averages helper maps benchmark snapshot consistently",
    passed:
      buildCategoryAverages(createLearningContext())?.sampleSize === 12 &&
      buildCategoryAverages(createLearningContext())?.price === 1100,
    detail: buildCategoryAverages(createLearningContext()),
  });

  const failed = checks.filter((check) => !check.passed);
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
