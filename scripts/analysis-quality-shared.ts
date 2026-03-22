import { parseAnalysisSummary } from "../lib/analysis-summary";
import type { AnalysisScenarioExpectation } from "./analysis-scenarios";

type SuggestionLike = {
  title: string;
  detail: string;
};

export type QualityCheck = {
  key: string;
  passed: boolean;
  detail: string;
};

export function normalizeAssertionText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsFieldLeak(value: string) {
  return /\b[a-z]+_[a-z0-9_]+\b/.test(value);
}

function textContainsAnyKeyword(value: string, keywords: string[]) {
  const normalized = normalizeAssertionText(value);
  return keywords.some((keyword) =>
    normalized.includes(normalizeAssertionText(keyword))
  );
}

export function evaluateSummarySuggestionAlignment(
  summary: string,
  suggestions: SuggestionLike[]
) {
  const parsed = parseAnalysisSummary(summary);
  const comparableRecipe = parsed.strategicRecipe.map((item) =>
    normalizeAssertionText(item)
  );
  const limit = Math.min(3, suggestions.length);
  const checks: QualityCheck[] = [];

  checks.push({
    key: "structured-summary",
    passed: parsed.hasStructuredSummary,
    detail: parsed.hasStructuredSummary
      ? "Summary parser tarafindan bolunebildi."
      : "Summary beklenen blok yapisini tasimiyor.",
  });

  checks.push({
    key: "recipe-count",
    passed: comparableRecipe.length >= limit && comparableRecipe.length >= 1,
    detail:
      comparableRecipe.length >= limit && comparableRecipe.length >= 1
        ? `Recete satiri sayisi yeterli: ${comparableRecipe.length}.`
        : `Recete satiri sayisi yetersiz: ${comparableRecipe.length}.`,
  });

  for (let index = 0; index < limit; index += 1) {
    const title = normalizeAssertionText(suggestions[index].title);
    const matched = comparableRecipe[index]?.includes(title) || false;

    checks.push({
      key: `recipe-align-${index + 1}`,
      passed: matched,
      detail: matched
        ? `${index + 1}. recete satiri ${suggestions[index].title} ile hizali.`
        : `${index + 1}. recete satiri ${suggestions[index].title} ile hizali degil.`,
    });
  }

  return checks;
}

export function evaluateAnalysisQuality(params: {
  name: string;
  summary: string;
  suggestions: SuggestionLike[];
  expected: AnalysisScenarioExpectation;
  topSignalLabels?: string[];
}) {
  const parsed = parseAnalysisSummary(params.summary);
  const topSignalsText = (params.topSignalLabels ?? []).join(" ");
  const checks: QualityCheck[] = [
    {
      key: "summary-no-field-leak",
      passed: !containsFieldLeak(params.summary),
      detail: containsFieldLeak(params.summary)
        ? "Summary icinde ham alan adi sizintisi var."
        : "Summary icinde ham alan adi sizintisi yok.",
    },
    {
      key: "suggestions-no-field-leak",
      passed: params.suggestions.every(
        (item) => !containsFieldLeak(`${item.title} ${item.detail}`)
      ),
      detail: params.suggestions.every(
        (item) => !containsFieldLeak(`${item.title} ${item.detail}`)
      )
        ? "Onerilerde ham alan adi sizintisi yok."
        : "En az bir oneride ham alan adi sizintisi var.",
    },
    {
      key: "suggestion-count",
      passed:
        params.suggestions.length >= (params.expected.minSuggestions ?? 1) &&
        params.suggestions.length <= (params.expected.maxSuggestions ?? 5),
      detail: `Oneri sayisi: ${params.suggestions.length}.`,
    },
    {
      key: "critical-keywords",
      passed: textContainsAnyKeyword(
        parsed.criticalDiagnosis || params.summary,
        params.expected.criticalKeywords
      ),
      detail: parsed.criticalDiagnosis
        ? `Kritik teshis: ${parsed.criticalDiagnosis}`
        : "Kritik teshis ayrisamadi.",
    },
    {
      key: "first-suggestion-keywords",
      passed:
        params.suggestions.length > 0 &&
        textContainsAnyKeyword(
          `${params.suggestions[0].title} ${params.suggestions[0].detail}`,
          params.expected.firstSuggestionKeywords
        ),
      detail:
        params.suggestions.length > 0
          ? `Ilk oneri: ${params.suggestions[0].title}`
          : "Ilk oneri bulunamadi.",
    },
  ];

  if (params.expected.topSignalKeywords?.length) {
    checks.push({
      key: "top-signal-keywords",
      passed:
        params.topSignalLabels != null &&
        textContainsAnyKeyword(topSignalsText, params.expected.topSignalKeywords),
      detail:
        params.topSignalLabels != null
          ? `Top sinyaller: ${params.topSignalLabels.join(", ")}`
          : "Top sinyaller iletilmedi.",
    });
  }

  checks.push(...evaluateSummarySuggestionAlignment(params.summary, params.suggestions));

  const passedChecks = checks.filter((item) => item.passed).length;

  return {
    parsedSummary: parsed,
    checks,
    passedChecks,
    totalChecks: checks.length,
    score: Math.round((passedChecks / Math.max(checks.length, 1)) * 100),
    passed: checks.every((item) => item.passed),
  };
}
