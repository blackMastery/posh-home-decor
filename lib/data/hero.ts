import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { storageUrl } from "@/lib/images";
import { TAGS } from "@/lib/data/catalog";
import {
  MAX_LIVE_SLIDES,
  isInWindow,
  isLinkBroken,
  resolveHref,
  type HeroKind,
  type HeroLinkType,
  type HeroScrim,
  type HeroSlideView,
  type HeroTextPosition,
  type HeroTextTone,
} from "@/lib/hero";

const MIN_REVALIDATE = 5 * 60; // below 5 min the hero would become a dynamic hole
const DAY = 24 * 60 * 60;

/**
 * Live hero slides (first MAX_LIVE_SLIDES in admin order).
 * The cache lifetime shrinks to the next scheduled start/end, so slides go live and
 * expire without an admin edit; the carousel also drops expired slides client-side.
 */
export async function getHeroSlides(): Promise<HeroSlideView[]> {
  "use cache";
  cacheTag(TAGS.hero, TAGS.products, TAGS.categories);

  const now = Date.now();
  const db = createPublicClient();
  // RLS hides slides that haven't started, so ask separately when the next one does.
  const [{ data, error }, { data: nextStart }] = await Promise.all([
    db
    .from("hero_slides")
    .select(
      "id, kind, mobile_image_path, mobile_width, mobile_height, desktop_image_path, desktop_width, desktop_height, alt, eyebrow, headline, body, cta_label, link_type, link_url, show_price, text_position, text_tone, scrim, starts_at, ends_at, product:product_cards(slug, status, price, compare_at_price, availability), category:categories(path)",
    )
    .eq("is_visible", true)
    .or(`ends_at.is.null,ends_at.gt.${new Date(now).toISOString()}`)
    .order("sort_order")
    .order("created_at"),
    db.rpc("hero_next_start"),
  ]);

  if (error) {
    // Missing table (migration not applied) or an outage: fall back to the static hero briefly.
    console.error("[hero] couldn't load slides:", error.message);
    cacheLife({ stale: 60, revalidate: MIN_REVALIDATE, expire: 2 * MIN_REVALIDATE });
    return [];
  }

  // Next moment a slide starts (from the RPC) or a live slide ends.
  let boundary = nextStart ? Date.parse(nextStart) : Infinity;
  for (const r of data ?? []) {
    for (const t of [r.starts_at, r.ends_at]) {
      const ms = t ? Date.parse(t) : NaN;
      if (ms > now && ms < boundary) boundary = ms;
    }
  }
  const untilBoundary = Number.isFinite(boundary) ? Math.ceil((boundary - now) / 1000) : DAY;
  const revalidate = Math.min(Math.max(untilBoundary, MIN_REVALIDATE), DAY);
  cacheLife({ stale: Math.min(revalidate, MIN_REVALIDATE), revalidate, expire: revalidate * 2 });

  const live: HeroSlideView[] = [];
  for (const r of data ?? []) {
    const linkType = r.link_type as HeroLinkType;
    if (!isInWindow(r.starts_at, r.ends_at, now)) continue;
    // Public reads only see published products, so a hidden product comes back null.
    if (isLinkBroken({ linkType, product: r.product, category: r.category })) continue;
    const { href, external } = resolveHref({
      linkType,
      productSlug: r.product?.slug ?? null,
      categoryPath: r.category?.path ?? null,
      linkUrl: r.link_url,
    });
    const p = r.product;
    live.push({
      id: r.id,
      kind: r.kind as HeroKind,
      mobile: { src: storageUrl(r.mobile_image_path, "site"), width: r.mobile_width ?? 1080, height: r.mobile_height ?? 1350 },
      desktop: r.desktop_image_path
        ? { src: storageUrl(r.desktop_image_path, "site"), width: r.desktop_width ?? 2000, height: r.desktop_height ?? 1000 }
        : null,
      alt: r.alt,
      eyebrow: r.eyebrow,
      headline: r.headline,
      body: r.body,
      ctaLabel: r.cta_label,
      href,
      external,
      textPosition: r.text_position as HeroTextPosition,
      textTone: r.text_tone as HeroTextTone,
      scrim: r.scrim as HeroScrim,
      price:
        r.show_price && p && p.price != null && p.availability === "available"
          ? { price: p.price, compareAt: p.compare_at_price }
          : null,
      endsAt: r.ends_at,
    });
    if (live.length === MAX_LIVE_SLIDES) break;
  }
  return live;
}
