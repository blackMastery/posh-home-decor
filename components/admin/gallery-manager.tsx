"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { addPhoto, deletePhoto, reorderPhotos, setPhotoProducts, updatePhoto } from "@/app/admin/actions/gallery";
import { createClient } from "@/lib/supabase/browser";
import type { AdminGalleryPhoto } from "@/lib/gallery";
import { PoshImage } from "@/components/ui/posh-image";
import { prepareImage } from "./image-prep";
import { ImageLightbox } from "./image-lightbox";
import { GalleryPhotoSheet, type PhotoPatch } from "./gallery-photo-sheet";

type Pending = { key: string; file: File; preview: string; status: "waiting" | "processing" | "uploading" | "error"; error?: string };
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string; retry: () => void };

export function GalleryManager({ initial }: { initial: AdminGalleryPhoto[] }) {
  const [photos, setPhotos] = useState(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const savedTimer = useRef<number | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const sensors = useSensors(
    // Drag starts only from the handle, which has touch-action: none, so a short move is enough.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const hiddenCount = photos.filter((p) => !p.isVisible).length;
  const open = photos.find((p) => p.id === openId) ?? null;

  /** Apply locally, save, show progress, and roll back if it fails. Retry re-applies. */
  async function persist(apply: () => void, fn: () => Promise<{ ok: boolean; error?: string }>, rollback: () => void) {
    apply();
    window.clearTimeout(savedTimer.current);
    setSave({ kind: "saving" });
    const res = await fn().catch(() => ({ ok: false, error: "Check your connection" }));
    if (res.ok) {
      setSave({ kind: "saved" });
      savedTimer.current = window.setTimeout(() => setSave({ kind: "idle" }), 1800);
    } else {
      rollback();
      setSave({
        kind: "error",
        message: res.error ?? "Couldn't save",
        retry: () => void persist(apply, fn, rollback),
      });
    }
  }

  function patchLocal(id: string, patch: Partial<AdminGalleryPhoto>) {
    setPhotos((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function updateDetails(id: string, patch: PhotoPatch) {
    const before = photos.find((p) => p.id === id);
    if (!before) return;
    if (patch.products) {
      const products = patch.products;
      void persist(
        () => patchLocal(id, { products }),
        () => setPhotoProducts(id, products.map((x) => x.id)),
        () => patchLocal(id, { products: before.products }),
      );
      return;
    }
    const { caption, alt, isVisible } = patch;
    void persist(
      () => patchLocal(id, patch),
      () => updatePhoto(id, { caption, alt, isVisible }),
      () => patchLocal(id, { caption: before.caption, alt: before.alt, isVisible: before.isVisible }),
    );
  }

  function remove(id: string) {
    const before = photos;
    setOpenId(null);
    void persist(
      () => setPhotos((list) => list.filter((p) => p.id !== id)),
      () => deletePhoto(id),
      () => setPhotos(before),
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const before = photos;
    const next = arrayMove(
      photos,
      photos.findIndex((p) => p.id === active.id),
      photos.findIndex((p) => p.id === over.id),
    );
    void persist(
      () => setPhotos(next),
      () => reorderPhotos(next.map((p) => p.id)),
      () => setPhotos(before),
    );
  }

  // --- Uploads (one at a time, so phones on mobile data aren't swamped) ------
  async function upload(item: Pending) {
    const setItem = (patch: Partial<Pending>) =>
      setPending((list) => list.map((x) => (x.key === item.key ? { ...x, ...patch } : x)));
    try {
      setItem({ status: "processing", error: undefined });
      const prepared = await prepareImage(item.file, () => {});
      setItem({ status: "uploading" });
      const path = `gallery/${crypto.randomUUID()}.jpg`;
      const storage = createClient().storage.from("site");
      const { error: upError } = await storage.upload(path, prepared.blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (upError) throw new Error("Upload failed — check your connection");
      const res = await addPhoto({ storagePath: path, width: prepared.width, height: prepared.height });
      if (!res.ok) {
        await storage.remove([path]);
        throw new Error(res.error);
      }
      URL.revokeObjectURL(item.preview);
      setPending((list) => list.filter((x) => x.key !== item.key));
      setPhotos((list) => [...list, res.photo]);
    } catch (e) {
      setItem({ status: "error", error: e instanceof Error ? e.message : "Couldn't read this photo" });
    }
  }

  function enqueue(item: Pending) {
    // Mark queued right away so a second Retry tap can't upload it twice.
    setPending((list) => list.map((x) => (x.key === item.key ? { ...x, status: "waiting", error: undefined } : x)));
    queue.current = queue.current.then(() => upload(item));
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const items: Pending[] = Array.from(files).map((file) => ({
      key: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: "waiting",
    }));
    setPending((list) => [...list, ...items]);
    items.forEach(enqueue);
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-medium text-brown-deep">Gallery</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {photos.length} photo{photos.length === 1 ? "" : "s"} · shown on{" "}
            <a href="/gallery" target="_blank" className="text-brown underline-offset-4 hover:underline">
              /gallery ↗
            </a>
          </p>
        </div>
        <SaveIndicator state={save} />
      </div>

      <label className="btn btn-primary mt-5 w-full cursor-pointer sm:w-auto">
        + Add photos
        <input
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {hiddenCount > 0 && (
        <p className="mt-4 border border-gold/60 bg-gold/15 px-4 py-3 text-[14px] text-brown-deep">
          {hiddenCount} hidden photo{hiddenCount === 1 ? "" : "s"} — tap a photo to add a caption, then switch it on to show it on the site.
        </p>
      )}

      {photos.length === 0 && pending.length === 0 ? (
        <p className="mt-6 bg-sand px-4 py-12 text-center text-[15px] text-ink-soft">
          No photos yet. Add showroom and styled-room photos to build the gallery.
        </p>
      ) : (
        <>
          <p className="mt-5 text-[13px] text-muted">Hold ⠿ and drag to reorder. Tap a photo to edit.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((p, i) => (
                  <SortableTile
                    key={p.id}
                    photo={p}
                    index={i}
                    onOpen={() => setOpenId(p.id)}
                    onToggle={() => updateDetails(p.id, { isVisible: !p.isVisible })}
                  />
                ))}
                {pending.map((p) => (
                  <li key={p.key} className="relative aspect-square overflow-hidden bg-sand-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt="" className="h-full w-full object-cover opacity-50" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-[13px] text-brown-deep">
                      {p.status === "error" ? (
                        <>
                          <span className="text-error">{p.error}</span>
                          <span className="flex gap-2">
                            <button type="button" className="min-h-10 bg-brown px-3 text-cream" onClick={() => enqueue(p)}>
                              Retry
                            </button>
                            <button
                              type="button"
                              className="min-h-10 border border-line-strong bg-cream px-3"
                              onClick={() => {
                                URL.revokeObjectURL(p.preview);
                                setPending((list) => list.filter((x) => x.key !== p.key));
                              }}
                            >
                              Remove
                            </button>
                          </span>
                        </>
                      ) : (
                        <span className="bg-cream/90 px-2 py-1">
                          {p.status === "waiting" ? "Waiting…" : p.status === "processing" ? "Preparing…" : "Uploading…"}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      {open && (
        <GalleryPhotoSheet
          key={open.id}
          photo={open}
          onChange={(patch) => updateDetails(open.id, patch)}
          onDelete={() => remove(open.id)}
          onClose={() => setOpenId(null)}
          onPreview={() => setPreviewIndex(photos.findIndex((p) => p.id === open.id))}
        />
      )}
      <ImageLightbox
        bucket="site"
        showCover={false}
        images={photos.map((p) => ({ storagePath: p.storagePath, alt: p.alt, width: p.width, height: p.height }))}
        index={previewIndex}
        onIndex={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
      />
    </>
  );
}

function SortableTile({
  photo,
  index,
  onOpen,
  onToggle,
}: {
  photo: AdminGalleryPhoto;
  index: number;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const unpublished = photo.products.filter((p) => p.status !== "published").length;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? "z-10 opacity-80 shadow-xl" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Edit photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ""}`}
        className="relative block aspect-square w-full overflow-hidden bg-sand-image"
      >
        <PoshImage
          path={photo.storagePath}
          bucket="site"
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className={`object-cover ${photo.isVisible ? "" : "opacity-50 grayscale"}`}
        />
        {!photo.isVisible && (
          <span className="absolute bottom-2 left-2 bg-ink/80 px-2 py-0.5 text-[11px] font-medium text-cream">Hidden</span>
        )}
        {photo.products.length > 0 && (
          <span className="absolute right-2 bottom-2 bg-cream/90 px-2 py-0.5 text-[11px] text-brown-deep">
            {photo.products.length} product{photo.products.length === 1 ? "" : "s"}
            {unpublished > 0 && " ⚠"}
          </span>
        )}
      </button>
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder photo ${index + 1}. Press space to pick up, arrows to move.`}
        className="absolute top-1.5 left-1.5 inline-flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-full bg-cream/90 text-[20px] leading-none text-brown-deep shadow active:cursor-grabbing"
      >
        ⠿
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={photo.isVisible}
        aria-label={`Show photo ${index + 1} on the site`}
        onClick={onToggle}
        className={`absolute top-1.5 right-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full shadow ${
          photo.isVisible ? "bg-brown text-cream" : "bg-cream/90 text-ink-soft"
        }`}
      >
        <EyeIcon off={!photo.isVisible} />
      </button>
      {photo.caption && <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-soft">{photo.caption}</p>}
    </li>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <div aria-live="polite" className="min-h-11 text-right text-[13px]">
      {state.kind === "saving" && <span className="text-muted">Saving…</span>}
      {state.kind === "saved" && <span className="text-[#2F5320]">✓ Saved</span>}
      {state.kind === "error" && (
        <span className="text-error">
          {state.message}{" "}
          <button type="button" onClick={state.retry} className="min-h-11 font-medium underline">
            Retry
          </button>
        </span>
      )}
    </div>
  );
}
