"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { readLastInquiry, saveLastInquiry, type LastInquiry } from "@/lib/bag/stores";
import { WhatsAppIcon } from "@/components/ui/icons";
import { useStore } from "./store-provider";

export function OrderConfirmation() {
  const { ref } = useParams<{ ref: string }>();
  const { whatsappNumber } = useStore();
  const [last, setLast] = useState<LastInquiry | null | undefined>(undefined);

  useEffect(() => {
    const stored = readLastInquiry();
    const match = stored && stored.ref === ref ? stored : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
    setLast(match);
    if (match?.pendingOpen) {
      // Consume first so returning with Back doesn't reopen WhatsApp.
      saveLastInquiry({ ...match, pendingOpen: false });
      window.location.href = match.waUrl;
    }
  }, [ref]);

  const safeRef = /^PH-(\d{5}|WEB)$/.test(ref) ? ref : null;
  const againHref = last?.waUrl ?? `https://wa.me/${whatsappNumber}`;

  return (
    <div className="container-posh flex flex-col items-center py-20 text-center nav:py-28">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brown text-gold">
        <WhatsAppIcon size={30} />
      </span>
      {safeRef && <p className="eyebrow mt-8 text-bronze">Order {safeRef}</p>}
      <h1 className="mt-4 max-w-2xl font-display text-[clamp(38px,5vw,64px)] leading-[1.02] font-medium text-brown-deep">
        {last?.firstName ? (
          <>
            Almost there, <em className="text-bronze">{last.firstName}.</em>
          </>
        ) : (
          <>
            Almost <em className="text-bronze">there.</em>
          </>
        )}
      </h1>
      <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-soft">
        Your order opened in WhatsApp — just press send. We&apos;ll reply to confirm availability
        {last?.fulfilment === "collection" ? " and a time to collect." : " and quote delivery."}
      </p>
      <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
        <a href={againHref} target="_blank" rel="noopener noreferrer" className="btn btn-gold w-full">
          <WhatsAppIcon size={18} /> Open WhatsApp again
        </a>
        <Link href="/shop" className="btn btn-outline w-full">
          Keep shopping
        </Link>
      </div>
      {safeRef === "PH-WEB" && (
        <p className="mt-8 max-w-sm text-[13px] text-muted">
          If WhatsApp didn&apos;t open, message us on {whatsappNumber.replace(/^592/, "+592 ")} and we&apos;ll take it from
          there.
        </p>
      )}
    </div>
  );
}
