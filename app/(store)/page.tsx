import Link from "next/link";
import { getCategories, getComingSoon, getNewArrivals, getSettings } from "@/lib/data/catalog";
import { ProductGrid } from "@/components/store/product-card";
import { PoshImage } from "@/components/ui/posh-image";
import { ArrowRight } from "@/components/ui/icons";
import { JsonLd } from "@/components/store/json-ld";
import { HomeHero } from "@/components/store/home-hero";
import { SITE_URL } from "@/lib/env";
import { BRAND_NAME, SITE_DESCRIPTION } from "@/lib/seo";
import { ADDRESS, LANDLINE, MAPS_URL } from "@/lib/contact";

export default async function HomePage() {
  const [settings, categories, newest, comingSoon] = await Promise.all([
    getSettings(),
    getCategories(),
    getNewArrivals(4),
    getComingSoon(4),
  ]);
  const tiles = categories
    .filter((c) => c.depth === 1 && c.productCount > 0)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 6);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HomeGoodsStore",
          "@id": `${SITE_URL}/#business`,
          name: BRAND_NAME,
          description: SITE_DESCRIPTION,
          url: SITE_URL,
          telephone: LANDLINE.tel,
          contactPoint: {
            "@type": "ContactPoint",
            telephone: `+${settings.whatsapp_number}`,
            contactType: "sales",
            areaServed: "GY",
          },
          hasMap: MAPS_URL,
          image: `${SITE_URL}/images/og-default.jpg`,
          logo: `${SITE_URL}/images/logo-full.png`,
          priceRange: "$$",
          currenciesAccepted: "GYD",
          address: {
            "@type": "PostalAddress",
            streetAddress: ADDRESS.street,
            addressLocality: ADDRESS.city,
            addressRegion: ADDRESS.region,
            addressCountry: "GY",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: BRAND_NAME,
          url: SITE_URL,
          inLanguage: "en-GY",
          publisher: { "@id": `${SITE_URL}/#business` },
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/shop?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />

      {/* 1. Hero */}
      <HomeHero />

      {/* 2. Shop by category */}
      {tiles.length > 0 && (
        <section className="container-posh py-[clamp(64px,10vw,120px)]" aria-labelledby="cat-heading">
          <div className="flex items-end justify-between gap-6" data-reveal>
            <div>
              <p className="eyebrow text-bronze">Explore</p>
              <h2 id="cat-heading" className="mt-3 font-display text-[clamp(32px,4vw,52px)] leading-none font-medium text-brown-deep">
                Shop by <em className="text-bronze">category</em>
              </h2>
            </div>
            <Link href="/shop" className="label-caps hidden min-h-11 items-center gap-2 text-brown hover:underline sm:inline-flex">
              All pieces <ArrowRight size={14} />
            </Link>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {tiles.map((c) => {
              const tile = c.tile_image_path
                ? { path: c.tile_image_path, bucket: "site" as const }
                : c.newestImagePath
                  ? { path: c.newestImagePath, bucket: "product-images" as const }
                  : null;
              return (
                <li key={c.id} data-reveal>
                  <Link href={`/shop/${c.path}`} className="group block">
                    <div className="relative aspect-[3/4] overflow-hidden bg-sand-image">
                      {tile && (
                        <PoshImage
                          path={tile.path}
                          bucket={tile.bucket}
                          alt=""
                          fill
                          sizes="(max-width: 1024px) 50vw, 25vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      )}
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(59,35,20,0.7)_100%)]" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-cream">
                        <p className="font-display text-[clamp(24px,2.4vw,32px)] leading-none font-medium">{c.name}</p>
                        <p className="mt-2 text-[12px] tracking-[0.18em] text-gold-light uppercase">
                          {c.productCount} {c.productCount === 1 ? "piece" : "pieces"}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 3. New in the showroom */}
      {newest.length > 0 && (
        <section className="bg-sand/60 py-[clamp(64px,10vw,120px)]" aria-labelledby="new-heading">
          <div className="container-posh">
            <div className="flex items-end justify-between gap-6" data-reveal>
              <div>
                <p className="eyebrow text-bronze">Just arrived</p>
                <h2 id="new-heading" className="mt-3 font-display text-[clamp(32px,4vw,52px)] leading-none font-medium text-brown-deep">
                  New in the <em className="text-bronze">showroom</em>
                </h2>
              </div>
              <Link href="/shop/new" className="label-caps inline-flex min-h-11 items-center gap-2 text-brown hover:underline">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="mt-10">
              <ProductGrid products={newest} />
            </div>
          </div>
        </section>
      )}

      {/* 4. Coming soon (hidden when empty) */}
      {comingSoon.length > 0 && (
        <section className="container-posh py-[clamp(64px,10vw,120px)]" aria-labelledby="soon-heading">
          <div className="flex items-end justify-between gap-6" data-reveal>
            <div>
              <p className="eyebrow text-bronze">Pre-order now</p>
              <h2 id="soon-heading" className="mt-3 font-display text-[clamp(32px,4vw,52px)] leading-none font-medium text-brown-deep">
                Coming <em className="text-bronze">soon</em>
              </h2>
            </div>
            <Link href="/shop/coming-soon" className="label-caps inline-flex min-h-11 items-center gap-2 text-brown hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-10">
            <ProductGrid products={comingSoon} />
          </div>
        </section>
      )}

    </>
  );
}
