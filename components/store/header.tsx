import { getCategories, getVirtualCounts } from "@/lib/data/catalog";
import { buildTree, pruneEmpty } from "@/lib/catalog/tree";
import { Suspense } from "react";
import { HeaderClient, HeaderWithPathname, type NavCategory } from "./header-client";
import type { CategoryNode } from "@/lib/catalog/types";

function toNav(n: CategoryNode): NavCategory {
  return { name: n.name, path: n.path, children: n.children.map(toNav) };
}

export async function SiteHeader() {
  const [categories, counts] = await Promise.all([getCategories(), getVirtualCounts()]);
  const nav = pruneEmpty(buildTree(categories)).map(toNav);
  const props = { categories: nav, showNew: counts.newCount > 0, showSale: counts.saleCount > 0 };
  return (
    <Suspense fallback={<HeaderClient {...props} pathname="" />}>
      <HeaderWithPathname {...props} />
    </Suspense>
  );
}
