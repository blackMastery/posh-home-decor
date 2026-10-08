"use client";

import { useEffect } from "react";
import { storageUrl, type Bucket } from "@/lib/images";
import { useDialog } from "@/components/ui/use-dialog";
import { ChevronLeft, ChevronRight, CloseIcon } from "@/components/ui/icons";

export type LightboxImage = { storagePath: string; alt: string; width: number | null; height: number | null };

/** Full-size, uncropped photo preview. Arrow keys / buttons step through the set. */
export function ImageLightbox({
  images,
  index,
  onIndex,
  onClose,
  bucket = "product-images",
  showCover = true,
}: {
  bucket?: Bucket;
  /** Label the first photo as the product cover. */
  showCover?: boolean;
  images: LightboxImage[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const open = index !== null && images[index] != null;
  const ref = useDialog<HTMLDivElement>(open, onClose);
  const count = images.length;

  useEffect(() => {
    if (!open || count < 2) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") onIndex((index! - 1 + count) % count);
      if (e.key === "ArrowRight") onIndex((index! + 1) % count);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, index, count, onIndex]);

  if (!open) return null;
  const img = images[index];
  const url = storageUrl(img.storagePath, bucket);
  const nav = "absolute top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-cream/90 text-brown-deep hover:bg-cream";

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${count}`}
      className="fixed inset-0 z-50 flex flex-col bg-ink/90"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-cream">
        <span>
          {index + 1} / {count}
          {img.width && img.height ? ` · ${img.width} × ${img.height}px` : ""}
          {showCover && index === 0 ? " · Cover" : ""}
        </span>
        <div className="flex items-center gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center px-3 underline-offset-4 hover:underline">
            Open original
          </a>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-cream/10"
          >
            <CloseIcon size={22} />
          </button>
        </div>
      </div>
      <div
        className="relative min-h-0 flex-1 px-4 pb-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={img.alt} className="mx-auto h-full w-full object-contain" />
        {count > 1 && (
          <>
            <button type="button" onClick={() => onIndex((index - 1 + count) % count)} aria-label="Previous photo" className={`${nav} left-6`}>
              <ChevronLeft size={22} />
            </button>
            <button type="button" onClick={() => onIndex((index + 1) % count)} aria-label="Next photo" className={`${nav} right-6`}>
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
