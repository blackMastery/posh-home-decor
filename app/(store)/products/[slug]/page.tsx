import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, Suspense, type ReactNode } from "react";
import { getCategories, getProductBySlug, getPublishedSlugs, getSettings, getStyleItWith } from "@/lib/data/catalog";
import { ancestry } from "@/lib/catalog/tree";
import { formatDimensions, type Availability, type DimKey } from "@/lib/catalog/types";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductPurchase } from "@/components/store/product-purchase";
import { Price, ProductBadge } from "@/components/store/price";
import { ProductGrid } from "@/components/store/product-card";
import { JsonLd } from "@/components/store/json-ld";
import { ChevronDown } from "@/components/ui/icons";
import { SITE_URL } from "@/lib/env";
import { storageUrl } from "@/lib/images";
import { BRAND_NAME, baseOpenGraph, productDescription, productOgImagePath } from "@/lib/seo";
import { displayName } from "@/lib/format/text";

type Props = PageProps<"/products/[slug]">;

const SCHEMA_AVAILABILITY: Record<Availability, string> = {
  available: "https://schema.org/InStock",
  coming_soon: "https://schema.org/PreOrder",
  sold_out: "https://schema.org/OutOfStock",
};

/** Facebook/Open Graph product availability values. */
const OG_AVAILABILITY: Record<Availability, string> = {
  available: "in stock",
  coming_soon: "preorder",
  sold_out: "out of stock",
};

/** Spec attributes that map onto schema.org Product properties; the rest go in additionalProperty. */
const SCHEMA_SPEC_PROPS: Record<string, "color" | "material"> = { colour: "color", color: "color", material: "material" };

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  // Cache Components requires at least one param; unknown slugs render on demand.
  return slugs.length ? slugs.map((s) => ({ slug: s.slug })) : [{ slug: "__placeholder__" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [p, settings] = await Promise.all([getProductBySlug(slug), getSettings()]);
  if (!p) return { title: "Not found" };
  const name = displayName(p.name);
  const title = `${name} | ${BRAND_NAME}`;
  const description = productDescription(p, settings.price_prefix);
  // Our own 1200×630 card: raw product photos are often portrait/small, which Facebook drops or crops.
  const image = { url: productOgImagePath(p, settings.price_prefix), width: 1200, height: 630, type: "image/png", alt: name };
  return {
    title: name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { ...baseOpenGraph, title, description, url: `/products/${p.slug}`, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    other: {
      "product:brand": BRAND_NAME,
      "product:availability": OG_AVAILABILITY[p.availability],
      "product:condition": "new",
      "product:retailer_item_id": p.slug,
      ...(p.price != null ? { "product:price:amount": String(p.price), "product:price:currency": "GYD" } : {}),
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
  const dimensions = formatDimensions(product.dimensions);
  const schemaProps: Record<string, string> = {};
  const extraProps: { "@type": "PropertyValue"; name: string; value: string | number; unitCode?: string }[] = [];
  for (const s of product.specs) {
    const value = s.values.map((v) => v.name).join(", ");
    const key = SCHEMA_SPEC_PROPS[s.attribute.slug];
    if (key) schemaProps[key] = value;
    else extraProps.push({ "@type": "PropertyValue", name: s.attribute.name, value });
  }
  const size = (key: DimKey) =>
    product.dimensions[key] != null ? { "@type": "QuantitativeValue", value: product.dimensions[key], unitCode: "CMT" } : undefined;
  if (product.dimensions.diameter != null)
    extraProps.push({ "@type": "PropertyValue", name: "Diameter", value: product.dimensions.diameter, unitCode: "CMT" });
  // Spec values link to the department filtered by that value ("More in Rattan").
  const department = trail[0]?.path ?? product.category.path;
  const specs =
    dimensions || product.specs.length > 0 ? (
      <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-6 gap-y-3">
        {dimensions && (
          <>
            <dt className="text-muted">Dimensions</dt>
            <dd>{dimensions}</dd>
          </>
        )}
        {product.specs.map((s) => (
          <Fragment key={s.attribute.slug}>
            <dt className="text-muted">{s.attribute.name}</dt>
            <dd>
              {s.values.map((v, i) => (
                <Fragment key={v.slug}>
                  {i > 0 && ", "}
                  <Link
                    href={`/shop/${department}?${s.attribute.slug}=${v.slug}`}
                    className="underline decoration-line-strong underline-offset-4 hover:text-brown hover:decoration-brown"
                  >
                    {v.name}
                  </Link>
                </Fragment>
              ))}
            </dd>
          </Fragment>
        ))}
      </dl>
    ) : null;
  const accordions: { title: string; body: ReactNode; pre?: boolean }[] = [
    ...(specs ? [{ title: "Specifications", body: specs }] : []),
    ...[
      { title: "Details", body: product.details_text },
      { title: "Care", body: product.care_text },
      { title: "Delivery & collection", body: product.delivery_text },
    ]
      .filter((a) => a.body && a.body.trim())
      .map((a) => ({ ...a, pre: true })),
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          "@id": `${url}#product`,
          name: displayName(product.name),
          url,
          sku: product.slug,
          brand: { "@type": "Brand", name: BRAND_NAME },
          description: product.description?.trim() || productDescription(product, settings.price_prefix),
          image: product.images.map((i) => storageUrl(i.storage_path)),
          category: trail.map((c) => c.name).join(" > "),
          ...schemaProps,
          height: size("height"),
          width: size("width"),
          depth: size("depth"),
          additionalProperty: extraProps.length ? extraProps : undefined,
          offers: {
            "@type": "Offer",
            url,
            // "Price on request" products omit price rather than publishing a fake one.
            ...(product.price != null ? { priceCurrency: "GYD", price: product.price } : {}),
            availability: SCHEMA_AVAILABILITY[product.availability],
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@type": "Organization", "@id": `${SITE_URL}/#business`, name: BRAND_NAME, url: SITE_URL },
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
        <Breadcrumbs items={crumbs} hideCurrentOnMobile />

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 nav:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] nav:gap-14 lg:gap-20">
          <ProductGallery
            images={product.images}
            name={product.name}
            productId={product.id}
            soldOut={product.availability === "sold_out"}
          />

          <div className="nav:sticky nav:top-[150px] nav:self-start">
            <div className="flex items-center gap-3">
              <p className="eyebrow text-bronze">{product.category.name}</p>
              <ProductBadge availability={product.availability} onSale={product.is_on_sale} isNew={product.is_new} />
            </div>
            <h1 className="mt-3 font-display text-[clamp(34px,4vw,54px)] leading-[1.02] font-medium text-brown-deep">
              {displayName(product.name)}
            </h1>
            {product.note && <p className="mt-2 text-[15px] text-muted">{product.note}</p>}
            <p className="mt-5 text-[22px] font-medium">
              <Price price={product.price} compareAt={product.compare_at_price} prefix={settings.price_prefix} />
            </p>
            {product.description && (
              <p className="mt-6 max-w-prose whitespace-pre-line text-[16px] leading-relaxed font-light text-ink-soft">{product.description.trim()}</p>
            )}

            <div className="mt-8">
              <ProductPurchase
                productId={product.id}
                name={product.name}
                price={product.price}
                availability={product.availability}
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
                    <div className={`pb-6 text-[15px] leading-relaxed text-ink-soft ${a.pre ? "whitespace-pre-line" : ""}`}>{a.body}</div>
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
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 nav:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] nav:gap-14 lg:gap-20">
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
