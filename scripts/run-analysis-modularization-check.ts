import { readFileSync } from "node:fs";
import { join } from "node:path";

type Check = {
  label: string;
  passed: boolean;
  detail?: unknown;
};

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function includesAll(source: string, patterns: string[]) {
  return patterns.every((pattern) => source.includes(pattern));
}

function run() {
  const runAnalysis = read("lib/run-analysis.ts");
  const helpers = read("lib/run-analysis-helpers.ts");
  const extraction = read("lib/run-analysis-extraction.ts");
  const finalize = read("lib/run-analysis-finalize.ts");

  const checks: Check[] = [
    {
      label: "run-analysis imports modular extraction/finalize layers",
      passed: includesAll(runAnalysis, [
        'from "@/lib/run-analysis-extraction"',
        'from "@/lib/run-analysis-finalize"',
      ]),
    },
    {
      label: "run-analysis delegates extraction phase to shared module",
      passed: runAnalysis.includes("await executeExtractionPhase({"),
    },
    {
      label: "run-analysis delegates review enrichment to shared module",
      passed: runAnalysis.includes("await enrichTrendyolReviewSignals({"),
    },
    {
      label: "run-analysis delegates final AI/trace assembly to shared module",
      passed: runAnalysis.includes("await enrichAnalysisForDelivery({"),
    },
    {
      label: "run-analysis no longer directly builds analysis trace",
      passed: !runAnalysis.includes("buildAnalysisTrace({"),
    },
    {
      label: "run-analysis no longer directly calls analyzeWithAi",
      passed: !runAnalysis.includes("analyzeWithAi({"),
    },
    {
      label: "helpers module exposes shared priority/backfill helpers",
      passed: includesAll(helpers, [
        "export function shouldRunPythonBackfill",
        "export async function fetchPythonBackfill",
        "export function resolvePriorityActions",
      ]),
    },
    {
      label: "extraction module exposes extraction and review enrichment entrypoints",
      passed: includesAll(extraction, [
        "export async function executeExtractionPhase",
        "export async function enrichTrendyolReviewSignals",
      ]),
    },
    {
      label: "finalize module exposes metadata and delivery finalizers",
      passed: includesAll(finalize, [
        "export function attachDeterministicMetadata",
        "export function logExtractorHealth",
        "export async function enrichAnalysisForDelivery",
      ]),
    },
    {
      label: "finalize module owns trace emission",
      passed: finalize.includes('emitDebugTrace(debugTrace, "SellBoostInternalTrace")'),
    },
  ];

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

run();
