import type { Category, CategoryNode } from "./types";

export function buildTree(categories: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const c of categories) byId.set(c.id, { ...c, children: [] });
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** Ancestors (root first) including the category itself. */
export function ancestry(categories: Category[], path: string): Category[] {
  const byPath = new Map(categories.map((c) => [c.path, c]));
  const parts = path.split("/");
  const out: Category[] = [];
  for (let i = 1; i <= parts.length; i++) {
    const c = byPath.get(parts.slice(0, i).join("/"));
    if (c) out.push(c);
  }
  return out;
}

/** Remove categories with no published products (recursively). */
export function pruneEmpty(nodes: CategoryNode[]): CategoryNode[] {
  return nodes
    .filter((n) => n.productCount > 0)
    .map((n) => ({ ...n, children: pruneEmpty(n.children) }));
}

export function categoryHref(path: string) {
  return `/shop/${path}`;
}

/** "Decor › Vases and Jars › Glass Vases" */
export function pathLabel(categories: Category[], path: string) {
  return ancestry(categories, path)
    .map((c) => c.name)
    .join(" › ");
}
