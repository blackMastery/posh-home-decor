"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { duplicateProduct, saveProduct, searchProductsForRelated, setStatus } from "@/app/admin/actions/products";
import { createClient } from "@/lib/supabase/browser";
import { formatNumber, parseMoney } from "@/lib/format/money";
import { relativeTime } from "@/lib/format/time";
import { slugify } from "@/lib/slug";
import { AVAILABILITIES, type Availability } from "@/lib/catalog/types";
import { storageUrl } from "@/lib/images";
import { PoshImage } from "@/components/ui/posh-image";
import { prepareImage, type PreparedImage } from "./image-prep";
import { ImageLightbox } from "./image-lightbox";

export type CategoryOption = { id: string; label: string };
export type RelatedItem = { id: string; name: string; imagePath: string | null };

export type ProductFormValues = {
  name: string;
  slug: string;
  slugEdited: boolean;
  price: string;
  compareAtPrice: string;
  categoryId: string | null;
  note: string;
  description: string;
  availability: Availability;
  detailsText: string;
  careText: string;
  deliveryText: string;
  featuredRank: string;
  related: RelatedItem[];
  images: SavedImage[];
};

type SavedImage = { key: string; storagePath: string; width: number | null; height: number | null; alt: string; persisted: boolean };
type PendingImage = {
  key: string;
  status: "processing" | "uploading" | "error";
  progress: number;
  error?: string;
  file: File;
  preview: string;
};

export type ProductMeta = { status: "draft" | "published" | "archived"; updatedAt: string; slug: string } | null;
type Defaults = { details: string; care: string; delivery: string };

const CARRY_KEY = "posh-admin-carry";
const draftKey = (id: string) => `posh-admin-draft-${id}`;

function aspectWarning(w: number | null, h: number | null) {
  if (!w || !h) return false;
  return Math.abs(w / h - 0.8) / 0.8 > 0.05;
}

export function ProductForm({
  productId,
  initial,
  meta,
  categories,
  defaults,
}: {
  productId: string;
  initial: ProductFormValues;
  meta: ProductMeta;
  categories: CategoryOption[];
  defaults: Defaults;
}) {
  const router = useRouter();
  const ids = useId();
  const [v, setV] = useState<ProductFormValues>(initial);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; conflict?: boolean; retry?: () => void } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedMeta, setSavedMeta] = useState(meta);
  const [restore, setRestore] = useState<ProductFormValues | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const baseline = useRef(JSON.stringify(initial));
  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  // --- Draft safety: offer to restore, then autosave every few seconds -------
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(productId));
      if (raw) {
        const draft = JSON.parse(raw) as { base: string | null; values: ProductFormValues };
        if (draft.base === (meta?.updatedAt ?? null) && JSON.stringify(draft.values) !== baseline.current) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
          setRestore(draft.values);
        } else {
          window.localStorage.removeItem(draftKey(productId));
        }
      } else if (!meta) {
        const carry = window.sessionStorage.getItem(CARRY_KEY);
        if (carry) {
          window.sessionStorage.removeItem(CARRY_KEY);
          const c = JSON.parse(carry) as Partial<ProductFormValues>;
          setV((p) => ({ ...p, ...c }));
          setNotice("Category and accordion text carried over from the last product.");
        }
      }
    } catch {
      // ignore
    }
  }, [productId, meta]);

  const latest = useRef(v);
  useEffect(() => {
    latest.current = v;
  });
  useEffect(() => {
    const t = window.setInterval(() => {
      const snapshot = JSON.stringify(latest.current);
      if (snapshot === baseline.current) return;
      try {
        window.localStorage.setItem(
          draftKey(productId),
          JSON.stringify({ base: savedMeta?.updatedAt ?? null, values: latest.current }),
        );
      } catch {
        // ignore
      }
    }, 3000);
    return () => window.clearInterval(t);
  }, [productId, savedMeta]);

  // Warn before leaving with unsaved changes.
  const dirty = JSON.stringify(v) !== baseline.current;
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // --- Photos ---------------------------------------------------------------
  async function upload(file: File, key: string) {
    setPending((p) => p.map((x) => (x.key === key ? { ...x, status: "processing", progress: 0, error: undefined } : x)));
    let prepared: PreparedImage;
    try {
      prepared = await prepareImage(file, (pct) =>
        setPending((p) => p.map((x) => (x.key === key ? { ...x, progress: pct } : x))),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't read this photo";
      setPending((p) => p.map((x) => (x.key === key ? { ...x, status: "error", error: message } : x)));
      return;
    }
    setPending((p) => p.map((x) => (x.key === key ? { ...x, status: "uploading", progress: 100 } : x)));
    const path = `products/${productId}/${crypto.randomUUID()}.jpg`;
    const { error: upError } = await createClient()
      .storage.from("product-images")
      .upload(path, prepared.blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (upError) {
      setPending((p) => p.map((x) => (x.key === key ? { ...x, status: "error", error: "Upload failed — check your connection" } : x)));
      return;
    }
    setPending((p) => {
      const item = p.find((x) => x.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return p.filter((x) => x.key !== key);
    });
    setV((prev) => ({
      ...prev,
      images: [...prev.images, { key, storagePath: path, width: prepared.width, height: prepared.height, alt: "", persisted: false }],
    }));
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const items = Array.from(files)
      .slice(0, 20)
      .map((file) => ({
        key: crypto.randomUUID(),
        status: "processing" as const,
        progress: 0,
        file,
        preview: URL.createObjectURL(file),
      }));
    setPending((p) => [...p, ...items]);
    // Upload one at a time so a slow connection doesn't stall every photo.
    void (async () => {
      for (const it of items) await upload(it.file, it.key);
    })();
  }

  function removeImage(key: string) {
    const img = v.images.find((i) => i.key === key);
    set(
      "images",
      v.images.filter((i) => i.key !== key),
    );
    // Not saved yet → delete the orphan now. Saved images are removed on save.
    if (img && !img.persisted) void createClient().storage.from("product-images").remove([img.storagePath]);
  }

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= v.images.length) return;
    const next = [...v.images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set("images", next);
  }

  const dragFrom = useRef<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // --- Save -----------------------------------------------------------------
  const price = parseMoney(v.price);
  const compareAt = parseMoney(v.compareAtPrice);
  const compareWarning = compareAt != null && price != null && compareAt <= price;
  const compareNeedsPrice = compareAt != null && price == null;
  const uploading = pending.some((p) => p.status !== "error");

  async function save(intent: "draft" | "publish" | "keep", opts: { force?: boolean; then?: "another" } = {}) {
    if (uploading) {
      setError({ message: "Wait for photos to finish uploading." });
      return;
    }
    setSaving(intent);
    setError(null);
    setFieldErrors({});
    const run = () => save(intent, opts);
    try {
      const res = await saveProduct({
        id: productId,
        intent,
        expectedUpdatedAt: savedMeta?.updatedAt ?? null,
        force: opts.force ?? false,
        name: v.name,
        slug: v.slugEdited ? v.slug : "",
        note: v.note,
        description: v.description,
        price,
        compareAtPrice: compareAt,
        categoryId: v.categoryId,
        availability: v.availability,
        detailsText: v.detailsText,
        careText: v.careText,
        deliveryText: v.deliveryText,
        featuredRank: v.featuredRank.trim() ? Number.parseInt(v.featuredRank, 10) : null,
        images: v.images.map((i) => ({ storagePath: i.storagePath, width: i.width, height: i.height, alt: i.alt || null })),
        relatedIds: v.related.map((r) => r.id),
      });
      if (!res.ok) {
        setFieldErrors(res.fieldErrors ?? {});
        setError({ message: res.error, conflict: res.conflict });
        return;
      }
      try {
        window.localStorage.removeItem(draftKey(productId));
      } catch {
        // ignore
      }
      const persisted = { ...v, slug: res.slug, images: v.images.map((i) => ({ ...i, persisted: true })) };
      baseline.current = JSON.stringify(persisted);
      setV(persisted);
      setSavedMeta({ status: res.status as "draft" | "published", updatedAt: res.updatedAt, slug: res.slug });
      if (opts.then === "another") {
        try {
          window.sessionStorage.setItem(
            CARRY_KEY,
            JSON.stringify({ categoryId: v.categoryId, detailsText: v.detailsText, careText: v.careText, deliveryText: v.deliveryText }),
          );
        } catch {
          // ignore
        }
        router.push("/admin/products/new");
        return;
      }
      setNotice(intent === "publish" ? "Published — it's live on the site." : "Saved.");
      if (!meta) router.replace(`/admin/products/${productId}`);
      else router.refresh();
    } catch {
      setError({ message: "Couldn't reach the server. Your changes are still here.", retry: run });
    } finally {
      setSaving(null);
    }
  }

  async function changeStatus(status: "archived" | "draft") {
    setSaving(status);
    const res = await setStatus(productId, status).catch(() => ({ ok: false as const, error: "Couldn't reach the server" }));
    setSaving(null);
    if (!res.ok) return setError({ message: res.error });
    if (status === "archived") router.push("/admin/products");
    else {
      setSavedMeta((m) => (m ? { ...m, status } : m));
      router.refresh();
    }
  }

  async function duplicate() {
    setSaving("duplicate");
    const res = await duplicateProduct(productId).catch(() => ({ ok: false as const, error: "Couldn't reach the server" }));
    setSaving(null);
    if (!res.ok) return setError({ message: res.error });
    router.push(`/admin/products/${res.id}`);
  }

  const status = savedMeta?.status ?? "draft";
  const label = "mb-2 block text-[13px] font-medium tracking-[0.08em] text-ink-soft uppercase";
  const err = (k: string) => fieldErrors[k] && <p className="mt-1.5 text-[13px] text-error">{fieldErrors[k]}</p>;
  const section = "border-t border-line pt-6";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(status === "published" ? "keep" : "draft");
      }}
      className="space-y-6 pb-40"
    >
      {restore && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 border border-gold bg-gold/15 px-4 py-3 text-[14px]">
          <span>Restore unsaved changes from this device?</span>
          <span className="flex gap-2">
            <button type="button" className="btn btn-primary min-h-10 px-4" onClick={() => (setV(restore), setRestore(null))}>
              Restore
            </button>
            <button
              type="button"
              className="btn btn-outline min-h-10 px-4"
              onClick={() => {
                window.localStorage.removeItem(draftKey(productId));
                setRestore(null);
              }}
            >
              Discard
            </button>
          </span>
        </div>
      )}
      {notice && (
        <p role="status" className="border border-line-strong bg-sand px-4 py-3 text-[14px]">
          {notice}
        </p>
      )}

      {/* 1. Photos */}
      <section aria-labelledby={`${ids}-photos`}>
        <h2 id={`${ids}-photos`} className={label}>
          Photos
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {v.images.map((img, i) => (
            <li
              key={img.key}
              draggable
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom.current !== null) moveImage(dragFrom.current, i);
                dragFrom.current = null;
              }}
              className="border border-line bg-cream-raised"
            >
              <button
                type="button"
                onClick={() => setPreviewIndex(i)}
                aria-label={`Preview photo ${i + 1} full size`}
                className="group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden bg-sand-image"
              >
                <PoshImage path={img.storagePath} alt="" fill sizes="200px" className="object-cover" />
                {i === 0 && <span className="absolute top-2 left-2 bg-brown px-2 py-0.5 text-[11px] text-cream">Cover</span>}
                <span className="absolute right-2 bottom-2 bg-ink/70 px-2 py-0.5 text-[11px] text-cream opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  View full size
                </span>
              </button>
              {aspectWarning(img.width, img.height) && (
                <details className="border-t border-line px-2 py-1.5 text-[12px] text-brown-deep">
                  <summary className="cursor-pointer">⚠ Not 4:5 — preview crop</summary>
                  <p className="mt-1 text-muted">The shop shows photos at 4:5, centred. This is what customers will see:</p>
                  <div className="relative mt-1 aspect-[4/5] w-24 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={storageUrl(img.storagePath)} alt="" className="h-full w-full object-cover" />
                  </div>
                </details>
              )}
              <input
                aria-label={`Alt text for photo ${i + 1}`}
                placeholder="Alt text (optional)"
                className="w-full border-t border-line bg-transparent px-2 py-2 text-[13px] focus:outline-none"
                value={img.alt}
                maxLength={200}
                onChange={(e) => set("images", v.images.map((x) => (x.key === img.key ? { ...x, alt: e.target.value } : x)))}
              />
              <div className="flex border-t border-line text-[13px]">
                <button type="button" className="min-h-11 flex-1 disabled:opacity-30" disabled={i === 0} onClick={() => moveImage(i, i - 1)} aria-label="Move photo earlier">
                  ↑
                </button>
                <button
                  type="button"
                  className="min-h-11 flex-1 border-x border-line disabled:opacity-30"
                  disabled={i === v.images.length - 1}
                  onClick={() => moveImage(i, i + 1)}
                  aria-label="Move photo later"
                >
                  ↓
                </button>
                <button type="button" className="min-h-11 flex-1 text-error" onClick={() => removeImage(img.key)} aria-label={`Remove photo ${i + 1}`}>
                  ✕
                </button>
              </div>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="border border-line bg-cream-raised">
              <div className="relative aspect-[4/5] overflow-hidden bg-sand-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="h-full w-full object-cover opacity-50" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-[13px]">
                  {p.status === "error" ? (
                    <>
                      <span className="text-error">{p.error}</span>
                      <span className="flex gap-2">
                        <button type="button" className="min-h-10 bg-brown px-3 text-cream" onClick={() => void upload(p.file, p.key)}>
                          Retry
                        </button>
                        <button
                          type="button"
                          className="min-h-10 border border-line-strong bg-cream px-3"
                          onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}
                        >
                          Remove
                        </button>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-brown-deep">{p.status === "uploading" ? "Uploading…" : `Preparing ${p.progress}%`}</span>
                      <span className="h-1 w-3/4 bg-line">
                        <span className="block h-full bg-brown transition-all" style={{ width: `${p.status === "uploading" ? 100 : p.progress}%` }} />
                      </span>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
          <li>
            <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-line-strong text-center text-[14px] text-brown hover:bg-cream-raised has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold">
              <span className="text-[28px] leading-none">+</span>
              Add photos
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </li>
        </ul>
        <p className="mt-2 text-[12px] text-muted">First photo is the cover. Drag, or use ↑ ↓, to reorder.</p>
        {err("images")}
        <ImageLightbox images={v.images} index={previewIndex} onIndex={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
      </section>

      {/* 2. Name */}
      <div className={section}>
        <label htmlFor={`${ids}-name`} className={label}>
          Name
        </label>
        <input
          id={`${ids}-name`}
          className="field"
          maxLength={120}
          value={v.name}
          onChange={(e) => setV((p) => ({ ...p, name: e.target.value, slug: p.slugEdited || meta ? p.slug : slugify(e.target.value) }))}
          aria-invalid={fieldErrors.name ? true : undefined}
        />
        {err("name")}
      </div>

      {/* 3. Price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${ids}-price`} className={label}>
            Price (GYD)
          </label>
          <MoneyInput
            id={`${ids}-price`}
            value={v.price}
            onChange={(val) => set("price", val)}
            invalid={!!fieldErrors.price}
            placeholder="Optional"
            aria-describedby={`${ids}-price-hint`}
          />
          {err("price") ?? (
            <p id={`${ids}-price-hint`} className="mt-1.5 text-[13px] text-muted">
              {price == null ? "Blank shows “Price on request” — customers ask on WhatsApp" : "Shown to customers"}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${ids}-was`} className={label}>
            Was price
          </label>
          <MoneyInput id={`${ids}-was`} value={v.compareAtPrice} onChange={(val) => set("compareAtPrice", val)} invalid={compareWarning || compareNeedsPrice} placeholder="Optional" />
          {compareNeedsPrice ? (
            <p className="mt-1.5 text-[13px] text-error">Add a price to show a Was price</p>
          ) : compareWarning ? (
            <p className="mt-1.5 text-[13px] text-error">Was price must be higher to show as Sale</p>
          ) : compareAt != null && price != null ? (
            <p className="mt-1.5 text-[13px] text-[#2F5320]">Shows as Sale</p>
          ) : null}
        </div>
      </div>

      {/* 4. Category */}
      <div>
        <span id={`${ids}-cat`} className={label}>
          Category
        </span>
        <CategoryPicker labelledBy={`${ids}-cat`} options={categories} value={v.categoryId} onChange={(id) => set("categoryId", id)} />
        {err("categoryId")}
      </div>

      {/* 5. Note & description */}
      <div className={section}>
        <label htmlFor={`${ids}-note`} className={label}>
          Short note
        </label>
        <input
          id={`${ids}-note`}
          className="field"
          maxLength={120}
          placeholder="e.g. Woven jute · 38cm"
          value={v.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={`${ids}-desc`} className={label}>
          Description
        </label>
        <textarea id={`${ids}-desc`} className="field min-h-[120px]" value={v.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      {/* 6. Availability */}
      <fieldset className="border-y border-line py-3">
        <legend className="sr-only">Availability</legend>
        <div className="grid grid-cols-3 gap-1 bg-sand p-1" role="radiogroup" aria-label="Availability">
          {AVAILABILITIES.map((a) => {
            const active = v.availability === a.value;
            return (
              <button
                key={a.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("availability", a.value)}
                className={`min-h-11 px-2 text-[14px] font-medium transition-colors ${
                  active ? "bg-cream-raised text-brown-deep shadow" : "text-ink-soft hover:text-brown"
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {v.availability === "available"
            ? "Customers can add it to their bag."
            : v.availability === "coming_soon"
              ? "Shown with a Coming soon badge. Customers can pre-order."
              : "Switch to Sold out after it sells in the showroom."}
        </p>
      </fieldset>

      {/* 7. Accordions */}
      <div className="space-y-5">
        {(
          [
            ["detailsText", "Details", defaults.details],
            ["careText", "Care", defaults.care],
            ["deliveryText", "Delivery & collection", defaults.delivery],
          ] as const
        ).map(([key, title, def]) => (
          <div key={key}>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor={`${ids}-${key}`} className="text-[13px] font-medium tracking-[0.08em] text-ink-soft uppercase">
                {title}
              </label>
              {v[key] !== def && (
                <button type="button" className="min-h-9 text-[13px] text-brown underline-offset-4 hover:underline" onClick={() => set(key, def)}>
                  Reset to default
                </button>
              )}
            </div>
            <textarea id={`${ids}-${key}`} className="field min-h-[96px]" value={v[key]} onChange={(e) => set(key, e.target.value)} />
            <p className="mt-1 text-[12px] text-muted">Leave empty to hide this section on the product page.</p>
          </div>
        ))}
      </div>

      {/* 8. Style it with */}
      <RelatedPicker productId={productId} value={v.related} onChange={(r) => set("related", r)} labelClass={label} />

      {/* 9. Advanced */}
      <details className="border-t border-line pt-4">
        <summary className="min-h-11 cursor-pointer text-[14px] font-medium text-brown-deep">Advanced</summary>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor={`${ids}-slug`} className={label}>
              Web address
            </label>
            <div className="flex items-center">
              <span className="pr-2 text-[14px] text-muted">/products/</span>
              <input
                id={`${ids}-slug`}
                className="field"
                value={v.slug}
                onChange={(e) => setV((p) => ({ ...p, slug: slugify(e.target.value) || e.target.value.toLowerCase(), slugEdited: true }))}
                aria-invalid={fieldErrors.slug ? true : undefined}
              />
            </div>
            <p className="mt-1 text-[12px] text-muted">Changing this keeps old links working.</p>
            {err("slug")}
          </div>
          <div>
            <label htmlFor={`${ids}-rank`} className={label}>
              Featured rank
            </label>
            <input
              id={`${ids}-rank`}
              className="field max-w-[160px]"
              inputMode="numeric"
              placeholder="e.g. 1"
              value={v.featuredRank}
              onChange={(e) => set("featuredRank", e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <p className="mt-1 text-[12px] text-muted">Lower numbers show first under “Featured”. Leave empty for newest-first.</p>
          </div>
        </div>
      </details>

      {savedMeta && (
        <p className="text-[13px] text-muted" suppressHydrationWarning>
          Last edited {relativeTime(savedMeta.updatedAt)}
        </p>
      )}

      {/* Secondary actions */}
      {meta && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-5">
          <button type="button" className="btn btn-outline min-h-11 px-4" disabled={!!saving} onClick={() => void save(status === "published" ? "keep" : "draft", { then: "another" })}>
            Save &amp; add another
          </button>
          <button type="button" className="btn btn-outline min-h-11 px-4" disabled={!!saving} onClick={() => void duplicate()}>
            Duplicate
          </button>
          {status === "published" && (
            <button type="button" className="btn btn-outline min-h-11 px-4" disabled={!!saving} onClick={() => void save("draft")}>
              Unpublish
            </button>
          )}
          {status === "archived" ? (
            <button type="button" className="btn btn-outline min-h-11 px-4" disabled={!!saving} onClick={() => void changeStatus("draft")}>
              Restore as draft
            </button>
          ) : (
            <button
              type="button"
              className="btn min-h-11 border border-error px-4 text-error"
              disabled={!!saving}
              onClick={() => {
                if (window.confirm("Archive this product? It will be hidden everywhere but can be restored.")) void changeStatus("archived");
              }}
            >
              Archive
            </button>
          )}
          {status === "published" && savedMeta && (
            <Link href={`/products/${savedMeta.slug}`} target="_blank" className="btn min-h-11 px-4 text-brown">
              View on site ↗
            </Link>
          )}
        </div>
      )}
      {!meta && (
        <div className="border-t border-line pt-5">
          <button type="button" className="btn btn-outline min-h-11 px-4" disabled={!!saving} onClick={() => void save("draft", { then: "another" })}>
            Save &amp; add another
          </button>
        </div>
      )}

      {/* Primary action bar: sits above the mobile tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-cream-raised/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-60">
        {error && (
          <div role="alert" className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center justify-between gap-2 text-[14px] text-error">
            <span>{error.message}</span>
            {error.conflict && (
              <span className="flex gap-2">
                <button type="button" className="min-h-10 border border-brown px-3 text-brown" onClick={() => window.location.reload()}>
                  Reload
                </button>
                <button type="button" className="min-h-10 bg-brown px-3 text-cream" onClick={() => void save(status === "published" ? "keep" : "draft", { force: true })}>
                  Overwrite
                </button>
              </span>
            )}
            {error.retry && (
              <button type="button" className="min-h-10 bg-brown px-3 text-cream" onClick={error.retry}>
                Retry
              </button>
            )}
          </div>
        )}
        <div className="mx-auto flex max-w-3xl gap-2">
          {status === "published" ? (
            <button type="submit" className="btn btn-primary flex-1" disabled={!!saving || uploading}>
              {saving === "keep" ? "Saving…" : "Save changes"}
            </button>
          ) : (
            <>
              <button type="submit" className="btn btn-outline flex-1" disabled={!!saving || uploading}>
                {saving === "draft" ? "Saving…" : "Save draft"}
              </button>
              <button type="button" className="btn btn-primary flex-1" disabled={!!saving || uploading} onClick={() => void save("publish")}>
                {saving === "publish" ? "Publishing…" : "Publish"}
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  placeholder,
  "aria-describedby": describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
  "aria-describedby"?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">$</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className="field pl-7"
        placeholder={placeholder}
        value={value}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          const n = parseMoney(e.target.value);
          onChange(n == null ? "" : formatNumber(Math.min(n, 99_999_999)));
        }}
      />
    </div>
  );
}

function CategoryPicker({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: CategoryOption[];
  value: string | null;
  onChange: (id: string) => void;
  labelledBy: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const listId = useId();
  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [q, options]);

  return (
    <div>
      <button
        type="button"
        aria-labelledby={labelledBy}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="field flex items-center justify-between text-left"
      >
        <span className={selected ? "" : "text-muted"}>{selected?.label ?? "Choose a category"}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="mt-1 border border-line-strong bg-cream-raised">
          <input
            autoFocus
            type="search"
            aria-label="Search categories"
            placeholder="Search categories"
            className="w-full border-b border-line bg-transparent px-3 py-3 text-[16px] focus:outline-none"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul id={listId} role="listbox" aria-labelledby={labelledBy} className="max-h-72 overflow-y-auto">
            {filtered.map((o) => (
              <li key={o.id} role="option" aria-selected={o.id === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex min-h-11 w-full items-center px-3 text-left text-[14px] hover:bg-sand ${o.id === value ? "font-medium text-brown" : ""}`}
                >
                  {o.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-3 text-[14px] text-muted">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function RelatedPicker({
  productId,
  value,
  onChange,
  labelClass,
}: {
  productId: string;
  value: RelatedItem[];
  onChange: (v: RelatedItem[]) => void;
  labelClass: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RelatedItem[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const full = value.length >= 4;

  function search(term: string) {
    window.clearTimeout(timer.current);
    if (!term.trim()) return setResults([]);
    timer.current = window.setTimeout(async () => {
      const res = await searchProductsForRelated(term, productId).catch(() => []);
      setResults(res.map((r) => ({ id: r.id, name: r.name, imagePath: r.imagePath })));
    }, 250);
  }

  return (
    <section className="border-t border-line pt-6">
      <h2 className={labelClass}>Style it with</h2>
      <p className="-mt-1 mb-3 text-[13px] text-muted">Pick up to 4. Empty spots are filled from the same category.</p>
      {value.length > 0 && (
        <ul className="mb-3 divide-y divide-line border-y border-line">
          {value.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <div className="relative aspect-[4/5] w-10 shrink-0 overflow-hidden bg-sand-image">
                {r.imagePath && <PoshImage path={r.imagePath} alt="" fill sizes="40px" className="object-cover" />}
              </div>
              <span className="flex-1 text-[14px]">{r.name}</span>
              <button type="button" className="min-h-11 px-3 text-[13px] text-error" onClick={() => onChange(value.filter((x) => x.id !== r.id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="search"
        className="field"
        aria-label="Search products to pair"
        placeholder={full ? "4 of 4 picked" : "Search products to add"}
        disabled={full}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          search(e.target.value);
        }}
      />
      {!full && results.length > 0 && (
        <ul className="mt-1 max-h-64 overflow-y-auto border border-line-strong bg-cream-raised">
          {results
            .filter((r) => !value.some((x) => x.id === r.id))
            .map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-[14px] hover:bg-sand"
                  onClick={() => {
                    onChange([...value, r].slice(0, 4));
                    setQ("");
                    setResults([]);
                  }}
                >
                  + {r.name}
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
