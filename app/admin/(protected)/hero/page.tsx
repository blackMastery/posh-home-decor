import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadAdminSlides } from "@/lib/admin/hero-loader";
import { HeroManager } from "@/components/admin/hero-manager";

export const metadata: Metadata = { title: "Home hero" };

export default async function AdminHeroPage() {
  const { supabase } = await requireAdminPage();
  const slides = await loadAdminSlides(supabase);
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-10">
      <HeroManager initial={slides} />
    </div>
  );
}
