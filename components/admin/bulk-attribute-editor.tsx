"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { bulkUpdateProductAttributes } from "@/app/admin/actions/products";
import { PoshImage } from "@/components/ui/posh-image";
import type { Attribute, AttributeValue, DimKey } from "@/lib/catalog/types";
import { AttributePicker } from "./attribute-picker";
import { DimensionInputs, parseCm, type CategoryOption } from "./product-form";

export type BulkRow = {
  id: string;
  name: string;
  imagePath: string | null;
  categoryId: string;
  categoryName: string;
  attributeValueIds: string[];
  dims: Record<DimKey, string>;
};

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 800;

export function BulkAttributeEditor({
  rows: initialRows,
  attributes: initialAttributes,
  categories,
  cat,
  missing,
}: {
  rows: BulkRow[];
  attributes: Attribute[];
  categories: CategoryOption[];
  cat: string;
  missing: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [attributes, setAttributes] = useState(initialAttributes);
  const addValue = (attributeId: string, value: AttributeValue) =>
    setAttributes((list) => list.map((a) => (a.id === attributeId ? { ...a, values: [...a.values, value] } : a)));

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    params.delete("page");
    if (value) params.set(key, value);
    else params.delete(key);
    const s = params.toString();
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  const dimsByCategory = new Map(categories.map((c) => [c.id, c.dims]));

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select aria-label="Category" className="field min-h-11 py-2 text-[14px] sm:max-w-sm" value={cat} onChange={(e) => update("cat", e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-3 text-[14px]">
          <input type="checkbox" className="h-5 w-5 accent-brown" checked={missing} onChange={(e) => update("missing", e.target.checked ? "1" : "")} />
          Only products missing attributes or dimensions
        </label>
      </div>

      {initialRows.length === 0 ? (
        <p className="mt-6 bg-sand px-4 py-12 text-center text-[15px] text-ink-soft">
          {missing ? "Every product here has attributes and dimensions. 🎉" : "No products match."}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {initialRows.map((r) => (
            <BulkRowEditor key={r.id} row={r} attributes={attributes} onCreated={addValue} activeDims={dimsByCategory.get(r.categoryId) ?? null} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BulkRowEditor({
  row,
  attributes,
  onCreated,
  activeDims,
}: {
  row: BulkRow;
  attributes: Attribute[];
  onCreated: (attributeId: string, value: AttributeValue) => void;
  activeDims: DimKey[] | null;
}) {
  const [valueIds, setValueIds] = useState(row.attributeValueIds);
  const [dims, setDims] = useState(row.dims);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef({ valueIds, dims });

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const save = async () => {
    setState("saving");
    const { valueIds: ids, dims: d } = latest.current;
    const res = await bulkUpdateProductAttributes({
      productId: row.id,
      attributeValueIds: ids,
      heightCm: parseCm(d.height),
      widthCm: parseCm(d.width),
      depthCm: parseCm(d.depth),
      diameterCm: parseCm(d.diameter),
    }).catch(() => ({ ok: false as const, error: "Couldn't reach the server" }));
    // A newer edit started while saving: let its timer save again.
    if (latest.current.valueIds !== ids || latest.current.dims !== d) return;
    if (res.ok) {
      setState("saved");
      setError(null);
    } else {
      setState("error");
      setError(res.error);
    }
  };

  const schedule = (next: { valueIds?: string[]; dims?: Record<DimKey, string> }) => {
    latest.current = { ...latest.current, ...next };
    window.clearTimeout(timer.current);
    // Don't save a half-typed number as "no dimension".
    if (Object.values(latest.current.dims).some((v) => v.trim() !== "" && parseCm(v) === null)) {
      setState("error");
      setError("Check the dimensions");
      return;
    }
    setState("pending");
    timer.current = window.setTimeout(() => void save(), SAVE_DELAY_MS);
  };

  const status =
    state === "saving" || state === "pending" ? (
      <span className="text-muted">Saving…</span>
    ) : state === "saved" ? (
      <span className="text-[#2F5320]">Saved</span>
    ) : state === "error" ? (
      <button type="button" className="text-error underline underline-offset-4" onClick={() => void save()}>
        {error ?? "Failed"} · Retry
      </button>
    ) : null;

  return (
    <li className="border border-line bg-cream-raised p-3">
      <div className="flex items-center gap-3">
        <div className="relative aspect-[4/5] w-10 shrink-0 overflow-hidden bg-sand-image">
          {row.imagePath && <PoshImage path={row.imagePath} alt="" fill sizes="40px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/admin/products/${row.id}`} className="block truncate text-[15px] font-medium text-brown-deep hover:underline">
            {row.name}
          </Link>
          <p className="truncate text-[12px] text-muted">{row.categoryName}</p>
        </div>
        <p className="shrink-0 text-[12px]" aria-live="polite">
          {status}
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {attributes.map((a) => (
          <div key={a.id}>
            <span className="mb-1 block text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{a.name}</span>
            <AttributePicker
              attribute={a}
              compact
              selected={valueIds}
              onChange={(next) => {
                setValueIds(next);
                schedule({ valueIds: next });
              }}
              onCreated={onCreated}
            />
          </div>
        ))}
      </div>
      <div className="mt-2">
        <span className="mb-1 block text-[11px] font-medium tracking-[0.08em] text-muted uppercase">Dimensions (cm)</span>
        <DimensionInputs
          compact
          ids={row.id}
          values={dims}
          active={activeDims}
          onChange={(next) => {
            setDims(next);
            schedule({ dims: next });
          }}
        />
      </div>
    </li>
  );
}
