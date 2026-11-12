import type { Availability } from "@/lib/catalog/types";
import { discountPercent, formatPrice, PRICE_ON_REQUEST } from "@/lib/format/money";

export function Price({
  price,
  compareAt,
  prefix = "$",
  className = "",
  showDiscount = true,
}: {
  price: number | null;
  compareAt?: number | null;
  prefix?: string;
  className?: string;
  /** Show the "25% off" pill when on sale. */
  showDiscount?: boolean;
}) {
  if (price == null) {
    return <span className={`text-ink-soft ${className}`}>{PRICE_ON_REQUEST}</span>;
  }
  const onSale = compareAt != null && compareAt > price;
  const pct = showDiscount ? discountPercent(price, compareAt) : null;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      {onSale && (
        <s className="text-muted text-[0.85em] font-normal">
          <span className="sr-only">Was </span>
          {formatPrice(compareAt, prefix)}
        </s>
      )}
      <span className="text-brown">
        {onSale && <span className="sr-only">Now </span>}
        {formatPrice(price, prefix)}
      </span>
      {pct != null && (
        <span className="self-center bg-error/10 px-1.5 py-1 text-[11px] leading-none font-medium tracking-[0.06em] text-error uppercase">
          {pct}% off
        </span>
      )}
    </span>
  );
}

/** Badge precedence: Sold out > Coming soon > Pre-order > Sale > New. */
export function ProductBadge({
  availability,
  onSale,
  isNew,
  preorder = false,
}: {
  availability: Availability;
  onSale: boolean;
  isNew: boolean;
  /** Effective pre-order (Available + flagged). */
  preorder?: boolean;
}) {
  const isPreorder = availability === "available" && preorder;
  const label =
    availability === "sold_out"
      ? "Sold out"
      : availability === "coming_soon"
        ? "Coming soon"
        : isPreorder
          ? "Pre-order"
          : onSale
            ? "Sale"
            : isNew
              ? "New"
              : null;
  if (!label) return null;
  const tone =
    availability === "sold_out"
      ? "bg-ink-soft text-cream"
      : availability === "coming_soon"
        ? "bg-gold text-brown-deep"
        : isPreorder
          ? "bg-bronze text-cream"
          : onSale
            ? "bg-brown text-cream"
            : "bg-cream-raised text-brown-deep border border-line-strong";
  return <span className={`eyebrow px-2.5 py-1.5 text-[10px] ${tone}`}>{label}</span>;
}
