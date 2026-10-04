"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";

type Opt = { id: string; label: string };

export function ProductFilters({
  q,
  status,
  avail,
  cat,
  sort,
  categories,
}: {
  q: string;
  status: string;
  avail: string;
  cat: string;
  sort: string;
  categories: Opt[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [search, setSearch] = useState(q);
  const [, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  const update = (key: string, value: string, fallback: string) => {
    const params = new URLSearchParams(sp.toString());
    params.delete("page");
    if (!value || value === fallback) params.delete(key);
    else params.set(key, value);
    const s = params.toString();
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  const select = "field min-h-11 py-2 text-[14px]";
  return (
    <div className="mt-5 space-y-3">
      <input
        type="search"
        aria-label="Search products by name"
        placeholder="Search by name"
        className="field"
        value={search}
        onChange={(e) => {
          const v = e.target.value;
          setSearch(v);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => update("q", v.trim(), ""), 300);
        }}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select aria-label="Status" className={select} value={status} onChange={(e) => update("status", e.target.value, "active")}>
          <option value="active">Draft + published</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <select aria-label="Availability" className={select} value={avail} onChange={(e) => update("avail", e.target.value, "all")}>
          <option value="all">Any availability</option>
          <option value="available">Available</option>
          <option value="soldout">Sold out</option>
        </select>
        <select aria-label="Category" className={select} value={cat} onChange={(e) => update("cat", e.target.value, "")}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select aria-label="Sort" className={select} value={sort} onChange={(e) => update("sort", e.target.value, "edited")}>
          <option value="edited">Recently edited</option>
          <option value="name">Name</option>
          <option value="newest">Newest</option>
        </select>
      </div>
    </div>
  );
}
