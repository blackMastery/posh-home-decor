"use client";

import { useId, useRef, useState } from "react";
import { searchProductsForRelated } from "@/app/admin/actions/products";
import { MAX_LOOK_PRODUCTS, type AdminGalleryPhoto, type AdminGalleryProduct } from "@/lib/gallery";
import { PoshImage } from "@/components/ui/posh-image";
import { CloseIcon } from "@/components/ui/icons";
import { useDialog } from "@/components/ui/use-dialog";

export type PhotoPatch = Partial<Pick<AdminGalleryPhoto, "caption" | "alt" | "isVisible" | "products">>;

/** Bottom sheet on phones, side panel on desktop. Every change saves on its own. */
export function GalleryPhotoSheet({
  photo,
  onChange,
  onDelete,
  onClose,
  onPreview,
}: {
  photo: AdminGalleryPhoto;
  onChange: (patch: PhotoPatch) => void;
  onDelete: () => void;
  onClose: () => void;
  onPreview: () => void;
}) {
  const ids = useId();
  const [caption, setCaption] = useState(photo.caption);
  const [alt, setAlt] = useState(photo.alt);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** Save edited text fields. Runs on blur, and on close since Escape skips blur. */
  function commit() {
    const patch: PhotoPatch = {};
    if (caption.trim() !== photo.caption) patch.caption = caption.trim();
    if (alt.trim() !== photo.alt) patch.alt = alt.trim();
    if (Object.keys(patch).length) onChange(patch);
  }
  function close() {
    commit();
    onClose();
  }
  const ref = useDialog<HTMLDivElement>(true, close);
  const label = "mb-1.5 block text-[13px] font-medium text-brown-deep";

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/50 lg:items-stretch lg:justify-end" onClick={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-cream shadow-2xl lg:h-dvh lg:max-h-none lg:w-[420px] lg:rounded-none"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong lg:hidden" />
          <h2 id={`${ids}-title`} className="text-[17px] font-medium text-brown-deep">
            Edit photo
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center">
            <CloseIcon size={22} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onPreview}
            className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-sand-image"
            aria-label="View full size"
          >
            <PoshImage path={photo.storagePath} bucket="site" alt="" fill sizes="420px" className="object-contain" />
            <span className="absolute right-2 bottom-2 bg-ink/70 px-2 py-0.5 text-[11px] text-cream">View full size</span>
          </button>

          <div className="flex items-center justify-between gap-4 border-y border-line py-3">
            <div>
              <p id={`${ids}-vis`} className="text-[15px] font-medium text-brown-deep">
                {photo.isVisible ? "Shown on the site" : "Hidden"}
              </p>
              <p className="text-[13px] text-muted">New photos stay hidden until you switch them on.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={photo.isVisible}
              aria-labelledby={`${ids}-vis`}
              onClick={() => onChange({ isVisible: !photo.isVisible })}
              className="tap inline-flex shrink-0 items-center justify-center"
            >
              <span className={`relative inline-block h-7 w-12 rounded-full transition-colors ${photo.isVisible ? "bg-[#3E7B2A]" : "bg-line-strong"}`}>
                <span
                  className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-cream-raised shadow transition-transform ${photo.isVisible ? "translate-x-5" : ""}`}
                />
              </span>
            </button>
          </div>

          <div>
            <label htmlFor={`${ids}-caption`} className={label}>
              Caption
            </label>
            <textarea
              id={`${ids}-caption`}
              className="field min-h-[72px]"
              maxLength={200}
              placeholder="e.g. Living room styled with brass and velvet"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={commit}
            />
          </div>

          <div>
            <label htmlFor={`${ids}-alt`} className={label}>
              Alt text <span className="font-normal text-muted">(describes the photo for screen readers)</span>
            </label>
            <input
              id={`${ids}-alt`}
              className="field"
              maxLength={200}
              placeholder={caption || "What's in the photo"}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              onBlur={commit}
            />
          </div>

          <ProductPicker value={photo.products} onChange={(products) => onChange({ products })} labelClass={label} />

          <div className="border-t border-line pt-4">
            {confirmDelete ? (
              <div className="flex gap-2">
                <button type="button" className="btn flex-1 bg-error text-cream" onClick={onDelete}>
                  Yes, delete photo
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" className="min-h-11 text-[14px] text-error underline-offset-4 hover:underline" onClick={() => setConfirmDelete(true)}>
                Delete photo…
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductPicker({
  value,
  onChange,
  labelClass,
}: {
  value: AdminGalleryProduct[];
  onChange: (v: AdminGalleryProduct[]) => void;
  labelClass: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminGalleryProduct[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const full = value.length >= MAX_LOOK_PRODUCTS;

  function search(term: string) {
    window.clearTimeout(timer.current);
    if (!term.trim()) return setResults([]);
    timer.current = window.setTimeout(async () => {
      const res = await searchProductsForRelated(term, "").catch(() => []);
      setResults(res.map((r) => ({ id: r.id, name: r.name, imagePath: r.imagePath, status: r.status })));
    }, 250);
  }

  return (
    <section>
      <h3 className={labelClass}>Shop this look</h3>
      <p className="-mt-1 mb-3 text-[13px] text-muted">Products in the photo, shown under it on the site. Up to {MAX_LOOK_PRODUCTS}.</p>
      {value.length > 0 && (
        <ul className="mb-3 divide-y divide-line border-y border-line">
          {value.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <div className="relative aspect-[4/5] w-10 shrink-0 overflow-hidden bg-sand-image">
                {r.imagePath && <PoshImage path={r.imagePath} alt="" fill sizes="40px" className="object-cover" />}
              </div>
              <span className="min-w-0 flex-1 text-[14px]">
                {r.name}
                {r.status !== "published" && (
                  <span className="mt-0.5 block text-[12px] text-error">⚠ Not published — hidden from customers</span>
                )}
              </span>
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
        aria-label="Search products to add to this look"
        placeholder={full ? `${MAX_LOOK_PRODUCTS} of ${MAX_LOOK_PRODUCTS} picked` : "Search products to add"}
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
                    onChange([...value, r].slice(0, MAX_LOOK_PRODUCTS));
                    setQ("");
                    setResults([]);
                  }}
                >
                  + {r.name}
                  {r.status !== "published" && <span className="text-[12px] text-muted">({r.status})</span>}
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
