import {
  type NamedRule,
  type RuleMergeMode,
  type SectionKey,
  TRENDYOL_RULEBOOK,
} from "@/lib/trendyol-rulebook";

type SourcePriority = {
  sourceFile: string;
  rank: number;
};

export type ResolvedSectionRules = {
  section: SectionKey;
  rules: NamedRule[];
  resolutionNotes: string[];
};

const SOURCE_PRIORITY: SourcePriority[] = [
  { sourceFile: "TRENDYOL_UZMANLIK_KURALLARI.md", rank: 1 },
  { sourceFile: "TRENDYOL_SKOR_MIMARISI_VE_VERI_STRATEJISI_RAPORU.md", rank: 2 },
  { sourceFile: "GRAFIK_VERI_ESLESTIRME_NOTLARI.md", rank: 3 },
  { sourceFile: "docs/demand-capture-diagnosis.md", rank: 4 },
  { sourceFile: "docs/seo-rule-engine.md", rank: 5 },
  { sourceFile: "YAPAY_ZEKA_DEGERLENDIRME_AKISI_2026-03-24.md", rank: 6 },
];

function getSourceRank(rule: NamedRule) {
  const matched = SOURCE_PRIORITY.find((item) => item.sourceFile === rule.sourceFile);
  return matched?.rank ?? 999;
}

function getRuleTimestamp(rule: NamedRule) {
  const raw = rule.sourceUpdatedAt ? Date.parse(rule.sourceUpdatedAt) : Number.NaN;
  return Number.isFinite(raw) ? raw : 0;
}

function compareRules(a: NamedRule, b: NamedRule) {
  const sourceRankDiff = getSourceRank(a) - getSourceRank(b);
  if (sourceRankDiff !== 0) return sourceRankDiff;

  const timeDiff = getRuleTimestamp(b) - getRuleTimestamp(a);
  if (timeDiff !== 0) return timeDiff;

  return a.id.localeCompare(b.id, "tr");
}

function defaultMergeMode(rule: NamedRule): RuleMergeMode {
  return rule.mergeMode ?? "legacy_fallback";
}

function sameTopic(a: NamedRule, b: NamedRule) {
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase("tr-TR")
      .replace(/[^a-z0-9ığüşöç]+/giu, " ")
      .trim();

  const aTitle = normalize(a.title);
  const bTitle = normalize(b.title);
  if (!aTitle || !bTitle) return false;
  if (aTitle === bTitle) return true;

  const aTokens = new Set(aTitle.split(/\s+/));
  const bTokens = new Set(bTitle.split(/\s+/));
  const overlap = [...aTokens].filter((token) => bTokens.has(token));
  return overlap.length >= Math.min(2, Math.min(aTokens.size, bTokens.size));
}

function shouldReplace(existing: NamedRule, incoming: NamedRule) {
  const incomingMode = defaultMergeMode(incoming);
  if (incomingMode !== "override_if_conflict") return false;

  const existingPriority = getSourceRank(existing);
  const incomingPriority = getSourceRank(incoming);
  if (incomingPriority < existingPriority) return true;
  if (incomingPriority > existingPriority) return false;

  return getRuleTimestamp(incoming) >= getRuleTimestamp(existing);
}

export function resolveSectionRules(section: SectionKey): ResolvedSectionRules {
  const sourceRules = [...(TRENDYOL_RULEBOOK.explicitRules[section] ?? [])].sort(compareRules);
  const resolved: NamedRule[] = [];
  const resolutionNotes: string[] = [];

  for (const rule of sourceRules) {
    const existingIndex = resolved.findIndex((item) => sameTopic(item, rule));
    if (existingIndex === -1) {
      resolved.push(rule);
      continue;
    }

    const existing = resolved[existingIndex];
    const incomingMode = defaultMergeMode(rule);
    if (incomingMode === "additive") {
      resolved.push(rule);
      resolutionNotes.push(`${section}:${rule.id} additive olarak mevcut kurallara eklendi.`);
      continue;
    }

    if (shouldReplace(existing, rule)) {
      resolved[existingIndex] = rule;
      resolutionNotes.push(`${section}:${rule.id} açık çelişki varsayımıyla eski kuralın yerini aldı.`);
      continue;
    }

    resolutionNotes.push(
      `${section}:${rule.id} legacy korunarak mevcut kural setine zorla uygulanmadı.`
    );
  }

  return {
    section,
    rules: resolved,
    resolutionNotes,
  };
}

export function resolveFullRulebook() {
  const sections: SectionKey[] = [
    "shared",
    "price_competition",
    "content_seo",
    "trust_reviews",
    "demand_signals",
    "actions",
  ];

  return Object.fromEntries(
    sections.map((section) => [section, resolveSectionRules(section)])
  ) as Record<SectionKey, ResolvedSectionRules>;
}

