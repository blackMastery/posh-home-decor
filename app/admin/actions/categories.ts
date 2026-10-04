"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { TAGS } from "@/lib/data/catalog";
import { RESERVED_CATEGORY_SLUGS, slugify } from "@/lib/slug";
import type { ActionResult } from "./products";

function invalidate() {
  updateTag(TAGS.categories);
  updateTag(TAGS.products);
  updateTag(TAGS.home);
  updateTag(TAGS.redirects);
}

/** Turn trigger exceptions (P0001) and unique violations into friendly messages. */
function friendly(error: { code?: string; message: string }) {
  if (error.code === "23505") return "A category with that name already exists here.";
  if (error.code === "23503") return "This category still contains products or subcategories.";
  return error.message;
}

const Name = z.string().trim().min(1, "Name is required").max(80);

function slugFor(name: string) {
  const slug = slugify(name);
  if (!slug) return { error: "Name needs at least one letter or number" } as const;
  if ((RESERVED_CATEGORY_SLUGS as readonly string[]).includes(slug)) {
    return { error: `"${name}" can't be used — /shop/${slug} is reserved.` } as const;
  }
  return { slug } as const;
}

export async function createCategory(parentId: string | null, name: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const n = Name.safeParse(name);
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  const s = slugFor(n.data);
  if ("error" in s) return { ok: false, error: s.error! };
  const { data: siblings } = await supabase
    .from("categories")
    .select("sort_order")
    .filter("parent_id", parentId ? "eq" : "is", parentId ?? null)
    .order("sort_order", { ascending: false })
    .limit(1);
  const { error } = await supabase.from("categories").insert({
    parent_id: parentId,
    name: n.data,
    slug: s.slug,
    sort_order: (siblings?.[0]?.sort_order ?? 0) + 1,
  } as never);
  if (error) return { ok: false, error: friendly(error) };
  invalidate();
  return { ok: true };
}

export async function renameCategory(id: string, name: string, updateSlug: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const n = Name.safeParse(name);
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  const patch: { name: string; slug?: string } = { name: n.data };
  if (updateSlug) {
    const s = slugFor(n.data);
    if ("error" in s) return { ok: false, error: s.error! };
    patch.slug = s.slug;
  }
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendly(error) };
  invalidate();
  return { ok: true };
}

export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: me } = await supabase.from("categories").select("id, parent_id").eq("id", id).single();
  if (!me) return { ok: false, error: "Category not found" };
  const { data: siblings } = await supabase
    .from("categories")
    .select("id, sort_order, name")
    .filter("parent_id", me.parent_id ? "eq" : "is", me.parent_id ?? null)
    .order("sort_order")
    .order("name");
  const list = siblings ?? [];
  const i = list.findIndex((c) => c.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  // Renumber so equal sort_orders can't get stuck.
  for (const [idx, c] of list.entries()) {
    if (c.sort_order !== idx + 1) {
      const { error } = await supabase.from("categories").update({ sort_order: idx + 1 }).eq("id", c.id);
      if (error) return { ok: false, error: friendly(error) };
    }
  }
  invalidate();
  return { ok: true };
}

export async function reparentCategory(id: string, newParentId: string | null): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (newParentId === id) return { ok: false, error: "A category cannot be moved inside itself" };
  const { data: siblings } = await supabase
    .from("categories")
    .select("sort_order")
    .filter("parent_id", newParentId ? "eq" : "is", newParentId ?? null)
    .order("sort_order", { ascending: false })
    .limit(1);
  const { error } = await supabase
    .from("categories")
    .update({ parent_id: newParentId, sort_order: (siblings?.[0]?.sort_order ?? 0) + 1 })
    .eq("id", id);
  if (error) return { ok: false, error: friendly(error) };
  invalidate();
  return { ok: true };
}

export async function setCategoryTile(id: string, path: string | null): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (path && !/^tiles\/[0-9a-f-]{36}\.jpg$/.test(path)) return { ok: false, error: "Invalid image" };
  const { data: before } = await supabase.from("categories").select("tile_image_path, depth").eq("id", id).single();
  if (!before) return { ok: false, error: "Category not found" };
  if (before.depth !== 1) return { ok: false, error: "Tile images are for top-level categories only" };
  const { error } = await supabase.from("categories").update({ tile_image_path: path }).eq("id", id);
  if (error) return { ok: false, error: friendly(error) };
  if (before.tile_image_path && before.tile_image_path !== path) {
    await supabase.storage.from("site").remove([before.tile_image_path]);
  }
  invalidate();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const [{ count: children }, { count: products }] = await Promise.all([
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id),
  ]);
  if (children || products) return { ok: false, error: "Move or remove its products and subcategories first." };
  const { data: before } = await supabase.from("categories").select("tile_image_path").eq("id", id).single();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error) };
  if (before?.tile_image_path) await supabase.storage.from("site").remove([before.tile_image_path]);
  invalidate();
  return { ok: true };
}
