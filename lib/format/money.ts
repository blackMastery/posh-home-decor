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

/** Parse "12,500" → 12500. Returns null when empty/invalid. */
export function parseMoney(input: string): number | null {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isSafeInteger(n) ? n : null;
}
