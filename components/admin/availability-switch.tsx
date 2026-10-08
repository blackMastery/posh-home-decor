"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setAvailability } from "@/app/admin/actions/products";
import { AVAILABILITIES, type Availability } from "@/lib/catalog/types";

const TONE: Record<Availability, string> = {
  available: "border-[#3E7B2A] text-[#2F5320]",
  coming_soon: "border-gold text-brown-deep",
  sold_out: "border-error text-error",
};

/** Available / Coming soon / Sold out, optimistic. Reverts with a message if the save fails. */
export function AvailabilitySwitch({ id, name, initial }: { id: string; name: string; initial: Availability }) {
  const [value, setValue] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 flex-col items-end">
      <select
        aria-label={`${name}: availability`}
        value={optimistic}
        onChange={(e) => {
          const next = e.target.value as Availability;
          setError(false);
          startTransition(async () => {
            setOptimistic(next);
            const res = await setAvailability(id, next).catch(() => ({ ok: false as const }));
            if (res.ok) setValue(next);
            else setError(true);
          });
        }}
        className={`min-h-11 border bg-cream-raised px-2 text-[12px] font-medium ${TONE[optimistic]}`}
      >
        {AVAILABILITIES.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-[11px] text-error">
          Couldn&apos;t save — try again
        </span>
      )}
    </div>
  );
}
