import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { toAvailability, type Availability, type Category, type ProductCardData, type Settings, type ShopSort } from "@/lib/catalog/types";

// Cache tags (spec §6.5). Admin mutations call updateTag() with these.
export const TAGS = {
  products: "products",
  product: (slug: string) => `product:${slug}`,
  categories: "categories",
  settings: "settings",
  home: "home",
  redirects: "redirects",
  gallery: "gallery",
} as const;

export const CARD_COLUMNS =
  "id, slug, name, note, price, compare_at_price, availability, is_new, is_on_sale, image_path, image_width, image_height, image_alt";

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

export type ShopFilter = "new" | "sale" | "coming-soon";

export type ShopQuery = {
  categoryPath?: string | null;
  filter?: ShopFilter | null;
  q?: string | null;
  sort?: ShopSort;
  limit: number;
};

export async function getShopProducts(query: ShopQuery): Promise<{ items: ProductCardData[]; total: number }> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.categories);
  const { data, error } = await createPublicClient().rpc("shop_products", {
    p_category_path: query.categoryPath ?? undefined,
    p_filter: query.filter ?? undefined,
    p_q: query.q ?? undefined,
    p_sort: query.sort ?? "featured",
    p_limit: query.limit,
    p_offset: 0,
  });
  if (error) throw error;
  return {
    items: (data ?? []).map(card),
    total: Number(data?.[0]?.total_count ?? 0),
  };
}

/** Counts for the virtual New / Sale / Coming soon filters (hidden when empty). */
export async function getVirtualCounts() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products);
  const db = createPublicClient();
  const [n, s, c] = await Promise.all([
    db.rpc("shop_products", { p_filter: "new", p_limit: 1 }),
    db.rpc("shop_products", { p_filter: "sale", p_limit: 1 }),
    db.rpc("shop_products", { p_filter: "coming-soon", p_limit: 1 }),
  ]);
  return {
    newCount: Number(n.data?.[0]?.total_count ?? 0),
    saleCount: Number(s.data?.[0]?.total_count ?? 0),
    comingSoonCount: Number(c.data?.[0]?.total_count ?? 0),
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
      "id, slug, name, note, description, price, compare_at_price, availability, details_text, care_text, delivery_text, updated_at, category:categories(id, name, path), images:product_images(id, storage_path, width, height, alt, sort_order)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!p) return null;
  const { data: flags } = await db.from("product_cards").select("is_new, is_on_sale").eq("id", p.id).single();
  return {
    ...p,
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
