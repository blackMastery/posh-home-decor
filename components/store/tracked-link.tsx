"use client";

import { track } from "@/lib/analytics";

/** External WhatsApp link that records an analytics event. */
export function TrackedWhatsAppLink({
  href,
  event,
  product,
  className,
  children,
}: {
  href: string;
  event: "whatsapp_product_question";
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
      onClick={() => track(event, { product: product ?? "" })}
    >
      {children}
    </a>
  );
}
