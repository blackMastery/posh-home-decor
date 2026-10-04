"use client";

import { track } from "@/lib/analytics";

type EventName = "whatsapp_product_question" | "styling_studio_click";

/** External WhatsApp link that records an analytics event. */
export function TrackedWhatsAppLink({
  href,
  event,
  product,
  className,
  children,
}: {
  href: string;
  event: EventName;
  product?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() =>
        event === "styling_studio_click" ? track(event, {}) : track(event, { product: product ?? "" })
      }
    >
      {children}
    </a>
  );
}
