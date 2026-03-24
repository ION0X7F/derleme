import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeWithAi } from "../lib/ai-analysis";
import { buildAnalysis } from "../lib/build-analysis";
import { extractFieldsWithFallback } from "../lib/extractors";
import { mergeExtractedFieldsWithMetadata } from "../lib/extractors/merge-extracted-fields";
import { fetchPageHtml } from "../lib/fetch-page-html";
import { fetchTrendyolApi } from "../lib/fetch-trendyol-api";
import { isAiAnalysisEligible } from "../lib/ai-eligibility";
import { getLearningContext } from "../lib/learning-engine";
import { completeMissingFieldsWithMetadata } from "../lib/missing-data";
import { prepareAnalysisInput } from "../lib/prepare-analysis-input";
import { parseAnalysisSummary } from "../lib/analysis-summary";
import { detectCategory } from "../lib/detect-category";

type RunMode = "fallback" | "auto";

type CalibrationEntry = {
  url: string;
  platform: string | null;
  category: string;
  extractorStatus: string | null | undefined;
  coreFields: {
    title: {
      value: string | null;
      confidence: number;
      source: string;
      metadataConfidence: string | null;
      metadataSource: string | null;
    };
    price: {
      value: number | null;
      confidence: number;
      source: string;
      metadataConfidence: string | null;
      metadataSource: string | null;
    };
    descriptionLength: {
      value: number | null;
      confidence: number;
      source: string;
      metadataConfidence: string | null;
      metadataSource: string | null;
    };
  };
  eligibility: {
    eligible: boolean;
    mode: "skip" | "cautious" | "full";
    level: "none" | "medium" | "high";
    score: number;
    reason: string;
    blockingFields: string[];
    criticalFieldsWithValue: number;
    criticalFieldsWithHighConfidence: number;
  };
  coverageConfidence: "high" | "medium" | "low";
  deterministic: {
    overallScore: number;
    suggestionCount: number;
    criticalDiagnosis: string | null;
  };
  final: {
    overallScore: number;
    suggestionCount: number;
    criticalDiagnosis: string | null;
    usedAi: boolean;
  };
};

function getArgValue(name: string) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

function resolveMode(): RunMode {
  const raw = getArgValue("--mode");
  return raw === "auto" ? "auto" : "fallback";
}

function resolveUrls() {
  const raw = getArgValue("--urls");
  if (!raw) {
    return [
      "https://www.trendyol.com/apple/iphone-16-pro-max-256gb-siyah-titanyum-p-857296077",
      "https://www.trendyol.com/apple/iphone-16e-128gb-siyah-p-900754126",
      "https://www.trendyol.com/caykur/rize-turist-cay-500gr-p-4409228",
    ];
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function buildMarkdownReport(params: {
  generatedAt: string;
  requestedMode: RunMode;
  effectiveMode: RunMode;
  entries: CalibrationEntry[];
}) {
  const lines: string[] = [
    "# AI Decision Calibration",
    "",
    `- Generated: ${params.generatedAt}`,
    `- Requested mode: ${params.requestedMode}`,
    `- Effective mode: ${params.effectiveMode}`,
    `- URL count: ${params.entries.length}`,
    "",
  ];

  for (const entry of params.entries) {
    lines.push(`## ${entry.url}`);
    lines.push("");
    lines.push(`- Platform: ${entry.platform || "-"}`);
    lines.push(`- Category: ${entry.category}`);
    lines.push(`- Extractor status: ${entry.extractorStatus || "-"}`);
    lines.push(
      `- Core fields: title=${entry.coreFields.title.confidence.toFixed(2)} (${entry.coreFields.title.source}/${entry.coreFields.title.metadataConfidence || "-"})`
    );
    lines.push(
      `  price=${entry.coreFields.price.confidence.toFixed(2)} (${entry.coreFields.price.source}/${entry.coreFields.price.metadataConfidence || "-"})`
    );
    lines.push(
      `  description=${entry.coreFields.descriptionLength.confidence.toFixed(2)} (${entry.coreFields.descriptionLength.source}/${entry.coreFields.descriptionLength.metadataConfidence || "-"})`
    );
    lines.push(`- Eligibility: ${entry.eligibility.mode} / ${entry.eligibility.level}`);
    lines.push(`- Eligibility score: ${entry.eligibility.score.toFixed(2)}`);
    lines.push(`- Coverage confidence: ${entry.coverageConfidence}`);
    lines.push(`- Blocking fields: ${entry.eligibility.blockingFields.join(", ") || "-"}`);
    lines.push(`- Critical fields with value: ${entry.eligibility.criticalFieldsWithValue}`);
    lines.push(
      `- Critical fields with high confidence: ${entry.eligibility.criticalFieldsWithHighConfidence}`
    );
    lines.push(`- Deterministic score: ${entry.deterministic.overallScore}`);
    lines.push(`- Final score: ${entry.final.overallScore}`);
    lines.push(`- Used AI: ${entry.final.usedAi ? "yes" : "no"}`);
    lines.push(`- Deterministic diagnosis: ${entry.deterministic.criticalDiagnosis || "-"}`);
    lines.push(`- Final diagnosis: ${entry.final.criticalDiagnosis || "-"}`);
    lines.push(`- Final suggestion count: ${entry.final.suggestionCount}`);
    lines.push(`- Reason: ${entry.eligibility.reason}`);
    lines.push("");
  }

  return lines.join("\n");
}

async function analyzeUrl(url: string, effectiveMode: RunMode): Promise<CalibrationEntry> {
  const html = await fetchPageHtml(url);
  const trendyolApiData = url.toLocaleLowerCase("tr-TR").includes("trendyol.com")
    ? await fetchTrendyolApi(url)
    : null;

  const extraction = extractFieldsWithFallback({ url, html });
  const merged = mergeExtractedFieldsWithMetadata({
    genericFields: extraction.genericFields,
    platformFields: extraction.platformFields,
    platform: extraction.platform,
  });

  const completed = completeMissingFieldsWithMetadata(
    {
      platform: extraction.platform,
      extracted: merged.merged,
      genericFields: extraction.genericFields,
      platformFields: extraction.platformFields,
      trendyolApiData,
    },
    merged.fieldMetadata
  );

  const extracted = completed.extracted;
  const consolidatedInput = prepareAnalysisInput(extracted, completed.fieldMetadata);
  const eligibility = isAiAnalysisEligible(consolidatedInput);
  const platform = extracted.platform ?? null;
  const category =
    extracted.category ||
    detectCategory({
      url,
      title: extracted.title,
      h1: extracted.h1,
      brand: extracted.brand,
      product_name: extracted.product_name,
    }) ||
    "General";

  const deterministic = buildAnalysis({
    platform,
    url,
    consolidatedInput,
    extracted: {
      ...extracted,
      category: extracted.category || category,
    },
    planContext: "pro",
  });

  const learningContext = await getLearningContext({
    platform,
    category,
    brand: extracted.brand,
    extracted: deterministic.extractedData,
  });

  let finalResult = {
    summary: deterministic.summary,
    suggestions: deterministic.suggestions,
    overall_score: deterministic.overallScore,
  };
  let usedAi = false;

  if (effectiveMode === "auto" && eligibility.eligible) {
    const aiResult = await analyzeWithAi({
      consolidatedInput,
      packet: {
        ...deterministic.decisionSupportPacket,
        coverage: {
          ...deterministic.decisionSupportPacket.coverage,
          confidence: eligibility.guidance.coverageConfidence,
        },
      },
      extracted: deterministic.extractedData,
      url,
      learningContext,
      missingDataReport: completed.report,
      baseline: {
        summary: deterministic.summary,
        strengths: deterministic.strengths,
        weaknesses: deterministic.weaknesses,
        suggestions: deterministic.suggestions,
        seo_score: deterministic.seoScore,
        conversion_score: deterministic.conversionScore,
        overall_score: deterministic.overallScore,
      },
      eligibility,
    });

    if (aiResult) {
      finalResult = {
        summary: eligibility.guidance.allowNarrativeExpansion
          ? aiResult.summary
          : deterministic.summary,
        suggestions:
          aiResult.suggestions.length > 0
            ? aiResult.suggestions
            : deterministic.suggestions,
        overall_score:
          eligibility.guidance.allowScoreOverrides
            ? aiResult.overall_score
            : deterministic.overallScore,
      };
      usedAi = eligibility.guidance.allowNarrativeExpansion;
    }
  }

  return {
    url,
    platform,
    category,
    extractorStatus: extracted.extractor_status,
    coreFields: {
      title: {
        value: consolidatedInput.title.value,
        confidence: consolidatedInput.title.confidence,
        source: consolidatedInput.title.source,
        metadataConfidence: completed.fieldMetadata.title?.confidence ?? null,
        metadataSource: completed.fieldMetadata.title?.source ?? null,
      },
      price: {
        value: consolidatedInput.price.value,
        confidence: consolidatedInput.price.confidence,
        source: consolidatedInput.price.source,
        metadataConfidence: completed.fieldMetadata.normalized_price?.confidence ?? null,
        metadataSource: completed.fieldMetadata.normalized_price?.source ?? null,
      },
      descriptionLength: {
        value: consolidatedInput.descriptionLength.value,
        confidence: consolidatedInput.descriptionLength.confidence,
        source: consolidatedInput.descriptionLength.source,
        metadataConfidence: completed.fieldMetadata.description_length?.confidence ?? null,
        metadataSource: completed.fieldMetadata.description_length?.source ?? null,
      },
    },
    eligibility: {
      eligible: eligibility.eligible,
      mode: eligibility.mode,
      level: eligibility.level,
      score: Number(eligibility.score.toFixed(2)),
      reason: eligibility.reason,
      blockingFields: eligibility.blockingFields,
      criticalFieldsWithValue: eligibility.criticalFieldsWithValue,
      criticalFieldsWithHighConfidence: eligibility.criticalFieldsWithHighConfidence,
    },
    coverageConfidence: deterministic.decisionSupportPacket.coverage.confidence,
    deterministic: {
      overallScore: deterministic.overallScore,
      suggestionCount: deterministic.suggestions.length,
      criticalDiagnosis: parseAnalysisSummary(deterministic.summary).criticalDiagnosis,
    },
    final: {
      overallScore: finalResult.overall_score,
      suggestionCount: finalResult.suggestions.length,
      criticalDiagnosis: parseAnalysisSummary(finalResult.summary).criticalDiagnosis,
      usedAi,
    },
  };
}

async function main() {
  const requestedMode = resolveMode();
  const urls = resolveUrls();

  if (requestedMode === "fallback") {
    process.env.GEMINI_API_KEY = "";
  }

  const effectiveMode =
    requestedMode === "auto" && process.env.GEMINI_API_KEY ? "auto" : "fallback";

  const entries: CalibrationEntry[] = [];
  for (const url of urls) {
    entries.push(await analyzeUrl(url, effectiveMode));
  }

  const now = new Date();
  const generatedAt = now.toISOString();
  const reportDir = path.join(process.cwd(), "artifacts", "ai-decision");
  const timestamp = formatTimestamp(now);
  const baseName = `ai-decision-calibration-${timestamp}-${effectiveMode}`;

  await mkdir(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, `${baseName}.json`);
  const mdPath = path.join(reportDir, `${baseName}.md`);

  const payload = {
    generatedAt,
    requestedMode,
    effectiveMode,
    entryCount: entries.length,
    entries,
  };

  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(
    mdPath,
    buildMarkdownReport({
      generatedAt,
      requestedMode,
      effectiveMode,
      entries,
    }),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        requestedMode,
        effectiveMode,
        entryCount: entries.length,
        reports: {
          json: jsonPath,
          markdown: mdPath,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
