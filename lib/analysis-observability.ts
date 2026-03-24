import type { AnalysisTrace } from "@/types/analysis";

type TraceLevel = "info" | "warn" | "error";

function safeJsonParse(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

const REDACTED = "[redacted]";
const MAX_DEPTH = 2;
const MAX_KEYS = 20;
const MAX_ARRAY = 10;
const MAX_STRING = 240;
const SENSITIVE_KEY_RE = /(token|secret|password|authorization|cookie|session|email|api[-_]?key)/i;

function sanitizeKeyValue(key: string, value: unknown, depth: number): unknown {
  if (SENSITIVE_KEY_RE.test(key)) {
    return REDACTED;
  }

  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    const limited = value.slice(0, MAX_ARRAY);
    if (depth >= MAX_DEPTH) {
      return limited.map((item) => (typeof item === "string" ? sanitizeKeyValue("", item, depth) : "[truncated]"));
    }
    return limited.map((item) => sanitizeUnknown(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) {
      return "[truncated]";
    }
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS);
    const next: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of entries) {
      next[entryKey] = sanitizeKeyValue(entryKey, entryValue, depth + 1);
    }
    return next;
  }

  return String(value);
}

function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (value == null) return value;

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS);
    const next: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
      next[key] = sanitizeKeyValue(key, entryValue, depth);
    }
    return next;
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return String(value);
}

function redactUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}

function extractAiDecision(trace: AnalysisTrace | null | undefined) {
  return trace?.aiDecision
    ? {
        eligible: trace.aiDecision.eligible,
        executed: trace.aiDecision.executed,
        mode: trace.aiDecision.mode,
        reason: trace.aiDecision.reason,
        blockingFields: trace.aiDecision.blockingFields,
        coverageTier: trace.aiDecision.coverageTier,
      }
    : null;
}

export function logAnalyzeEvent(params: {
  level?: TraceLevel;
  stage: string;
  requestId: string;
  actor: string;
  url?: string | null;
  message: string;
  trace?: AnalysisTrace | null;
  extra?: unknown;
}) {
  const payload = buildAnalyzeLogPayload(params);

  if (params.level === "error") {
    console.error("[analyze]", payload);
    return;
  }

  if (params.level === "warn") {
    console.warn("[analyze]", payload);
    return;
  }

  console.info("[analyze]", payload);
}

export function buildAnalyzeLogPayload(params: {
  level?: TraceLevel;
  stage: string;
  requestId: string;
  actor: string;
  url?: string | null;
  message: string;
  trace?: AnalysisTrace | null;
  extra?: unknown;
}) {
  return {
    ts: new Date().toISOString(),
    stage: params.stage,
    requestId: params.requestId,
    actor: params.actor,
    url: redactUrl(params.url),
    message: params.message,
    aiDecision: extractAiDecision(params.trace),
    extra: sanitizeUnknown(safeJsonParse(params.extra)),
  };
}

type AnalyzeUsageLike = {
  used: number;
  limit: number;
  periodKey: string;
};

export function logAnalyzeLimitReached(params: {
  requestId: string;
  actor: string;
  url?: string | null;
  stage: string;
  usage: AnalyzeUsageLike;
  message?: string;
}) {
  logAnalyzeEvent({
    level: "warn",
    stage: params.stage,
    requestId: params.requestId,
    actor: params.actor,
    url: params.url,
    message: params.message ?? "Analyze limiti asildi",
    extra: {
      used: params.usage.used,
      limit: params.usage.limit,
      periodKey: params.usage.periodKey,
    },
  });
}

export function logAnalyzeThrottled(params: {
  requestId: string;
  actor: string;
  url?: string | null;
  stage: string;
  reason: string;
  retryAfterSeconds: number;
}) {
  logAnalyzeEvent({
    level: "warn",
    stage: params.stage,
    requestId: params.requestId,
    actor: params.actor,
    url: params.url,
    message: params.reason,
    extra: { retryAfterSeconds: params.retryAfterSeconds },
  });
}
