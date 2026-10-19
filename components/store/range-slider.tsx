"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Bounds, Range } from "@/lib/catalog/types";

type Props = {
  label: string;
  bounds: Bounds;
  value: Range | null;
  step?: number;
  /** Display a value (e.g. "$12,500", "38 cm"). */
  format: (n: number) => string;
  /** Unit shown beside the number inputs. */
  unit?: string;
  /** Called (debounced) with the new range; null when it spans the full bounds. */
  onChange: (range: Range | null) => void;
  debounceMs?: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Dual-thumb slider with min/max number inputs. Keyboard accessible (two native range inputs). */
export function RangeSlider({ label, bounds, value, step = 1, format, unit, onChange, debounceMs = 400 }: Props) {
  const id = useId();
  // A selection outside the current bounds (other filters narrowed them) widens the track.
  const lo = Math.min(bounds.min, value?.min ?? bounds.min);
  const hi = Math.max(bounds.max, value?.max ?? bounds.max);
  const [min, setMin] = useState(value?.min ?? lo);
  const [max, setMax] = useState(value?.max ?? hi);
  const [synced, setSynced] = useState({ value, lo, hi });
  const timer = useRef<number | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Follow external changes: Clear all, back button, or bounds narrowed by other filters.
  if (value?.min !== synced.value?.min || value?.max !== synced.value?.max || lo !== synced.lo || hi !== synced.hi) {
    setSynced({ value, lo, hi });
    setMin(value?.min ?? lo);
    setMax(value?.max ?? hi);
  }

  const commit = (nextMin: number, nextMax: number, immediate = false) => {
    window.clearTimeout(timer.current);
    const run = () => {
      const range: Range = { min: nextMin <= bounds.min ? null : nextMin, max: nextMax >= bounds.max ? null : nextMax };
      onChangeRef.current(range.min === null && range.max === null ? null : range);
    };
    if (immediate) run();
    else timer.current = window.setTimeout(run, debounceMs);
  };

  const span = hi - lo || 1;
  const left = ((min - lo) / span) * 100;
  const right = ((max - lo) / span) * 100;

  const setFromInput = (which: "min" | "max", raw: string) => {
    const n = Number(raw.replace(/[^\d.]/g, ""));
    if (raw.trim() === "" || !Number.isFinite(n)) {
      if (which === "min") {
        setMin(lo);
        commit(lo, max, true);
      } else {
        setMax(hi);
        commit(min, hi, true);
      }
      return;
    }
    if (which === "min") {
      const v = clamp(n, lo, max);
      setMin(v);
      commit(v, max, true);
    } else {
      const v = clamp(n, min, hi);
      setMax(v);
      commit(min, v, true);
    }
  };

  if (hi <= lo) {
    return <p className="text-[14px] text-muted">{format(lo)}</p>;
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      <div className="range-dual mx-[11px]">
        <span className="range-fill" style={{ left: `${left}%`, right: `${100 - right}%` }} />
        <input
          type="range"
          aria-label={`Minimum ${label.toLowerCase()}`}
          aria-valuetext={format(min)}
          min={lo}
          max={hi}
          step={step}
          value={min}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), max);
            setMin(v);
            commit(v, max);
          }}
        />
        <input
          type="range"
          aria-label={`Maximum ${label.toLowerCase()}`}
          aria-valuetext={format(max)}
          min={lo}
          max={hi}
          step={step}
          value={max}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), min);
            setMax(v);
            commit(min, v);
          }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <NumberBox key={`min-${min}`} label={`Minimum ${label.toLowerCase()}`} value={min} unit={unit} onCommit={(raw) => setFromInput("min", raw)} />
        <span aria-hidden className="text-muted">
          –
        </span>
        <NumberBox key={`max-${max}`} label={`Maximum ${label.toLowerCase()}`} value={max} unit={unit} onCommit={(raw) => setFromInput("max", raw)} />
      </div>
    </div>
  );
}

/** Uncontrolled while typing; commits on blur or Enter. Re-keyed when the slider moves. */
function NumberBox({ label, value, unit, onCommit }: { label: string; value: number; unit?: string; onCommit: (raw: string) => void }) {
  return (
    <label className="relative flex-1">
      <span className="sr-only">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        defaultValue={String(value)}
        onBlur={(e) => {
          if (e.target.value !== String(value)) onCommit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(e.currentTarget.value);
          }
        }}
        className={`field min-h-11 py-2 text-[15px] ${unit ? "pr-11" : ""}`}
      />
      {unit && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted">{unit}</span>}
    </label>
  );
}
