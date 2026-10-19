import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { CategoryOption } from "@/components/admin/product-form";
import { resolveCategoryDims } from "@/lib/catalog/tree";
import { toSwatch, type Attribute } from "@/lib/catalog/types";

/**
 * All categories as picker options with full paths ("Decor › Vases and Jars › Glass Vases")
 * and the dimensions shoppers filter that category by (inherited).
 */
export async function loadCategoryOptions(supabase: SupabaseClient<Database>): Promise<CategoryOption[]> {
  const { data } = await supabase.from("categories").select("id, name, path, filter_dims, primary_dim").order("path");
  const rows = data ?? [];
  const byPath = new Map(rows.map((c) => [c.path, c.name]));
  return rows.map((c) => {
    const parts = c.path.split("/");
    const label = parts.map((_, i) => byPath.get(parts.slice(0, i + 1).join("/")) ?? "").join(" › ");
    return { id: c.id, label, dims: resolveCategoryDims(rows, c.path).dims };
  });
}

export type AdminAttribute = Attribute & { usage: Record<string, number> };

/** Attributes with ordered values and how many products use each value. */
export async function loadAttributes(supabase: SupabaseClient<Database>): Promise<AdminAttribute[]> {
  const [{ data: attrs }, { data: links }] = await Promise.all([
    supabase
      .from("attributes")
      .select("id, name, slug, kind, sort_order, show_on_pdp, values:attribute_values(id, name, slug, hex, swatch, sort_order)")
      .order("sort_order")
      .order("name"),
    supabase.rpc("attribute_value_usage"),
  ]);
  const usage: Record<string, number> = {};
  for (const l of links ?? []) usage[l.value_id] = Number(l.product_count);
  return (attrs ?? []).map((a) => ({
    ...a,
    kind: a.kind === "color" ? "color" : "standard",
    values: [...(a.values ?? [])]
      .map((v) => ({ ...v, swatch: toSwatch(v.swatch) }))
      .sort((x, y) => x.sort_order - y.sort_order || x.name.localeCompare(y.name)),
    usage: Object.fromEntries((a.values ?? []).map((v) => [v.id, usage[v.id] ?? 0])),
  }));
}

export async function loadDefaults(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("settings")
    .select("default_details_text, default_care_text, default_delivery_text")
    .eq("id", 1)
    .single();
  return {
    details: data?.default_details_text ?? "",
    care: data?.default_care_text ?? "",
    delivery: data?.default_delivery_text ?? "",
  };
}
