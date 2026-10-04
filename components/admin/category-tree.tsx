"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createCategory,
  deleteCategory,
  moveCategory,
  renameCategory,
  reparentCategory,
  setCategoryTile,
} from "@/app/admin/actions/categories";
import { createClient } from "@/lib/supabase/browser";
import { PoshImage } from "@/components/ui/posh-image";
import { prepareImage } from "./image-prep";

export type AdminCategory = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  path: string;
  depth: number;
  sort_order: number;
  tile_image_path: string | null;
  subtreeCount: number;
  directProducts: number;
  childCount: number;
};

type Panel = { id: string; kind: "rename" | "add" | "move" | "tile" } | { id: null; kind: "add" } | null;

export function CategoryTree({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ordered = useMemo(() => {
    const byParent = new Map<string | null, AdminCategory[]>();
    for (const c of categories) {
      const list = byParent.get(c.parent_id) ?? [];
      list.push(c);
      byParent.set(c.parent_id, list);
    }
    const out: AdminCategory[] = [];
    const walk = (parent: string | null) => {
      for (const c of (byParent.get(parent) ?? []).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))) {
        out.push(c);
        walk(c.id);
      }
    };
    walk(null);
    return out;
  }, [categories]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
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

  const siblingsOf = (c: AdminCategory) => ordered.filter((x) => x.parent_id === c.parent_id);

  return (
    <div className="mt-6">
      {error && (
        <p role="alert" className="mb-4 border border-error/40 bg-error/5 px-4 py-3 text-[14px] text-error">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={() => setPanel({ id: null, kind: "add" })}>
        + Top-level category
      </button>
      {panel?.kind === "add" && panel.id === null && (
        <NameForm
          title="New top-level category"
          onCancel={() => setPanel(null)}
          onSubmit={(name) => run(() => createCategory(null, name), () => setPanel(null))}
          pending={pending}
        />
      )}

      <ul className="mt-5 divide-y divide-line border-y border-line" aria-busy={pending}>
        {ordered.map((c) => {
          const sibs = siblingsOf(c);
          const idx = sibs.findIndex((s) => s.id === c.id);
          const blocked = c.directProducts > 0 || c.childCount > 0;
          const reason = [
            c.directProducts ? `${c.directProducts} product${c.directProducts === 1 ? "" : "s"}` : null,
            c.childCount ? `${c.childCount} subcategor${c.childCount === 1 ? "y" : "ies"}` : null,
          ]
            .filter(Boolean)
            .join(" and ");
          const open = menu === c.id;
          return (
            <li key={c.id} className="py-1">
              <div className="flex items-center gap-2" style={{ paddingLeft: `${(c.depth - 1) * 20}px` }}>
                {c.depth > 1 && <span className="text-line-strong" aria-hidden>└</span>}
                <div className="min-w-0 flex-1 py-2">
                  <p className={`truncate ${c.depth === 1 ? "text-[16px] font-medium text-garnet-deep" : "text-[15px]"}`}>{c.name}</p>
                  <p className="truncate text-[12px] text-muted">
                    /shop/{c.path} · {c.subtreeCount} product{c.subtreeCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={`Actions for ${c.name}`}
                  onClick={() => setMenu(open ? null : c.id)}
                  className="tap inline-flex items-center justify-center text-[20px] text-ink-soft"
                >
                  ⋯
                </button>
              </div>

              {open && (
                <div className="mb-2 grid grid-cols-2 gap-2 bg-sand/60 p-3 sm:grid-cols-3" style={{ marginLeft: `${(c.depth - 1) * 20}px` }}>
                  <Action onClick={() => setPanel({ id: c.id, kind: "rename" })}>Rename</Action>
                  {c.depth < 3 && <Action onClick={() => setPanel({ id: c.id, kind: "add" })}>Add subcategory</Action>}
                  <Action disabled={idx <= 0 || pending} onClick={() => run(() => moveCategory(c.id, "up"))}>
                    Move up
                  </Action>
                  <Action disabled={idx >= sibs.length - 1 || pending} onClick={() => run(() => moveCategory(c.id, "down"))}>
                    Move down
                  </Action>
                  <Action onClick={() => setPanel({ id: c.id, kind: "move" })}>Move to…</Action>
                  {c.depth === 1 && <Action onClick={() => setPanel({ id: c.id, kind: "tile" })}>Tile image</Action>}
                  <Action
                    danger
                    disabled={blocked || pending}
                    onClick={() => {
                      if (window.confirm(`Delete “${c.name}”? This can't be undone.`)) run(() => deleteCategory(c.id), () => setMenu(null));
                    }}
                  >
                    Delete
                  </Action>
                  {blocked && <p className="col-span-full text-[12px] text-muted">Can&apos;t delete: contains {reason}.</p>}
                </div>
              )}

              {panel && panel.id === c.id && panel.kind === "rename" && (
                <RenameForm
                  category={c}
                  pending={pending}
                  onCancel={() => setPanel(null)}
                  onSubmit={(name, updateSlug) => run(() => renameCategory(c.id, name, updateSlug), () => setPanel(null))}
                />
              )}
              {panel && panel.id === c.id && panel.kind === "add" && (
                <NameForm
                  title={`New subcategory in ${c.name}`}
                  pending={pending}
                  onCancel={() => setPanel(null)}
                  onSubmit={(name) => run(() => createCategory(c.id, name), () => setPanel(null))}
                />
              )}
              {panel && panel.id === c.id && panel.kind === "move" && (
                <MoveForm
                  category={c}
                  all={ordered}
                  pending={pending}
                  onCancel={() => setPanel(null)}
                  onSubmit={(parentId) => run(() => reparentCategory(c.id, parentId), () => setPanel(null))}
                />
              )}
              {panel && panel.id === c.id && panel.kind === "tile" && (
                <TileForm
                  category={c}
                  onDone={(msg) => {
                    if (msg) setError(msg);
                    setPanel(null);
                    router.refresh();
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Action({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 border bg-cream-raised px-3 text-[13px] disabled:opacity-40 ${danger ? "border-error/50 text-error" : "border-line-strong text-ink"}`}
    >
      {children}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="my-2 border border-line-strong bg-cream-raised p-4">
      <p className="mb-3 text-[14px] font-medium text-garnet-deep">{title}</p>
      {children}
    </div>
  );
}

function NameForm({ title, onSubmit, onCancel, pending }: { title: string; onSubmit: (n: string) => void; onCancel: () => void; pending: boolean }) {
  const [name, setName] = useState("");
  return (
    <Panel title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input autoFocus aria-label="Name" className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
          Add
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
      </form>
    </Panel>
  );
}

function RenameForm({
  category,
  onSubmit,
  onCancel,
  pending,
}: {
  category: AdminCategory;
  onSubmit: (n: string, updateSlug: boolean) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState(category.name);
  const [updateSlug, setUpdateSlug] = useState(true);
  return (
    <Panel title={`Rename “${category.name}”`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim(), updateSlug);
        }}
        className="space-y-3"
      >
        <input autoFocus aria-label="New name" className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <label className="flex min-h-11 items-start gap-3 text-[14px]">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-garnet" checked={updateSlug} onChange={(e) => setUpdateSlug(e.target.checked)} />
          <span>
            Also update the web address
            <span className="block text-[12px] text-muted">Old links will keep working — they redirect to the new address.</span>
          </span>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
            Save
          </button>
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

function MoveForm({
  category,
  all,
  onSubmit,
  onCancel,
  pending,
}: {
  category: AdminCategory;
  all: AdminCategory[];
  onSubmit: (parentId: string | null) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  // Height of this subtree (1 = no children).
  const height = Math.max(1, ...all.filter((c) => c.path.startsWith(`${category.path}/`)).map((c) => c.depth - category.depth + 1));
  const options = all.filter(
    (c) => c.id !== category.id && !c.path.startsWith(`${category.path}/`) && c.depth + height <= 3 && c.id !== category.parent_id,
  );
  const [target, setTarget] = useState<string>(category.depth === 1 ? options[0]?.id ?? "" : "");
  return (
    <Panel title={`Move “${category.name}”`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(target || null);
        }}
        className="space-y-3"
      >
        <select aria-label="New parent" className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
          {category.depth !== 1 && <option value="">Top level</option>}
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {"— ".repeat(c.depth - 1)}
              {c.name}
            </option>
          ))}
        </select>
        <p className="text-[12px] text-muted">Old links redirect to the new location.</p>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={pending || (category.depth === 1 && !target)}>
            Move
          </button>
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

function TileForm({ category, onDone }: { category: AdminCategory; onDone: (error?: string) => void }) {
  const [status, setStatus] = useState<string | null>(null);
  async function onFile(file: File) {
    try {
      setStatus("Preparing…");
      const prepared = await prepareImage(file, (p) => setStatus(`Preparing ${p}%`));
      setStatus("Uploading…");
      const path = `tiles/${crypto.randomUUID()}.jpg`;
      const { error } = await createClient().storage.from("site").upload(path, prepared.blob, { contentType: "image/jpeg" });
      if (error) throw new Error("Upload failed — check your connection");
      const res = await setCategoryTile(category.id, path);
      onDone(res.ok ? undefined : res.error);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Upload failed");
    }
  }
  return (
    <Panel title={`Home tile for “${category.name}”`}>
      <div className="flex items-start gap-4">
        <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden bg-sand-image">
          {category.tile_image_path && <PoshImage path={category.tile_image_path} bucket="site" alt="" fill sizes="96px" className="object-cover" />}
        </div>
        <div className="space-y-2 text-[14px]">
          <p className="text-muted">Without a tile image, the newest product photo in this category is used. Tiles are cropped to 3:4.</p>
          <label className="btn btn-primary min-h-11 cursor-pointer px-4">
            Choose photo
            <input type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          </label>
          {category.tile_image_path && (
            <button
              type="button"
              className="ml-2 min-h-11 px-3 text-error"
              onClick={async () => {
                const res = await setCategoryTile(category.id, null);
                onDone(res.ok ? undefined : res.error);
              }}
            >
              Remove
            </button>
          )}
          {status && <p role="status">{status}</p>}
          <button type="button" className="block min-h-11 text-garnet" onClick={() => onDone()}>
            Close
          </button>
        </div>
      </div>
    </Panel>
  );
}
