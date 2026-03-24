import type { AnalysisTrace } from "@/types/analysis";

export type AnalysisDecisionSummary = {
  mode: "deterministic" | "ai_enriched";
  aiExecuted: boolean;
  aiMode: "skip" | "cautious" | "full" | null;
  aiReason: string | null;
  coverageTier: "strong" | "medium" | "weak" | null;
  fallbackUsed: boolean;
  dataSource: string | null;
};

export function buildAnalysisDecisionSummary(params: {
  analysisTrace: AnalysisTrace | null | undefined;
  dataSource: string | null | undefined;
}): AnalysisDecisionSummary {
  const trace = params.analysisTrace ?? null;
  const aiDecision = trace?.aiDecision ?? null;
  const mode = trace?.mode ?? "deterministic";
  const aiExecuted = aiDecision?.executed === true;

  return {
    mode,
    aiExecuted,
    aiMode: aiDecision?.mode ?? null,
    aiReason: aiDecision?.reason ?? null,
    coverageTier: aiDecision?.coverageTier ?? null,
    fallbackUsed: !aiExecuted || mode === "deterministic",
    dataSource: params.dataSource ?? null,
  };
}
