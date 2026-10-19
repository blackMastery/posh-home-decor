import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { hasActiveFilters, toRpcFilters } from "@/lib/catalog/filters";
import {
  DIMS,
  toAvailability,
  type Attribute,
  type Availability,
  type Category,
  type ColorSwatch,
  type DimKey,
  type FacetResult,
  type ProductCardData,
  type Settings,
  type ShopFilters,
  type ShopSort,
  toSwatch,
} from "@/lib/catalog/types";

// Cache tags (spec §6.5). Admin mutations call updateTag() with these.
export const TAGS = {
  products: "products",
  product: (slug: string) => `product:${slug}`,
  categories: "categories",
  settings: "settings",
  home: "home",
  redirects: "redirects",
  gallery: "gallery",
  attributes: "attributes",
} as const;

export const CARD_COLUMNS =
  "id, slug, name, note, price, compare_at_price, availability, is_new, is_on_sale, image_path, image_width, image_height, image_alt, color_swatches";

function swatches(raw: unknown): ColorSwatch[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: { name?: unknown; hex?: unknown; swatch?: unknown }) => ({
    name: String(s.name ?? ""),
    hex: typeof s.hex === "string" ? s.hex : null,
    swatch: toSwatch(s.swatch),
  }));
}


export function card(row: Record<string, unknown>): ProductCardData {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    note: (row.note as string | null) ?? null,
    price: (row.price as number | null) ?? null,
    compare_at_price: (row.compare_at_price as number | null) ?? null,
    availability: toAvailability(row.availability),
    is_new: Boolean(row.is_new),
    is_on_sale: Boolean(row.is_on_sale),
    image_path: (row.image_path as string | null) ?? null,
    image_width: (row.image_width as number | null) ?? null,
    image_height: (row.image_height as number | null) ?? null,
    image_alt: (row.image_alt as string | null) ?? null,
    color_swatches: swatches(row.color_swatches),
  };
}

export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.settings);
  const { data, error } = await createPublicClient().from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

/** All categories with published-product subtree counts. */
export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.categories, TAGS.products);
  const db = createPublicClient();
  const [{ data: cats, error }, { data: stats, error: statsError }] = await Promise.all([
    db.from("categories").select("*").order("sort_order"),
    db.rpc("category_stats", { p_published_only: true }),
  ]);
  if (error) throw error;
  if (statsError) throw statsError;
  const byId = new Map((stats ?? []).map((s) => [s.category_id, s]));
  return (cats ?? []).map((c) => ({
    ...c,
    productCount: Number(byId.get(c.id)?.product_count ?? 0),
    newestImagePath: byId.get(c.id)?.newest_image_path ?? null,
  }));
}

/** Attributes with their values, in admin order. */
export async function getAttributes(): Promise<Attribute[]> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.attributes);
  const { data, error } = await createPublicClient()
    .from("attributes")
    .select("id, name, slug, kind, sort_order, show_on_pdp, values:attribute_values(id, name, slug, hex, swatch, sort_order)")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((a) => ({
    ...a,
    kind: a.kind === "color" ? "color" : "standard",
    values: [...(a.values ?? [])]
      .map((v) => ({ ...v, swatch: toSwatch(v.swatch) }))
      .sort((x, y) => x.sort_order - y.sort_order || x.name.localeCompare(y.name)),
  }));
}

export type ShopQuery = {
  categoryPath?: string | null;
  q?: string | null;
  filters: ShopFilters;
  sort?: ShopSort;
  /** Dimension for the size sort; null = largest. */
  sizeDim?: DimKey | null;
  limit: number;
};

async function fetchShopProducts(query: ShopQuery): Promise<{ items: ProductCardData[]; total: number }> {
  const { data, error } = await createPublicClient().rpc("shop_products", {
    p_category_path: query.categoryPath ?? undefined,
    p_q: query.q ?? undefined,
    ...toRpcFilters(query.filters),
    p_sort: query.sort ?? "featured",
    p_size_dim: query.sizeDim ?? undefined,
    p_limit: query.limit,
    p_offset: 0,
  });
  if (error) throw error;
  return {
    items: (data ?? []).map((r) => card(r as Record<string, unknown>)),
    total: Number(data?.[0]?.total_count ?? 0),
  };
}

async function getShopProductsCached(query: ShopQuery) {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.categories, TAGS.attributes);
  return fetchShopProducts(query);
}

/**
 * Shop listing. Plain category/search pages are cached; filtered combinations
 * run uncached so the cache doesn't grow with every permutation.
 */
export function getShopProducts(query: ShopQuery) {
  return hasActiveFilters(query.filters) ? fetchShopProducts(query) : getShopProductsCached(query);
}

export type FacetQuery = { categoryPath?: string | null; q?: string | null; filters: ShopFilters };

export async function fetchShopFacets(query: FacetQuery): Promise<FacetResult> {
  const { data, error } = await createPublicClient().rpc("shop_facets", {
    p_category_path: query.categoryPath ?? undefined,
    p_q: query.q ?? undefined,
    ...toRpcFilters(query.filters),
  });
  if (error) throw error;
  const raw = (data ?? {}) as Partial<FacetResult>;
  return {
    total: Number(raw.total ?? 0),
    values: (raw.values ?? []).map((v) => ({ attribute: v.attribute, value: v.value, count: Number(v.count) })),
    show: {
      new: Number(raw.show?.new ?? 0),
      sale: Number(raw.show?.sale ?? 0),
      "coming-soon": Number(raw.show?.["coming-soon"] ?? 0),
    },
    price: raw.price ? { min: Number(raw.price.min), max: Number(raw.price.max) } : null,
    dims: Object.fromEntries(
      Object.entries(raw.dims ?? {}).map(([k, b]) => [k, { min: Number(b?.min), max: Number(b?.max) }]),
    ),
  };
}

async function getShopFacetsCached(query: FacetQuery) {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.categories, TAGS.attributes);
  return fetchShopFacets(query);
}

export function getShopFacets(query: FacetQuery) {
  return hasActiveFilters(query.filters) ? fetchShopFacets(query) : getShopFacetsCached(query);
}

/** Counts for the virtual New / Sale / Coming soon filters (hidden when empty). */
export async function getVirtualCounts() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products);
  const { data, error } = await createPublicClient().rpc("shop_facets", {});
  if (error) throw error;
  const show = ((data ?? {}) as { show?: Record<string, number> }).show ?? {};
  return {
    newCount: Number(show.new ?? 0),
    saleCount: Number(show.sale ?? 0),
    comingSoonCount: Number(show["coming-soon"] ?? 0),
  };
}

export type SearchSuggestions = {
  products: {
    id: string;
    slug: string;
    name: string;
    price: number | null;
    availability: Availability;
    image_path: string | null;
    image_width: number | null;
    image_height: number | null;
    image_alt: string | null;
    category_name: string;
  }[];
  categories: { name: string; path: string; parent_name: string | null }[];
};

export async function getSearchSuggestions(q: string): Promise<SearchSuggestions> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products, TAGS.categories, TAGS.attributes);
  const { data, error } = await createPublicClient().rpc("search_suggest", { p_q: q, p_limit: 6 });
  if (error) throw error;
  const raw = (data ?? {}) as Partial<SearchSuggestions>;
  return {
    products: (raw.products ?? []).map((p) => ({ ...p, availability: toAvailability(p.availability) })),
    categories: (raw.categories ?? []).map((c) => ({ name: c.name, path: c.path, parent_name: c.parent_name ?? null })),
  };
}

/** Home: 4 newest published (excluding Coming soon), available first. */
export async function getNewArrivals(limit = 4): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.home);
  const { data, error } = await createPublicClient()
    .from("product_cards")
    .select(CARD_COLUMNS)
    .eq("status", "published")
    .neq("availability", "coming_soon")
    .order("availability_rank", { ascending: true })
    .order("first_available_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => card(r as Record<string, unknown>));
}

/** Home: published Coming soon pieces, newest first. */
export async function getComingSoon(limit = 4): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.home);
  const { data, error } = await createPublicClient()
    .from("product_cards")
    .select(CARD_COLUMNS)
    .eq("status", "published")
    .eq("availability", "coming_soon")
    .order("featured_rank", { ascending: true, nullsFirst: false })
    .order("first_published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => card(r as Record<string, unknown>));
}

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  note: string | null;
  description: string | null;
  price: number | null;
  compare_at_price: number | null;
  availability: Availability;
  is_new: boolean;
  is_on_sale: boolean;
  details_text: string | null;
  care_text: string | null;
  delivery_text: string | null;
  updated_at: string;
  category: { id: string; name: string; path: string };
  dimensions: Partial<Record<DimKey, number>>;
  /** Attribute values shown in the spec table, grouped by attribute (admin order). */
  specs: { attribute: { name: string; slug: string }; values: { name: string; slug: string }[] }[];
  images: { id: string; storage_path: string; width: number | null; height: number | null; alt: string | null }[];
};

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.product(slug));
  const db = createPublicClient();
  const { data: p, error } = await db
    .from("products")
    .select(
      "id, slug, name, note, description, price, compare_at_price, availability, details_text, care_text, delivery_text, updated_at, height_cm, width_cm, depth_cm, diameter_cm, category:categories(id, name, path), images:product_images(id, storage_path, width, height, alt, sort_order), links:product_attribute_values(value:attribute_values(name, slug, sort_order, attribute:attributes(name, slug, sort_order, show_on_pdp)))",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!p) return null;
  const { data: flags } = await db.from("product_cards").select("is_new, is_on_sale").eq("id", p.id).single();
  const { links, height_cm, width_cm, depth_cm, diameter_cm, ...rest } = p;
  const dimValues: Record<string, number | null> = { height_cm, width_cm, depth_cm, diameter_cm };
  const dimensions: ProductDetail["dimensions"] = {};
  for (const d of DIMS) {
    const v = dimValues[d.column];
    if (v != null) dimensions[d.key] = Number(v);
  }
  return {
    ...rest,
    dimensions,
    specs: groupSpecs(links ?? []),
    availability: toAvailability(p.availability),
    is_new: Boolean(flags?.is_new),
    is_on_sale: Boolean(flags?.is_on_sale),
    category: p.category as ProductDetail["category"],
    images: [...(p.images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  };
}

export async function getStyleItWith(productId: string): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products);
  const { data, error } = await createPublicClient().rpc("style_it_with", { p_product_id: productId, p_limit: 4 });
  if (error) throw error;
  return (data ?? []).map((r) => card(r as unknown as Record<string, unknown>));
}

export async function getPublishedSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.products);
  const { data, error } = await createPublicClient()
    .from("products")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("first_published_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Fresh (uncached) product cards by id, for bag/wishlist reconciliation. */
export async function getCardsByIds(ids: string[]): Promise<ProductCardData[]> {
  if (ids.length === 0) return [];
  const { data, error } = await createPublicClient()
    .from("product_cards")
    .select(CARD_COLUMNS)
    .in("id", ids)
    .eq("status", "published");
  if (error) throw error;
  return (data ?? []).map((r) => card(r as Record<string, unknown>));
}

type SpecLink = {
  value: {
    name: string;
    slug: string;
    sort_order: number;
    attribute: { name: string; slug: string; sort_order: number; show_on_pdp: boolean } | null;
  } | null;
};

function groupSpecs(links: SpecLink[]): ProductDetail["specs"] {
  const groups = new Map<string, { attribute: { name: string; slug: string }; order: number; values: { name: string; slug: string; order: number }[] }>();
  for (const { value } of links) {
    const attr = value?.attribute;
    if (!value || !attr || !attr.show_on_pdp) continue;
    const g = groups.get(attr.slug) ?? { attribute: { name: attr.name, slug: attr.slug }, order: attr.sort_order, values: [] };
    g.values.push({ name: value.name, slug: value.slug, order: value.sort_order });
    groups.set(attr.slug, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.order - b.order || a.attribute.name.localeCompare(b.attribute.name))
    .map((g) => ({
      attribute: g.attribute,
      values: g.values.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map(({ name, slug }) => ({ name, slug })),
    }));
}
