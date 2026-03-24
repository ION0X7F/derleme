import type {
  InternalDebugEvent,
  InternalDebugLevel,
  InternalDebugStage,
  InternalDebugTraceReport,
  InternalDebugTraceSummary,
} from "@/types/analysis";

type DebugTraceContext = {
  pipeline: string;
  url?: string | null;
  platform?: string | null;
};

type TraceEventInput = {
  stage: InternalDebugStage;
  code: string;
  message: string;
  level?: InternalDebugLevel;
  field?: string;
  meta?: Record<string, unknown>;
};

type MutableDebugTrace = {
  enabled: boolean;
  pipeline: string;
  urlHost?: string | null;
  platform?: string | null;
  events: InternalDebugEvent[];
};

export type DebugTraceHandle = MutableDebugTrace | null;

const MAX_EVENTS = 120;
const MAX_STRING_LENGTH = 220;
const SENSITIVE_KEYS = ["authorization", "cookie", "set-cookie", "token", "html", "body"];

export function isDebugTraceEnabled() {
  const value =
    process.env.SELLBOOST_DEBUG_TRACE ||
    process.env.DEBUG_TRACE ||
    process.env.NODE_ENV === "development";

  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;

  return ["1", "true", "yes", "on", "development"].includes(
    value.toLocaleLowerCase("tr-TR")
  );
}

function sanitizeValue(value: unknown): unknown {
  if (value == null) return value;

  if (typeof value === "string") {
    if (value.length <= MAX_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_STRING_LENGTH)}...`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item));
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(input)) {
      if (SENSITIVE_KEYS.includes(key.toLocaleLowerCase("tr-TR"))) continue;
      output[key] = sanitizeValue(item);
    }
    return output;
  }

  return String(value);
}

function summarize(trace: MutableDebugTrace): InternalDebugTraceSummary {
  const countStage = (stage: InternalDebugStage) =>
    trace.events.filter((item) => item.stage === stage).length;

  return {
    totalEvents: trace.events.length,
    warnings: trace.events.filter((item) => item.level === "warn").length,
    fetchEvents: countStage("fetch"),
    parseEvents: countStage("parse"),
    mergeEvents: countStage("merge"),
    overrideEvents: countStage("override"),
    analysisEvents: countStage("analysis"),
    confidenceEvents: countStage("confidence"),
    missingCriticalCount: trace.events.filter((item) => item.code === "critical_field_missing").length,
    overrideConflictCount: trace.events.filter((item) => item.code === "field_override_conflict").length,
    confidenceDowngradeCount: trace.events.filter((item) => item.code.includes("confidence_downgraded")).length,
  };
}

export function createDebugTrace(context: DebugTraceContext): DebugTraceHandle {
  if (!isDebugTraceEnabled()) return null;

  let urlHost: string | null = null;
  try {
    if (context.url) {
      urlHost = new URL(context.url).host;
    }
  } catch {
    urlHost = null;
  }

  return {
    enabled: true,
    pipeline: context.pipeline,
    urlHost,
    platform: context.platform ?? null,
    events: [],
  };
}

export function traceEvent(trace: DebugTraceHandle, input: TraceEventInput) {
  if (!trace?.enabled) return;
  if (trace.events.length >= MAX_EVENTS) return;

  trace.events.push({
    stage: input.stage,
    level: input.level ?? "info",
    code: input.code,
    message: input.message,
    field: input.field,
    meta: sanitizeValue(input.meta) as Record<string, unknown> | undefined,
    timestamp: new Date().toISOString(),
  });
}

export function traceConflict(
  trace: DebugTraceHandle,
  params: {
    field: string;
    winner: string;
    loser: string;
    winnerValue?: unknown;
    loserValue?: unknown;
    reason: string;
  }
) {
  traceEvent(trace, {
    stage: "override",
    level: "warn",
    code: "field_override_conflict",
    field: params.field,
    message: `${params.field} override edildi: ${params.winner} kazandi, ${params.loser} yok sayildi.`,
    meta: {
      winner: params.winner,
      loser: params.loser,
      winnerValue: params.winnerValue,
      loserValue: params.loserValue,
      reason: params.reason,
    },
  });
}

export function traceMissingField(
  trace: DebugTraceHandle,
  field: string,
  reason: string,
  critical = false
) {
  traceEvent(trace, {
    stage: "parse",
    level: critical ? "warn" : "info",
    code: critical ? "critical_field_missing" : "field_missing",
    field,
    message: `${field} hicbir uygun kaynaktan bulunamadi.`,
    meta: { reason, critical },
  });
}

export function finalizeDebugTrace(
  trace: DebugTraceHandle
): InternalDebugTraceReport | null {
  if (!trace?.enabled) return null;

  return {
    enabled: true,
    pipeline: trace.pipeline,
    urlHost: trace.urlHost ?? null,
    platform: trace.platform ?? null,
    events: trace.events,
    summary: summarize(trace),
  };
}

export function emitDebugTrace(
  trace: DebugTraceHandle,
  label = "SellBoostDebugTrace"
) {
  const report = finalizeDebugTrace(trace);
  if (!report) return null;
  console.log(`[${label}] ${JSON.stringify(report)}`);
  return report;
}
