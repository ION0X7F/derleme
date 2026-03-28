export const TRENDYOL_FREE_SHIPPING_THRESHOLD = 350;

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function isTrendyolFreeShippingEligible(price: unknown): boolean {
  const amount = toFiniteNumber(price);
  return amount != null && amount >= TRENDYOL_FREE_SHIPPING_THRESHOLD;
}
