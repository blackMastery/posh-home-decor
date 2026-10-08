import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/auth";
import type { AdminGalleryPhoto } from "@/lib/gallery";
import { GalleryManager } from "@/components/admin/gallery-manager";

export const metadata: Metadata = { title: "Gallery" };

export default async function AdminGalleryPage() {
  const { supabase } = await requireAdminPage();
  const { data, error } = await supabase
    .from("gallery_photos")
    .select(
      "id, storage_path, width, height, caption, alt, is_visible, links:gallery_photo_products(sort_order, product:product_cards(id, name, image_path, status))",
    )
    .order("sort_order")
    .order("created_at");
  if (error) throw error;

  const photos: AdminGalleryPhoto[] = (data ?? []).map((p) => ({
    id: p.id,
    storagePath: p.storage_path,
    width: p.width,
    height: p.height,
    caption: p.caption ?? "",
    alt: p.alt ?? "",
    isVisible: p.is_visible,
    products: [...p.links]
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((l) =>
        l.product ? [{ id: l.product.id!, name: l.product.name!, imagePath: l.product.image_path, status: l.product.status! }] : [],
      ),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-10">
      <GalleryManager initial={photos} />
    </div>
  );
}
