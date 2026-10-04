"use client";

import { bag, useBag } from "@/lib/bag/stores";
import { track } from "@/lib/analytics";
import { CheckIcon, PlusIcon } from "@/components/ui/icons";
import { useStore } from "./store-provider";

export function QuickAdd({ productId, name }: { productId: string; name: string }) {
  const { items } = useBag();
  const { toast, openBag } = useStore();
  const inBag = items.some((i) => i.productId === productId);
  return (
    <button
      type="button"
      onClick={() => {
        if (inBag) return openBag();
        bag.add(productId, 1);
        track("add_to_bag", { product: productId, qty: 1 });
        toast(`${name} added`, { label: "View bag", onClick: openBag });
      }}
      aria-label={inBag ? `${name} is in your bag — view bag` : `Add ${name} to bag`}
      className={`tap absolute z-10 right-3 bottom-3 inline-flex items-center justify-center rounded-full shadow-sm transition-colors ${
        inBag ? "bg-garnet text-cream" : "bg-cream-raised/95 text-garnet hover:bg-garnet hover:text-cream"
      }`}
    >
      {inBag ? <CheckIcon size={18} /> : <PlusIcon size={18} />}
    </button>
  );
}
