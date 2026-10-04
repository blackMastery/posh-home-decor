"use client";

import Link from "next/link";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { formatPrice } from "@/lib/format/money";
import { useDialog } from "@/components/ui/use-dialog";
import { CloseIcon } from "@/components/ui/icons";
import { track } from "@/lib/analytics";
import { useStore } from "./store-provider";
import { BagLineItem, RemovedNotice, useBagLines } from "./bag-lines";

export function BagDrawer() {
  const { bagOpen, closeBag, refreshBag, pricePrefix } = useStore();
  const ref = useDialog<HTMLDivElement>(bagOpen, closeBag);
  const { lines, subtotal, count, ready, storedCount } = useBagLines();

  // Always show current prices when opened.
  useEffect(() => {
    if (bagOpen) refreshBag();
  }, [bagOpen, refreshBag]);

  if (!bagOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-garnet-deep/40 [animation:fade-in_.2s_ease-out]" onClick={closeBag} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bag-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-cream shadow-2xl [animation:slide-in-right_.28s_cubic-bezier(.2,.8,.2,1)]"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="bag-title" className="font-display text-[28px] font-medium text-garnet-deep">
            Your bag {count > 0 && <span className="text-[18px] text-muted">({count})</span>}
          </h2>
          <button type="button" onClick={closeBag} className="tap -mr-3 inline-flex items-center justify-center" aria-label="Close bag">
            <CloseIcon size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="pt-4">
            <RemovedNotice />
          </div>
          {storedCount === 0 ? (
            <div className="flex flex-col items-center px-4 py-16 text-center">
              <p className="font-display text-[26px] text-garnet-deep">Your bag is empty</p>
              <p className="mt-2 text-[14px] text-muted">Pieces you add will appear here.</p>
              <Link href="/shop" onClick={closeBag} className="btn btn-primary mt-8">
                Browse the collection
              </Link>
            </div>
          ) : !ready && lines.length === 0 ? (
            <p className="py-16 text-center text-[14px] text-muted">Loading your bag…</p>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((l) => (
                <BagLineItem key={l.product.id} line={l} onNavigate={closeBag} />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line bg-cream-raised px-6 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          {lines.length > 0 && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="label-caps text-ink-soft">Subtotal</span>
                <span className="text-[18px] font-medium text-garnet">{formatPrice(subtotal, pricePrefix)}</span>
              </div>
              <p className="mt-1 text-[13px] text-muted">Delivery quoted on WhatsApp</p>
              <Link
                href="/checkout"
                onClick={() => {
                  track("begin_checkout", { items: count });
                  closeBag();
                }}
                className="btn btn-primary mt-4 w-full"
              >
                Order via WhatsApp
              </Link>
              <Link href="/cart" onClick={closeBag} className="btn btn-outline mt-2 w-full">
                View full bag
              </Link>
            </>
          )}
          <p className="mt-3 text-center">
            <Link
              href="/saved"
              onClick={closeBag}
              className="inline-flex min-h-11 items-center text-[13px] tracking-[0.14em] text-ink-soft uppercase underline-offset-4 hover:text-garnet hover:underline"
            >
              Your saved pieces
            </Link>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
