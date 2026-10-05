import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog/types";
import { PoshImage } from "@/components/ui/posh-image";
import { Price, ProductBadge } from "./price";
import { QuickAdd } from "./quick-add";

export const CARD_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const soldOut = !product.is_available;
  return (
    <article className="group relative" data-reveal>
      <div className="relative">
        <div className={`relative aspect-[4/5] overflow-hidden bg-sand-image ${soldOut ? "opacity-70" : ""}`}>
            {product.image_path && (
              <PoshImage
                path={product.image_path}
                alt=""
                fill
                sizes={CARD_SIZES}
                priority={priority}
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
            )}
        </div>
        <div className="pointer-events-none absolute top-3 left-3">
          <ProductBadge available={product.is_available} onSale={product.is_on_sale} isNew={product.is_new} />
        </div>
        {!soldOut && <QuickAdd productId={product.id} name={product.name} />}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="font-display text-[clamp(18px,1.6vw,21px)] leading-tight font-medium text-brown-deep">
          <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-gold">
            {product.name}
          </Link>
        </h3>
        {product.note && <p className="text-[13px] text-muted">{product.note}</p>}
        <p className="text-[15px] font-medium">
          <Price price={product.price} compareAt={product.compare_at_price} />
        </p>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
