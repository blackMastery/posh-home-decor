const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** `$12,500` — all prices are whole GYD. */
export function formatPrice(amount: number, prefix = "$") {
  return `${prefix}${nf.format(Math.round(amount))}`;
}

export const PRICE_ON_REQUEST = "Price on request";

/** `$12,500`, or "Price on request" when the product has no price. */
export function formatPriceOrRequest(amount: number | null, prefix = "$") {
  return amount == null ? PRICE_ON_REQUEST : formatPrice(amount, prefix);
}

export function formatNumber(n: number) {
  return nf.format(n);
}

/**
 * Whole-percent discount from the Was price, rounded down so we never overstate
 * the saving (`$177.50 → $67.76` is 61%, not 62%). null when not on sale.
 */
export function discountPercent(price: number | null, compareAt: number | null | undefined): number | null {
  if (price == null || compareAt == null || compareAt <= price || compareAt <= 0) return null;
  const pct = Math.floor(((compareAt - price) * 100) / compareAt);
  return pct >= 1 ? pct : null;
}

/** Sale price for `pct`% off `base`, rounded down to whole GYD (so the shown % is never less than `pct`). */
export function priceAfterDiscount(base: number, pct: number): number {
  return Math.floor((base * (100 - pct)) / 100);
}

/** Parse "12,500" → 12500. Returns null when empty/invalid. */
export function parseMoney(input: string): number | null {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isSafeInteger(n) ? n : null;
}
