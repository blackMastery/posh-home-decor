"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchProductCards } from "@/app/actions/catalog";
import { savedStore } from "@/lib/bag/stores";
import { useHydrated } from "@/lib/bag/local-store";
import type { ProductCardData } from "@/lib/catalog/types";
import { ProductGrid } from "./product-card";

export function SavedView() {
  const hydrated = useHydrated();
  const ids = savedStore.useValue();
  const [cards, setCards] = useState<ProductCardData[] | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const list = key ? key.split(",") : [];
    fetchProductCards(list)
      .then((res) => {
        if (cancelled) return;
        const byId = new Map(res.map((c) => [c.id, c]));
        // Keep saved order; silently drop products no longer listed.
        setCards(list.map((id) => byId.get(id)).filter((c): c is ProductCardData => Boolean(c)));
      })
      .catch(() => !cancelled && setCards([]));
    return () => {
      cancelled = true;
    };
  }, [key, hydrated]);

  return (
    <div className="container-posh pt-10 pb-24 nav:pt-14">
      <p className="eyebrow text-bronze">Wishlist</p>
      <h1 className="mt-3 font-display text-[clamp(38px,5vw,64px)] leading-none font-medium text-garnet-deep">
        Saved pieces
      </h1>
      <p className="mt-3 text-[14px] text-muted">Saved on this device only.</p>
      {cards === null ? (
        <p className="mt-12 text-muted" aria-busy="true">
          Loading…
        </p>
      ) : cards.length === 0 ? (
        <div className="mt-10 flex flex-col items-center bg-sand px-6 py-20 text-center">
          <p className="font-display text-[32px] text-garnet-deep">Nothing saved yet</p>
          <p className="mt-2 text-[15px] text-ink-soft">Tap the heart on any piece to keep it here.</p>
          <Link href="/shop" className="btn btn-primary mt-8">
            View all pieces
          </Link>
        </div>
      ) : (
        <div className="mt-10">
          <ProductGrid products={cards} />
        </div>
      )}
    </div>
  );
}
