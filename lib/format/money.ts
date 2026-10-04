const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** `$12,500` — all prices are whole GYD. */
export function formatPrice(amount: number, prefix = "$") {
  return `${prefix}${nf.format(Math.round(amount))}`;
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
