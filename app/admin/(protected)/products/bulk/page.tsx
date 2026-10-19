import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { MISSING_DATA_FILTER } from "@/lib/admin/missing-data";
import { loadAttributes, loadCategoryOptions } from "@/lib/admin/product-loader";
import { BulkAttributeEditor, type BulkRow } from "@/components/admin/bulk-attribute-editor";

export const metadata: Metadata = { title: "Bulk edit attributes" };

const PAGE = 100;

export default async function BulkAttributesPage({ searchParams }: PageProps<"/admin/products/bulk">) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const cat = one("cat");
  const missing = one("missing") === "1";
  const page = Math.max(1, Math.min(40, Number.parseInt(one("page"), 10) || 1));

  const [categories, attributes] = await Promise.all([loadCategoryOptions(supabase), loadAttributes(supabase)]);
  const catPath = cat ? (await supabase.from("categories").select("path").eq("id", cat).maybeSingle()).data?.path : null;

  let query = supabase
    .from("product_cards")
    .select("id, name, image_path, category_id, category_name, height_cm, width_cm, depth_cm, diameter_cm, status", { count: "exact" })
    .neq("status", "archived");
  if (catPath) query = query.or(`category_path.eq.${catPath},category_path.like.${catPath}/%`);
  if (missing) query = query.or(MISSING_DATA_FILTER);
  const { data: products, count } = await query.order("category_path").order("name").range((page - 1) * PAGE, page * PAGE - 1);

  const ids = (products ?? []).map((p) => p.id!);
  const { data: links } = ids.length
    ? await supabase.from("product_attribute_values").select("product_id, value_id").in("product_id", ids)
    : { data: [] };
  const valuesBy = new Map<string, string[]>();
  for (const l of links ?? []) valuesBy.set(l.product_id, [...(valuesBy.get(l.product_id) ?? []), l.value_id]);

  const str = (n: number | null) => (n != null ? String(n) : "");
  const rows: BulkRow[] = (products ?? []).map((p) => ({
    id: p.id!,
    name: p.name!,
    imagePath: p.image_path,
    categoryId: p.category_id!,
    categoryName: p.category_name ?? "",
    attributeValueIds: valuesBy.get(p.id!) ?? [],
    dims: { height: str(p.height_cm), width: str(p.width_cm), depth: str(p.depth_cm), diameter: str(p.diameter_cm) },
  }));

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (cat) params.set("cat", cat);
    if (missing) params.set("missing", "1");
    if (n > 1) params.set("page", String(n));
    const s = params.toString();
    return s ? `/admin/products/bulk?${s}` : "/admin/products/bulk";
  };
  const total = count ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
      <Link href="/admin/products" className="inline-flex min-h-11 items-center text-[14px] text-brown">
        ← Products
      </Link>
      <h1 className="mt-1 text-[26px] font-medium text-brown-deep">Bulk edit attributes</h1>
      <p className="mt-1 text-[14px] text-muted">Changes save automatically, row by row.</p>
      <BulkAttributeEditor
        key={`${cat}-${missing}-${page}`}
        rows={rows}
        attributes={attributes}
        categories={categories}
        cat={cat}
        missing={missing}
      />
      {total > PAGE && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-[14px]">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn btn-outline min-h-11 px-4">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} of {total}
          </span>
          {page * PAGE < total ? (
            <Link href={pageHref(page + 1)} className="btn btn-outline min-h-11 px-4">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
