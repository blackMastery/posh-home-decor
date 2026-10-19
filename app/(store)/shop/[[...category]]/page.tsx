import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAttributes, getCategories, getShopFacets, getShopProducts } from "@/lib/data/catalog";
import { hasActiveFilters, parseFilters, pruneFilters, sameFilters, writeFilters } from "@/lib/catalog/filters";
import { ancestry, resolveCategoryDims } from "@/lib/catalog/tree";
import { PAGE_SIZE, SHOP_SORTS, type Category, type ShopFilters, type ShopSort, type ShowFlag } from "@/lib/catalog/types";
import { ProductGrid } from "@/components/store/product-card";
import { ShopControls } from "@/components/store/shop-controls";
import {
  ActiveFilterChips,
  FilterSheetButton,
  FilterSidebar,
  PendingResults,
  ShopFiltersProvider,
} from "@/components/store/shop-filters";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { JsonLd } from "@/components/store/json-ld";
import { SITE_URL } from "@/lib/env";
import { baseOpenGraph } from "@/lib/seo";

type Props = PageProps<"/shop/[[...category]]">;

const MAX_PAGE = 40;

type Resolved =
  | { kind: "all" }
  | { kind: "new" }
  | { kind: "sale" }
  | { kind: "coming-soon" }
  | { kind: "category"; category: Category; trail: Category[] };

async function resolve(segments: string[] | undefined): Promise<Resolved | null> {
  if (!segments || segments.length === 0) return { kind: "all" };
  if (segments.length === 1 && segments[0] === "new") return { kind: "new" };
  if (segments.length === 1 && segments[0] === "sale") return { kind: "sale" };
  if (segments.length === 1 && segments[0] === "coming-soon") return { kind: "coming-soon" };
  const path = segments.map((s) => decodeURIComponent(s).toLowerCase()).join("/");
  const categories = await getCategories();
  const category = categories.find((c) => c.path === path);
  if (!category) return null;
  return { kind: "category", category, trail: ancestry(categories, path) };
}

function parseSearch(sp: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim().slice(0, 80);
  const sortRaw = one(sp.sort);
  const sort: ShopSort = SHOP_SORTS.some((s) => s.value === sortRaw) ? (sortRaw as ShopSort) : "featured";
  const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));
  return { q, sort, page };
}

function title(r: Resolved) {
  switch (r.kind) {
    case "all":
      return "Curated pieces";
    case "new":
      return "New arrivals";
    case "sale":
      return "Sale";
    case "coming-soon":
      return "Coming soon";
    case "category":
      return r.category.name;
  }
}

/** New / Sale / Coming soon landing pages preset that toggle. */
function presetOf(r: Resolved): ShowFlag | null {
  return r.kind === "new" || r.kind === "sale" || r.kind === "coming-soon" ? r.kind : null;
}

function basePath(r: Resolved) {
  return r.kind === "all" ? "/shop" : r.kind === "category" ? `/shop/${r.category.path}` : `/shop/${r.kind}`;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const [{ category }, sp] = await Promise.all([props.params, props.searchParams]);
  const r = await resolve(category);
  if (!r) return { title: "Not found" };
  const { q, page } = parseSearch(sp);
  const filtered = hasActiveFilters(parseFilters(sp, await getAttributes(), presetOf(r)), presetOf(r));
  const name = title(r);
  const pageTitle = r.kind === "all" ? "Shop" : name;
  const description =
    r.kind === "category"
      ? `Shop ${name.toLowerCase()} at Posh Home Decor, Georgetown. Order on WhatsApp.`
      : `${name} at Posh Home Decor, Georgetown. Build your bag and order on WhatsApp.`;
  return {
    title: pageTitle,
    description,
    alternates: { canonical: basePath(r) },
    openGraph: { ...baseOpenGraph, title: `${pageTitle} | Posh Home Decor`, description, url: basePath(r) },
    // Search, deeper pages and filter combinations stay out of the index (canonical = the plain listing).
    robots: q || page > 1 || filtered ? { index: false, follow: true } : undefined,
  };
}

export default function ShopPage(props: Props) {
  return (
    <Suspense fallback={<ShopSkeleton />}>
      <ShopContent {...props} />
    </Suspense>
  );
}

async function ShopContent(props: Props) {
  const [{ category: segments }, sp] = await Promise.all([props.params, props.searchParams]);
  const r = await resolve(segments);
  if (!r) notFound();
  const { q, sort, page } = parseSearch(sp);
  const preset = presetOf(r);
  const categoryPath = r.kind === "category" ? r.category.path : null;

  const [attributes, categories] = await Promise.all([getAttributes(), getCategories()]);
  const { dims, primaryDim } = resolveCategoryDims(categories, categoryPath);

  const load = (f: ShopFilters) =>
    Promise.all([
      getShopProducts({ categoryPath, q: q || null, filters: f, sort, sizeDim: primaryDim, limit: page * PAGE_SIZE }),
      getShopFacets({ categoryPath, q: q || null, filters: f }),
    ]);
  let filters = parseFilters(sp, attributes, preset);
  let [{ items, total }, facets] = await load(filters);
  // Selections this listing can't offer (e.g. kept from another category) are dropped.
  const pruned = pruneFilters(filters, facets, dims);
  if (!sameFilters(pruned, filters)) {
    filters = pruned;
    [{ items, total }, facets] = await load(filters);
  }
  const filtered = hasActiveFilters(filters, preset);

  const topLevel = categories.filter((c) => c.depth === 1 && c.productCount > 0).sort((a, b) => a.sort_order - b.sort_order);
  const children =
    r.kind === "category"
      ? categories
          .filter((c) => c.parent_id === r.category.id && c.productCount > 0)
          .sort((a, b) => a.sort_order - b.sort_order)
      : [];
  const activeTop = r.kind === "category" ? r.trail[0]?.path : null;

  // Params kept when paging this listing (the preset is implied by the path)…
  const keepHere = new URLSearchParams();
  if (q) keepHere.set("q", q);
  if (sort !== "featured") keepHere.set("sort", sort);
  // …and when moving to another listing (the preset becomes an explicit toggle).
  const keepAcross = writeFilters(new URLSearchParams(keepHere), filters, attributes, null);
  writeFilters(keepHere, filters, attributes, preset);
  const withParams = (path: string, extra?: Record<string, string>, keep = keepAcross) => {
    const p = new URLSearchParams(keep);
    for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
    const s = p.toString();
    return s ? `${path}?${s}` : path;
  };

  const chips: { href: string; label: string; active: boolean }[] = [
    { href: "/shop", label: "All", active: r.kind !== "category" },
    ...topLevel.map((c) => ({ href: `/shop/${c.path}`, label: c.name, active: activeTop === c.path })),
  ];

  const crumbs =
    r.kind === "category"
      ? [
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
          ...r.trail.map((c) => ({ href: `/shop/${c.path}`, label: c.name })),
        ]
      : null;

  return (
    <div className="container-posh pt-10 pb-24 nav:pt-14">
      {crumbs && (
        <>
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
          <Breadcrumbs items={crumbs} />
        </>
      )}

      <header className="mt-4">
        <p className="eyebrow text-bronze">Shop</p>
        <h1 className="mt-3 font-display text-[clamp(38px,5vw,68px)] leading-none font-medium text-brown-deep">{title(r)}</h1>
        {children.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {children.map((c) => (
              <li key={c.id}>
                <Link
                  href={withParams(`/shop/${c.path}`)}
                  className="inline-flex min-h-11 items-center border border-line-strong px-4 text-[14px] text-ink-soft hover:border-brown hover:text-brown"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>

      <ShopFiltersProvider
        value={{ attributes, facets, filters, preset, dims, basePath: basePath(r), categoryPath, q }}
      >
        <div className="mt-10 space-y-5 border-y border-line py-5">
          <ShopControls q={q} sort={sort} />
          <nav aria-label="Categories" className="no-scrollbar -mx-[clamp(16px,4vw,48px)] overflow-x-auto px-[clamp(16px,4vw,48px)]">
            <ul className="flex w-max gap-2">
              {chips.map((c) => (
                <li key={c.href}>
                  <Link
                    href={withParams(c.href)}
                    aria-current={c.active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center px-5 text-[13px] tracking-[0.12em] uppercase transition-colors ${
                      c.active
                        ? "bg-brown text-cream"
                        : "border border-line-strong text-ink-soft hover:border-brown hover:text-brown"
                    }`}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[264px_minmax(0,1fr)] xl:gap-12">
          <div className="hidden lg:block">
            <div className="no-scrollbar sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto pb-6">
              <FilterSidebar />
            </div>
          </div>

          <div>
            <div className="flex min-h-11 items-center justify-between gap-4">
              <p className="text-[13px] tracking-[0.12em] text-muted uppercase" aria-live="polite">
                {total} {total === 1 ? "piece" : "pieces"}
                {q && (
                  <>
                    {" "}
                    for “<span className="text-ink">{q}</span>”
                  </>
                )}
              </p>
              <div className="lg:hidden">
                <FilterSheetButton />
              </div>
            </div>
            <ActiveFilterChips className="mt-4" />

            <PendingResults>
              {items.length === 0 ? (
                <div className="mt-8 flex flex-col items-center bg-sand px-6 py-20 text-center">
                  <p className="font-display text-[32px] leading-tight text-brown-deep">
                    {filtered ? "No pieces match these filters" : q ? "Nothing matches that search" : "New pieces arriving soon"}
                  </p>
                  <p className="mt-3 max-w-sm text-[15px] text-ink-soft">
                    {filtered
                      ? "Try removing a filter or two, or widen a size or price range."
                      : q
                        ? "Try a different word, or browse everything in the showroom."
                        : "We're restocking this collection. In the meantime, have a look around."}
                  </p>
                  {filtered ? (
                    <ActiveFilterChips className="mt-8 justify-center" />
                  ) : (
                    <Link href="/shop" className="btn btn-primary mt-8">
                      View all pieces
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  <div className="mt-8">
                    <ProductGrid products={items} priorityCount={4} columns="md:grid-cols-3" />
                  </div>
                  {items.length < total && page < MAX_PAGE && (
                    <div className="mt-16 flex flex-col items-center gap-3">
                      <p className="text-[13px] text-muted">
                        Showing {items.length} of {total}
                      </p>
                      <Link href={withParams(basePath(r), { page: String(page + 1) }, keepHere)} scroll={false} className="btn btn-outline">
                        Load more
                      </Link>
                    </div>
                  )}
                </>
              )}
            </PendingResults>
          </div>
        </div>
      </ShopFiltersProvider>
    </div>
  );
}

function ShopSkeleton() {
  return (
    <div className="container-posh pt-10 pb-24 nav:pt-14" aria-busy="true">
      <div className="h-3 w-16 bg-sand" />
      <div className="mt-4 h-14 w-72 max-w-full bg-sand" />
      <div className="mt-10 h-28 border-y border-line" />
      <ul className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}>
            <div className="aspect-[4/5] animate-pulse bg-sand-image" />
            <div className="mt-3 h-5 w-3/4 bg-sand" />
            <div className="mt-2 h-4 w-1/3 bg-sand" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading pieces…</span>
    </div>
  );
}
