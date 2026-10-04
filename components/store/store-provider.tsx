"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchProductCards } from "@/app/actions/catalog";
import type { ProductCardData } from "@/lib/catalog/types";
import { bag, bagStore, useBag } from "@/lib/bag/stores";

export type ToastAction = { label: string; onClick?: () => void; href?: string };
type Toast = { id: number; message: string; action?: ToastAction };

type StoreContextValue = {
  // Toasts
  toasts: Toast[];
  toast: (message: string, action?: ToastAction) => void;
  dismissToast: (id: number) => void;
  // Bag drawer
  bagOpen: boolean;
  openBag: () => void;
  closeBag: () => void;
  // Fresh bag product data
  products: Map<string, ProductCardData>;
  bagReady: boolean;
  refreshBag: () => void;
  removedNotice: number;
  clearRemovedNotice: () => void;
  // Settings needed client-side
  whatsappNumber: string;
  pricePrefix: string;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

const TOAST_MS = 2600;

export function StoreProvider({
  children,
  whatsappNumber,
  pricePrefix,
}: {
  children: React.ReactNode;
  whatsappNumber: string;
  pricePrefix: string;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [products, setProducts] = useState<Map<string, ProductCardData>>(new Map());
  const [fetchedIds, setFetchedIds] = useState<Set<string>>(new Set());
  const [removedNotice, setRemovedNotice] = useState(0);
  const toastId = useRef(0);
  const inflight = useRef(0);
  const { items } = useBag();

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message: string, action?: ToastAction) => {
      const id = ++toastId.current;
      setToasts((t) => [...t.slice(-2), { id, message, action }]);
      window.setTimeout(() => dismissToast(id), TOAST_MS);
    },
    [dismissToast],
  );

  const load = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const req = ++inflight.current;
    let cards: ProductCardData[];
    try {
      cards = await fetchProductCards(ids);
    } catch {
      return; // offline: keep what we have, never drop items on a network error
    }
    if (req !== inflight.current) return;
    const found = new Set(cards.map((c) => c.id));
    setProducts((prev) => {
      const next = new Map(prev);
      cards.forEach((c) => next.set(c.id, c));
      return next;
    });
    setFetchedIds((prev) => new Set([...prev, ...ids]));
    // Reconcile: products no longer listed are removed with a one-time notice.
    const current = new Set(bagStore.read().items.map((i) => i.productId));
    const gone = ids.filter((id) => !found.has(id) && current.has(id));
    if (gone.length) {
      bag.removeMany(gone);
      setRemovedNotice((n) => n + gone.length);
    }
  }, []);

  const refreshBag = useCallback(() => {
    void load(bagStore.read().items.map((i) => i.productId));
  }, [load]);

  // Fetch any bag item we haven't seen yet (on load, after add, across tabs).
  const idsKey = items.map((i) => i.productId).join(",");
  useEffect(() => {
    const missing = idsKey ? idsKey.split(",").filter((id) => !fetchedIds.has(id)) : [];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() only sets state after the network call resolves
    if (missing.length) void load(missing);
  }, [idsKey, fetchedIds, load]);

  const bagReady = items.every((i) => fetchedIds.has(i.productId));

  const value = useMemo<StoreContextValue>(
    () => ({
      toasts,
      toast,
      dismissToast,
      bagOpen,
      openBag: () => setBagOpen(true),
      closeBag: () => setBagOpen(false),
      products,
      bagReady,
      refreshBag,
      removedNotice,
      clearRemovedNotice: () => setRemovedNotice(0),
      whatsappNumber,
      pricePrefix,
    }),
    [toasts, toast, dismissToast, bagOpen, products, bagReady, refreshBag, removedNotice, whatsappNumber, pricePrefix],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
