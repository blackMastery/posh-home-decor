import { formatPrice } from "@/lib/format/money";

export function Price({
  price,
  compareAt,
  prefix = "$",
  className = "",
}: {
  price: number;
  compareAt?: number | null;
  prefix?: string;
  className?: string;
}) {
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

/** Badge precedence: Sold out > Sale > New. */
export function ProductBadge({ available, onSale, isNew }: { available: boolean; onSale: boolean; isNew: boolean }) {
  const label = !available ? "Sold out" : onSale ? "Sale" : isNew ? "New" : null;
  if (!label) return null;
  const tone = !available
    ? "bg-ink-soft text-cream"
    : onSale
      ? "bg-brown text-cream"
      : "bg-cream-raised text-brown-deep border border-line-strong";
  return <span className={`eyebrow px-2.5 py-1.5 text-[10px] ${tone}`}>{label}</span>;
}
