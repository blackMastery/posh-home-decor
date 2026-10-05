"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SearchIcon, CloseIcon } from "@/components/ui/icons";
import { SHOP_SORTS, type ShopSort } from "@/lib/catalog/types";

/** Search (debounced 300ms, router.replace) + sort. Works as a GET form without JS. */
export function ShopControls({ q, sort }: { q: string; sort: ShopSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(q);
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  // Keep the input in sync when navigating (e.g. back button).
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setValue(q);
  }

  const push = (next: { q?: string; sort?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (next.q !== undefined) {
      if (next.q.trim()) params.set("q", next.q.trim());
      else params.delete("q");
    }
    if (next.sort !== undefined) {
      if (next.sort === "featured") params.delete("sort");
      else params.set("sort", next.sort);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <form
      role="search"
      method="get"
      action={pathname}
      onSubmit={(e) => {
        e.preventDefault();
        window.clearTimeout(timer.current);
        push({ q: value });
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      aria-busy={pending}
    >
      <div className="relative flex-1 sm:max-w-sm">
        <label htmlFor="shop-search" className="sr-only">
          Search pieces
        </label>
        <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input
          id="shop-search"
          name="q"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Search pieces"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => push({ q: next }), 300);
          }}
          className="field pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              push({ q: "" });
            }}
            className="tap absolute top-1/2 right-0 inline-flex -translate-y-1/2 items-center justify-center text-muted hover:text-brown"
            aria-label="Clear search"
          >
            <CloseIcon size={16} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 sm:ml-auto">
        <label htmlFor="shop-sort" className="label-caps text-muted">
          Sort
        </label>
        <select
          id="shop-sort"
          name="sort"
          value={sort}
          onChange={(e) => push({ sort: e.target.value })}
          className="field w-auto min-w-[200px] cursor-pointer"
        >
          {SHOP_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit" className="btn btn-outline">
            Apply
          </button>
        </noscript>
      </div>
    </form>
  );
}
