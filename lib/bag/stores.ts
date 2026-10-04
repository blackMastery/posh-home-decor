"use client";

import { createLocalStore } from "./local-store";

import { MAX_LINES, MAX_QTY } from "@/lib/inquiry-limits";

export { MAX_LINES, MAX_QTY };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Bag: only ids + quantities are stored (spec §5.5)
// ---------------------------------------------------------------------------

export type BagItem = { productId: string; qty: number };
export type Bag = { items: BagItem[]; updatedAt: number };

const EMPTY_BAG: Bag = { items: [], updatedAt: 0 };

function clampQty(n: unknown) {
  const q = Math.floor(Number(n));
  return Number.isFinite(q) ? Math.min(MAX_QTY, Math.max(1, q)) : 1;
}

export const bagStore = createLocalStore<Bag>("posh-bag-v1", EMPTY_BAG, (raw) => {
  const r = raw as Partial<Bag>;
  const items = Array.isArray(r?.items)
    ? r.items
        .filter((i) => i && typeof i.productId === "string" && UUID_RE.test(i.productId))
        .map((i) => ({ productId: i.productId, qty: clampQty(i.qty) }))
        .slice(0, MAX_LINES)
    : [];
  return { items, updatedAt: Number(r?.updatedAt) || 0 };
});

export const bag = {
  add(productId: string, qty = 1) {
    bagStore.update((b) => {
      const existing = b.items.find((i) => i.productId === productId);
      const items = existing
        ? b.items.map((i) => (i.productId === productId ? { ...i, qty: clampQty(i.qty + qty) } : i))
        : [...b.items, { productId, qty: clampQty(qty) }].slice(0, MAX_LINES);
      return { items, updatedAt: Date.now() };
    });
  },
  setQty(productId: string, qty: number) {
    if (qty < 1) return bag.remove(productId);
    bagStore.update((b) => ({
      items: b.items.map((i) => (i.productId === productId ? { ...i, qty: clampQty(qty) } : i)),
      updatedAt: Date.now(),
    }));
  },
  remove(productId: string) {
    bag.removeMany([productId]);
  },
  removeMany(ids: string[]) {
    const set = new Set(ids);
    bagStore.update((b) => ({ items: b.items.filter((i) => !set.has(i.productId)), updatedAt: Date.now() }));
  },
  clear() {
    bagStore.write({ items: [], updatedAt: Date.now() });
  },
};

export function useBag() {
  return bagStore.useValue();
}

export function useBagCount() {
  return bagStore.useValue().items.reduce((n, i) => n + i.qty, 0);
}

// ---------------------------------------------------------------------------
// Wishlist (device only)
// ---------------------------------------------------------------------------

export const savedStore = createLocalStore<string[]>("posh-saved-v1", [], (raw) =>
  Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && UUID_RE.test(id)).slice(0, 200) : [],
);

export function toggleSaved(productId: string): boolean {
  const current = savedStore.read();
  const isSaved = current.includes(productId);
  savedStore.write(isSaved ? current.filter((id) => id !== productId) : [productId, ...current]);
  return !isSaved;
}

// ---------------------------------------------------------------------------
// Remembered checkout details (note is never stored)
// ---------------------------------------------------------------------------

export type CustomerDetails = {
  name: string;
  phone: string;
  fulfilment: "delivery" | "collection";
  address: string;
};

export const customerStore = createLocalStore<CustomerDetails>(
  "posh-customer-v1",
  { name: "", phone: "", fulfilment: "delivery", address: "" },
  (raw) => {
    const r = (raw ?? {}) as Partial<CustomerDetails>;
    return {
      name: typeof r.name === "string" ? r.name.slice(0, 80) : "",
      phone: typeof r.phone === "string" ? r.phone.slice(0, 20) : "",
      fulfilment: r.fulfilment === "collection" ? "collection" : "delivery",
      address: typeof r.address === "string" ? r.address.slice(0, 300) : "",
    };
  },
);

// ---------------------------------------------------------------------------
// Last inquiry (sessionStorage) for the confirmation page
// ---------------------------------------------------------------------------

export type LastInquiry = {
  ref: string;
  firstName: string;
  fulfilment: "delivery" | "collection";
  waUrl: string;
  /** Open WhatsApp from the confirmation page (mobile / popup blocked). Consumed once. */
  pendingOpen?: boolean;
};

export function saveLastInquiry(v: LastInquiry) {
  try {
    window.sessionStorage.setItem("posh-last-inquiry", JSON.stringify(v));
  } catch {
    // ignore
  }
}

export function readLastInquiry(): LastInquiry | null {
  try {
    const raw = window.sessionStorage.getItem("posh-last-inquiry");
    return raw ? (JSON.parse(raw) as LastInquiry) : null;
  } catch {
    return null;
  }
}
