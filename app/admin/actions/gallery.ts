"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { TAGS } from "@/lib/data/catalog";
import { MAX_LOOK_PRODUCTS, type AdminGalleryPhoto } from "@/lib/gallery";
import type { ActionResult } from "./products";

function invalidate() {
  updateTag(TAGS.gallery);
}

const Id = z.uuid();
const PathRe = /^gallery\/[0-9a-f-]{36}\.jpg$/;

/** Records an uploaded file. New photos start hidden and go to the end. */
export async function addPhoto(input: {
  storagePath: string;
  width: number | null;
  height: number | null;
}): Promise<ActionResult<{ photo: AdminGalleryPhoto }>> {
  const { supabase } = await requireAdmin();
  const parsed = z
    .object({
      storagePath: z.string().regex(PathRe),
      width: z.number().int().positive().nullable(),
      height: z.number().int().positive().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Upload mismatch — please try again" };
  const { data: last } = await supabase
    .from("gallery_photos")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("gallery_photos")
    .insert({
      storage_path: parsed.data.storagePath,
      width: parsed.data.width,
      height: parsed.data.height,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id, storage_path, width, height")
    .single();
  if (error) return { ok: false, error: error.message };
  // Hidden photos aren't public, so no cache invalidation needed yet.
  return {
    ok: true,
    photo: {
      id: data.id,
      storagePath: data.storage_path,
      width: data.width,
      height: data.height,
      caption: "",
      alt: "",
      isVisible: false,
      products: [],
    },
  };
}

const PhotoPatch = z
  .object({
    caption: z.string().trim().max(200),
    alt: z.string().trim().max(200),
    isVisible: z.boolean(),
  })
  .partial();

export async function updatePhoto(id: string, patch: z.input<typeof PhotoPatch>): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = PhotoPatch.safeParse(patch);
  if (!Id.safeParse(id).success || !parsed.success) return { ok: false, error: "Invalid photo details" };
  const p = parsed.data;
  const { error } = await supabase
    .from("gallery_photos")
    .update({
      ...(p.caption !== undefined && { caption: p.caption || null }),
      ...(p.alt !== undefined && { alt: p.alt || null }),
      ...(p.isVisible !== undefined && { is_visible: p.isVisible }),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  invalidate();
  return { ok: true };
}

/** Persist the full order after a drag. */
export async function reorderPhotos(ids: string[]): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = z.array(Id).max(1000).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order" };
  const results = await Promise.all(
    parsed.data.map((id, sort_order) => supabase.from("gallery_photos").update({ sort_order }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  invalidate();
  return { ok: true };
}

export async function setPhotoProducts(id: string, productIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = z.array(Id).max(MAX_LOOK_PRODUCTS).safeParse([...new Set(productIds)]);
  if (!Id.safeParse(id).success || !parsed.success) {
    return { ok: false, error: `Pick up to ${MAX_LOOK_PRODUCTS} products` };
  }
  const { error: delError } = await supabase.from("gallery_photo_products").delete().eq("photo_id", id);
  if (delError) return { ok: false, error: delError.message };
  if (parsed.data.length) {
    const { error } = await supabase
      .from("gallery_photo_products")
      .insert(parsed.data.map((product_id, sort_order) => ({ photo_id: id, product_id, sort_order })));
    if (error) return { ok: false, error: error.message };
  }
  invalidate();
  return { ok: true };
}

export async function deletePhoto(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Id.safeParse(id).success) return { ok: false, error: "Invalid photo" };
  const { data, error } = await supabase.from("gallery_photos").delete().eq("id", id).select("storage_path").single();
  if (error) return { ok: false, error: error.message };
  await supabase.storage.from("site").remove([data.storage_path]);
  invalidate();
  return { ok: true };
}
