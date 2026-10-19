import type { Database } from "@/lib/database.types";

export type Settings = Database["public"]["Tables"]["settings"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export type Category = CategoryRow & {
  productCount: number;
  newestImagePath: string | null;
};

export type CategoryNode = Category & { children: CategoryNode[] };

export type Availability = "available" | "coming_soon" | "sold_out";
export const AVAILABILITIES: { value: Availability; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "sold_out", label: "Sold out" },
];

export function toAvailability(value: unknown): Availability {
  return value === "coming_soon" || value === "sold_out" ? value : "available";
}

/** What a product card needs. Field names mirror the product_cards view. */
export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  note: string | null;
  /** null = "Price on request" (priced on WhatsApp). */
  price: number | null;
  compare_at_price: number | null;
  availability: Availability;
  is_new: boolean;
  is_on_sale: boolean;
  image_path: string | null;
  image_width: number | null;
  image_height: number | null;
  image_alt: string | null;
  /** Colour attribute values, for the swatch dots. */
  color_swatches: ColorSwatch[];
};

export type ShopSort = "featured" | "price-asc" | "price-desc" | "newest" | "size-asc";
export const SHOP_SORTS: { value: ShopSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "size-asc", label: "Size: small to large" },
];
export const PAGE_SIZE = 24;

// ---------------------------------------------------------------------------
// Attributes, dimensions and shop filters
// ---------------------------------------------------------------------------

export type Swatch = "solid" | "metallic" | "multi";
export type ColorSwatch = { name: string; hex: string | null; swatch: Swatch };

export function toSwatch(value: unknown): Swatch {
  return value === "metallic" || value === "multi" ? value : "solid";
}

export type AttributeValue = {
  id: string;
  name: string;
  slug: string;
  hex: string | null;
  swatch: Swatch;
  sort_order: number;
};

export type Attribute = {
  id: string;
  name: string;
  /** Shop URL param, e.g. ?color=gold */
  slug: string;
  kind: "standard" | "color";
  sort_order: number;
  show_on_pdp: boolean;
  values: AttributeValue[];
};

export type DimKey = "height" | "width" | "depth" | "diameter";
export const DIMS: { key: DimKey; param: string; label: string; short: string; column: `${DimKey}_cm` }[] = [
  { key: "height", param: "h", label: "Height", short: "H", column: "height_cm" },
  { key: "width", param: "w", label: "Width", short: "W", column: "width_cm" },
  { key: "depth", param: "d", label: "Depth", short: "D", column: "depth_cm" },
  { key: "diameter", param: "dia", label: "Diameter", short: "Ø", column: "diameter_cm" },
];
/** "H 42 × Ø 24 cm" (dimensions in DIMS order; null when none are set). */
export function formatDimensions(dims: Partial<Record<DimKey, number>>) {
  const parts = DIMS.filter((d) => dims[d.key] != null).map((d) => `${d.short} ${Number(dims[d.key])}`);
  return parts.length ? `${parts.join(" × ")} cm` : null;
}

export function isDimKey(value: unknown): value is DimKey {
  return DIMS.some((d) => d.key === value);
}

export type ShowFlag = "new" | "sale" | "coming-soon";
export const SHOW_FLAGS: { value: ShowFlag; param: string; label: string }[] = [
  { value: "new", param: "new", label: "New in" },
  { value: "sale", param: "sale", label: "On sale" },
  { value: "coming-soon", param: "soon", label: "Coming soon" },
];

/** Either bound may be open. */
export type Range = { min: number | null; max: number | null };

export type ShopFilters = {
  /** attribute slug → selected value slugs (OR within, AND across). */
  values: Record<string, string[]>;
  price: Range | null;
  dims: Partial<Record<DimKey, Range>>;
  show: ShowFlag[];
  hideSoldOut: boolean;
};

export type Bounds = { min: number; max: number };

/** shop_facets() result. Counts are disjunctive (a facet's own selection is ignored). */
export type FacetResult = {
  total: number;
  values: { attribute: string; value: string; count: number }[];
  show: Record<ShowFlag, number>;
  price: Bounds | null;
  dims: Partial<Record<DimKey, Bounds>>;
};
