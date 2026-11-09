"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { TAGS } from "@/lib/data/catalog";
import { KINDS, LINK_TYPES, SCRIMS, TEXT_POSITIONS, TEXT_TONES, guyanaInputToIso, type HeroSlideInput } from "@/lib/hero";
import type { ActionResult } from "./products";

function invalidate() {
  updateTag(TAGS.hero);
}

const Id = z.uuid();
const SITE_PATH = /^\/([^/\\\s][^\\\s]*)?$/;
const ImagePath = z.string().regex(/^hero\/[0-9a-f-]{36}\.jpg$/);
const Dim = z.number().int().positive().nullable();
const LocalDateTime = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)]);

const SlideInput = z
  .object({
    internalName: z.string().trim().min(1, "Give the slide a name").max(80),
    kind: z.enum(KINDS),
    mobileImagePath: ImagePath,
    mobileWidth: Dim,
    mobileHeight: Dim,
    desktopImagePath: ImagePath.nullable(),
    desktopWidth: Dim,
    desktopHeight: Dim,
    alt: z.string().trim().max(200),
    eyebrow: z.string().trim().max(40),
    headline: z.string().trim().max(80),
    body: z.string().trim().max(200),
    ctaLabel: z.string().trim().max(30),
    linkType: z.enum(LINK_TYPES),
    productId: Id.nullable(),
    categoryId: Id.nullable(),
    linkUrl: z.string().trim().max(500),
    showPrice: z.boolean(),
    textPosition: z.enum(TEXT_POSITIONS),
    textTone: z.enum(TEXT_TONES),
    scrim: z.enum(SCRIMS),
    startsAt: LocalDateTime,
    endsAt: LocalDateTime,
    isVisible: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const err = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.kind === "overlay" && !v.headline) err("headline", "Add a headline");
    if (v.kind === "artwork") {
      if (!v.alt) err("alt", "Describe what the graphic says, for screen readers and search");
      // A portrait graphic can't be cropped to a wide banner without cutting its text.
      if (!v.desktopImagePath) err("desktopImagePath", "Artwork slides need a desktop image too");
    }
    if (v.linkType === "product" && !v.productId) err("productId", "Pick a product");
    if (v.linkType === "category" && !v.categoryId) err("categoryId", "Pick a category");
    // Same rule as the DB check: no "//host" or "/\\host", which browsers treat as another site.
    if (v.linkType === "path" && !SITE_PATH.test(v.linkUrl)) err("linkUrl", "Use a site path starting with /, e.g. /shop/new");
    if (v.linkType === "url" && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v.linkUrl)) err("linkUrl", "Use a full link starting with https://");
    const s = guyanaInputToIso(v.startsAt);
    const e = guyanaInputToIso(v.endsAt);
    if (s && e && Date.parse(e) <= Date.parse(s)) err("endsAt", "End must be after the start");
  });

function toRow(v: z.output<typeof SlideInput>) {
  return {
    internal_name: v.internalName,
    kind: v.kind,
    mobile_image_path: v.mobileImagePath,
    mobile_width: v.mobileWidth,
    mobile_height: v.mobileHeight,
    desktop_image_path: v.desktopImagePath,
    desktop_width: v.desktopImagePath ? v.desktopWidth : null,
    desktop_height: v.desktopImagePath ? v.desktopHeight : null,
    alt: v.alt,
    eyebrow: v.kind === "overlay" ? v.eyebrow : "",
    headline: v.kind === "overlay" ? v.headline : "",
    body: v.kind === "overlay" ? v.body : "",
    cta_label: v.kind === "overlay" ? v.ctaLabel : "",
    link_type: v.linkType,
    product_id: v.linkType === "product" ? v.productId : null,
    category_id: v.linkType === "category" ? v.categoryId : null,
    link_url: v.linkType === "path" || v.linkType === "url" ? v.linkUrl : null,
    show_price: v.kind === "overlay" && v.linkType === "product" && v.showPrice,
    text_position: v.textPosition,
    text_tone: v.textTone,
    scrim: v.scrim,
    starts_at: guyanaInputToIso(v.startsAt),
    ends_at: guyanaInputToIso(v.endsAt),
    is_visible: v.isVisible,
  };
}

function invalid(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? "form");
    fieldErrors[k] ??= i.message;
  }
  return { ok: false, error: "Check the highlighted fields", fieldErrors };
}

export async function createSlide(input: HeroSlideInput): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireAdmin();
  const parsed = SlideInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data: last } = await supabase
    .from("hero_slides")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("hero_slides")
    .insert({ ...toRow(parsed.data), sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  invalidate();
  return { ok: true, id: data.id };
}

export async function updateSlide(id: string, input: HeroSlideInput): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Id.safeParse(id).success) return { ok: false, error: "Invalid slide" };
  const parsed = SlideInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data: before } = await supabase
    .from("hero_slides")
    .select("mobile_image_path, desktop_image_path")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false, error: "This slide was deleted" };
  const row = toRow(parsed.data);
  const { error } = await supabase.from("hero_slides").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };
  // Remove images this save replaced.
  const kept = new Set([row.mobile_image_path, row.desktop_image_path]);
  const stale = [before.mobile_image_path, before.desktop_image_path].filter((p): p is string => !!p && !kept.has(p));
  if (stale.length) await supabase.storage.from("site").remove(stale);
  invalidate();
  return { ok: true };
}

export async function setSlideVisible(id: string, isVisible: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Id.safeParse(id).success || typeof isVisible !== "boolean") return { ok: false, error: "Invalid slide" };
  const { error } = await supabase.from("hero_slides").update({ is_visible: isVisible }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  invalidate();
  return { ok: true };
}

/** Persist the full order after a drag. */
export async function reorderSlides(ids: string[]): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = z.array(Id).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order" };
  // One statement, so a failure leaves the old order intact.
  const { error } = await supabase.rpc("reorder_hero_slides", { p_ids: parsed.data });
  if (error) return { ok: false, error: error.message };
  invalidate();
  return { ok: true };
}

export async function deleteSlide(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Id.safeParse(id).success) return { ok: false, error: "Invalid slide" };
  const { data, error } = await supabase
    .from("hero_slides")
    .delete()
    .eq("id", id)
    .select("mobile_image_path, desktop_image_path")
    .single();
  if (error) return { ok: false, error: error.message };
  await supabase.storage.from("site").remove([data.mobile_image_path, data.desktop_image_path].filter((p): p is string => !!p));
  invalidate();
  return { ok: true };
}

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Safety net for uploads the form couldn't clean up (tab killed, network gone):
 * deletes hero/ files older than a day that no slide references. Run when the hero list opens.
 */
export async function sweepOrphanUploads(): Promise<ActionResult<{ removed: number }>> {
  const { supabase } = await requireAdmin();
  const storage = supabase.storage.from("site");
  const [{ data: files, error }, { data: slides, error: slidesError }] = await Promise.all([
    storage.list("hero", { limit: 1000, sortBy: { column: "created_at", order: "asc" } }),
    supabase.from("hero_slides").select("mobile_image_path, desktop_image_path"),
  ]);
  if (error || slidesError) return { ok: false, error: (error ?? slidesError)!.message };
  const used = new Set((slides ?? []).flatMap((s) => [s.mobile_image_path, s.desktop_image_path]));
  const cutoff = Date.now() - ORPHAN_AGE_MS;
  const orphans = (files ?? [])
    .filter((f) => f.id && f.created_at && Date.parse(f.created_at) < cutoff)
    .map((f) => `hero/${f.name}`)
    .filter((p) => /^hero\/[0-9a-f-]{36}\.jpg$/.test(p) && !used.has(p));
  if (orphans.length) {
    const { error: rmError } = await storage.remove(orphans);
    if (rmError) return { ok: false, error: rmError.message };
  }
  return { ok: true, removed: orphans.length };
}

/** Removes uploads the form made but never saved (replaced or abandoned). Only hero/ paths not used by any slide. */
export async function discardUploads(paths: string[]): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = z.array(ImagePath).max(10).safeParse(paths);
  if (!parsed.success || !parsed.data.length) return { ok: true };
  const list = parsed.data.join(",");
  const { data: used } = await supabase
    .from("hero_slides")
    .select("mobile_image_path, desktop_image_path")
    .or(`mobile_image_path.in.(${list}),desktop_image_path.in.(${list})`);
  const inUse = new Set((used ?? []).flatMap((r) => [r.mobile_image_path, r.desktop_image_path]));
  const orphans = parsed.data.filter((p) => !inUse.has(p));
  if (orphans.length) await supabase.storage.from("site").remove(orphans);
  return { ok: true };
}
