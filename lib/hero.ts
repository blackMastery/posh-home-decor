/** Hero carousel: types and pure helpers shared by the storefront, admin UI and server actions. */

export const MAX_LIVE_SLIDES = 5;
export const AUTOPLAY_MS = 6000;

/** Recommended upload ratios (width / height). The storefront frames match these. */
export const MOBILE_RATIO = 4 / 5;
export const DESKTOP_RATIO = 2 / 1;

export const KINDS = ["overlay", "artwork"] as const;
export const LINK_TYPES = ["none", "product", "category", "path", "url"] as const;
export const TEXT_POSITIONS = ["bottom-left", "center", "bottom-center"] as const;
export const TEXT_TONES = ["light", "dark"] as const;
export const SCRIMS = ["none", "soft", "strong"] as const;

export type HeroKind = (typeof KINDS)[number];
export type HeroLinkType = (typeof LINK_TYPES)[number];
export type HeroTextPosition = (typeof TEXT_POSITIONS)[number];
export type HeroTextTone = (typeof TEXT_TONES)[number];
export type HeroScrim = (typeof SCRIMS)[number];

export type HeroImage = { src: string; width: number; height: number };

/** What the storefront (and the admin preview) renders. */
export type HeroSlideView = {
  id: string;
  kind: HeroKind;
  mobile: HeroImage;
  desktop: HeroImage | null;
  alt: string;
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  href: string | null;
  external: boolean;
  textPosition: HeroTextPosition;
  textTone: HeroTextTone;
  scrim: HeroScrim;
  price: { price: number; compareAt: number | null } | null;
  endsAt: string | null;
};

export type AdminHeroProduct = {
  id: string;
  name: string;
  slug: string;
  status: string;
  imagePath: string | null;
  price: number | null;
  compareAt: number | null;
};
export type AdminHeroCategory = { id: string; name: string; path: string };

/** Editable fields, as the admin form holds them (dates are Guyana-local "YYYY-MM-DDTHH:mm"). */
export type HeroSlideInput = {
  internalName: string;
  kind: HeroKind;
  mobileImagePath: string;
  mobileWidth: number | null;
  mobileHeight: number | null;
  desktopImagePath: string | null;
  desktopWidth: number | null;
  desktopHeight: number | null;
  alt: string;
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  linkType: HeroLinkType;
  productId: string | null;
  categoryId: string | null;
  linkUrl: string;
  showPrice: boolean;
  textPosition: HeroTextPosition;
  textTone: HeroTextTone;
  scrim: HeroScrim;
  startsAt: string;
  endsAt: string;
  isVisible: boolean;
};

export type HeroStats = { views7: number; clicks7: number; views30: number; clicks30: number };

/** The editable subset of a loaded slide, for the form. */
export function toSlideInput(s: AdminHeroSlide): HeroSlideInput {
  return {
    internalName: s.internalName,
    kind: s.kind,
    mobileImagePath: s.mobileImagePath,
    mobileWidth: s.mobileWidth,
    mobileHeight: s.mobileHeight,
    desktopImagePath: s.desktopImagePath,
    desktopWidth: s.desktopWidth,
    desktopHeight: s.desktopHeight,
    alt: s.alt,
    eyebrow: s.eyebrow,
    headline: s.headline,
    body: s.body,
    ctaLabel: s.ctaLabel,
    linkType: s.linkType,
    productId: s.productId,
    categoryId: s.categoryId,
    linkUrl: s.linkUrl,
    showPrice: s.showPrice,
    textPosition: s.textPosition,
    textTone: s.textTone,
    scrim: s.scrim,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    isVisible: s.isVisible,
  };
}

export type AdminHeroSlide = HeroSlideInput & {
  id: string;
  /** UTC ISO, for status checks. */
  startsAtIso: string | null;
  endsAtIso: string | null;
  product: AdminHeroProduct | null;
  category: AdminHeroCategory | null;
  stats: HeroStats;
};

export type HeroStatus = "live" | "scheduled" | "expired" | "draft" | "over-limit" | "broken";

export const STATUS_LABEL: Record<HeroStatus, string> = {
  live: "Live",
  scheduled: "Scheduled",
  expired: "Expired",
  draft: "Hidden",
  "over-limit": "Over limit — not shown",
  broken: "Link broken",
};

/** True when the slide's link points at a product or category customers can't see. */
export function isLinkBroken(s: {
  linkType: HeroLinkType;
  product: { status: string | null } | null;
  category: unknown | null;
}) {
  if (s.linkType === "product") return !s.product || s.product.status !== "published";
  if (s.linkType === "category") return !s.category;
  return false;
}

export function isInWindow(startsAt: string | null, endsAt: string | null, now: number) {
  if (startsAt && Date.parse(startsAt) > now) return false;
  if (endsAt && Date.parse(endsAt) <= now) return false;
  return true;
}

/** Status for each slide in admin order, applying the live cap the same way the storefront does. */
export function slideStatuses(slides: AdminHeroSlide[], now: number): HeroStatus[] {
  let live = 0;
  return slides.map((s) => {
    if (!s.isVisible) return "draft";
    if (s.endsAtIso && Date.parse(s.endsAtIso) <= now) return "expired";
    if (s.startsAtIso && Date.parse(s.startsAtIso) > now) return "scheduled";
    if (isLinkBroken(s)) return "broken";
    live += 1;
    return live > MAX_LIVE_SLIDES ? "over-limit" : "live";
  });
}

export function resolveHref(s: {
  linkType: HeroLinkType;
  productSlug: string | null;
  categoryPath: string | null;
  linkUrl: string | null;
}): { href: string | null; external: boolean } {
  switch (s.linkType) {
    case "product":
      return { href: s.productSlug ? `/products/${s.productSlug}` : null, external: false };
    case "category":
      return { href: s.categoryPath ? `/shop/${s.categoryPath}` : null, external: false };
    case "path":
      return { href: s.linkUrl || null, external: false };
    case "url":
      return { href: s.linkUrl || null, external: true };
    default:
      return { href: null, external: false };
  }
}

// --- Guyana time (fixed UTC−4, no daylight saving) ---------------------------

const GY_OFFSET_MS = -4 * 60 * 60 * 1000;

/** UTC ISO → "YYYY-MM-DDTHH:mm" in Guyana time, for <input type="datetime-local">. */
export function isoToGuyanaInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(Date.parse(iso) + GY_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" in Guyana time → UTC ISO. Empty → null. */
export function guyanaInputToIso(local: string): string | null {
  if (!local) return null;
  const ms = Date.parse(`${local}:00-04:00`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function ctr(views: number, clicks: number) {
  return views > 0 ? `${((clicks / views) * 100).toFixed(1)}%` : "—";
}
