import type { NextRequest } from "next/server";
import { fetchShopFacets, getAttributes, getCategories } from "@/lib/data/catalog";
import { parseFilters } from "@/lib/catalog/filters";
import { SHOW_FLAGS, type ShowFlag } from "@/lib/catalog/types";

/**
 * Live facet counts for the mobile filter sheet's draft (before it is applied).
 * Same params as the shop page, plus `path` (category path) and `preset`.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const [attributes, categories] = await Promise.all([getAttributes(), getCategories()]);
  const path = sp.get("path")?.toLowerCase() || null;
  if (path && !categories.some((c) => c.path === path)) {
    return Response.json({ error: "Unknown category" }, { status: 404 });
  }
  const presetRaw = sp.get("preset");
  const preset = SHOW_FLAGS.some((f) => f.value === presetRaw) ? (presetRaw as ShowFlag) : null;
  const q = (sp.get("q") ?? "").trim().slice(0, 80) || null;
  const facets = await fetchShopFacets({ categoryPath: path, q, filters: parseFilters(sp, attributes, preset) });
  return Response.json(facets, { headers: { "Cache-Control": "private, no-store" } });
}
