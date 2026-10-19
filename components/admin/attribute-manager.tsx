"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  createAttribute,
  createValue,
  deleteAttribute,
  deleteValue,
  mergeValue,
  moveAttribute,
  moveValue,
  updateAttribute,
  updateValue,
} from "@/app/admin/actions/attributes";
import { Swatch } from "@/components/ui/swatch";
import type { AdminAttribute } from "@/lib/admin/product-loader";
import type { AttributeValue } from "@/lib/catalog/types";

type Result = { ok: boolean; error?: string };

export function AttributeManager({ attributes }: { attributes: AdminAttribute[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn().catch(() => ({ ok: false, error: "Couldn't reach the server — try again." }));
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else {
        after?.();
        router.refresh();
      }
    });
  };

  return (
    <div className="mt-6 space-y-6" aria-busy={pending}>
      {error && (
        <p role="alert" className="border border-error/40 bg-error/5 px-4 py-3 text-[14px] text-error">
          {error}
        </p>
      )}

      {attributes.map((a, i) => (
        <AttributeCard key={a.id} attribute={a} first={i === 0} last={i === attributes.length - 1} run={run} pending={pending} />
      ))}

      <NewAttributeForm run={run} pending={pending} />
    </div>
  );
}

function AttributeCard({
  attribute: a,
  first,
  last,
  run,
  pending,
}: {
  attribute: AdminAttribute;
  first: boolean;
  last: boolean;
  run: (fn: () => Promise<Result>, after?: () => void) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(a.name);
  const inUse = Object.values(a.usage).some((n) => n > 0);

  return (
    <section className="border border-line-strong bg-cream-raised" aria-label={a.name}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <input
          aria-label="Attribute name"
          className="field min-h-11 flex-1 py-2 text-[16px] font-medium"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== a.name && run(() => updateAttribute(a.id, { name }))}
        />
        <select
          aria-label="Type"
          className="field min-h-11 w-auto py-2 text-[14px]"
          value={a.kind}
          onChange={(e) => run(() => updateAttribute(a.id, { kind: e.target.value as "standard" | "color" }))}
        >
          <option value="standard">List</option>
          <option value="color">Colour (swatches)</option>
        </select>
        <div className="flex">
          <SmallButton disabled={first || pending} onClick={() => run(() => moveAttribute(a.id, "up"))} label={`Move ${a.name} up`}>
            ↑
          </SmallButton>
          <SmallButton disabled={last || pending} onClick={() => run(() => moveAttribute(a.id, "down"))} label={`Move ${a.name} down`}>
            ↓
          </SmallButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 text-[13px] text-muted">
        <span>
          Shop link: <code className="text-ink-soft">?{a.slug}=…</code>
        </span>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-brown" checked={a.show_on_pdp} onChange={(e) => run(() => updateAttribute(a.id, { showOnPdp: e.target.checked }))} />
          Show on product pages
        </label>
      </div>

      <ul className="divide-y divide-line px-3">
        {a.values.map((v, i) => (
          <ValueRow
            key={v.id}
            attribute={a}
            value={v}
            usage={a.usage[v.id] ?? 0}
            first={i === 0}
            last={i === a.values.length - 1}
            run={run}
            pending={pending}
          />
        ))}
        {a.values.length === 0 && <li className="py-3 text-[14px] text-muted">No values yet.</li>}
      </ul>

      <NewValueForm attribute={a} run={run} pending={pending} />

      <div className="border-t border-line px-3 py-2 text-right">
        <button
          type="button"
          className="min-h-10 text-[13px] text-error disabled:opacity-40"
          disabled={inUse || pending}
          title={inUse ? "Products use this attribute's values" : undefined}
          onClick={() => {
            if (window.confirm(`Delete “${a.name}” and all its values?`)) run(() => deleteAttribute(a.id));
          }}
        >
          Delete attribute
        </button>
      </div>
    </section>
  );
}

function ValueRow({
  attribute,
  value: v,
  usage,
  first,
  last,
  run,
  pending,
}: {
  attribute: AdminAttribute;
  value: AttributeValue;
  usage: number;
  first: boolean;
  last: boolean;
  run: (fn: () => Promise<Result>, after?: () => void) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(v.name);
  const [hex, setHex] = useState(v.hex ?? "#d4c0a0");
  const hexTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hexTimer.current), []);
  const [merging, setMerging] = useState(false);
  const [target, setTarget] = useState("");
  const others = attribute.values.filter((x) => x.id !== v.id);

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        {attribute.kind === "color" && (
          <>
            <Swatch hex={hex} swatch={v.swatch} size={22} />
            <input
              type="color"
              aria-label={`Colour for ${v.name}`}
              className="h-10 w-10 cursor-pointer border border-line-strong bg-transparent p-0.5"
              value={hex}
              onChange={(e) => {
                const next = e.target.value;
                setHex(next);
                // The native picker fires on every drag step; save once it settles.
                window.clearTimeout(hexTimer.current);
                hexTimer.current = window.setTimeout(() => {
                  if (next.toLowerCase() !== (v.hex ?? "").toLowerCase()) run(() => updateValue(v.id, { hex: next }));
                }, 600);
              }}
            />
            <select
              aria-label={`Finish for ${v.name}`}
              className="field min-h-10 w-auto py-1.5 text-[13px]"
              value={v.swatch}
              onChange={(e) => run(() => updateValue(v.id, { swatch: e.target.value }))}
            >
              <option value="solid">Solid</option>
              <option value="metallic">Metallic</option>
              <option value="multi">Multi-colour</option>
            </select>
          </>
        )}
        <input
          aria-label="Value name"
          className="field min-h-10 min-w-[10rem] flex-1 py-1.5 text-[15px]"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== v.name && run(() => updateValue(v.id, { name }))}
        />
        <span className="w-24 text-right text-[12px] text-muted tabular-nums">
          {usage} product{usage === 1 ? "" : "s"}
        </span>
        <div className="flex">
          <SmallButton disabled={first || pending} onClick={() => run(() => moveValue(v.id, "up"))} label={`Move ${v.name} up`}>
            ↑
          </SmallButton>
          <SmallButton disabled={last || pending} onClick={() => run(() => moveValue(v.id, "down"))} label={`Move ${v.name} down`}>
            ↓
          </SmallButton>
          <SmallButton disabled={others.length === 0 || pending} onClick={() => setMerging((m) => !m)} label={`Merge ${v.name} into another value`}>
            Merge
          </SmallButton>
          <SmallButton
            danger
            disabled={usage > 0 || pending}
            title={usage > 0 ? "In use — merge it into another value instead" : undefined}
            onClick={() => {
              if (window.confirm(`Delete “${v.name}”?`)) run(() => deleteValue(v.id));
            }}
            label={`Delete ${v.name}`}
          >
            ✕
          </SmallButton>
        </div>
      </div>
      {merging && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2 bg-sand/60 p-2 text-[14px]"
          onSubmit={(e) => {
            e.preventDefault();
            const into = others.find((o) => o.id === target);
            if (into && window.confirm(`Move ${usage} product${usage === 1 ? "" : "s"} from “${v.name}” to “${into.name}” and delete “${v.name}”?`)) {
              run(() => mergeValue(v.id, into.id), () => setMerging(false));
            }
          }}
        >
          <span>Merge into</span>
          <select aria-label="Merge into" className="field min-h-10 w-auto py-1.5 text-[14px]" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose…</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary min-h-10 px-4" disabled={!target || pending}>
            Merge
          </button>
          <button type="button" className="min-h-10 px-2 text-brown" onClick={() => setMerging(false)}>
            Cancel
          </button>
        </form>
      )}
    </li>
  );
}

function NewValueForm({ attribute, run, pending }: { attribute: AdminAttribute; run: (fn: () => Promise<Result>, after?: () => void) => void; pending: boolean }) {
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#c49a52");
  return (
    <form
      className="flex flex-wrap gap-2 border-t border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        run(() => createValue(attribute.id, { name, hex: attribute.kind === "color" ? hex : undefined }), () => setName(""));
      }}
    >
      {attribute.kind === "color" && (
        <input type="color" aria-label="New value colour" className="h-11 w-11 cursor-pointer border border-line-strong p-0.5" value={hex} onChange={(e) => setHex(e.target.value)} />
      )}
      <input
        aria-label={`New ${attribute.name.toLowerCase()} value`}
        placeholder={`Add a ${attribute.name.toLowerCase()} value`}
        className="field min-h-11 flex-1 py-2"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="btn btn-outline min-h-11 px-4" disabled={pending || !name.trim()}>
        Add
      </button>
    </form>
  );
}

function NewAttributeForm({ run, pending }: { run: (fn: () => Promise<Result>, after?: () => void) => void; pending: boolean }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"standard" | "color">("standard");
  return (
    <form
      className="border border-dashed border-line-strong p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) run(() => createAttribute(name, kind), () => setName(""));
      }}
    >
      <p className="mb-3 text-[14px] font-medium text-brown-deep">New attribute</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input aria-label="Attribute name" placeholder="e.g. Style, Finish, Shape" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <select aria-label="Type" className="field sm:w-auto" value={kind} onChange={(e) => setKind(e.target.value as "standard" | "color")}>
          <option value="standard">List</option>
          <option value="color">Colour (swatches)</option>
        </select>
        <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
          Add
        </button>
      </div>
      <p className="mt-2 text-[12px] text-muted">Each attribute becomes a filter group in the shop.</p>
    </form>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  danger,
  label,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={`min-h-10 min-w-10 border border-line-strong bg-cream px-2 text-[13px] -ml-px first:ml-0 disabled:opacity-35 ${danger ? "text-error" : "text-ink-soft"}`}
    >
      {children}
    </button>
  );
}
