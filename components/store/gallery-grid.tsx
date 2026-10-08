"use client";

import { useMemo, useState } from "react";
import type { GalleryPhoto } from "@/lib/data/gallery";
import { PoshImage } from "@/components/ui/posh-image";
import { GalleryLightbox } from "./gallery-lightbox";

/** One layout per breakpoint, toggled with CSS so the server render is already correct. */
const LAYOUTS = [
  { cols: 2, className: "flex md:hidden" },
  { cols: 3, className: "hidden md:flex lg:hidden" },
  { cols: 4, className: "hidden lg:flex" },
];

/** Rough extra height (as a fraction of column width) taken by a caption line. */
const CAPTION_HEIGHT = 0.18;

/**
 * Masonry that reads left to right in admin order: each photo goes to the
 * shortest column so far. A photo's column depends only on the photos before
 * it, so "Load more" appends without moving anything already on screen.
 */
function toColumns(photos: GalleryPhoto[], cols: number): number[][] {
  const columns: number[][] = Array.from({ length: cols }, () => []);
  const heights = new Array<number>(cols).fill(0);
  photos.forEach((p, i) => {
    const c = heights.indexOf(Math.min(...heights));
    columns[c].push(i);
    heights[c] += (p.height ?? 1500) / (p.width ?? 1200) + (p.caption ? CAPTION_HEIGHT : 0);
  });
  return columns;
}

/** Keep ?photo= in sync so the open photo can be shared or reloaded. */
function setPhotoParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("photo", id);
  else url.searchParams.delete("photo");
  window.history.replaceState(window.history.state, "", url);
}

export function GalleryGrid({ photos, initialPhotoId }: { photos: GalleryPhoto[]; initialPhotoId: string | null }) {
  const [index, setIndex] = useState<number | null>(() => {
    const i = photos.findIndex((p) => p.id === initialPhotoId);
    return i >= 0 ? i : null;
  });
  const layouts = useMemo(() => LAYOUTS.map((l) => ({ ...l, columns: toColumns(photos, l.cols) })), [photos]);

  const show = (i: number | null) => {
    setIndex(i);
    setPhotoParam(i === null ? null : photos[i].id);
  };

  return (
    <>
      {layouts.map(({ cols, className, columns }) => (
        <div key={cols} className={`${className} items-start gap-3 sm:gap-4`}>
          {columns.map((col, c) => (
            <ul key={c} className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
              {col.map((i) => (
                <GalleryTile key={photos[i].id} photo={photos[i]} index={i} priority={i < cols} onOpen={() => show(i)} />
              ))}
            </ul>
          ))}
        </div>
      ))}
      {index !== null && <GalleryLightbox photos={photos} index={index} onIndex={show} onClose={() => show(null)} />}
    </>
  );
}

function GalleryTile({ photo: p, index, priority, onOpen }: { photo: GalleryPhoto; index: number; priority: boolean; onOpen: () => void }) {
  return (
    <li data-reveal>
      <button
        type="button"
        onClick={onOpen}
        className="group relative block w-full overflow-hidden bg-sand-image text-left"
        aria-label={`Open photo ${index + 1}${p.caption ? `: ${p.caption}` : ""}`}
      >
        <PoshImage
          path={p.storage_path}
          bucket="site"
          alt={p.alt || p.caption || ""}
          width={p.width ?? 1200}
          height={p.height ?? 1500}
          priority={priority}
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="block h-auto w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        {p.products.length > 0 && (
          <span className="absolute bottom-2 left-2 bg-cream/90 px-2 py-1 text-[11px] tracking-[0.12em] text-brown-deep uppercase">
            Shop the look
          </span>
        )}
      </button>
      {p.caption && <p className="mt-2 text-[13px] leading-snug text-ink-soft">{p.caption}</p>}
    </li>
  );
}
