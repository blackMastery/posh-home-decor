import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadCategoryOptions } from "@/lib/admin/product-loader";
import { EMPTY_SLIDE, HeroSlideForm } from "@/components/admin/hero-slide-form";

export const metadata: Metadata = { title: "New slide" };

export default async function NewHeroSlidePage() {
  const { supabase } = await requireAdminPage();
  const categories = await loadCategoryOptions(supabase);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
      <Link href="/admin/hero" className="inline-flex min-h-11 items-center text-[14px] text-brown">
        ← Home hero
      </Link>
      <h1 className="mt-1 mb-6 text-[26px] font-medium text-brown-deep">New slide</h1>
      <HeroSlideForm slideId={null} initial={EMPTY_SLIDE} initialProduct={null} categories={categories.map(({ id, label }) => ({ id, label }))} />
    </div>
  );
}
