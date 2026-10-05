import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/auth";
import { CategoryTree, type AdminCategory } from "@/components/admin/category-tree";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { supabase } = await requireAdminPage();
  const [{ data: cats }, { data: stats }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id, parent_id, name, slug, path, depth, sort_order, tile_image_path").order("sort_order").order("name"),
    supabase.rpc("category_stats", { p_published_only: false }),
    supabase.from("products").select("category_id"),
  ]);
  const subtree = new Map((stats ?? []).map((s) => [s.category_id, Number(s.product_count)]));
  const direct = new Map<string, number>();
  for (const p of products ?? []) direct.set(p.category_id, (direct.get(p.category_id) ?? 0) + 1);
  const childCount = new Map<string, number>();
  for (const c of cats ?? []) if (c.parent_id) childCount.set(c.parent_id, (childCount.get(c.parent_id) ?? 0) + 1);

  const list: AdminCategory[] = (cats ?? []).map((c) => ({
    ...c,
    subtreeCount: subtree.get(c.id) ?? 0,
    directProducts: direct.get(c.id) ?? 0,
    childCount: childCount.get(c.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <h1 className="text-[26px] font-medium text-brown-deep">Categories</h1>
      <p className="mt-1 text-[14px] text-muted">Up to 3 levels. Renaming keeps old links working.</p>
      <CategoryTree categories={list} />
    </div>
  );
}
