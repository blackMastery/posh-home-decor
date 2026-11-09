import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  isoToGuyanaInput,
  type AdminHeroSlide,
  type HeroKind,
  type HeroLinkType,
  type HeroScrim,
  type HeroStats,
  type HeroTextPosition,
  type HeroTextTone,
} from "@/lib/hero";

const SELECT =
  "*, product:product_cards(id, name, slug, status, image_path, price, compare_at_price), category:categories(id, name, path)";

type Row = Database["public"]["Tables"]["hero_slides"]["Row"] & {
  product: {
    id: string | null;
    name: string | null;
    slug: string | null;
    status: string | null;
    image_path: string | null;
    price: number | null;
    compare_at_price: number | null;
  } | null;
  category: { id: string; name: string; path: string } | null;
};

const NO_STATS: HeroStats = { views7: 0, clicks7: 0, views30: 0, clicks30: 0 };

function toAdmin(r: Row, stats: HeroStats = NO_STATS): AdminHeroSlide {
  return {
    id: r.id,
    internalName: r.internal_name,
    kind: r.kind as HeroKind,
    mobileImagePath: r.mobile_image_path,
    mobileWidth: r.mobile_width,
    mobileHeight: r.mobile_height,
    desktopImagePath: r.desktop_image_path,
    desktopWidth: r.desktop_width,
    desktopHeight: r.desktop_height,
    alt: r.alt,
    eyebrow: r.eyebrow,
    headline: r.headline,
    body: r.body,
    ctaLabel: r.cta_label,
    linkType: r.link_type as HeroLinkType,
    productId: r.product_id,
    categoryId: r.category_id,
    linkUrl: r.link_url ?? "",
    showPrice: r.show_price,
    textPosition: r.text_position as HeroTextPosition,
    textTone: r.text_tone as HeroTextTone,
    scrim: r.scrim as HeroScrim,
    startsAt: isoToGuyanaInput(r.starts_at),
    endsAt: isoToGuyanaInput(r.ends_at),
    startsAtIso: r.starts_at,
    endsAtIso: r.ends_at,
    isVisible: r.is_visible,
    product: r.product?.id
      ? { id: r.product.id, name: r.product.name ?? "", slug: r.product.slug ?? "", status: r.product.status ?? "", imagePath: r.product.image_path, price: r.product.price, compareAt: r.product.compare_at_price }
      : null,
    category: r.category,
    stats,
  };
}

/** Guyana-local calendar date `days` ago, as YYYY-MM-DD. */
function gyDaysAgo(days: number) {
  return new Date(Date.now() - 4 * 3600_000 - days * 86400_000).toISOString().slice(0, 10);
}

export async function loadAdminSlides(supabase: SupabaseClient<Database>): Promise<AdminHeroSlide[]> {
  const since30 = gyDaysAgo(29);
  const since7 = gyDaysAgo(6);
  const [{ data, error }, { data: stats, error: statsError }] = await Promise.all([
    supabase.from("hero_slides").select(SELECT).order("sort_order").order("created_at"),
    // Summed in the database: one row per slide, so the API row limit can't truncate it.
    supabase.rpc("hero_stats_summary", { p_since7: since7, p_since30: since30 }),
  ]);
  if (error) throw error;
  if (statsError) throw statsError;
  const bySlide = new Map<string, HeroStats>(
    (stats ?? []).map((s) => [
      s.slide_id,
      { views7: Number(s.views7), clicks7: Number(s.clicks7), views30: Number(s.views30), clicks30: Number(s.clicks30) },
    ]),
  );
  return ((data ?? []) as unknown as Row[]).map((r) => toAdmin(r, bySlide.get(r.id)));
}

export async function loadAdminSlide(supabase: SupabaseClient<Database>, id: string): Promise<AdminHeroSlide | null> {
  const { data } = await supabase.from("hero_slides").select(SELECT).eq("id", id).maybeSingle();
  return data ? toAdmin(data as unknown as Row) : null;
}
