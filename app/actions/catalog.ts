"use server";

import { z } from "zod";
import { getCardsByIds } from "@/lib/data/catalog";
import type { ProductCardData } from "@/lib/catalog/types";

const Ids = z.array(z.uuid()).max(200);

/** Fresh product data for the bag / wishlist (never cached). */
export async function fetchProductCards(ids: string[]): Promise<ProductCardData[]> {
  const parsed = Ids.safeParse(ids);
  if (!parsed.success) return [];
  return getCardsByIds([...new Set(parsed.data)]);
}
