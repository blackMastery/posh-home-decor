"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { TAGS } from "@/lib/data/catalog";
import { toSwatch, type AttributeValue } from "@/lib/catalog/types";
import { slugify } from "@/lib/slug";
import type { ActionResult } from "./products";

/** Shop URL params an attribute slug can't take (?q=, ?price=, …). Mirrors attributes_slug_not_reserved. */
const RESERVED_ATTRIBUTE_SLUGS = ["q", "sort", "page", "price", "h", "w", "d", "dia", "new", "sale", "soon", "instock"];

function invalidate() {
  updateTag(TAGS.attributes);
  updateTag(TAGS.products);
  updateTag(TAGS.home);
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === "23505") return "That name is already used here.";
  if (error.code === "23503") return "Products still use this. Merge it into another value first.";
  if (error.code === "23514" && error.message.includes("reserved")) return "That name is reserved by the shop. Try another.";
  return error.message;
}

const Uuid = z.uuid();
const AttrName = z.string().trim().min(1, "Name is required").max(40);
const ValueName = z.string().trim().min(1, "Name is required").max(60);
const Hex = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Colour must look like #C9A24B").nullable());
const SwatchKind = z.enum(["solid", "metallic", "multi"]);

/** Unique slug within `taken` (suffix -2, -3…). */
function uniqueSlug(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Next sort_order: after every attribute, or after every value of `attributeId`. */
async function nextSortOrder(attributeId?: string) {
  const { supabase } = await requireAdmin();
  const { data } = attributeId
    ? await supabase.from("attribute_values").select("sort_order").eq("attribute_id", attributeId).order("sort_order", { ascending: false }).limit(1)
    : await supabase.from("attributes").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  return (data?.[0]?.sort_order ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

export async function createAttribute(name: string, kind: "standard" | "color"): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const n = AttrName.safeParse(name);
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  const base = slugify(n.data);
  if (!base) return { ok: false, error: "Name needs at least one letter or number" };
  if (RESERVED_ATTRIBUTE_SLUGS.includes(base)) return { ok: false, error: `"${n.data}" is reserved by the shop. Try another name.` };
  const { data: existing } = await supabase.from("attributes").select("slug");
  const slug = uniqueSlug(base, new Set((existing ?? []).map((a) => a.slug)));
  const { error } = await supabase.from("attributes").insert({
    name: n.data,
    slug,
    kind: kind === "color" ? "color" : "standard",
    sort_order: await nextSortOrder(),
  });
  if (error) return { ok: false, error: friendly(error) };
  invalidate();
  return { ok: true };
}

/** Renaming keeps the slug (shop links like ?material=rattan keep working). */
export async function updateAttribute(
  id: string,
  patch: { name?: string; kind?: "standard" | "color"; showOnPdp?: boolean },
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Uuid.safeParse(id).success) return { ok: false, error: "Invalid attribute" };
  const row: { name?: string; kind?: string; show_on_pdp?: boolean } = {};
  if (patch.name !== undefined) {
    const n = AttrName.safeParse(patch.name);
    if (!n.success) return { ok: false, error: n.error.issues[0].message };
    row.name = n.data;
  }
  if (patch.kind !== undefined) row.kind = patch.kind === "color" ? "color" : "standard";
  if (patch.showOnPdp !== undefined) row.show_on_pdp = patch.showOnPdp;
  const { error } = await supabase.from("attributes").update(row).eq("id", id);
  if (error) return { ok: false, error: friendly(error) };
  invalidate();
  return { ok: true };
}

export async function deleteAttribute(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Uuid.safeParse(id).success) return { ok: false, error: "Invalid attribute" };
  const { error } = await supabase.from("attributes").delete().eq("id", id);
  if (error) return { ok: false, error: error.code === "23503" ? "Products still use values of this attribute. Remove them first." : friendly(error) };
  invalidate();
  return { ok: true };
}

/** Move an attribute (or a value within its attribute) one place up or down. */
async function swapOrder(table: "attributes" | "attribute_values", id: string, direction: "up" | "down"): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Uuid.safeParse(id).success) return { ok: false, error: "Invalid id" };
  let siblings: { id: string; sort_order: number }[] | null;
  if (table === "attributes") {
    ({ data: siblings } = await supabase.from("attributes").select("id, sort_order").order("sort_order").order("name"));
  } else {
    const { data: me } = await supabase.from("attribute_values").select("attribute_id").eq("id", id).single();
    if (!me) return { ok: false, error: "Not found" };
    ({ data: siblings } = await supabase
      .from("attribute_values")
      .select("id, sort_order")
      .eq("attribute_id", me.attribute_id)
      .order("sort_order")
      .order("name"));
  }
  const list = siblings ?? [];
  const i = list.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  // Renumber the whole list so ties (equal sort_order) can't block a move.
  const ordered = [...list];
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  for (const [n, s] of ordered.entries()) {
    if (s.sort_order === n + 1) continue;
    const { error } = await supabase.from(table).update({ sort_order: n + 1 }).eq("id", s.id);
    if (error) return { ok: false, error: error.message };
  }
  invalidate();
  return { ok: true };
}

export async function moveAttribute(id: string, direction: "up" | "down"): Promise<ActionResult> {
  return swapOrder("attributes", id, direction);
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export async function createValue(
  attributeId: string,
  input: { name: string; hex?: string; swatch?: string },
): Promise<ActionResult<{ value: AttributeValue }>> {
  const { supabase } = await requireAdmin();
  if (!Uuid.safeParse(attributeId).success) return { ok: false, error: "Invalid attribute" };
  const n = ValueName.safeParse(input.name);
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  const hex = Hex.safeParse(input.hex ?? "");
  if (!hex.success) return { ok: false, error: hex.error.issues[0].message };
  const base = slugify(n.data);
  if (!base) return { ok: false, error: "Name needs at least one letter or number" };
  const { data: existing } = await supabase.from("attribute_values").select("slug, name").eq("attribute_id", attributeId);
  if ((existing ?? []).some((v) => v.name.toLowerCase() === n.data.toLowerCase())) {
    return { ok: false, error: `"${n.data}" already exists.` };
  }
  const slug = uniqueSlug(base, new Set((existing ?? []).map((v) => v.slug)));
  const { data, error } = await supabase
    .from("attribute_values")
    .insert({
      attribute_id: attributeId,
      name: n.data,
      slug,
      hex: hex.data,
      swatch: SwatchKind.catch("solid").parse(input.swatch),
      sort_order: await nextSortOrder(attributeId),
    })
    .select("id, name, slug, hex, swatch, sort_order")
    .single();
  if (error) return { ok: false, error: friendly(error) };
  invalidate();
  return { ok: true, value: { ...data, swatch: toSwatch(data.swatch) } };
}

/** Name/colour only: the slug never changes, so shared filter links survive a rename. */
export async function updateValue(id: string, patch: { name?: string; hex?: string; swatch?: string }): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Uuid.safeParse(id).success) return { ok: false, error: "Invalid value" };
  const row: { name?: string; hex?: string | null; swatch?: string } = {};
  if (patch.name !== undefined) {
    const n = ValueName.safeParse(patch.name);
    if (!n.success) return { ok: false, error: n.error.issues[0].message };
    row.name = n.data;
  }
  if (patch.hex !== undefined) {
    const hex = Hex.safeParse(patch.hex);
    if (!hex.success) return { ok: false, error: hex.error.issues[0].message };
    row.hex = hex.data;
  }
  if (patch.swatch !== undefined) row.swatch = SwatchKind.catch("solid").parse(patch.swatch);
  const { error } = await supabase.from("attribute_values").update(row).eq("id", id);
  if (error) return { ok: false, error: friendly(error) };
  invalidate();
  return { ok: true };
}

/** Blocked by the database while any product uses the value. */
export async function deleteValue(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Uuid.safeParse(id).success) return { ok: false, error: "Invalid value" };
  const { error } = await supabase.from("attribute_values").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error) };
  invalidate();
  return { ok: true };
}

export async function moveValue(id: string, direction: "up" | "down"): Promise<ActionResult> {
  return swapOrder("attribute_values", id, direction);
}

/** Move every product from one value to another, then delete the first. */
export async function mergeValue(fromId: string, intoId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Uuid.safeParse(fromId).success || !Uuid.safeParse(intoId).success) return { ok: false, error: "Invalid value" };
  const { error } = await supabase.rpc("merge_attribute_value", { p_from: fromId, p_into: intoId });
  if (error) return { ok: false, error: friendly(error) };
  invalidate();
  return { ok: true };
}

/** Close existing values ("Terra cotta" ~ "Terracotta"), checked before creating one inline. */
export async function suggestSimilarValues(attributeId: string, name: string) {
  const { supabase } = await requireAdmin();
  if (!Uuid.safeParse(attributeId).success) return [];
  const term = name.trim().slice(0, 60);
  if (!term) return [];
  const { data } = await supabase.rpc("similar_attribute_values", { p_attribute_id: attributeId, p_name: term });
  return (data ?? []).map((v) => ({ id: v.id, name: v.name }));
}
