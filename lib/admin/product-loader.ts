import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { CategoryOption } from "@/components/admin/product-form";

/** All categories as picker options with full paths ("Decor › Vases and Jars › Glass Vases"). */
export async function loadCategoryOptions(supabase: SupabaseClient<Database>): Promise<CategoryOption[]> {
  const { data } = await supabase.from("categories").select("id, name, path").order("path");
  const byPath = new Map((data ?? []).map((c) => [c.path, c.name]));
  return (data ?? []).map((c) => {
    const parts = c.path.split("/");
    const label = parts.map((_, i) => byPath.get(parts.slice(0, i + 1).join("/")) ?? "").join(" › ");
    return { id: c.id, label };
  });
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
