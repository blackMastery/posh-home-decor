"use client";

import type { ReactNode } from "react";
import { ChevronDown, CheckIcon } from "@/components/ui/icons";
import { Swatch } from "@/components/ui/swatch";
import { setDim, setPrice, toggleShow, toggleValue } from "@/lib/catalog/filters";
import { DIMS, SHOW_FLAGS, type Attribute, type DimKey, type FacetResult, type ShopFilters, type ShowFlag } from "@/lib/catalog/types";
import { formatNumber, formatPrice } from "@/lib/format/money";
import { RangeSlider } from "./range-slider";

export type FilterPanelProps = {
  attributes: Attribute[];
  facets: FacetResult;
  filters: ShopFilters;
  /** The landing page's toggle (/shop/sale → "sale"); shown checked. */
  preset: ShowFlag | null;
  /** Dimensions this listing filters on. */
  dims: DimKey[];
  onChange: (next: ShopFilters) => void;
  /** Range sliders commit after this delay (the mobile sheet uses a shorter one). */
  rangeDebounceMs?: number;
};

/** Facet groups. Controlled: the sidebar applies changes to the URL, the sheet to a draft. */
export function FilterPanel({ attributes, facets, filters, preset, dims, onChange, rangeDebounceMs }: FilterPanelProps) {
  const byAttr = new Map<string, Map<string, number>>();
  for (const v of facets.values) {
    const m = byAttr.get(v.attribute) ?? new Map<string, number>();
    m.set(v.value, v.count);
    byAttr.set(v.attribute, m);
  }

  const showFlags = SHOW_FLAGS.filter((f) => facets.show[f.value] > 0 || filters.show.includes(f.value));
  const dimGroups = DIMS.filter((d) => dims.includes(d.key) && (facets.dims[d.key] || filters.dims[d.key]));

  return (
    <div className="divide-y divide-line border-y border-line">
      {(showFlags.length > 0 || filters.hideSoldOut) && (
        <Group title="Show" open>
          <ul className="space-y-1">
            {showFlags.map((f) => (
              <li key={f.value}>
                <CheckRow
                  checked={filters.show.includes(f.value)}
                  disabled={facets.show[f.value] === 0 && !filters.show.includes(f.value)}
                  count={facets.show[f.value]}
                  onToggle={() => onChange(toggleShow(filters, f.value))}
                  label={f.label}
                  hint={f.value === preset ? "This page" : undefined}
                />
              </li>
            ))}
            <li>
              <CheckRow
                checked={filters.hideSoldOut}
                onToggle={() => onChange({ ...filters, hideSoldOut: !filters.hideSoldOut })}
                label="Hide sold out"
              />
            </li>
          </ul>
        </Group>
      )}

      {attributes.map((a, i) => {
        const counts = byAttr.get(a.slug);
        if (!counts) return null;
        const values = a.values.filter((v) => counts.has(v.slug));
        const selected = filters.values[a.slug] ?? [];
        return (
          <Group key={a.id} title={a.name} count={selected.length} open={selected.length > 0 || i < 2}>
            <ul className="space-y-1">
              {values.map((v) => {
                const checked = selected.includes(v.slug);
                const count = counts.get(v.slug) ?? 0;
                return (
                  <li key={v.id}>
                    <CheckRow
                      checked={checked}
                      disabled={count === 0 && !checked}
                      count={count}
                      onToggle={() => onChange(toggleValue(filters, a.slug, v.slug))}
                      label={v.name}
                      swatch={a.kind === "color" ? <Swatch hex={v.hex} swatch={v.swatch} size={18} /> : undefined}
                    />
                  </li>
                );
              })}
            </ul>
          </Group>
        );
      })}

      {dimGroups.map((d) => {
        const bounds = facets.dims[d.key] ?? { min: filters.dims[d.key]?.min ?? 0, max: filters.dims[d.key]?.max ?? 0 };
        return (
          <Group key={d.key} title={`${d.label} (cm)`} count={filters.dims[d.key] ? 1 : 0} open={Boolean(filters.dims[d.key])}>
            <RangeSlider
              label={d.label}
              bounds={{ min: Math.floor(bounds.min), max: Math.ceil(bounds.max) }}
              value={filters.dims[d.key] ?? null}
              format={(n) => `${formatNumber(n)} cm`}
              unit="cm"
              onChange={(r) => onChange(setDim(filters, d.key, r))}
              debounceMs={rangeDebounceMs}
            />
          </Group>
        );
      })}

      {(facets.price || filters.price) && (
        <Group title="Price" count={filters.price ? 1 : 0} open={Boolean(filters.price)}>
          <RangeSlider
            label="Price"
            bounds={facets.price ?? { min: filters.price?.min ?? 0, max: filters.price?.max ?? 0 }}
            value={filters.price}
            step={100}
            format={(n) => formatPrice(n)}
            unit="GYD"
            onChange={(r) => onChange(setPrice(filters, r))}
            debounceMs={rangeDebounceMs}
          />
          <p className="mt-3 text-[12px] text-muted">Pieces priced on request are hidden while a price range is set.</p>
        </Group>
      )}
    </div>
  );
}

function Group({ title, count = 0, open = false, children }: { title: string; count?: number; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group/acc">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="label-caps text-brown-deep">
          {title}
          {count > 0 && <span className="ml-2 text-bronze">({count})</span>}
        </span>
        <ChevronDown size={16} className="text-muted transition-transform group-open/acc:rotate-180" />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

function CheckRow({
  checked,
  disabled = false,
  count,
  onToggle,
  label,
  hint,
  swatch,
}: {
  checked: boolean;
  disabled?: boolean;
  count?: number;
  onToggle: () => void;
  label: string;
  hint?: string;
  swatch?: ReactNode;
}) {
  return (
    <label className={`flex min-h-10 items-center gap-3 text-[15px] ${disabled ? "cursor-not-allowed text-muted/60" : "cursor-pointer text-ink-soft hover:text-brown"}`}>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={onToggle} />
      <span
        aria-hidden
        className={`inline-flex size-5 flex-none items-center justify-center border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold ${
          checked ? "border-brown bg-brown text-cream" : "border-line-strong bg-cream-raised"
        }`}
      >
        {checked && <CheckIcon size={14} />}
      </span>
      {swatch}
      <span className="flex-1">
        {label}
        {hint && <span className="ml-2 text-[12px] text-muted">{hint}</span>}
      </span>
      {count !== undefined && <span className="text-[13px] tabular-nums text-muted">{count}</span>}
    </label>
  );
}
