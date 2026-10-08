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
};

export type ShopSort = "featured" | "price-asc" | "price-desc" | "newest";
export const SHOP_SORTS: { value: ShopSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];
export const PAGE_SIZE = 24;
