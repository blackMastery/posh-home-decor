import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadCategoryOptions, loadDefaults } from "@/lib/admin/product-loader";
import { formatNumber } from "@/lib/format/money";
import { toAvailability } from "@/lib/catalog/types";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const { supabase } = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: p }, categories, defaults] = await Promise.all([
    supabase
      .from("products")
      .select("*, images:product_images(id, storage_path, width, height, alt, sort_order), related:product_related!product_related_product_id_fkey(sort_order, product:products!product_related_related_id_fkey(id, name))")
      .eq("id", id)
      .maybeSingle(),
    loadCategoryOptions(supabase),
    loadDefaults(supabase),
  ]);
  if (!p) notFound();

  const relatedRows = [...(p.related ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const relatedIds = relatedRows.map((r) => r.product?.id).filter(Boolean) as string[];
  const { data: relatedCards } = relatedIds.length
    ? await supabase.from("product_cards").select("id, image_path").in("id", relatedIds)
    : { data: [] };
  const imageById = new Map((relatedCards ?? []).map((c) => [c.id, c.image_path]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <Link href="/admin/products" className="inline-flex min-h-11 items-center text-[14px] text-brown">
        ← Products
      </Link>
      <h1 className="mt-1 mb-6 text-[26px] font-medium text-brown-deep">{p.name}</h1>
      <ProductForm
        key={p.id}
        productId={p.id}
        meta={{ status: p.status as "draft" | "published" | "archived", updatedAt: p.updated_at, slug: p.slug }}
        categories={categories}
        defaults={defaults}
        initial={{
          name: p.name,
          slug: p.slug,
          slugEdited: false,
          price: p.price != null ? formatNumber(p.price) : "",
          compareAtPrice: p.compare_at_price != null ? formatNumber(p.compare_at_price) : "",
          categoryId: p.category_id,
          note: p.note ?? "",
          description: p.description ?? "",
          availability: toAvailability(p.availability),
          detailsText: p.details_text ?? "",
          careText: p.care_text ?? "",
          deliveryText: p.delivery_text ?? "",
          featuredRank: p.featured_rank != null ? String(p.featured_rank) : "",
          itemCode: p.item_code ?? "",
          itemUpcCode: p.item_upc_code ?? "",
          related: relatedRows
            .filter((r) => r.product)
            .map((r) => ({ id: r.product!.id, name: r.product!.name, imagePath: imageById.get(r.product!.id) ?? null })),
          images: [...(p.images ?? [])]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((i) => ({ key: i.id, storagePath: i.storage_path, width: i.width, height: i.height, alt: i.alt ?? "", persisted: true })),
        }}
      />
    </div>
  );
}
