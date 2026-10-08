"use client";

import { track as vercelTrack } from "@vercel/analytics";

type Events = {
  add_to_bag: { product: string; qty: number };
  begin_checkout: { items: number };
  inquiry_sent: { fallback: boolean; items: number };
  whatsapp_product_question: { product: string };
  whatsapp_look_question: { photo: string };
  gallery_share: { photo: string };
};

export function track<E extends keyof Events>(event: E, props?: Events[E]) {
  try {
    vercelTrack(event, props as Record<string, string | number | boolean>);
  } catch {
    // analytics must never break the shop
  }
}
