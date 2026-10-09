"use client";

import { useRef, useState } from "react";
import { PoshImage } from "@/components/ui/posh-image";
import { HeartIcon } from "@/components/ui/icons";
import { savedStore, toggleSaved } from "@/lib/bag/stores";
import { useStore } from "./store-provider";

type Img = { id: string; storage_path: string; alt: string | null };

export function ProductGallery({
  images,
  name,
  productId,
  soldOut,
}: {
  images: Img[];
  name: string;
  productId: string;
  soldOut: boolean;
}) {
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const goTo = (i: number) => {
    setIndex(i);
    const el = scroller.current;
    if (el) el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row md:gap-4">
      {images.length > 1 && (
        // From md the strip sits beside the image: the absolute list adds no height, so it scrolls within the image's height.
        <div className="relative -mx-[3px] md:mx-0 md:w-[84px] md:shrink-0">
          {/* Padding leaves room for the active ring, which the scroll container would otherwise clip. */}
          <ul className="no-scrollbar flex gap-3 overflow-x-auto p-[3px] md:absolute md:inset-0 md:flex-col md:overflow-x-hidden md:overflow-y-auto" aria-label="Choose image">
            {images.map((img, i) => (
              <li key={img.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Show image ${i + 1} of ${images.length}`}
                  aria-current={i === index ? "true" : undefined}
                  className={`relative block aspect-[4/5] w-[68px] overflow-hidden bg-sand-image md:w-full ${
                    i === index ? "ring-1 ring-brown ring-offset-2 ring-offset-cream" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  <PoshImage path={img.storage_path} alt="" fill sizes="84px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="relative min-w-0 flex-1">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            if (i !== index) setIndex(i);
          }}
          className={`no-scrollbar flex snap-x snap-mandatory overflow-x-auto bg-sand-image ${soldOut ? "opacity-80" : ""}`}
          aria-roledescription="carousel"
          aria-label={`${name} images`}
        >
          {(images.length ? images : [null]).map((img, i) => (
            <div
              key={img?.id ?? "empty"}
              className="relative aspect-[4/5] w-full shrink-0 snap-center"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${Math.max(images.length, 1)}`}
            >
              {img && (
                <PoshImage
                  path={img.storage_path}
                  alt={img.alt || name}
                  fill
                  priority={i === 0}
                  sizes="(max-width: 860px) 100vw, 55vw"
                  className="object-contain"
                />
              )}
            </div>
          ))}
        </div>
        <SaveButton productId={productId} name={name} />
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5 md:hidden" aria-hidden>
            {images.map((img, i) => (
              <span key={img.id} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-brown" : "bg-cream/80"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveButton({ productId, name }: { productId: string; name: string }) {
  const saved = savedStore.useValue().includes(productId);
  const { toast } = useStore();
  return (
    <button
      type="button"
      onClick={() => {
        const nowSaved = toggleSaved(productId);
        toast(nowSaved ? "Saved to your wishlist" : "Removed from wishlist", nowSaved ? { label: "View", href: "/saved" } : undefined);
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      className="tap absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-cream-raised/95 text-brown shadow-sm hover:bg-cream-raised"
    >
      <HeartIcon size={20} filled={saved} />
    </button>
  );
}
