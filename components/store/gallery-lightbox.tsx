"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "@/lib/data/gallery";
import { PoshImage } from "@/components/ui/posh-image";
import { ChevronLeft, ChevronRight, CloseIcon, WhatsAppIcon } from "@/components/ui/icons";
import { useDialog } from "@/components/ui/use-dialog";
import { lookQuestionMessage, waUrl } from "@/lib/whatsapp/message";
import { track } from "@/lib/analytics";
import { SITE_URL } from "@/lib/env";
import { Price, ProductBadge } from "./price";
import { useStore } from "./store-provider";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

function photoUrl(id: string) {
  // SITE_URL, not window.location: the lightbox also renders on the server for ?photo= deep links.
  return `${SITE_URL}/gallery?photo=${id}`;
}

/** Full-screen viewer: swipe between photos, pinch or double-tap to zoom, shop the look. */
export function GalleryLightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: GalleryPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useDialog<HTMLDivElement>(true, onClose);
  const track_ = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const [copied, setCopied] = useState(false);
  const count = photos.length;
  const photo = photos[index];

  // Jump straight to the opening photo (no smooth scroll on open).
  useLayoutEffect(() => {
    const el = track_.current;
    if (el) el.scrollLeft = el.clientWidth * index;
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (i: number) => {
    const next = (i + count) % count;
    const el = track_.current;
    if (el) el.scrollTo({ left: el.clientWidth * next, behavior: "smooth" });
    setZoomed(false);
    onIndex(next);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goTo(index - 1);
      if (e.key === "ArrowRight") goTo(index + 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function share() {
    const url = photoUrl(photo.id);
    track("gallery_share", { photo: photo.id });
    try {
      if (navigator.share) {
        await navigator.share({ title: photo.caption ?? "Posh Home Decor gallery", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed.
    }
  }

  const round = "inline-flex h-11 w-11 items-center justify-center rounded-full text-cream hover:bg-cream/10";

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Gallery photo" className="fixed inset-0 z-[60] flex flex-col bg-ink text-cream">
      <div className="flex items-center justify-between px-2 pt-[max(8px,env(safe-area-inset-top))] pb-1">
        <span className="px-2 text-[13px] tabular-nums text-cream/80" aria-live="polite">
          {index + 1} / {count}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={share} className={`${round} w-auto px-3 text-[13px]`}>
            {copied ? "Link copied" : <ShareIcon />}
            <span className="sr-only">{copied ? "" : "Share this photo"}</span>
          </button>
          <button type="button" onClick={onClose} className={round} aria-label="Close" data-autofocus>
            <CloseIcon size={24} />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={track_}
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            if (i !== index && i >= 0 && i < count) onIndex(i);
          }}
          className={`no-scrollbar flex h-full snap-x snap-mandatory ${zoomed ? "overflow-x-hidden" : "overflow-x-auto"}`}
          aria-roledescription="carousel"
        >
          {photos.map((p, i) => (
            <div key={p.id} className="relative h-full w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
              {Math.abs(i - index) <= 1 ? (
                <ZoomableImage key={i === index ? `${p.id}-active` : p.id} photo={p} active={i === index} onZoomChange={setZoomed} />
              ) : null}
            </div>
          ))}
        </div>
        {count > 1 && !zoomed && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous photo"
              className="absolute top-1/2 left-3 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-cream/90 text-brown-deep md:inline-flex"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next photo"
              className="absolute top-1/2 right-3 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-cream/90 text-brown-deep md:inline-flex"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      <LookPanel photo={photo} />
    </div>
  );
}

function LookPanel({ photo }: { photo: GalleryPhoto }) {
  const { whatsappNumber, pricePrefix } = useStore();
  return (
    <div className="max-h-[42dvh] shrink-0 overflow-y-auto bg-cream px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] text-ink">
      <div className="mx-auto max-w-3xl">
        {photo.caption && <p className="font-display text-[20px] leading-snug text-brown-deep">{photo.caption}</p>}
        {photo.products.length > 0 && (
          <>
            <p className="eyebrow mt-3 text-bronze">Shop this look</p>
            <ul className="no-scrollbar -mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
              {photo.products.map((p) => (
                <li key={p.id} className="w-[148px] shrink-0">
                  <Link href={`/products/${p.slug}`} className="block">
                    <div className={`relative aspect-[4/5] overflow-hidden bg-sand-image ${p.availability === "sold_out" ? "opacity-70" : ""}`}>
                      {p.image_path && <PoshImage path={p.image_path} alt="" fill sizes="148px" className="object-cover" />}
                      <span className="absolute top-2 left-2">
                        <ProductBadge availability={p.availability} onSale={p.is_on_sale} isNew={false} />
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[14px] leading-tight font-medium text-brown-deep">{p.name}</p>
                    <p className="text-[13px]">
                      <Price price={p.price} compareAt={p.compare_at_price} prefix={pricePrefix} />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <a
          href={waUrl(whatsappNumber, lookQuestionMessage(photoUrl(photo.id)))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("whatsapp_look_question", { photo: photo.id })}
          className="btn btn-outline mt-4 w-full"
        >
          <WhatsAppIcon size={18} className="text-whatsapp" />
          Ask about this look
        </a>
      </div>
    </div>
  );
}

type View = { s: number; x: number; y: number };
const IDENTITY: View = { s: 1, x: 0, y: 0 };

/** Pinch / double-tap / drag-to-pan. At scale 1 horizontal swipes go to the carousel. */
function ZoomableImage({ photo, active, onZoomChange }: { photo: GalleryPhoto; active: boolean; onZoomChange: (z: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(IDENTITY);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; px: number; py: number; from: View } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const moved = useRef(false);

  function clamp(v: View): View {
    const el = box.current;
    const s = Math.min(MAX_SCALE, Math.max(1, v.s));
    if (!el || s === 1) return { s, x: 0, y: 0 };
    const mx = ((s - 1) * el.clientWidth) / 2;
    const my = ((s - 1) * el.clientHeight) / 2;
    return { s, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }

  function apply(v: View) {
    const next = clamp(v);
    setView(next);
    if (active) onZoomChange(next.s > 1);
  }

  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function begin() {
    const pts = [...pointers.current.values()];
    gesture.current = {
      dist: pts.length === 2 ? dist() : 0,
      px: pts[0].x,
      py: pts[0].y,
      from: view,
    };
  }

  return (
    <div
      ref={box}
      className="relative h-full w-full overflow-hidden select-none"
      style={{ touchAction: view.s > 1 ? "none" : "pan-x" }}
      onPointerDown={(e) => {
        if (!active) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        moved.current = false;
        begin();
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gesture.current;
        if (!g) return;
        if (pointers.current.size === 2 && g.dist > 0) {
          moved.current = true;
          apply({ ...g.from, s: g.from.s * (dist() / g.dist) });
        } else if (pointers.current.size === 1 && g.from.s > 1) {
          const dx = e.clientX - g.px;
          const dy = e.clientY - g.py;
          if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
          apply({ ...g.from, x: g.from.x + dx, y: g.from.y + dy });
        } else if (Math.abs(e.clientX - g.px) + Math.abs(e.clientY - g.py) > 8) {
          moved.current = true;
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size > 0) return begin();
        gesture.current = null;
        if (moved.current) return;
        // Double tap toggles zoom around the tapped point.
        const now = Date.now();
        const last = lastTap.current;
        if (last && now - last.t < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
          lastTap.current = null;
          const el = box.current!;
          const r = el.getBoundingClientRect();
          if (view.s > 1) apply(IDENTITY);
          else {
            const s = DOUBLE_TAP_SCALE;
            apply({ s, x: (r.width / 2 - (e.clientX - r.left)) * (s - 1), y: (r.height / 2 - (e.clientY - r.top)) * (s - 1) });
          }
        } else {
          lastTap.current = { t: now, x: e.clientX, y: e.clientY };
        }
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        gesture.current = null;
      }}
    >
      <div
        className="absolute inset-0 transition-transform duration-100 ease-out"
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})` }}
      >
        <PoshImage
          path={photo.storage_path}
          bucket="site"
          alt={photo.alt || photo.caption || ""}
          fill
          sizes="100vw"
          quality={85}
          draggable={false}
          className="object-contain"
        />
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6" />
    </svg>
  );
}
