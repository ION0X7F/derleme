export type NormalizePaginationInput = {
  requestedTake: number | null;
  requestedCursor: number | null;
  historyLimit: number;
  maxTake: number;
};

export type NormalizePaginationResult = {
  take: number;
  cursor: number;
};

export function parsePositiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

export function normalizePagination(input: NormalizePaginationInput): NormalizePaginationResult {
  const effectiveLimit =
    input.historyLimit > 0 ? Math.min(input.historyLimit, input.maxTake) : input.maxTake;
  const take = Math.min(input.requestedTake ?? effectiveLimit, effectiveLimit, input.maxTake);
  const cursor = input.requestedCursor ?? 0;
  return { take, cursor };
}
