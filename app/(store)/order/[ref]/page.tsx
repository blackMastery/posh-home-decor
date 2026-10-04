import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderConfirmation } from "@/components/store/order-confirmation";

export const metadata: Metadata = { title: "Almost there", robots: { index: false } };

export default function OrderPage() {
  return (
    <Suspense>
      <OrderConfirmation />
    </Suspense>
  );
}
