"use server";

import { createHash, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { normalisePhone, PHONE_ERROR } from "@/lib/phone/normalize";
import { buildOrderMessage, waUrl } from "@/lib/whatsapp/message";
import { MAX_QTY } from "@/lib/inquiry-limits";

const InquirySchema = z
  .object({
    clientNonce: z.uuid(),
    name: z.string().trim().min(1, "Please enter your name").max(80),
    phone: z.string().trim().min(7, PHONE_ERROR).max(20, PHONE_ERROR),
    fulfilment: z.enum(["delivery", "collection"]),
    address: z.string().trim().max(300).optional().default(""),
    note: z.string().trim().max(500).optional().default(""),
    items: z
      .array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(MAX_QTY) }))
      .min(1, "Your bag is empty")
      .max(50),
    website: z.string().optional().default(""), // honeypot
  })
  .refine((v) => v.fulfilment === "collection" || v.address.length > 0, {
    path: ["address"],
    message: "Please enter a delivery address",
  });

export type InquiryInput = z.input<typeof InquirySchema>;

export type InquiryResult =
  | { ok: true; ref: string; waUrl: string }
  | { ok: false; code: "validation"; error: string; fieldErrors?: Record<string, string> }
  | { ok: false; code: "rate_limited" | "server" };

const RATE_10_MIN = 5;
const RATE_24_H = 20;

function clientIp(h: Headers) {
  const xff = h.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

function hashIp(ip: string) {
  return createHash("sha256")
    .update(`${process.env.INQUIRY_IP_SALT ?? ""}:${ip}`)
    .digest("hex");
}

function newRef() {
  return `PH-${String(randomInt(0, 100000)).padStart(5, "0")}`;
}

export async function submitInquiry(input: InquiryInput): Promise<InquiryResult> {
  const parsed = InquirySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, code: "validation", error: Object.values(fieldErrors)[0] ?? "Please check your details", fieldErrors };
  }
  const v = parsed.data;

  // Honeypot: pretend success, write nothing.
  if (v.website) {
    return { ok: true, ref: "PH-WEB", waUrl: "https://wa.me/" };
  }

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, code: "validation", error: PHONE_ERROR, fieldErrors: { phone: PHONE_ERROR } };

  try {
    const db = createServiceClient();

    // Idempotency per checkout visit (double taps).
    const { data: existing } = await db
      .from("inquiries")
      .select("ref, message_text")
      .eq("client_nonce", v.clientNonce)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
      .maybeSingle();
    const { data: settings, error: settingsError } = await db
      .from("settings")
      .select("whatsapp_number, price_prefix")
      .eq("id", 1)
      .single();
    if (settingsError) throw settingsError;
    if (existing) {
      return { ok: true, ref: existing.ref, waUrl: waUrl(settings.whatsapp_number, existing.message_text) };
    }

    // Rate limit by hashed IP.
    const ipHash = hashIp(clientIp(await headers()));
    const since10 = new Date(Date.now() - 10 * 60_000).toISOString();
    const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [{ count: c10 }, { count: c24 }] = await Promise.all([
      db.from("inquiries").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since10),
      db.from("inquiries").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since24),
    ]);
    if ((c10 ?? 0) >= RATE_10_MIN || (c24 ?? 0) >= RATE_24_H) {
      return { ok: false, code: "rate_limited" };
    }

    // Re-price from the database; drop anything no longer listed.
    const qtyById = new Map<string, number>();
    for (const i of v.items) qtyById.set(i.productId, Math.min(MAX_QTY, (qtyById.get(i.productId) ?? 0) + i.qty));
    const { data: products, error: productsError } = await db
      .from("product_cards")
      .select("id, slug, name, note, price, is_available, image_path")
      .in("id", [...qtyById.keys()])
      .eq("status", "published");
    if (productsError) throw productsError;
    const byId = new Map((products ?? []).map((p) => [p.id!, p]));
    const items = [...qtyById.entries()]
      .filter(([id]) => byId.has(id))
      .map(([id, qty]) => {
        const p = byId.get(id)!;
        return {
          product_id: id,
          slug: p.slug!,
          name: p.name!,
          note: p.note,
          unit_price: p.price!,
          qty,
          line_total: p.price! * qty,
          was_available: Boolean(p.is_available),
          image_path: p.image_path,
        };
      });
    if (items.length === 0) {
      return { ok: false, code: "validation", error: "These pieces are no longer listed" };
    }

    const subtotal = items.reduce((s, i) => s + i.line_total, 0);
    const itemCount = items.reduce((s, i) => s + i.qty, 0);
    const address = v.fulfilment === "delivery" ? v.address : null;
    const note = v.note || null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const ref = newRef();
      const message = buildOrderMessage(
        {
          ref,
          lines: items.map((i) => ({ name: i.name, qty: i.qty, lineTotal: i.line_total, soldOut: !i.was_available })),
          subtotal,
          fulfilment: v.fulfilment,
          name: v.name,
          phoneDisplay: phone.display,
          address,
          note,
          pricePrefix: settings.price_prefix,
        },
        settings.whatsapp_number,
      );
      const { error } = await db.from("inquiries").insert({
        ref,
        client_nonce: v.clientNonce,
        customer_name: v.name,
        phone_raw: v.phone,
        phone_e164: phone.e164,
        fulfilment: v.fulfilment,
        address,
        note,
        styling_advice: false, // column kept for old inquiries; the option is gone
        items,
        item_count: itemCount,
        subtotal,
        message_text: message.text,
        ip_hash: ipHash,
      });
      if (!error) return { ok: true, ref, waUrl: message.url };
      if (error.code === "23505" && error.message.includes("client_nonce")) {
        const { data: dup } = await db.from("inquiries").select("ref, message_text").eq("client_nonce", v.clientNonce).single();
        if (dup) return { ok: true, ref: dup.ref, waUrl: waUrl(settings.whatsapp_number, dup.message_text) };
      }
      if (error.code !== "23505") throw error;
      // ref collision → retry
    }
    throw new Error("Could not allocate a unique reference");
  } catch (err) {
    console.error("submitInquiry failed", err);
    return { ok: false, code: "server" };
  }
}
