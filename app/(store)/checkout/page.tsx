import type { Metadata } from "next";
import { CheckoutView } from "@/components/store/checkout-form";

export const metadata: Metadata = { title: "Send your order", robots: { index: false } };

export default function CheckoutPage() {
  return <CheckoutView />;
}
