"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CloseIcon, SearchIcon } from "@/components/ui/icons";
import { PoshImage } from "@/components/ui/posh-image";
import { useDialog } from "@/components/ui/use-dialog";
import type { SearchSuggestions } from "@/lib/data/catalog";
import { formatPriceOrRequest } from "@/lib/format/money";
import { displayName } from "@/lib/format/text";

const EMPTY: SearchSuggestions = { products: [], categories: [] };

type Option = { key: string; href: string };

/** Header search: instant suggestions; Enter searches the shop. */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const ref = useDialog<HTMLDivElement>(true, onClose);
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchSuggestions>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<number | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      abort.current?.abort();
    },
    [],
  );

  const term = q.trim();
  const options: Option[] = [
    ...results.categories.map((c) => ({ key: `c:${c.path}`, href: `/shop/${c.path}` })),
    ...results.products.map((p) => ({ key: `p:${p.id}`, href: `/products/${p.slug}` })),
  ];
  const searchHref = `/shop?q=${encodeURIComponent(term)}`;

  const onInput = (value: string) => {
    setQ(value);
    setActive(-1);
    window.clearTimeout(timer.current);
    abort.current?.abort();
    if (value.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = window.setTimeout(async () => {
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(value.trim())}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setResults((await res.json()) as SearchSuggestions);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setResults(EMPTY);
      }
      setLoading(false);
    }, 200);
  };

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const optionId = (i: number) => `${id}-opt-${i}`;
  const showList = term.length >= 2;
  const empty = showList && !loading && options.length === 0;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-brown-deep/40 [animation:fade-in_.2s_ease-out]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="absolute inset-x-0 top-0 max-h-[90dvh] overflow-y-auto bg-cream shadow-2xl [animation:slide-down_.2s_ease-out]"
      >
        <div className="container-posh py-5 nav:py-8">
          <form
            role="search"
            action="/shop"
            onSubmit={(e) => {
              e.preventDefault();
              if (active >= 0 && options[active]) go(options[active].href);
              else if (term) go(searchHref);
            }}
            className="flex items-center gap-3 border-b border-brown pb-3"
          >
            <SearchIcon size={22} className="flex-none text-muted" />
            <input
              data-autofocus
              name="q"
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Search vases, brass, living room…"
              value={q}
              maxLength={80}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && options.length) {
                  e.preventDefault();
                  setActive((i) => (i + 1) % options.length);
                } else if (e.key === "ArrowUp" && options.length) {
                  e.preventDefault();
                  setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
                }
              }}
              role="combobox"
              aria-expanded={showList && options.length > 0}
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? optionId(active) : undefined}
              aria-label="Search pieces"
              className="min-h-12 flex-1 bg-transparent font-display text-[clamp(24px,3vw,34px)] text-brown-deep placeholder:text-muted/70 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            <button type="button" onClick={onClose} className="tap -mr-3 inline-flex items-center justify-center" aria-label="Close search">
              <CloseIcon size={22} />
            </button>
          </form>

          <div aria-live="polite" className="sr-only">
            {showList && !loading ? `${options.length} suggestions` : ""}
          </div>

          {showList && (
            <div id={`${id}-list`} role="listbox" aria-label="Suggestions" className="mt-6 grid gap-8 nav:grid-cols-[minmax(200px,260px)_1fr]">
              {results.categories.length > 0 && (
                <div role="group" aria-labelledby={`${id}-cats`}>
                  <p id={`${id}-cats`} className="eyebrow text-bronze">
                    Categories
                  </p>
                  <ul className="mt-3">
                    {results.categories.map((c, i) => (
                      <li key={c.path} id={optionId(i)} role="option" aria-selected={active === i}>
                        <Link
                          href={`/shop/${c.path}`}
                          onClick={onClose}
                          tabIndex={-1}
                          className={`flex min-h-11 items-baseline gap-2 text-[16px] hover:text-brown ${active === i ? "text-brown underline underline-offset-4" : "text-ink-soft"}`}
                        >
                          {c.name}
                          {c.parent_name && <span className="text-[13px] text-muted">in {c.parent_name}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {results.products.length > 0 && (
                <div role="group" aria-labelledby={`${id}-prods`} className={results.categories.length ? "" : "nav:col-span-2"}>
                  <p id={`${id}-prods`} className="eyebrow text-bronze">
                    Pieces
                  </p>
                  <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {results.products.map((p, j) => {
                      const i = results.categories.length + j;
                      return (
                        <li key={p.id} id={optionId(i)} role="option" aria-selected={active === i}>
                          <Link
                            href={`/products/${p.slug}`}
                            onClick={onClose}
                            tabIndex={-1}
                            className={`flex items-center gap-4 p-2 transition-colors hover:bg-sand ${active === i ? "bg-sand" : ""}`}
                          >
                            <span className="relative size-16 flex-none overflow-hidden bg-white">
                              {p.image_path && <PoshImage path={p.image_path} alt="" fill sizes="64px" className="object-contain p-1" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-display text-[19px] leading-tight text-brown-deep">{displayName(p.name)}</span>
                              <span className="block text-[13px] text-muted">
                                {p.category_name} · {p.availability === "sold_out" ? "Sold out" : formatPriceOrRequest(p.price)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {empty && <p className="mt-6 text-[15px] text-ink-soft">No suggestions for “{term}”. Press Enter to search everything.</p>}

          {showList && (
            <Link
              href={searchHref}
              onClick={onClose}
              className="label-caps mt-6 inline-flex min-h-11 items-center gap-2 text-brown underline-offset-4 hover:underline"
            >
              See all results for “{term}” <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
