import type { Metadata } from "next";
import { SavedView } from "@/components/store/saved-view";

export const metadata: Metadata = { title: "Saved pieces", robots: { index: false } };

export default function SavedPage() {
  return <SavedView />;
}
