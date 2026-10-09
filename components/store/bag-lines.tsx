"use client";

import Link from "next/link";
import { bag, MAX_QTY, useBag } from "@/lib/bag/stores";
import { formatPrice, PRICE_ON_REQUEST } from "@/lib/format/money";
import { PoshImage } from "@/components/ui/posh-image";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import type { ProductCardData } from "@/lib/catalog/types";
import { useStore } from "./store-provider";

/** lineTotal is null when the product is "Price on request". */
export type BagLine = { product: ProductCardData; qty: number; lineTotal: number | null };

/** Joins stored ids/qty with fresh product data. */
export function useBagLines() {
  const { items } = useBag();
  const { products, bagReady } = useStore();
  const lines: BagLine[] = [];
  for (const i of items) {
    const product = products.get(i.productId);
    if (product) lines.push({ product, qty: i.qty, lineTotal: product.price == null ? null : product.price * i.qty });
  }
  // Subtotal covers priced lines only; the rest are priced on WhatsApp.
  const subtotal = lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const unpricedCount = lines.filter((l) => l.lineTotal == null).length;
  return { lines, subtotal, count, unpricedCount, ready: bagReady, storedCount: items.length };
}

/** Subtotal amount; "Price on request" when nothing in the bag has a price. */
export function SubtotalValue({ subtotal, allUnpriced }: { subtotal: number; allUnpriced: boolean }) {
  const { pricePrefix } = useStore();
  return <>{allUnpriced ? PRICE_ON_REQUEST : formatPrice(subtotal, pricePrefix)}</>;
}

export function UnpricedNote({ count, allUnpriced }: { count: number; allUnpriced: boolean }) {
  if (count === 0) return null;
  return (
    <p className="mt-1 text-[13px] text-muted">
      {allUnpriced
        ? "We'll confirm prices on WhatsApp"
        : `+ ${count} ${count === 1 ? "item" : "items"} priced on WhatsApp`}
    </p>
  );
}

export function QtyStepper({
  value,
  onChange,
  label,
  min = 0,
  size = "sm",
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  min?: number;
  size?: "sm" | "lg";
}) {
  const h = size === "lg" ? "h-12" : "h-11";
  return (
    <div className={`inline-flex ${h} items-stretch border border-line-strong bg-cream-raised`} role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className="inline-flex w-11 items-center justify-center text-brown disabled:opacity-40"
        aria-label={value <= 1 && min === 0 ? "Remove" : "Decrease quantity"}
      >
        <MinusIcon size={16} />
      </button>
      <output className="inline-flex w-8 items-center justify-center text-[15px] tabular-nums" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QTY}
        className="inline-flex w-11 items-center justify-center text-brown disabled:opacity-40"
        aria-label="Increase quantity"
      >
        <PlusIcon size={16} />
      </button>
    </div>
  );
}

export function BagLineItem({ line, onNavigate }: { line: BagLine; onNavigate?: () => void }) {
  const { pricePrefix } = useStore();
  const p = line.product;
  return (
    <li className="flex gap-4 py-5">
      <Link
        href={`/products/${p.slug}`}
        onClick={onNavigate}
        className={`relative block aspect-[4/5] w-[84px] shrink-0 overflow-hidden ${p.image_path ? "bg-white" : "bg-sand-image"} ${p.availability === "sold_out" ? "opacity-70" : ""}`}
        tabIndex={-1}
        aria-hidden
      >
        {p.image_path && <PoshImage path={p.image_path} alt="" fill sizes="96px" className="object-contain p-1" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/products/${p.slug}`}
              onClick={onNavigate}
              className="font-display text-[19px] leading-tight font-medium text-brown-deep hover:text-brown"
            >
              {p.name}
            </Link>
            {p.note && <p className="mt-0.5 text-[13px] text-muted">{p.note}</p>}
          </div>
          <p className={`shrink-0 text-[15px] font-medium ${line.lineTotal == null ? "text-ink-soft" : "text-brown"}`}>
            {line.lineTotal == null ? PRICE_ON_REQUEST : formatPrice(line.lineTotal, pricePrefix)}
          </p>
        </div>
        {p.availability === "sold_out" && (
          <p className="mt-2 text-[13px] text-error">Sold out — we&apos;ll suggest alternatives in the chat</p>
        )}
        {p.availability === "coming_soon" && (
          <p className="mt-2 text-[13px] text-bronze">Coming soon — pre-order</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <QtyStepper value={line.qty} onChange={(n) => bag.setQty(p.id, n)} label={`Quantity of ${p.name}`} />
          <button
            type="button"
            onClick={() => bag.remove(p.id)}
            className="tap text-[12px] tracking-[0.14em] text-muted uppercase underline-offset-4 hover:text-brown hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function RemovedNotice() {
  const { removedNotice, clearRemovedNotice } = useStore();
  if (!removedNotice) return null;
  return (
    <div role="status" className="flex items-start justify-between gap-3 border border-line-strong bg-sand px-4 py-3 text-[14px]">
      <span>
        {removedNotice} item{removedNotice === 1 ? " is" : "s are"} no longer listed and{" "}
        {removedNotice === 1 ? "was" : "were"} removed.
      </span>
      <button type="button" onClick={clearRemovedNotice} className="label-caps shrink-0 text-brown" aria-label="Dismiss notice">
        OK
      </button>
    </div>
  );
}
