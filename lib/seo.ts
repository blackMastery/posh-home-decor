import type { Metadata } from "next";

export const BRAND_NAME = "Posh Home Decor & Styling Studio";

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
