"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/ui/icons";
import { Swatch } from "@/components/ui/swatch";
import { useDialog } from "@/components/ui/use-dialog";
import { clearFilters, countActive, sameFilters, setDim, setPrice, shopHref, toggleShow, toggleValue, writeFilters } from "@/lib/catalog/filters";
import { DIMS, SHOW_FLAGS, type Attribute, type DimKey, type FacetResult, type Range, type ShopFilters, type ShowFlag } from "@/lib/catalog/types";
import { formatNumber, formatPrice } from "@/lib/format/money";
import { FilterPanel } from "./filter-panel";

type ShopFilterState = {
  attributes: Attribute[];
  facets: FacetResult;
  filters: ShopFilters;
  preset: ShowFlag | null;
  dims: DimKey[];
  /** Listing path without params: /shop, /shop/decor, /shop/sale. */
  basePath: string;
  categoryPath: string | null;
  q: string;
};

type Ctx = ShopFilterState & { apply: (next: ShopFilters) => void; pending: boolean };

const ShopFilterContext = createContext<Ctx | null>(null);

function useShopFilters() {
  const ctx = use(ShopFilterContext);
  if (!ctx) throw new Error("useShopFilters must be used inside <ShopFiltersProvider>");
  return ctx;
}

/** Holds the listing's filter state and applies changes to the URL. */
export function ShopFiltersProvider({ value, children }: { value: ShopFilterState; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (next: ShopFilters) => {
    if (sameFilters(next, value.filters)) return;
    const href = shopHref({
      basePath: value.basePath,
      preset: value.preset,
      filters: next,
      attributes: value.attributes,
      current: new URLSearchParams(searchParams.toString()),
    });
    const samePath = href.split("?")[0] === pathname;
    startTransition(() => (samePath ? router.replace(href, { scroll: false }) : router.push(href)));
  };

  return <ShopFilterContext value={{ ...value, apply, pending }}>{children}</ShopFilterContext>;
}

/** Dims the results while a filter change is loading. */
export function PendingResults({ children }: { children: ReactNode }) {
  const { pending } = useShopFilters();
  return (
    <div aria-busy={pending} className={`transition-opacity duration-200 ${pending ? "pointer-events-none opacity-50" : ""}`}>
      {children}
    </div>
  );
}

/** Desktop: always-visible sidebar, applies on change. */
export function FilterSidebar() {
  const { attributes, facets, filters, preset, dims, apply, pending } = useShopFilters();
  const active = countActive(filters, preset);
  return (
    <aside aria-label="Filters" aria-busy={pending}>
      <div className="flex min-h-11 items-center justify-between">
        <h2 className="eyebrow text-bronze">Filter</h2>
        {active > 0 && (
          <button type="button" onClick={() => apply(clearFilters(preset))} className="text-[13px] text-muted underline underline-offset-4 hover:text-brown">
            Clear all
          </button>
        )}
      </div>
      <div className="mt-2">
        <FilterPanel attributes={attributes} facets={facets} filters={filters} preset={preset} dims={dims} onChange={apply} />
      </div>
    </aside>
  );
}

/** Mobile: "Filter (n)" button opening a bottom sheet that edits a draft. */
export function FilterSheetButton() {
  const state = useShopFilters();
  const [open, setOpen] = useState(false);
  const active = countActive(state.filters, state.preset);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-outline min-h-11 px-5" aria-haspopup="dialog">
        Filter{active > 0 && ` (${active})`}
      </button>
      {open && <FilterSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function facetsUrl(state: ShopFilterState, draft: ShopFilters) {
  const params = new URLSearchParams();
  if (state.categoryPath) params.set("path", state.categoryPath);
  if (state.q) params.set("q", state.q);
  const preset = state.preset && draft.show.includes(state.preset) ? state.preset : null;
  if (preset) params.set("preset", preset);
  writeFilters(params, draft, state.attributes, preset);
  return `/api/shop/facets?${params}`;
}

function FilterSheet({ onClose }: { onClose: () => void }) {
  const state = useShopFilters();
  const ref = useDialog<HTMLDivElement>(true, onClose);
  const [draft, setDraft] = useState(state.filters);
  const [facets, setFacets] = useState(state.facets);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      abort.current?.abort();
    },
    [],
  );

  const update = (next: ShopFilters) => {
    setDraft(next);
    window.clearTimeout(timer.current);
    abort.current?.abort();
    if (sameFilters(next, state.filters)) {
      setFacets(state.facets);
      setLoading(false);
      setFailed(false);
      return;
    }
    setLoading(true);
    timer.current = window.setTimeout(async () => {
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(facetsUrl(state, next), { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setFacets((await res.json()) as FacetResult);
        setFailed(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setFailed(true);
      }
      setLoading(false);
    }, 250);
  };

  const total = facets.total;
  const label = loading ? "Updating…" : failed ? "Show results" : total === 0 ? "No matches" : `Show ${total} ${total === 1 ? "piece" : "pieces"}`;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-brown-deep/40 [animation:fade-in_.2s_ease-out]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-sheet-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col bg-cream shadow-2xl [animation:slide-up_.28s_cubic-bezier(.2,.8,.2,1)]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="filter-sheet-title" className="font-display text-[26px] font-medium text-brown-deep">
            Filter
          </h2>
          <button type="button" onClick={onClose} className="tap -mr-3 inline-flex items-center justify-center" aria-label="Close filters">
            <CloseIcon size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5">
          <FilterPanel
            attributes={state.attributes}
            facets={facets}
            filters={draft}
            preset={state.preset}
            dims={state.dims}
            onChange={update}
            rangeDebounceMs={150}
          />
        </div>
        <div className="flex gap-3 border-t border-line bg-cream-raised px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => update(clearFilters(state.preset))} className="btn btn-outline flex-none px-5">
            Clear all
          </button>
          <button
            type="button"
            onClick={() => {
              state.apply(draft);
              onClose();
            }}
            disabled={loading || (total === 0 && !failed)}
            className="btn btn-primary flex-1"
            aria-live="polite"
          >
            {label}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function rangeLabel(r: Range, fmt: (n: number) => string) {
  if (r.min !== null && r.max !== null) return `${fmt(r.min)}–${fmt(r.max)}`;
  if (r.min !== null) return `${fmt(r.min)}+`;
  return `up to ${fmt(r.max ?? 0)}`;
}

/** Removable chips for every active selection, plus Clear all. */
export function ActiveFilterChips({ className = "" }: { className?: string }) {
  const { attributes, filters, preset, apply } = useShopFilters();
  const chips: { key: string; label: string; swatch?: ReactNode; remove: () => ShopFilters }[] = [];

  for (const a of attributes) {
    for (const slug of filters.values[a.slug] ?? []) {
      const v = a.values.find((x) => x.slug === slug);
      if (!v) continue;
      chips.push({
        key: `${a.slug}=${slug}`,
        label: v.name,
        swatch: a.kind === "color" ? <Swatch hex={v.hex} swatch={v.swatch} size={12} /> : undefined,
        remove: () => toggleValue(filters, a.slug, slug),
      });
    }
  }
  for (const d of DIMS) {
    const r = filters.dims[d.key];
    if (r) chips.push({ key: d.key, label: `${d.label} ${rangeLabel(r, (n) => `${formatNumber(n)}`)} cm`, remove: () => setDim(filters, d.key, null) });
  }
  if (filters.price) chips.push({ key: "price", label: rangeLabel(filters.price, (n) => formatPrice(n)), remove: () => setPrice(filters, null) });
  for (const f of SHOW_FLAGS) {
    if (f.value !== preset && filters.show.includes(f.value)) chips.push({ key: f.value, label: f.label, remove: () => toggleShow(filters, f.value) });
  }
  if (filters.hideSoldOut) chips.push({ key: "instock", label: "Hide sold out", remove: () => ({ ...filters, hideSoldOut: false }) });

  if (chips.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            onClick={() => apply(c.remove())}
            className="inline-flex min-h-9 items-center gap-2 border border-line-strong bg-cream-raised px-3 text-[13px] text-ink-soft hover:border-brown hover:text-brown"
            aria-label={`Remove filter: ${c.label}`}
          >
            {c.swatch}
            {c.label}
            <CloseIcon size={12} />
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={() => apply(clearFilters(preset))} className="min-h-9 px-2 text-[13px] text-muted underline underline-offset-4 hover:text-brown">
          Clear all
        </button>
      </li>
    </ul>
  );
}
