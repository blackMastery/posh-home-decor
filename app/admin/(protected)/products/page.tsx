import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatPriceOrRequest } from "@/lib/format/money";
import { toAvailability } from "@/lib/catalog/types";
import { PoshImage } from "@/components/ui/posh-image";
import { AvailabilitySwitch } from "@/components/admin/availability-switch";
import { ProductFilters } from "@/components/admin/product-filters";

export const metadata: Metadata = { title: "Products" };

const PAGE = 50;

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = one("q").trim().slice(0, 60);
  const status = ["draft", "published", "archived", "all"].includes(one("status")) ? one("status") : "active";
  // "soldout" kept so old bookmarks still work.
  const availRaw = one("avail") === "soldout" ? "sold_out" : one("avail");
  const avail = ["available", "coming_soon", "sold_out"].includes(availRaw) ? availRaw : "all";
  const cat = one("cat");
  const sort = ["name", "newest"].includes(one("sort")) ? one("sort") : "edited";
  const page = Math.max(1, Math.min(40, Number.parseInt(one("page"), 10) || 1));

  const { data: categories } = await supabase.from("categories").select("id, name, path, depth").order("path");
  const catPath = categories?.find((c) => c.id === cat)?.path;

  let query = supabase
    .from("product_cards")
    .select("id, name, slug, price, compare_at_price, availability, status, image_path, category_name, category_path, updated_at, item_code", {
      count: "exact",
    });
  if (status === "active") query = query.neq("status", "archived");
  else if (status !== "all") query = query.eq("status", status);
  if (avail !== "all") query = query.eq("availability", avail);
  if (catPath) query = query.or(`category_path.eq.${catPath},category_path.like.${catPath}/%`);
  if (q) {
    // Name, item code or UPC. Strip characters that are special in PostgREST filters.
    const term = q.replace(/[%_\\,()*]/g, " ").trim();
    if (term) query = query.or(`name.ilike.*${term}*,item_code.ilike.*${term}*,item_upc_code.ilike.*${term}*`);
  }
  query =
    sort === "name"
      ? query.order("name")
      : sort === "newest"
        ? query.order("created_at", { ascending: false })
        : query.order("updated_at", { ascending: false });
  const { data: products, count } = await query.range(0, page * PAGE - 1);

  const nextParams = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
  nextParams.set("page", String(page + 1));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[26px] font-medium text-brown-deep">Products</h1>
        <Link href="/admin/products/new" className="btn btn-primary px-5">
          + New
        </Link>
      </div>

      <ProductFilters
        q={q}
        status={status}
        avail={avail}
        cat={cat}
        sort={sort}
        categories={(categories ?? []).map((c) => ({ id: c.id, label: `${"— ".repeat(c.depth - 1)}${c.name}` }))}
      />

      <p className="mt-4 text-[13px] text-muted">
        {count ?? 0} product{count === 1 ? "" : "s"}
      </p>

      {!products?.length ? (
        <p className="mt-6 bg-sand px-4 py-12 text-center text-[15px] text-ink-soft">No products match.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {products.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <Link href={`/admin/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden bg-sand-image">
                  {p.image_path && <PoshImage path={p.image_path} alt="" fill sizes="56px" className="object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-brown-deep">
                    {p.name}
                    {p.item_code && <span className="ml-2 font-mono text-[12px] font-normal text-muted">{p.item_code}</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {formatPriceOrRequest(p.price)}
                    {p.price != null && p.compare_at_price != null && p.compare_at_price > p.price && (
                      <span className="ml-1 text-brown">· Sale</span>
                    )}{" "}
                    · {p.category_name}
                  </p>
                  <StatusChip status={p.status!} />
                </div>
              </Link>
              {p.status !== "archived" && (
                <AvailabilitySwitch id={p.id!} name={p.name!} initial={toAvailability(p.availability)} />
              )}
            </li>
          ))}
        </ul>
      )}
      {(products?.length ?? 0) < (count ?? 0) && (
        <div className="mt-6 text-center">
          <Link href={`/admin/products?${nextParams}`} scroll={false} className="btn btn-outline">
            Show more
          </Link>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "published"
      ? "bg-[#E4EEDB] text-[#2F5320]"
      : status === "draft"
        ? "bg-gold/25 text-brown-deep"
        : "bg-line text-ink-soft";
  const label = status === "published" ? "Published" : status === "draft" ? "Draft" : "Archived";
  return <span className={`mt-1 inline-block px-2 py-0.5 text-[11px] font-medium tracking-wide ${tone}`}>{label}</span>;
}
