"use client";

import { useId, useMemo, useRef, useState } from "react";
import { createValue, suggestSimilarValues } from "@/app/admin/actions/attributes";
import { Swatch } from "@/components/ui/swatch";
import type { Attribute, AttributeValue } from "@/lib/catalog/types";

type Props = {
  attribute: Attribute;
  /** Selected value ids (any attribute; only this attribute's are shown). */
  selected: string[];
  onChange: (next: string[]) => void;
  /** A value was created inline; the parent adds it to its attribute list. */
  onCreated: (attributeId: string, value: AttributeValue) => void;
  /** Smaller variant for the bulk-edit table. */
  compact?: boolean;
  labelledBy?: string;
};

type Similar = { id: string; name: string }[];

/** Multi-select for one attribute's values, with inline "Create" and a "Did you mean…?" check. */
export function AttributePicker({ attribute, selected, onChange, onCreated, compact = false, labelledBy }: Props) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<{ name: string; matches: Similar } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mine = attribute.values.filter((v) => selected.includes(v.id));
  const term = q.trim();
  const options = useMemo(() => {
    const t = term.toLowerCase();
    return attribute.values.filter((v) => !selected.includes(v.id) && (!t || v.name.toLowerCase().includes(t)));
  }, [attribute.values, selected, term]);
  const exact = attribute.values.find((v) => v.name.toLowerCase() === term.toLowerCase());

  const add = (id: string) => {
    if (!selected.includes(id)) onChange([...selected, id]);
    setQ("");
    setSimilar(null);
    setError(null);
    inputRef.current?.focus();
  };
  const remove = (id: string) => onChange(selected.filter((x) => x !== id));

  async function create(name: string, skipCheck = false) {
    setBusy(true);
    setError(null);
    try {
      if (!skipCheck) {
        const matches = (await suggestSimilarValues(attribute.id, name)).filter((m) => !selected.includes(m.id));
        if (matches.length) {
          setSimilar({ name, matches });
          return;
        }
      }
      const res = await createValue(attribute.id, { name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated(attribute.id, res.value);
      add(res.value.id);
    } catch {
      setError("Couldn't reach the server");
    } finally {
      setBusy(false);
    }
  }

  const swatch = (v: AttributeValue) => (attribute.kind === "color" ? <Swatch hex={v.hex} swatch={v.swatch} size={compact ? 12 : 14} /> : null);
  const text = compact ? "text-[13px]" : "text-[14px]";

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <div className={`field flex flex-wrap items-center gap-1.5 ${compact ? "min-h-10 px-2 py-1.5" : "py-2"}`}>
        {mine.map((v) => (
          <span key={v.id} className={`inline-flex items-center gap-1.5 bg-sand py-1 pr-1 pl-2 ${text}`}>
            {swatch(v)}
            {v.name}
            <button
              type="button"
              onClick={() => remove(v.id)}
              className="inline-flex size-6 items-center justify-center text-muted hover:text-error"
              aria-label={`Remove ${v.name}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : attribute.name}
          placeholder={mine.length ? "" : compact ? "—" : `Add ${attribute.name.toLowerCase()}`}
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setSimilar(null);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (exact) add(exact.id);
              else if (options.length === 1) add(options[0].id);
              else if (term && !busy) void create(term);
            } else if (e.key === "Backspace" && !q && mine.length) {
              remove(mine[mine.length - 1].id);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className={`min-w-[6ch] flex-1 bg-transparent focus:outline-none ${text}`}
        />
      </div>

      {open && (options.length > 0 || term || similar) && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 border border-line-strong bg-cream-raised shadow-lg">
          {similar ? (
            <div className="space-y-2 p-3 text-[14px]">
              <p>Did you mean…</p>
              <div className="flex flex-wrap gap-2">
                {similar.matches.map((m) => (
                  <button key={m.id} type="button" className="btn btn-outline min-h-10 px-3 normal-case tracking-normal" onClick={() => add(m.id)}>
                    {m.name}
                  </button>
                ))}
              </div>
              <button type="button" className="min-h-10 text-[13px] text-brown underline underline-offset-4" disabled={busy} onClick={() => void create(similar.name, true)}>
                No, create “{similar.name}”
              </button>
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label={attribute.name} className="max-h-60 overflow-y-auto">
              {options.map((v) => (
                <li key={v.id} role="option" aria-selected={false}>
                  <button type="button" onClick={() => add(v.id)} className={`flex min-h-10 w-full items-center gap-2 px-3 text-left hover:bg-sand ${text}`}>
                    {swatch(v)}
                    {v.name}
                  </button>
                </li>
              ))}
              {term && !exact && (
                <li role="option" aria-selected={false}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void create(term)}
                    className={`flex min-h-10 w-full items-center px-3 text-left font-medium text-brown hover:bg-sand ${text}`}
                  >
                    {busy ? "Checking…" : `+ Create “${term}”`}
                  </button>
                </li>
              )}
            </ul>
          )}
          {error && <p className="border-t border-line px-3 py-2 text-[13px] text-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
