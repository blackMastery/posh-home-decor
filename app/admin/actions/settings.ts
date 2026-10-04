"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { TAGS } from "@/lib/data/catalog";
import type { ActionResult } from "./products";

const SettingsInput = z.object({
  whatsappNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d]/g, ""))
    .pipe(z.string().regex(/^[1-9]\d{7,14}$/, "Use digits only, with country code, e.g. 5926748619")),
  displayPhone: z.string().trim().min(1).max(30),
  heroEyebrow: z.string().trim().max(60),
  heroHeadline: z.string().trim().min(1, "Headline is required").max(120),
  heroHeadlineAccent: z.string().trim().max(60),
  heroImagePath: z
    .string()
    .regex(/^hero\/[0-9a-f-]{36}\.jpg$/)
    .nullable(),
  defaultDetailsText: z.string().trim().max(4000),
  defaultCareText: z.string().trim().max(4000),
  defaultDeliveryText: z.string().trim().max(4000),
  newWindowDays: z.number().int().min(1).max(365),
  stylingStudioMessage: z.string().trim().min(1).max(500),
});

export type SettingsInputT = z.input<typeof SettingsInput>;

export async function saveSettings(input: SettingsInputT): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = SettingsInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: Object.values(fieldErrors)[0], fieldErrors };
  }
  const v = parsed.data;
  const { data: before } = await supabase.from("settings").select("hero_image_path").eq("id", 1).single();
  const { error } = await supabase
    .from("settings")
    .update({
      whatsapp_number: v.whatsappNumber,
      display_phone: v.displayPhone,
      hero_eyebrow: v.heroEyebrow,
      hero_headline: v.heroHeadline,
      hero_headline_accent: v.heroHeadlineAccent,
      hero_image_path: v.heroImagePath,
      default_details_text: v.defaultDetailsText,
      default_care_text: v.defaultCareText,
      default_delivery_text: v.defaultDeliveryText,
      new_window_days: v.newWindowDays,
      styling_studio_message: v.stylingStudioMessage,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  if (before?.hero_image_path && before.hero_image_path !== v.heroImagePath) {
    await supabase.storage.from("site").remove([before.hero_image_path]);
  }
  updateTag(TAGS.settings);
  updateTag(TAGS.home);
  updateTag(TAGS.products); // new_window_days changes "New"
  return { ok: true };
}
