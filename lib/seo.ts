import type { Metadata } from "next";
import type { ProductDetail } from "@/lib/data/catalog";
import { formatDimensions } from "@/lib/catalog/types";
import { formatPriceOrRequest } from "@/lib/format/money";
import { displayName } from "@/lib/format/text";

export const BRAND_NAME = "Posh Home Decor";

export const SITE_DESCRIPTION = `Curated home decor, furniture and accent pieces from ${BRAND_NAME} in Georgetown, Guyana. Build your bag and order on WhatsApp.`;

export const SITE_KEYWORDS = [
  "Posh Home Decor",
  "home decor Guyana",
  "home decor Georgetown",
  "furniture Guyana",
  "furniture store Georgetown",
  "accent pieces",
  "home styling Guyana",
  "interior decor",
  "wall art",
  "vases and decorative accessories",
];

export const DEFAULT_OG_IMAGE = { url: "/images/og-default.jpg", width: 1200, height: 630, alt: BRAND_NAME };

/**
 * Shared Open Graph fields. Next merges metadata shallowly, so any page that sets
 * `openGraph` replaces the layout's whole object — spread this in to keep them.
 */
export const baseOpenGraph = {
  siteName: "Posh Home Decor",
  type: "website",
  locale: "en_GY",
  images: [DEFAULT_OG_IMAGE],
} satisfies Metadata["openGraph"];

/** Plain-text meta description: whitespace collapsed, cut at a word boundary. */
export function metaDescription(text: string, max = 160) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** The product's own copy when it has some, otherwise a sentence built from its data. */
export function productDescription(p: ProductDetail, pricePrefix?: string) {
  const note = p.note?.trim().replace(/\.$/, "");
  const own = p.description?.trim();
  if (own) return metaDescription(note ? `${note}. ${own}` : own);
  const dims = formatDimensions(p.dimensions);
  return metaDescription(
    `${displayName(p.name)}${note ? ` (${note})` : ""}: ${p.category.name.toLowerCase()} from ${BRAND_NAME}, Georgetown, Guyana. ` +
      (dims ? `Size ${dims}. ` : "") +
      `${formatPriceOrRequest(p.price, pricePrefix)}. Order on WhatsApp.`,
  );
}

/**
 * Share image for a product, served from our own domain at exactly 1200×630. The `v` param
 * changes whenever anything drawn on it changes, so cached copies (CDN, Facebook) refresh.
 */
export function productOgImagePath(p: ProductDetail, pricePrefix = "") {
  const key = [p.name, p.updated_at, p.images[0]?.storage_path, p.price, p.compare_at_price, p.availability, pricePrefix].join("|");
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = (h * 33) ^ key.charCodeAt(i);
  return `/og/products/${p.slug}?v=${(h >>> 0).toString(36)}`;
}
