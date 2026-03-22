import type { AnalysisSuggestion } from "@/types/analysis";

export type ParsedAnalysisSummary = {
  raw: string | null;
  criticalDiagnosis: string | null;
  dataCollision: string | null;
  strategicRecipe: string[];
  systemLearning: string | null;
  hasStructuredSummary: boolean;
};

type SummaryTag =
  | "KRITIK TESHIS"
  | "VERI CARPISTIRMA"
  | "STRATEJIK RECETE"
  | "SISTEM OGRENISI";

const SUMMARY_TAGS: SummaryTag[] = [
  "KRITIK TESHIS",
  "VERI CARPISTIRMA",
  "STRATEJIK RECETE",
  "SISTEM OGRENISI",
];

const DEFAULT_SYSTEM_LEARNING =
  "Bu kategoride yeterli tarihsel ogrenim birikmedigi icin sistem ilk benchmark setini olusturuyor.";

function cleanText(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return normalized.length > 0 ? normalized : null;
}

function extractSection(text: string, tag: SummaryTag) {
  const startToken = `[${tag}]:`;
  const startIndex = text.indexOf(startToken);

  if (startIndex === -1) {
    return null;
  }

  const contentStart = startIndex + startToken.length;
  let contentEnd = text.length;

  for (const nextTag of SUMMARY_TAGS) {
    if (nextTag === tag) continue;

    const candidateIndex = text.indexOf(`\n[${nextTag}]:`, contentStart);

    if (candidateIndex !== -1 && candidateIndex < contentEnd) {
      contentEnd = candidateIndex;
    }
  }

  return cleanText(text.slice(contentStart, contentEnd));
}

function normalizeRecipeLine(value: string | null | undefined) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  return cleaned.replace(/^\d+\.\s*/, "").trim() || null;
}

function buildRecipeFromSuggestions(suggestions: AnalysisSuggestion[]) {
  return suggestions
    .filter((item) => cleanText(item.title) && cleanText(item.detail))
    .slice(0, 3)
    .map((item) => `${item.title.trim()}: ${item.detail.trim()}`);
}

export function buildStructuredSummary(params: {
  criticalDiagnosis: string;
  dataCollision: string;
  strategicRecipe: string[];
  systemLearning?: string | null;
}) {
  const recipeLines = params.strategicRecipe
    .map((item) => normalizeRecipeLine(item))
    .filter((item): item is string => !!item)
    .slice(0, 3);

  while (recipeLines.length < 3) {
    recipeLines.push(
      "Veri yetersizligi nedeniyle bu alan analiz disi birakildi."
    );
  }

  return [
    `[KRITIK TESHIS]: ${
      cleanText(params.criticalDiagnosis) ||
      "Veri yetersizligi nedeniyle ana darbozagin bir kismi analiz disi birakildi."
    }`,
    `[VERI CARPISTIRMA]: ${
      cleanText(params.dataCollision) ||
      "Veri yetersizligi nedeniyle capraz sorgu sinirli kapsama sahip."
    }`,
    "[STRATEJIK RECETE]:",
    ...recipeLines.map((item, index) => `${index + 1}. ${item}`),
    `[SISTEM OGRENISI]: ${
      cleanText(params.systemLearning) || DEFAULT_SYSTEM_LEARNING
    }`,
  ].join("\n");
}

export function parseAnalysisSummary(
  summary: string | null | undefined
): ParsedAnalysisSummary {
  const raw = cleanText(summary);

  if (!raw) {
    return {
      raw: null,
      criticalDiagnosis: null,
      dataCollision: null,
      strategicRecipe: [],
      systemLearning: null,
      hasStructuredSummary: false,
    };
  }

  const criticalDiagnosis = extractSection(raw, "KRITIK TESHIS");
  const dataCollision = extractSection(raw, "VERI CARPISTIRMA");
  const strategicRecipeBlock = extractSection(raw, "STRATEJIK RECETE");
  const systemLearning = extractSection(raw, "SISTEM OGRENISI");

  const strategicRecipe = (strategicRecipeBlock || "")
    .split(/\n+/)
    .map((line) => normalizeRecipeLine(line))
    .filter((line): line is string => !!line);

  const hasStructuredSummary = Boolean(
    criticalDiagnosis &&
      dataCollision &&
      strategicRecipe.length > 0 &&
      systemLearning
  );

  return {
    raw,
    criticalDiagnosis,
    dataCollision,
    strategicRecipe,
    systemLearning,
    hasStructuredSummary,
  };
}

export function syncStructuredSummaryWithSuggestions(params: {
  summary: string | null | undefined;
  fallbackSummary?: string | null | undefined;
  suggestions: AnalysisSuggestion[];
  systemLearning?: string | null;
}) {
  const primary = parseAnalysisSummary(params.summary);
  const fallback = parseAnalysisSummary(params.fallbackSummary);
  const source = primary.hasStructuredSummary
    ? primary
    : fallback.hasStructuredSummary
      ? fallback
      : null;

  if (!source) {
    return cleanText(params.summary) || cleanText(params.fallbackSummary);
  }

  const strategicRecipe =
    buildRecipeFromSuggestions(params.suggestions).length > 0
      ? buildRecipeFromSuggestions(params.suggestions)
      : source.strategicRecipe;

  return buildStructuredSummary({
    criticalDiagnosis:
      source.criticalDiagnosis ||
      fallback.criticalDiagnosis ||
      "Veri yetersizligi nedeniyle ana darbozagin bir kismi analiz disi birakildi.",
    dataCollision:
      source.dataCollision ||
      fallback.dataCollision ||
      "Veri yetersizligi nedeniyle capraz sorgu sinirli kapsama sahip.",
    strategicRecipe,
    systemLearning:
      source.systemLearning ||
      fallback.systemLearning ||
      params.systemLearning ||
      DEFAULT_SYSTEM_LEARNING,
  });
}
