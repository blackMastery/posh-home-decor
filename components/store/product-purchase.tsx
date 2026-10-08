"use client";

import { useState } from "react";
import { bag } from "@/lib/bag/stores";
import { formatPrice } from "@/lib/format/money";
import { track } from "@/lib/analytics";
import { WhatsAppIcon } from "@/components/ui/icons";
import { priceQuestionMessage, productQuestionMessage, similarPiecesMessage, waUrl } from "@/lib/whatsapp/message";
import type { Availability } from "@/lib/catalog/types";
import { QtyStepper } from "./bag-lines";
import { useStore } from "./store-provider";

export function ProductPurchase({
  productId,
  name,
  price,
  availability,
  productUrl,
}: {
  productId: string;
  name: string;
  /** null = price on request. */
  price: number | null;
  availability: Availability;
  productUrl: string;
}) {
  const [qty, setQty] = useState(1);
  const { toast, openBag, whatsappNumber, pricePrefix } = useStore();
  const available = availability !== "sold_out";
  const askHref = waUrl(
    whatsappNumber,
    !available
      ? similarPiecesMessage(name, productUrl)
      : price == null
        ? priceQuestionMessage(name, productUrl)
        : productQuestionMessage(name, productUrl),
  );
  const action = availability === "coming_soon" ? "Pre-order" : "Add to bag";

  return (
    <div className="space-y-3">
      {available ? (
        <div className="flex gap-3">
          <QtyStepper value={qty} onChange={(n) => setQty(Math.max(1, n))} min={1} size="lg" label="Quantity" />
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => {
              bag.add(productId, qty);
              track("add_to_bag", { product: productId, qty });
              toast(`${name} added`, { label: "View bag", onClick: openBag });
              setQty(1);
            }}
          >
            {price == null ? action : `${action} · ${formatPrice(price * qty, pricePrefix)}`}
          </button>
        </div>
      ) : (
        <button type="button" disabled className="btn w-full cursor-not-allowed bg-sand text-ink-soft !opacity-100">
          Sold out
        </button>
      )}
      <a
        href={askHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("whatsapp_product_question", { product: productId })}
        className="btn btn-outline w-full"
      >
        <WhatsAppIcon size={18} className="text-whatsapp" />
        {!available ? "Ask about similar pieces" : price == null ? "Ask for price on WhatsApp" : "Ask about this piece"}
      </a>
    </div>
  );
}
