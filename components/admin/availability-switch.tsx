"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setAvailability } from "@/app/admin/actions/products";

/** One tap, optimistic. Reverts with a message if the save fails. */
export function AvailabilitySwitch({ id, name, initial }: { id: string; name: string; initial: boolean }) {
  const [value, setValue] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label={`${name}: ${optimistic ? "Available" : "Sold out"}`}
        onClick={() => {
          const next = !optimistic;
          setError(false);
          startTransition(async () => {
            setOptimistic(next);
            const res = await setAvailability(id, next).catch(() => ({ ok: false as const }));
            if (res.ok) setValue(next);
            else setError(true);
          });
        }}
        className="flex min-h-11 items-center gap-2"
      >
        <span className={`w-[64px] text-right text-[12px] font-medium ${optimistic ? "text-[#2F5320]" : "text-error"}`}>
          {optimistic ? "Available" : "Sold out"}
        </span>
        <span className={`relative inline-block h-7 w-12 rounded-full transition-colors ${optimistic ? "bg-[#3E7B2A]" : "bg-line-strong"}`}>
          <span
            className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-cream-raised shadow transition-transform ${optimistic ? "translate-x-5" : ""}`}
          />
        </span>
      </button>
      {error && (
        <span role="alert" className="text-[11px] text-error">
          Couldn&apos;t save — tap again
        </span>
      )}
    </div>
  );
}
