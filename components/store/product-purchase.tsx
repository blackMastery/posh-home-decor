"use client";

import { useState } from "react";
import { bag } from "@/lib/bag/stores";
import { formatPrice } from "@/lib/format/money";
import { track } from "@/lib/analytics";
import { WhatsAppIcon } from "@/components/ui/icons";
import { productQuestionMessage, similarPiecesMessage, waUrl } from "@/lib/whatsapp/message";
import { QtyStepper } from "./bag-lines";
import { useStore } from "./store-provider";

export function ProductPurchase({
  productId,
  name,
  price,
  available,
  productUrl,
}: {
  productId: string;
  name: string;
  price: number;
  available: boolean;
  productUrl: string;
}) {
  const [qty, setQty] = useState(1);
  const { toast, openBag, whatsappNumber, pricePrefix } = useStore();
  const askHref = waUrl(
    whatsappNumber,
    available ? productQuestionMessage(name, productUrl) : similarPiecesMessage(name, productUrl),
  );

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
            Add to bag · {formatPrice(price * qty, pricePrefix)}
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
        {available ? "Ask about this piece" : "Ask about similar pieces"}
      </a>
    </div>
  );
}
