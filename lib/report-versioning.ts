type AccessStateLike = {
  plan?: string;
  [key: string]: unknown;
};

export type ReportVersionMeta = {
  previousReportId: string | null;
  rootReportId: string | null;
  generation: number;
  trigger: "analyze" | "reanalyze";
};

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readReportVersionMeta(accessState: unknown): ReportVersionMeta {
  const state = asObject(accessState);
  const meta = asObject(state?.versioning);

  const generation = getNumber(meta?.generation) ?? 0;

  return {
    previousReportId: getString(meta?.previousReportId),
    rootReportId: getString(meta?.rootReportId),
    generation: Math.max(0, Math.round(generation)),
    trigger:
      getString(meta?.trigger) === "reanalyze" ? "reanalyze" : "analyze",
  };
}

export function attachReportVersionMeta(params: {
  accessState: AccessStateLike;
  previousReportId?: string | null;
  rootReportId?: string | null;
  generation?: number;
  trigger?: "analyze" | "reanalyze";
}) {
  const generation =
    typeof params.generation === "number" && Number.isFinite(params.generation)
      ? Math.max(0, Math.round(params.generation))
      : 0;

  return {
    ...params.accessState,
    versioning: {
      previousReportId: params.previousReportId ?? null,
      rootReportId: params.rootReportId ?? null,
      generation,
      trigger: params.trigger ?? "analyze",
      createdAt: new Date().toISOString(),
    },
  };
}
