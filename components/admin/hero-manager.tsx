"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderSlides, setSlideVisible, sweepOrphanUploads } from "@/app/admin/actions/hero";
import { PoshImage } from "@/components/ui/posh-image";
import { formatDateTime } from "@/lib/format/time";
import { MAX_LIVE_SLIDES, STATUS_LABEL, ctr, slideStatuses, type AdminHeroSlide, type HeroStatus } from "@/lib/hero";

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string; retry: () => void };

const BADGE: Record<HeroStatus, string> = {
  live: "bg-[#3E7B2A] text-cream",
  scheduled: "bg-gold text-brown-deep",
  expired: "bg-line-strong text-ink-soft",
  draft: "bg-ink/80 text-cream",
  "over-limit": "bg-terracotta text-cream",
  broken: "bg-error text-cream",
};

export function HeroManager({ initial }: { initial: AdminHeroSlide[] }) {
  const [slides, setSlides] = useState(initial);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const savedTimer = useRef<number | undefined>(undefined);
  // Status is relative to page load; reload to refresh.
  const [now] = useState(() => Date.now());
  const statuses = useMemo(() => slideStatuses(slides, now), [slides, now]);
  const liveCount = statuses.filter((s) => s === "live").length;
  const overLimit = statuses.filter((s) => s === "over-limit").length;
  const broken = statuses.filter((s) => s === "broken").length;

  // Background tidy-up of abandoned uploads; failures are harmless.
  useEffect(() => {
    void sweepOrphanUploads().catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      setSave({ kind: "error", message: res.error ?? "Couldn't save", retry: () => void persist(apply, fn, rollback) });
    }
  }

  // Apply/rollback are functional and touch only their own change, so overlapping
  // saves (toggle one slide while a drag is saving) can't undo each other.
  const setVisible = (id: string, isVisible: boolean) =>
    setSlides((list) => list.map((s) => (s.id === id ? { ...s, isVisible } : s)));
  const applyOrder = (ids: string[]) =>
    setSlides((list) => {
      const rank = new Map(ids.map((id, i) => [id, i]));
      return [...list].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    });

  function toggle(id: string) {
    const target = slides.find((s) => s.id === id);
    if (!target) return;
    const isVisible = !target.isVisible;
    void persist(
      () => setVisible(id, isVisible),
      () => setSlideVisible(id, isVisible),
      () => setVisible(id, !isVisible),
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const beforeIds = slides.map((s) => s.id);
    const nextIds = arrayMove(beforeIds, beforeIds.indexOf(String(active.id)), beforeIds.indexOf(String(over.id)));
    void persist(
      () => applyOrder(nextIds),
      () => reorderSlides(nextIds),
      () => applyOrder(beforeIds),
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-medium text-brown-deep">Home hero</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {liveCount} of {MAX_LIVE_SLIDES} live · shown on the{" "}
            <a href="/" target="_blank" className="text-brown underline-offset-4 hover:underline">
              home page ↗
            </a>
          </p>
        </div>
        <SaveIndicator state={save} />
      </div>

      <Link href="/admin/hero/new" className="btn btn-primary mt-5 w-full sm:w-auto">
        + New slide
      </Link>

      {liveCount === 0 && slides.length > 0 && (
        <p className="mt-4 border border-line bg-sand px-4 py-3 text-[14px] text-ink-soft">
          No slides are live, so the home page shows the standard collage hero.
        </p>
      )}
      {overLimit > 0 && (
        <p className="mt-4 border border-terracotta/50 bg-terracotta/10 px-4 py-3 text-[14px] text-brown-deep">
          Only the first {MAX_LIVE_SLIDES} live slides are shown. Drag the ones you want higher, or hide some.
        </p>
      )}
      {broken > 0 && (
        <p className="mt-4 border border-error/40 bg-error/10 px-4 py-3 text-[14px] text-brown-deep">
          {broken} slide{broken === 1 ? " links" : "s link"} to a product or category customers can&apos;t see, so{" "}
          {broken === 1 ? "it's" : "they're"} hidden from the site. Edit the link or publish the product.
        </p>
      )}

      {slides.length === 0 ? (
        <p className="mt-6 bg-sand px-4 py-12 text-center text-[15px] text-ink-soft">
          No slides yet. The home page shows the standard collage hero until you add and switch one on.
        </p>
      ) : (
        <>
          <p className="mt-5 text-[13px] text-muted">Hold ⠿ and drag to reorder. Views and clicks cover the last 7 / 30 days.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {slides.map((s, i) => (
                  <SortableRow key={s.id} slide={s} index={i} status={statuses[i]} onToggle={() => toggle(s.id)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}
    </>
  );
}

function schedule(s: AdminHeroSlide) {
  if (!s.startsAtIso && !s.endsAtIso) return "Always on";
  if (s.startsAtIso && s.endsAtIso) return `${formatDateTime(s.startsAtIso)} → ${formatDateTime(s.endsAtIso)}`;
  if (s.startsAtIso) return `From ${formatDateTime(s.startsAtIso)}`;
  return `Until ${formatDateTime(s.endsAtIso!)}`;
}

function SortableRow({
  slide: s,
  index,
  status,
  onToggle,
}: {
  slide: AdminHeroSlide;
  index: number;
  status: HeroStatus;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 bg-cream py-3 sm:gap-3 ${isDragging ? "relative z-10 opacity-90 shadow-xl" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${s.internalName}. Press space to pick up, arrows to move.`}
        className="inline-flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-[20px] text-ink-soft active:cursor-grabbing"
      >
        ⠿
      </button>
      <Link href={`/admin/hero/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden bg-sand-image sm:w-16">
          <PoshImage
            path={s.mobileImagePath}
            bucket="site"
            alt=""
            fill
            sizes="64px"
            className={`object-cover ${status === "live" ? "" : "opacity-60"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[15px] font-medium text-brown-deep">
              {index + 1}. {s.internalName}
            </span>
            <span className={`px-1.5 py-0.5 text-[11px] font-medium ${BADGE[status]}`}>{STATUS_LABEL[status]}</span>
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {s.kind === "artwork" ? "Artwork" : "Photo + text"} · {schedule(s)}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-soft tabular-nums">
            {s.stats.views7} views · {s.stats.clicks7} clicks · {ctr(s.stats.views7, s.stats.clicks7)}
            <span className="text-muted"> / 30d {s.stats.views30} · {s.stats.clicks30} · {ctr(s.stats.views30, s.stats.clicks30)}</span>
          </p>
        </div>
      </Link>
      <button
        type="button"
        role="switch"
        aria-checked={s.isVisible}
        aria-label={`Show ${s.internalName} on the site`}
        onClick={onToggle}
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          s.isVisible ? "bg-brown text-cream" : "bg-sand text-ink-soft"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {!s.isVisible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </li>
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
