import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCategories, getProductBySlug, getPublishedSlugs, getSettings, getStyleItWith } from "@/lib/data/catalog";
import { ancestry } from "@/lib/catalog/tree";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductPurchase } from "@/components/store/product-purchase";
import { Price, ProductBadge } from "@/components/store/price";
import { ProductGrid } from "@/components/store/product-card";
import { JsonLd } from "@/components/store/json-ld";
import { ChevronDown } from "@/components/ui/icons";
import { IMAGE_TRANSFORM, SITE_URL } from "@/lib/env";
import { renderUrl, storageUrl } from "@/lib/images";
import { baseOpenGraph } from "@/lib/seo";

type Props = PageProps<"/products/[slug]">;

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  // Cache Components requires at least one param; unknown slugs render on demand.
  return slugs.length ? slugs.map((s) => ({ slug: s.slug })) : [{ slug: "__placeholder__" }];
}

function ogImage(path: string) {
  const url = storageUrl(path);
  return IMAGE_TRANSFORM ? renderUrl(url, { width: 1200, height: 630, resize: "cover", quality: 80 }) : url;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Not found" };
  const description = (p.note ? `${p.note}. ` : "") + (p.description ?? "").slice(0, 150);
  const image = p.images[0];
  return {
    title: p.name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: {
      ...baseOpenGraph,
      title: `${p.name} | Posh Home Decor`,
      description,
      url: `/products/${p.slug}`,
      images: image ? [{ url: ogImage(image.storage_path), width: 1200, height: 630, alt: image.alt || p.name }] : baseOpenGraph.images,
    },
  };
}

export default function ProductPage(props: Props) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent {...props} />
    </Suspense>
  );
}

async function ProductContent({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [categories, related, settings] = await Promise.all([getCategories(), getStyleItWith(product.id), getSettings()]);
  const trail = ancestry(categories, product.category.path);
  const url = `${SITE_URL}/products/${product.slug}`;
  const crumbs = [
    { href: "/", label: "Home" },
    ...trail.map((c) => ({ href: `/shop/${c.path}`, label: c.name })),
    { href: `/products/${product.slug}`, label: product.name },
  ];
  const accordions = [
    { title: "Details", body: product.details_text },
    { title: "Care", body: product.care_text },
    { title: "Delivery & collection", body: product.delivery_text },
  ].filter((a) => a.body && a.body.trim());

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          url,
          brand: { "@type": "Brand", name: "Posh Home Decor" },
          description: product.description ?? product.note ?? undefined,
          image: product.images.map((i) => storageUrl(i.storage_path)),
          category: trail.map((c) => c.name).join(" > "),
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: "GYD",
            price: product.price,
            availability: product.is_available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            seller: { "@id": `${SITE_URL}/#business` },
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            item: `${SITE_URL}${c.href}`,
          })),
        }}
      />

      <div className="container-posh pt-6 pb-20 nav:pt-10">
        <Breadcrumbs items={crumbs} />

        <div className="mt-6 grid gap-10 nav:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] nav:gap-14 lg:gap-20">
          <ProductGallery
            images={product.images}
            name={product.name}
            productId={product.id}
            soldOut={!product.is_available}
          />

          <div className="nav:sticky nav:top-[150px] nav:self-start">
            <div className="flex items-center gap-3">
              <p className="eyebrow text-bronze">{product.category.name}</p>
              <ProductBadge available={product.is_available} onSale={product.is_on_sale} isNew={product.is_new} />
            </div>
            <h1 className="mt-3 font-display text-[clamp(34px,4vw,54px)] leading-[1.02] font-medium text-brown-deep">
              {product.name}
            </h1>
            {product.note && <p className="mt-2 text-[15px] text-muted">{product.note}</p>}
            <p className="mt-5 text-[22px] font-medium">
              <Price price={product.price} compareAt={product.compare_at_price} prefix={settings.price_prefix} />
            </p>
            {product.description && (
              <p className="mt-6 max-w-prose text-[16px] leading-relaxed font-light text-ink-soft">{product.description}</p>
            )}

            <div className="mt-8">
              <ProductPurchase
                productId={product.id}
                name={product.name}
                price={product.price}
                available={product.is_available}
                productUrl={url}
              />
              <p className="mt-3 text-[13px] text-muted">
                Orders are confirmed on WhatsApp. Delivery quoted in the chat · All prices in GYD
              </p>
            </div>

            {accordions.length > 0 && (
              <div className="mt-10 border-t border-line">
                {accordions.map((a, i) => (
                  <details key={a.title} open={i === 0} className="group border-b border-line">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 label-caps text-brown-deep [&::-webkit-details-marker]:hidden">
                      {a.title}
                      <ChevronDown size={18} className="transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="pb-6 text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">{a.body}</div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-24" aria-labelledby="style-heading">
            <p className="eyebrow text-bronze">Complete the look</p>
            <h2 id="style-heading" className="mt-3 font-display text-[clamp(30px,3.4vw,44px)] leading-none font-medium text-brown-deep">
              Style it <em className="text-bronze">with</em>
            </h2>
            <div className="mt-10">
              <ProductGrid products={related} />
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function ProductSkeleton() {
  return (
    <div className="container-posh pt-6 pb-20 nav:pt-10" aria-busy="true">
      <div className="h-4 w-60 bg-sand" />
      <div className="mt-6 grid gap-10 nav:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] nav:gap-14 lg:gap-20">
        <div className="aspect-[4/5] animate-pulse bg-sand-image" />
        <div className="space-y-4">
          <div className="h-3 w-24 bg-sand" />
          <div className="h-12 w-4/5 bg-sand" />
          <div className="h-6 w-28 bg-sand" />
          <div className="h-24 w-full bg-sand" />
          <div className="h-12 w-full bg-sand" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
