"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatPrice } from "@/lib/format/money";
import { useHydrated } from "@/lib/bag/local-store";
import { track } from "@/lib/analytics";
import { BagLineItem, RemovedNotice, useBagLines } from "./bag-lines";
import { useStore } from "./store-provider";

export const HOW_IT_WORKS = [
  { title: "Build your bag", body: "Add the pieces you love. Prices are in GYD." },
  { title: "Send it on WhatsApp", body: "We prepare a message with your order — you just press send." },
  { title: "We confirm in the chat", body: "We'll check availability, quote any delivery and arrange payment." },
];

export function StepLabel({ step }: { step: 1 | 2 }) {
  return (
    <p className="eyebrow text-bronze">
      Step {step} of 2 · {step === 1 ? "Your bag" : "Your details"}
    </p>
  );
}

export function CartView() {
  const hydrated = useHydrated();
  const { refreshBag, pricePrefix } = useStore();
  const { lines, subtotal, count, ready, storedCount } = useBagLines();

  useEffect(() => {
    refreshBag();
  }, [refreshBag]);

  return (
    <div className="container-posh pt-10 pb-24 nav:pt-14">
      <StepLabel step={1} />
      <h1 className="mt-3 font-display text-[clamp(38px,5vw,64px)] leading-none font-medium text-garnet-deep">Your bag</h1>

      {!hydrated || (!ready && lines.length === 0 && storedCount > 0) ? (
        <p className="mt-12 text-muted" aria-busy="true">
          Loading your bag…
        </p>
      ) : storedCount === 0 ? (
        <div className="mt-10 flex flex-col items-center bg-sand px-6 py-20 text-center">
          <RemovedNotice />
          <p className="mt-4 font-display text-[32px] text-garnet-deep">Your bag is empty</p>
          <p className="mt-2 text-[15px] text-ink-soft">Find something beautiful in the showroom.</p>
          <Link href="/shop" className="btn btn-primary mt-8">
            Browse the collection
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <RemovedNotice />
            <ul className="divide-y divide-line border-y border-line">
              {lines.map((l) => (
                <BagLineItem key={l.product.id} line={l} />
              ))}
            </ul>
            <Link href="/shop" className="label-caps mt-6 inline-flex min-h-11 items-center text-garnet hover:underline">
              ← Keep shopping
            </Link>
          </div>

          <aside className="self-start bg-sand p-6 sm:p-8 lg:sticky lg:top-[150px]" aria-label="Order summary">
            <h2 className="font-display text-[26px] text-garnet-deep">Summary</h2>
            <dl className="mt-5 space-y-3 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">
                  Subtotal ({count} {count === 1 ? "item" : "items"})
                </dt>
                <dd className="font-medium text-garnet">{formatPrice(subtotal, pricePrefix)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Delivery</dt>
                <dd className="text-ink-soft">Quoted on WhatsApp</dd>
              </div>
            </dl>
            <Link
              href="/checkout"
              onClick={() => track("begin_checkout", { items: count })}
              className="btn btn-primary mt-6 w-full"
            >
              Order via WhatsApp
            </Link>
            <p className="mt-3 text-center text-[13px] text-muted">All prices in GYD</p>

            <ol className="mt-8 space-y-5 border-t border-line-strong pt-6">
              {HOW_IT_WORKS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="font-display text-[26px] leading-none text-bronze">{i + 1}</span>
                  <div>
                    <p className="text-[14px] font-medium text-garnet-deep">{s.title}</p>
                    <p className="mt-0.5 text-[13px] text-ink-soft">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}
