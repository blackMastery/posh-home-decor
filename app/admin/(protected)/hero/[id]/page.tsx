import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadCategoryOptions } from "@/lib/admin/product-loader";
import { loadAdminSlide } from "@/lib/admin/hero-loader";
import { HeroSlideForm } from "@/components/admin/hero-slide-form";
import { toSlideInput } from "@/lib/hero";

export const metadata: Metadata = { title: "Edit slide" };

export default async function EditHeroSlidePage({ params }: PageProps<"/admin/hero/[id]">) {
  const { supabase } = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [slide, categories] = await Promise.all([loadAdminSlide(supabase, id), loadCategoryOptions(supabase)]);
  if (!slide) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
      <Link href="/admin/hero" className="inline-flex min-h-11 items-center text-[14px] text-brown">
        ← Home hero
      </Link>
      <h1 className="mt-1 mb-6 text-[26px] font-medium text-brown-deep">{slide.internalName}</h1>
      <HeroSlideForm
        key={slide.id}
        slideId={slide.id}
        initial={toSlideInput(slide)}
        initialProduct={slide.product}
        categories={categories.map(({ id, label }) => ({ id, label }))}
      />
    </div>
  );
}
