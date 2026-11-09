import { createHash } from "node:crypto";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pagespeed|curl|wget|python|axios/i;
const MAX_BYTES = 2000;

const Body = z.object({
  events: z
    .array(
      z.object({
        id: z.uuid(),
        v: z.number().int().min(0).max(1),
        c: z.number().int().min(0).max(20),
      }),
    )
    .min(1)
    .max(10),
});

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

function clientIp(h: Headers) {
  const xff = h.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

function hashIp(ip: string) {
  return createHash("sha256").update(`${process.env.INQUIRY_IP_SALT ?? ""}:hero:${ip}`).digest("hex");
}

/** Reads at most MAX_BYTES; returns null if the body is larger. */
async function readCapped(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Hero carousel view/click beacon. Always 204 so clients never retry.
 * record_hero_events() is service-role only and dedupes per hashed IP per slide per day,
 * so calling the database directly with the anon key can't inflate stats.
 */
export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  const prefetch = request.headers.get("sec-purpose")?.includes("prefetch");
  if (!ua || BOT_RE.test(ua) || prefetch) return noContent();

  const raw = await readCapped(request);
  if (!raw) return noContent();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return noContent();
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return noContent();

  const { error } = await createServiceClient().rpc("record_hero_events", {
    p_ip_hash: hashIp(clientIp(request.headers)),
    p_events: parsed.data.events,
  });
  if (error) console.error("[hero-events]", error.message);
  return noContent();
}
