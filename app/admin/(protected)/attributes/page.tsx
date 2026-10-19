import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadAttributes } from "@/lib/admin/product-loader";
import { AttributeManager } from "@/components/admin/attribute-manager";

export const metadata: Metadata = { title: "Attributes" };

export default async function AttributesPage() {
  const { supabase } = await requireAdminPage();
  const attributes = await loadAttributes(supabase);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <h1 className="text-[26px] font-medium text-brown-deep">Attributes</h1>
      <p className="mt-1 text-[14px] text-muted">
        Colour, Material, Room… become filters in the shop. Renaming a value keeps shared links working. To tag many products at once, use{" "}
        <Link href="/admin/products/bulk" className="text-brown underline underline-offset-4">
          bulk edit
        </Link>
        .
      </p>
      <AttributeManager attributes={attributes} />
    </div>
  );
}
