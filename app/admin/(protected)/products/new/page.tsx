import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadCategoryOptions, loadDefaults } from "@/lib/admin/product-loader";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const { supabase } = await requireAdminPage();
  await connection();
  const [categories, defaults] = await Promise.all([loadCategoryOptions(supabase), loadDefaults(supabase)]);
  const id = crypto.randomUUID();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <Link href="/admin/products" className="inline-flex min-h-11 items-center text-[14px] text-brown">
        ← Products
      </Link>
      <h1 className="mt-1 mb-6 text-[26px] font-medium text-brown-deep">New product</h1>
      <ProductForm
        key={id}
        productId={id}
        meta={null}
        categories={categories}
        defaults={defaults}
        initial={{
          name: "",
          slug: "",
          slugEdited: false,
          price: "",
          compareAtPrice: "",
          categoryId: null,
          note: "",
          description: "",
          availability: "available",
          detailsText: defaults.details,
          careText: defaults.care,
          deliveryText: defaults.delivery,
          featuredRank: "",
          itemCode: "",
          itemUpcCode: "",
          related: [],
          images: [],
        }}
      />
    </div>
  );
}
