"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { TAGS } from "@/lib/data/catalog";
import type { Availability } from "@/lib/catalog/types";
import { SLUG_RE, slugify } from "@/lib/slug";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string>; conflict?: boolean };

function invalidateProduct(...slugs: (string | null | undefined)[]) {
  updateTag(TAGS.products);
  updateTag(TAGS.home);
  updateTag(TAGS.categories);
  for (const s of slugs) if (s) updateTag(TAGS.product(s));
}

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .transform((v) => v || null);

const ProductInput = z.object({
  id: z.uuid(),
  intent: z.enum(["draft", "publish", "keep"]),
  expectedUpdatedAt: z.string().nullable(),
  force: z.boolean().default(false),
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: z.string().trim().max(80).default(""),
  note: optionalText,
  description: optionalText,
  price: z.number().int().positive("Price must be more than 0").nullable(),
  compareAtPrice: z.number().int().positive().nullable(),
  categoryId: z.uuid().nullable(),
  availability: z.enum(["available", "coming_soon", "sold_out"]),
  detailsText: optionalText,
  careText: optionalText,
  deliveryText: optionalText,
  featuredRank: z.number().int().min(0).max(100000).nullable(),
  itemCode: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(
      z
        .string()
        .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$/, "Item code: letters, numbers, . _ / - only (max 40)")
        .nullable(),
    ),
  itemUpcCode: z
    .string()
    .transform((v) => v.replace(/\D/g, "") || null)
    .pipe(z.string().regex(/^\d{8,14}$/, "UPC must be 8–14 digits").nullable()),
  images: z
    .array(
      z.object({
        storagePath: z.string().regex(/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/),
        width: z.number().int().positive().nullable(),
        height: z.number().int().positive().nullable(),
        alt: z.string().trim().max(200).nullable(),
      }),
    )
    .max(20),
  relatedIds: z.array(z.uuid()).max(4),
});

export type ProductInputT = z.input<typeof ProductInput>;

export async function saveProduct(
  input: ProductInputT,
): Promise<ActionResult<{ id: string; slug: string; updatedAt: string; status: string }>> {
  const { supabase } = await requireAdmin();
  const parsed = ProductInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: Object.values(fieldErrors)[0] ?? "Please check the form", fieldErrors };
  }
  const v = parsed.data;

  // Every image must belong to this product's folder.
  if (v.images.some((img) => !img.storagePath.startsWith(`products/${v.id}/`))) {
    return { ok: false, error: "Image upload mismatch — please re-add photos" };
  }

  const { data: existing, error: loadError } = await supabase
    .from("products")
    .select("id, slug, status, updated_at")
    .eq("id", v.id)
    .maybeSingle();
  if (loadError) return { ok: false, error: loadError.message };

  if (existing && !v.force && v.expectedUpdatedAt && existing.updated_at !== v.expectedUpdatedAt) {
    return { ok: false, conflict: true, error: "This product was changed on another device — reload?" };
  }

  const status =
    v.intent === "publish" ? "published" : v.intent === "draft" ? "draft" : (existing?.status ?? "draft");

  // Draft saves are lenient; publishing requires the essentials.
  const fieldErrors: Record<string, string> = {};
  if (!v.categoryId) fieldErrors.categoryId = "Choose a category";
  if (status === "published" && v.images.length === 0) fieldErrors.images = "Add at least one photo to publish";
  // No price is fine ("Price on request"), but a Sale needs a price to compare against.
  if (v.compareAtPrice != null && v.price == null) {
    fieldErrors.compareAtPrice = "Add a price to show a Was price";
  } else if (v.compareAtPrice != null && v.price != null && v.compareAtPrice <= v.price) {
    fieldErrors.compareAtPrice = "Was price must be higher to show as Sale";
  }
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: Object.values(fieldErrors)[0], fieldErrors };
  }

  // Slug: explicit slugs must be valid and unique; auto slugs get a suffix.
  const explicit = v.slug.length > 0;
  let slug = explicit ? v.slug.toLowerCase() : existing?.slug ?? slugify(v.name);
  if (!slug || !SLUG_RE.test(slug)) {
    return { ok: false, error: "Web address can only use letters, numbers and dashes", fieldErrors: { slug: "Invalid web address" } };
  }
  const { data: clash } = await supabase.from("products").select("id").eq("slug", slug).neq("id", v.id).maybeSingle();
  if (clash) {
    if (explicit && existing?.slug !== slug) {
      return { ok: false, error: "Another product already uses that web address", fieldErrors: { slug: "Already in use" } };
    }
    const base = slug;
    for (let n = 2; n < 100; n++) {
      slug = `${base}-${n}`;
      const { data: taken } = await supabase.from("products").select("id").eq("slug", slug).neq("id", v.id).maybeSingle();
      if (!taken) break;
    }
  }

  const row = {
    id: v.id,
    slug,
    name: v.name,
    note: v.note,
    description: v.description,
    price: v.price,
    compare_at_price: v.compareAtPrice,
    category_id: v.categoryId!,
    availability: v.availability,
    status,
    details_text: v.detailsText,
    care_text: v.careText,
    delivery_text: v.deliveryText,
    featured_rank: v.featuredRank,
    item_code: v.itemCode,
    item_upc_code: v.itemUpcCode,
  };

  const { data: saved, error: saveError } = existing
    ? await supabase.from("products").update(row).eq("id", v.id).select("id, slug, updated_at, status").single()
    : await supabase.from("products").insert(row).select("id, slug, updated_at, status").single();
  if (saveError) {
    if (saveError.code === "23505" && saveError.message.includes("item_code")) {
      return { ok: false, error: "Another product already uses that item code", fieldErrors: { itemCode: "Already in use" } };
    }
    if (saveError.code === "23505" && saveError.message.includes("item_upc_code")) {
      return { ok: false, error: "Another product already uses that UPC", fieldErrors: { itemUpcCode: "Already in use" } };
    }
    return { ok: false, error: saveError.message };
  }

  // Images: replace the set; delete storage objects no longer referenced.
  const { data: oldImages } = await supabase.from("product_images").select("storage_path").eq("product_id", v.id);
  const keep = new Set(v.images.map((i) => i.storagePath));
  const removed = (oldImages ?? []).map((i) => i.storage_path).filter((p) => !keep.has(p));
  const { error: delImgError } = await supabase.from("product_images").delete().eq("product_id", v.id);
  if (delImgError) return { ok: false, error: delImgError.message };
  if (v.images.length) {
    const { error: imgError } = await supabase.from("product_images").insert(
      v.images.map((img, i) => ({
        product_id: v.id,
        storage_path: img.storagePath,
        width: img.width,
        height: img.height,
        alt: img.alt || null,
        sort_order: i,
      })),
    );
    if (imgError) return { ok: false, error: imgError.message };
  }
  if (removed.length) await supabase.storage.from("product-images").remove(removed);

  // Related ("Style it with").
  await supabase.from("product_related").delete().eq("product_id", v.id);
  const related = v.relatedIds.filter((id) => id !== v.id);
  if (related.length) {
    const { error: relError } = await supabase
      .from("product_related")
      .insert(related.map((related_id, sort_order) => ({ product_id: v.id, related_id, sort_order })));
    if (relError) return { ok: false, error: relError.message };
  }

  // Touch updated_at after child writes so the conflict check sees the final version.
  const { data: final } = await supabase
    .from("products")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", v.id)
    .select("updated_at")
    .single();

  invalidateProduct(existing?.slug, saved.slug);
  return { ok: true, id: saved.id, slug: saved.slug, updatedAt: final?.updated_at ?? saved.updated_at, status: saved.status };
}

export async function setAvailability(id: string, availability: Availability): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid product" };
  if (!["available", "coming_soon", "sold_out"].includes(availability)) return { ok: false, error: "Invalid availability" };
  const { data, error } = await supabase
    .from("products")
    .update({ availability })
    .eq("id", id)
    .select("slug")
    .single();
  if (error) return { ok: false, error: error.message };
  invalidateProduct(data.slug);
  return { ok: true };
}

export async function setStatus(id: string, status: "draft" | "published" | "archived"): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid product" };
  if (status === "published") {
    const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", id);
    if (!count) return { ok: false, error: "Add at least one photo to publish" };
  }
  const { data, error } = await supabase.from("products").update({ status }).eq("id", id).select("slug").single();
  if (error) return { ok: false, error: error.message };
  invalidateProduct(data.slug);
  return { ok: true };
}

/** Copies everything except images and slug; opens as a draft. */
export async function duplicateProduct(id: string): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireAdmin();
  const { data: p, error } = await supabase.from("products").select("*").eq("id", id).single();
  if (error) return { ok: false, error: error.message };
  const base = slugify(`${p.name} copy`);
  let slug = base;
  for (let n = 2; n < 100; n++) {
    const { data: taken } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${n}`;
  }
  const { data: created, error: insertError } = await supabase
    .from("products")
    .insert({
      slug,
      name: `${p.name} (copy)`,
      note: p.note,
      description: p.description,
      price: p.price,
      compare_at_price: p.compare_at_price,
      category_id: p.category_id,
      availability: p.availability,
      status: "draft",
      details_text: p.details_text,
      care_text: p.care_text,
      delivery_text: p.delivery_text,
      featured_rank: null,
    })
    .select("id")
    .single();
  if (insertError) return { ok: false, error: insertError.message };
  const { data: rel } = await supabase.from("product_related").select("related_id, sort_order").eq("product_id", id);
  if (rel?.length) {
    await supabase.from("product_related").insert(rel.map((r) => ({ ...r, product_id: created.id })));
  }
  updateTag(TAGS.products);
  return { ok: true, id: created.id };
}

export async function searchProductsForRelated(q: string, excludeId: string) {
  const { supabase } = await requireAdmin();
  const term = q.trim().slice(0, 60).replace(/[%_\\]/g, (m) => `\\${m}`);
  let query = supabase
    .from("product_cards")
    .select("id, name, image_path, status, category_name")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(8);
  if (term) query = query.ilike("name", `%${term}%`);
  if (z.uuid().safeParse(excludeId).success) query = query.neq("id", excludeId);
  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id!,
    name: r.name!,
    imagePath: r.image_path,
    status: r.status!,
    categoryName: r.category_name,
  }));
}
