import type { Availability } from "@/lib/catalog/types";
import { formatPrice, PRICE_ON_REQUEST } from "@/lib/format/money";

export function Price({
  price,
  compareAt,
  prefix = "$",
  className = "",
}: {
  price: number | null;
  compareAt?: number | null;
  prefix?: string;
  className?: string;
}) {
  if (price == null) {
    return <span className={`text-ink-soft ${className}`}>{PRICE_ON_REQUEST}</span>;
  }
  const onSale = compareAt != null && compareAt > price;
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
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
    </span>
  );
}

/** Badge precedence: Sold out > Coming soon > Sale > New. */
export function ProductBadge({
  availability,
  onSale,
  isNew,
}: {
  availability: Availability;
  onSale: boolean;
  isNew: boolean;
}) {
  const label =
    availability === "sold_out"
      ? "Sold out"
      : availability === "coming_soon"
        ? "Coming soon"
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
        : onSale
          ? "bg-brown text-cream"
          : "bg-cream-raised text-brown-deep border border-line-strong";
  return <span className={`eyebrow px-2.5 py-1.5 text-[10px] ${tone}`}>{label}</span>;
}
