import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  TEST_PLATFORM,
  TEST_URL,
} from "./analysis-fixtures";
import { getOfflineAnalysisScenarios } from "./analysis-scenarios";
import { evaluateAnalysisQuality } from "./analysis-quality-shared";

type RunMode = "fallback" | "auto";

type ScenarioRunReport = {
  name: string;
  description: string;
  passed: boolean;
  score: number;
  passedChecks: number;
  totalChecks: number;
  criticalDiagnosis: string | null;
  primaryTheme: string | null;
  firstSuggestion: string | null;
  suggestionCount: number;
  topSignalLabels: string[];
  checks: Array<{
    key: string;
    passed: boolean;
    detail: string;
  }>;
  scores: {
    seo: number;
    conversion: number;
    overall: number;
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
  mode: RunMode;
  effectiveMode: "fallback" | "auto";
  scenarios: ScenarioRunReport[];
}) {
  const passedScenarioCount = params.scenarios.filter((item) => item.passed).length;
  const averageScore =
    params.scenarios.length > 0
      ? Math.round(
          params.scenarios.reduce((sum, item) => sum + item.score, 0) /
            params.scenarios.length
        )
      : 0;

  const lines: string[] = [
    "# Analysis Quality Lab",
    "",
    `- Generated: ${params.generatedAt}`,
    `- Requested mode: ${params.mode}`,
    `- Effective mode: ${params.effectiveMode}`,
    `- Scenario pass rate: ${passedScenarioCount}/${params.scenarios.length}`,
    `- Average score: ${averageScore}/100`,
    "",
  ];

  for (const scenario of params.scenarios) {
    lines.push(`## ${scenario.name}`);
    lines.push("");
    lines.push(`- Description: ${scenario.description}`);
    lines.push(`- Status: ${scenario.passed ? "PASS" : "FAIL"}`);
    lines.push(`- Score: ${scenario.score}/100`);
    lines.push(`- Checks: ${scenario.passedChecks}/${scenario.totalChecks}`);
    lines.push(`- Critical diagnosis: ${scenario.criticalDiagnosis || "-"}`);
    lines.push(`- Primary theme: ${scenario.primaryTheme || "-"}`);
    lines.push(`- First suggestion: ${scenario.firstSuggestion || "-"}`);
    lines.push(`- Suggestion count: ${scenario.suggestionCount}`);
    lines.push(
      `- Top signals: ${scenario.topSignalLabels.length ? scenario.topSignalLabels.join(", ") : "-"}`
    );
    lines.push(
      `- Scores: SEO ${scenario.scores.seo}, Conversion ${scenario.scores.conversion}, Overall ${scenario.scores.overall}`
    );
    lines.push("");
    lines.push("### Checks");
    lines.push("");

    for (const check of scenario.checks) {
      lines.push(`- ${check.passed ? "PASS" : "FAIL"} ${check.key}: ${check.detail}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const requestedMode = resolveMode();

  if (requestedMode === "fallback") {
    process.env.GEMINI_API_KEY = "";
  }

  const effectiveMode =
    requestedMode === "auto" && process.env.GEMINI_API_KEY ? "auto" : "fallback";
  const { buildAnalysis } = await import("../lib/build-analysis");
  const { analyzeWithAi } = await import("../lib/ai-analysis");
  const { buildAnalysisTrace } = await import("../lib/analysis-trace");

  const scenarioReports: ScenarioRunReport[] = [];

  for (const scenario of getOfflineAnalysisScenarios()) {
    const analysis = buildAnalysis({
      platform: scenario.extracted.platform ?? TEST_PLATFORM,
      url: TEST_URL,
      extracted: scenario.extracted,
      planContext: "pro",
    });

    const result = await analyzeWithAi({
      packet: analysis.decisionSupportPacket,
      extracted: analysis.extractedData,
      url: TEST_URL,
      learningContext: scenario.learningContext,
      baseline: {
        summary: analysis.summary,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        suggestions: analysis.suggestions,
        seo_score: analysis.seoScore,
        conversion_score: analysis.conversionScore,
        overall_score: analysis.overallScore,
      },
    });

    if (!result) {
      scenarioReports.push({
        name: scenario.name,
        description: scenario.description,
        passed: false,
        score: 0,
        passedChecks: 0,
        totalChecks: 1,
        criticalDiagnosis: null,
        primaryTheme: null,
        firstSuggestion: null,
        suggestionCount: 0,
        topSignalLabels: [],
        checks: [
          {
            key: "result",
            passed: false,
            detail: "AI analiz sonucu donmedi.",
          },
        ],
        scores: {
          seo: 0,
          conversion: 0,
          overall: 0,
        },
      });
      continue;
    }

    const analysisTrace = buildAnalysisTrace({
      mode: effectiveMode === "auto" ? "ai_enriched" : "deterministic",
      summary: result.summary,
      suggestions: result.suggestions,
      packet: analysis.decisionSupportPacket,
      extracted: analysis.extractedData,
      derivedMetrics: analysis.derivedMetrics,
      seoScore: result.seo_score,
      conversionScore: result.conversion_score,
      overallScore: result.overall_score,
      learningContext: scenario.learningContext,
    });
    const quality = evaluateAnalysisQuality({
      name: scenario.name,
      summary: result.summary,
      suggestions: result.suggestions,
      expected: scenario.expected,
      topSignalLabels: analysisTrace.topSignals.map((item) => item.label),
    });

    scenarioReports.push({
      name: scenario.name,
      description: scenario.description,
      passed: quality.passed,
      score: quality.score,
      passedChecks: quality.passedChecks,
      totalChecks: quality.totalChecks,
      criticalDiagnosis: quality.parsedSummary.criticalDiagnosis,
      primaryTheme: analysisTrace.primaryTheme,
      firstSuggestion: result.suggestions[0]?.title || null,
      suggestionCount: result.suggestions.length,
      topSignalLabels: analysisTrace.topSignals.map((item) => item.label),
      checks: quality.checks,
      scores: {
        seo: result.seo_score,
        conversion: result.conversion_score,
        overall: result.overall_score,
      },
    });
  }

  const now = new Date();
  const generatedAt = now.toISOString();
  const reportDir = path.join(process.cwd(), "artifacts", "analysis-quality");
  const timestamp = formatTimestamp(now);
  const baseName = `analysis-quality-lab-${timestamp}-${effectiveMode}`;

  await mkdir(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, `${baseName}.json`);
  const mdPath = path.join(reportDir, `${baseName}.md`);

  const reportPayload = {
    generatedAt,
    requestedMode,
    effectiveMode,
    scenarioCount: scenarioReports.length,
    passedScenarioCount: scenarioReports.filter((item) => item.passed).length,
    averageScore:
      scenarioReports.length > 0
        ? Math.round(
            scenarioReports.reduce((sum, item) => sum + item.score, 0) /
              scenarioReports.length
          )
        : 0,
    scenarios: scenarioReports,
  };

  await writeFile(jsonPath, JSON.stringify(reportPayload, null, 2), "utf8");
  await writeFile(
    mdPath,
    buildMarkdownReport({
      generatedAt,
      mode: requestedMode,
      effectiveMode,
      scenarios: scenarioReports,
    }),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        requestedMode,
        effectiveMode,
        scenarioCount: reportPayload.scenarioCount,
        passedScenarioCount: reportPayload.passedScenarioCount,
        averageScore: reportPayload.averageScore,
        reports: {
          json: jsonPath,
          markdown: mdPath,
        },
      },
      null,
      2
    )
  );

  if (scenarioReports.some((item) => !item.passed)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
