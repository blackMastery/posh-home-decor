import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { ProductCardData } from "@/lib/catalog/types";
import { CARD_COLUMNS, TAGS, card } from "./catalog";

export const GALLERY_PAGE_SIZE = 30;

export type GalleryPhoto = {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  alt: string | null;
  /** Published products only (sold out included), in the admin's order. */
  products: ProductCardData[];
};

/** Visible photos in admin order, with their "Shop this look" products. */
export async function getGalleryPage(limit: number): Promise<{ photos: GalleryPhoto[]; total: number }> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.gallery, TAGS.products);
  const db = createPublicClient();
  const { data, error, count } = await db
    .from("gallery_photos")
    .select("id, storage_path, width, height, caption, alt, links:gallery_photo_products(product_id, sort_order)", {
      count: "exact",
    })
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at")
    .range(0, limit - 1);
  if (error) throw error;

  const productIds = [...new Set((data ?? []).flatMap((p) => p.links.map((l) => l.product_id)))];
  const byId = new Map<string, ProductCardData>();
  if (productIds.length) {
    const { data: cards, error: cardsError } = await db
      .from("product_cards")
      .select(CARD_COLUMNS)
      .in("id", productIds)
      .eq("status", "published");
    if (cardsError) throw cardsError;
    for (const c of cards ?? []) {
      const mapped = card(c as Record<string, unknown>);
      byId.set(mapped.id, mapped);
    }
  }

  const photos = (data ?? []).map(({ links, ...p }) => ({
    ...p,
    products: [...links]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => byId.get(l.product_id))
      .filter((c): c is ProductCardData => c != null),
  }));
  return { photos, total: count ?? photos.length };
}

/** One visible photo, for deep-link metadata. */
export async function getGalleryPhoto(id: string) {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.gallery);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createPublicClient()
    .from("gallery_photos")
    .select("id, storage_path, caption, alt")
    .eq("id", id)
    .eq("is_visible", true)
    .maybeSingle();
  return data;
}
