import type { Availability } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/format/money";

export type MessageLine = {
  name: string;
  qty: number;
  /** null = price on request. */
  lineTotal: number | null;
  availability: Availability;
};

export type MessageInput = {
  ref: string;
  lines: MessageLine[];
  /** Sum of priced lines only. */
  subtotal: number;
  fulfilment: "delivery" | "collection";
  name: string;
  phoneDisplay: string;
  address?: string | null;
  note?: string | null;
  pricePrefix?: string;
};

/** Keep the encoded wa.me URL under this many characters. */
export const MAX_URL_LENGTH = 4000;

type Mode = "full" | "no-note" | "condensed";

const FLAGS: Record<Availability, string> = {
  available: "",
  coming_soon: " (coming soon — pre-order)",
  sold_out: " (marked sold out on the site)",
};

function render(input: MessageInput, mode: Mode) {
  const p = input.pricePrefix ?? "$";
  const out: string[] = [];
  out.push(`Hello Posh! I'd like to order (${input.ref}):`, "");
  for (const l of input.lines) {
    if (mode === "condensed") {
      out.push(`• ${l.qty} × ${l.name}${l.availability === "coming_soon" ? FLAGS.coming_soon : ""}`);
    } else {
      const price = l.lineTotal == null ? "price on request" : formatPrice(l.lineTotal, p);
      out.push(`• ${l.qty} × ${l.name} — ${price}${FLAGS[l.availability]}`);
    }
  }
  if (mode === "condensed") out.push(`(full list saved under ${input.ref})`);
  out.push("");
  const unpriced = input.lines.filter((l) => l.lineTotal == null).length;
  if (unpriced === 0) {
    out.push(`Subtotal: ${formatPrice(input.subtotal, p)} GYD`);
  } else {
    if (unpriced < input.lines.length) out.push(`Subtotal (priced items): ${formatPrice(input.subtotal, p)} GYD`);
    out.push(`Please confirm prices for ${unpriced} ${unpriced === 1 ? "item" : "items"}.`);
  }
  out.push(input.fulfilment === "delivery" ? "Delivery — please quote me for delivery" : "Collection from the showroom");
  out.push(`Name: ${input.name}`);
  out.push(`Phone: ${input.phoneDisplay}`);
  if (input.fulfilment === "delivery" && input.address) out.push(`Address: ${input.address}`);
  if (mode === "full" && input.note) out.push(`Note: ${input.note}`);
  return out.join("\n");
}

/**
 * Prefilled chat link. Uses api.whatsapp.com/send directly: the wa.me short
 * link redirects there and corrupts some emoji (e.g. ✨) on the way.
 * Opens the app on phones and WhatsApp's landing page where it isn't installed.
 */
export function waUrl(number: string, text: string) {
  return `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(text)}`;
}

/**
 * Build the order message (spec §5.8), applying the length guard:
 * drop the note first, then collapse lines without prices.
 */
export function buildOrderMessage(input: MessageInput, whatsappNumber: string) {
  for (const mode of ["full", "no-note", "condensed"] as const) {
    const text = render(input, mode);
    const url = waUrl(whatsappNumber, text);
    if (url.length <= MAX_URL_LENGTH || mode === "condensed") return { text, url };
  }
  throw new Error("unreachable");
}

export function productQuestionMessage(name: string, url: string) {
  return `Hello Posh! I'd like to ask about the ${name} (${url}).`;
}

export function priceQuestionMessage(name: string, url: string) {
  return `Hello Posh! Could you tell me the price of the ${name} (${url})?`;
}

export function similarPiecesMessage(name: string, url: string) {
  return `Hello Posh! The ${name} (${url}) is sold out — do you have any similar pieces?`;
}
