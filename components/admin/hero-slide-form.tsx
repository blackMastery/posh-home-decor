"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createSlide, deleteSlide, discardUploads, updateSlide } from "@/app/admin/actions/hero";
import { searchProductsForRelated } from "@/app/admin/actions/products";
import { createClient } from "@/lib/supabase/browser";
import { storageUrl } from "@/lib/images";
import { PoshImage } from "@/components/ui/posh-image";
import { HeroSlide } from "@/components/store/hero-slide";
import {
  DESKTOP_RATIO,
  MOBILE_RATIO,
  type AdminHeroProduct,
  type HeroLinkType,
  type HeroSlideInput,
  type HeroSlideView,
} from "@/lib/hero";
import { prepareImage } from "./image-prep";

export type HeroCategoryOption = { id: string; label: string };

export const EMPTY_SLIDE: HeroSlideInput = {
  internalName: "",
  kind: "overlay",
  mobileImagePath: "",
  mobileWidth: null,
  mobileHeight: null,
  desktopImagePath: null,
  desktopWidth: null,
  desktopHeight: null,
  alt: "",
  eyebrow: "",
  headline: "",
  body: "",
  ctaLabel: "Shop now",
  linkType: "none",
  productId: null,
  categoryId: null,
  linkUrl: "",
  showPrice: false,
  textPosition: "bottom-left",
  textTone: "light",
  scrim: "soft",
  startsAt: "",
  endsAt: "",
  isVisible: false,
};

type Slot = "mobile" | "desktop";
type UploadState = { status: "idle" } | { status: "working"; label: string } | { status: "error"; message: string };

const label = "mb-1.5 block text-[13px] font-medium text-brown-deep";
const hint = "mt-1 text-[12px] text-muted";

export function HeroSlideForm({
  slideId,
  initial,
  initialProduct,
  categories,
}: {
  /** null for a new slide. */
  slideId: string | null;
  initial: HeroSlideInput;
  initialProduct: AdminHeroProduct | null;
  categories: HeroCategoryOption[];
}) {
  const router = useRouter();
  const ids = useId();
  const [v, setV] = useState(initial);
  const [product, setProduct] = useState(initialProduct);
  const [previews, setPreviews] = useState<Partial<Record<Slot, string>>>({});
  const [uploads, setUploads] = useState<Record<Slot, UploadState>>({ mobile: { status: "idle" }, desktop: { status: "idle" } });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewMode, setPreviewMode] = useState<Slot>("mobile");
  /** Uploaded this session and not yet saved; removed if replaced or abandoned. */
  const fresh = useRef(new Set<string>());

  const set = <K extends keyof HeroSlideInput>(k: K, val: HeroSlideInput[K]) => {
    setV((x) => ({ ...x, [k]: val }));
    if (errors[k]) setErrors((e) => omit(e, k));
  };
  const overlay = v.kind === "overlay";
  const busy = saving || uploads.mobile.status === "working" || uploads.desktop.status === "working";

  // Revoke blob previews on unmount (replaced ones are revoked in setPreview).
  const previewsRef = useRef(previews);
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);
  useEffect(() => () => Object.values(previewsRef.current).forEach((u) => u && URL.revokeObjectURL(u)), []);
  function setPreview(slot: Slot, url: string | null) {
    setPreviews((p) => {
      if (p[slot]) URL.revokeObjectURL(p[slot]);
      const next = { ...p };
      if (url) next[slot] = url;
      else delete next[slot];
      return next;
    });
  }

  async function onFile(slot: Slot, file: File | undefined) {
    if (!file) return;
    const setUp = (u: UploadState) => setUploads((x) => ({ ...x, [slot]: u }));
    try {
      setUp({ status: "working", label: "Preparing…" });
      const prepared = await prepareImage(file, () => {});
      setUp({ status: "working", label: "Uploading…" });
      const path = `hero/${crypto.randomUUID()}.jpg`;
      const { error } = await createClient()
        .storage.from("site")
        .upload(path, prepared.blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw new Error("Upload failed — check your connection");
      const prev = slot === "mobile" ? v.mobileImagePath : v.desktopImagePath;
      if (prev && fresh.current.delete(prev)) void discardUploads([prev]);
      fresh.current.add(path);
      setPreview(slot, URL.createObjectURL(prepared.blob));
      if (slot === "mobile") {
        setV((x) => ({ ...x, mobileImagePath: path, mobileWidth: prepared.width, mobileHeight: prepared.height }));
      } else {
        setV((x) => ({ ...x, desktopImagePath: path, desktopWidth: prepared.width, desktopHeight: prepared.height }));
        setPreviewMode("desktop");
      }
      setErrors((e) => omit(e, "mobileImagePath", "desktopImagePath"));
      setUp({ status: "idle" });
    } catch (e) {
      setUp({ status: "error", message: e instanceof Error ? e.message : "Couldn't read this image" });
    }
  }

  function removeDesktop() {
    const prev = v.desktopImagePath;
    if (prev && fresh.current.delete(prev)) void discardUploads([prev]);
    setPreview("desktop", null);
    setV((x) => ({ ...x, desktopImagePath: null, desktopWidth: null, desktopHeight: null }));
    setPreviewMode("mobile");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.mobileImagePath) {
      setErrors({ mobileImagePath: "Add a mobile image" });
      setMsg({ ok: false, text: "Check the highlighted fields" });
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await (slideId ? updateSlide(slideId, v) : createSlide(v)).catch(() => ({
      ok: false as const,
      error: "Check your connection",
      fieldErrors: undefined,
    }));
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setMsg({ ok: false, text: res.error });
      return;
    }
    fresh.current.clear();
    if (!slideId) {
      router.push("/admin/hero");
      return;
    }
    setMsg({ ok: true, text: "Slide saved." });
    router.refresh();
  }

  async function remove() {
    if (!slideId) return;
    setSaving(true);
    const res = await deleteSlide(slideId).catch(() => ({ ok: false as const, error: "Check your connection" }));
    setSaving(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    router.push("/admin/hero");
  }

  function discardFresh() {
    if (fresh.current.size) void discardUploads([...fresh.current]);
    fresh.current.clear();
  }

  // Unsaved uploads are discarded however the admin leaves: in-app navigation (unmount)
  // or closing the tab (pagehide). Anything still missed is swept by the hero list page.
  useEffect(() => {
    const set = fresh.current;
    const discard = () => {
      if (set.size) void discardUploads([...set]).catch(() => {});
      set.clear();
    };
    // persisted = page kept in the back/forward cache; the form may come back, so keep its uploads.
    const onHide = (e: PageTransitionEvent) => !e.persisted && discard();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      discard();
    };
  }, []);

  // --- Preview -------------------------------------------------------------
  const mobileSrc = previews.mobile ?? (v.mobileImagePath ? storageUrl(v.mobileImagePath, "site") : null);
  const desktopSrc = previews.desktop ?? (v.desktopImagePath ? storageUrl(v.desktopImagePath, "site") : null);
  const preview: HeroSlideView | null = mobileSrc
    ? {
        id: "preview",
        kind: v.kind,
        mobile: { src: mobileSrc, width: v.mobileWidth ?? 1080, height: v.mobileHeight ?? 1350 },
        desktop: desktopSrc ? { src: desktopSrc, width: v.desktopWidth ?? 2000, height: v.desktopHeight ?? 1000 } : null,
        alt: v.alt,
        eyebrow: v.eyebrow,
        headline: v.headline || "Your headline",
        body: v.body,
        ctaLabel: v.ctaLabel,
        href: v.linkType === "none" ? null : "#preview",
        external: false,
        textPosition: v.textPosition,
        textTone: v.textTone,
        scrim: v.scrim,
        price:
          overlay && v.showPrice && v.linkType === "product" && product?.price != null
            ? { price: product.price, compareAt: product.compareAt }
            : null,
        endsAt: null,
      }
    : null;

  return (
    <form onSubmit={submit} noValidate className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-start lg:gap-10">
      {/* Preview: first on phones, sticky side column on desktop */}
      <section aria-label="Preview" className="mb-8 lg:sticky lg:top-6 lg:order-2 lg:mb-0">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-brown-deep">Preview</h2>
          <Segmented
            name={`${ids}-pv`}
            value={previewMode}
            onChange={(m) => setPreviewMode(m as Slot)}
            options={[
              { value: "mobile", label: "Phone" },
              { value: "desktop", label: "Desktop" },
            ]}
          />
        </div>
        <div onClickCapture={(e) => e.preventDefault()} className="border border-line bg-sand p-3">
          {preview ? (
            previewMode === "mobile" ? (
              <div className="mx-auto max-w-[300px]">
                <ScaledFrame width={390} ratio={1 / MOBILE_RATIO}>
                  <HeroSlide slide={preview} variant="mobile" />
                </ScaledFrame>
              </div>
            ) : (
              <ScaledFrame width={1280} ratio={1 / DESKTOP_RATIO}>
                <HeroSlide slide={preview} variant="desktop" />
              </ScaledFrame>
            )
          ) : (
            <p className="flex aspect-[4/5] items-center justify-center px-6 text-center text-[14px] text-ink-soft">
              Add a mobile image to see the preview.
            </p>
          )}
        </div>
        {previewMode === "desktop" && preview && !preview.desktop && (
          <p className={hint}>No desktop image yet. The mobile image is cropped to fit wide screens.</p>
        )}
      </section>

      <div className="space-y-7 lg:order-1">
        <Field id={`${ids}-name`} label="Slide name" hint="Only staff see this." error={errors.internalName}>
          <input
            id={`${ids}-name`}
            className="field"
            maxLength={80}
            placeholder="e.g. Black Friday 2026"
            value={v.internalName}
            aria-invalid={!!errors.internalName}
            onChange={(e) => set("internalName", e.target.value)}
          />
        </Field>

        <div>
          <p className={label}>Type</p>
          <Segmented
            name={`${ids}-kind`}
            value={v.kind}
            onChange={(k) => set("kind", k as HeroSlideInput["kind"])}
            options={[
              { value: "overlay", label: "Photo + text" },
              { value: "artwork", label: "Finished artwork" },
            ]}
            wide
          />
          <p className={hint}>
            {overlay
              ? "A photo with your headline and button on top. Best for product and room photos."
              : "A graphic with its text already designed in (e.g. from Canva). The whole slide is the link."}
          </p>
        </div>

        <fieldset className="space-y-5">
          <legend className="mb-3 text-[17px] font-medium text-brown-deep">Images</legend>
          <ImageField
            label="Phone image"
            required
            hint="Portrait 4:5, e.g. 1080 × 1350. Shown on phones and small tablets."
            target={MOBILE_RATIO}
            path={v.mobileImagePath || null}
            blob={previews.mobile}
            dims={[v.mobileWidth, v.mobileHeight]}
            state={uploads.mobile}
            error={errors.mobileImagePath}
            onFile={(f) => onFile("mobile", f)}
          />
          <ImageField
            label="Desktop image"
            required={!overlay}
            hint={`Wide 2:1, e.g. 2000 × 1000. ${overlay ? "Optional — the phone image is cropped if missing." : "Required for artwork so the text isn't cropped."}`}
            target={DESKTOP_RATIO}
            path={v.desktopImagePath}
            blob={previews.desktop}
            dims={[v.desktopWidth, v.desktopHeight]}
            state={uploads.desktop}
            error={errors.desktopImagePath}
            onFile={(f) => onFile("desktop", f)}
            onRemove={v.desktopImagePath ? removeDesktop : undefined}
          />
          {!overlay && (
            <Field id={`${ids}-alt`} label="Describe the graphic" hint="Read out by screen readers and seen by Google. Include any offer text." error={errors.alt}>
              <input
                id={`${ids}-alt`}
                className="field"
                maxLength={200}
                placeholder="e.g. Black Friday: 30% off all lamps, Nov 28 – Dec 1"
                value={v.alt}
                aria-invalid={!!errors.alt}
                onChange={(e) => set("alt", e.target.value)}
              />
            </Field>
          )}
        </fieldset>

        {overlay && (
          <fieldset className="space-y-5">
            <legend className="mb-3 text-[17px] font-medium text-brown-deep">Text</legend>
            <CountedInput id={`${ids}-eyebrow`} label="Small heading" max={40} value={v.eyebrow} onChange={(x) => set("eyebrow", x)} placeholder="e.g. NEW SEASON" />
            <CountedInput
              id={`${ids}-headline`}
              label="Headline"
              max={80}
              value={v.headline}
              onChange={(x) => set("headline", x)}
              placeholder="e.g. Warm brass for winter"
              error={errors.headline}
            />
            <CountedInput id={`${ids}-body`} label="Supporting text" max={200} value={v.body} onChange={(x) => set("body", x)} multiline />
            <CountedInput
              id={`${ids}-cta`}
              label="Button label"
              max={30}
              value={v.ctaLabel}
              onChange={(x) => set("ctaLabel", x)}
              hint="Leave empty to make the whole slide the link with no button."
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className={label}>Text position</p>
                <Select
                  value={v.textPosition}
                  onChange={(x) => set("textPosition", x as HeroSlideInput["textPosition"])}
                  options={[
                    ["bottom-left", "Bottom left"],
                    ["bottom-center", "Bottom centre"],
                    ["center", "Centre"],
                  ]}
                />
              </div>
              <div>
                <p className={label}>Text colour</p>
                <Select
                  value={v.textTone}
                  onChange={(x) => set("textTone", x as HeroSlideInput["textTone"])}
                  options={[
                    ["light", "Light (dark photos)"],
                    ["dark", "Dark (light photos)"],
                  ]}
                />
              </div>
              <div>
                <p className={label}>Shade behind text</p>
                <Select
                  value={v.scrim}
                  onChange={(x) => set("scrim", x as HeroSlideInput["scrim"])}
                  options={[
                    ["none", "None"],
                    ["soft", "Soft"],
                    ["strong", "Strong"],
                  ]}
                />
              </div>
            </div>
          </fieldset>
        )}

        <fieldset className="space-y-4">
          <legend className="mb-3 text-[17px] font-medium text-brown-deep">Link</legend>
          <Select
            value={v.linkType}
            onChange={(x) => set("linkType", x as HeroLinkType)}
            options={[
              ["none", "No link"],
              ["product", "A product"],
              ["category", "A category"],
              ["path", "A page on this site"],
              ["url", "Another website"],
            ]}
          />
          {v.linkType === "product" && (
            <ProductSearch
              value={product}
              error={errors.productId}
              onChange={(p) => {
                setProduct(p);
                set("productId", p?.id ?? null);
              }}
            />
          )}
          {v.linkType === "category" && (
            <Field id={`${ids}-cat`} label="Category" error={errors.categoryId}>
              <select
                id={`${ids}-cat`}
                className="field"
                value={v.categoryId ?? ""}
                aria-invalid={!!errors.categoryId}
                onChange={(e) => set("categoryId", e.target.value || null)}
              >
                <option value="">Choose…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {(v.linkType === "path" || v.linkType === "url") && (
            <Field
              id={`${ids}-url`}
              label={v.linkType === "path" ? "Page path" : "Web address"}
              hint={v.linkType === "path" ? "e.g. /shop/new, /shop?sort=price-asc or /gallery" : "Opens in a new tab."}
              error={errors.linkUrl}
            >
              <input
                id={`${ids}-url`}
                className="field"
                inputMode="url"
                maxLength={500}
                placeholder={v.linkType === "path" ? "/shop/new" : "https://"}
                value={v.linkUrl}
                aria-invalid={!!errors.linkUrl}
                onChange={(e) => set("linkUrl", e.target.value)}
              />
            </Field>
          )}
          {overlay && v.linkType === "product" && (
            <Toggle
              checked={v.showPrice}
              onChange={(x) => set("showPrice", x)}
              title="Show the live price"
              detail="Includes the sale price and % off. Hidden automatically if the product sells out."
            />
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-[17px] font-medium text-brown-deep">Schedule</legend>
          <p className="text-[13px] text-muted">Guyana time. Leave empty to run until you switch it off.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField id={`${ids}-start`} label="Starts" value={v.startsAt} onChange={(x) => set("startsAt", x)} error={errors.startsAt} />
            <DateField id={`${ids}-end`} label="Ends" value={v.endsAt} onChange={(x) => set("endsAt", x)} error={errors.endsAt} />
          </div>
        </fieldset>

        <Toggle
          checked={v.isVisible}
          onChange={(x) => set("isVisible", x)}
          title={v.isVisible ? "Switched on" : "Switched off"}
          detail="When on, the slide shows during its schedule. Only the first 5 live slides appear."
        />

        <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-line bg-cream/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`mb-2 text-[14px] ${msg.ok ? "text-[#2F5320]" : "text-error"}`}>
              {msg.text}
            </p>
          )}
          <div className="flex gap-3">
            <button type="submit" className="btn btn-gold flex-1 sm:flex-none" disabled={busy}>
              {saving ? "Saving…" : slideId ? "Save slide" : "Create slide"}
            </button>
            <Link href="/admin/hero" onClick={discardFresh} className="btn btn-outline">
              {slideId ? "Back" : "Cancel"}
            </Link>
          </div>
        </div>

        {slideId && (
          <div className="border-t border-line pt-4">
            {confirmDelete ? (
              <div className="flex gap-2">
                <button type="button" className="btn flex-1 bg-error text-cream" onClick={remove} disabled={saving}>
                  Yes, delete slide
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" className="min-h-11 text-[14px] text-error underline-offset-4 hover:underline" onClick={() => setConfirmDelete(true)}>
                Delete slide…
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

// --- Pieces ------------------------------------------------------------------

function omit<T extends Record<string, string>>(obj: T, ...keys: string[]): T {
  const next = { ...obj };
  for (const k of keys) delete next[k];
  return next;
}

/** Renders children at a real device width, scaled down to fit, so container-query layouts match the site. */
function ScaledFrame({ width, ratio, children }: { width: number; ratio: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = avail ? Math.min(1, avail / width) : 0;
  return (
    <div ref={ref} className="w-full overflow-hidden" style={{ height: width * ratio * scale }}>
      <div className="@container origin-top-left" style={{ width, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

function Field({ id, label: text, hint: h, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      {children}
      {error ? <p className="mt-1 text-[13px] text-error">{error}</p> : h ? <p className={hint}>{h}</p> : null}
    </div>
  );
}

function CountedInput({
  id,
  label: text,
  max,
  value,
  onChange,
  placeholder,
  multiline,
  hint: h,
  error,
}: {
  id: string;
  label: string;
  max: number;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
  error?: string;
}) {
  const props = {
    id,
    className: `field ${multiline ? "min-h-[84px]" : ""}`,
    maxLength: max,
    value,
    placeholder,
    "aria-invalid": !!error,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className={label}>
          {text}
        </label>
        <span className={`text-[12px] tabular-nums ${value.length > max * 0.9 ? "text-terracotta" : "text-muted"}`}>
          {value.length}/{max}
        </span>
      </div>
      {multiline ? <textarea {...props} /> : <input {...props} />}
      {error ? <p className="mt-1 text-[13px] text-error">{error}</p> : h ? <p className={hint}>{h}</p> : null}
    </div>
  );
}

function Segmented({
  name,
  value,
  options,
  onChange,
  wide,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <div role="radiogroup" className={`inline-flex border border-line-strong ${wide ? "w-full sm:w-auto" : ""}`}>
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center px-4 text-[14px] has-focus-visible:outline-2 has-focus-visible:outline-brown ${
            value === o.value ? "bg-brown text-cream" : "bg-cream-raised text-ink-soft"
          }`}
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([val, text]) => (
        <option key={val} value={val}>
          {text}
        </option>
      ))}
    </select>
  );
}

function Toggle({ checked, onChange, title, detail }: { checked: boolean; onChange: (v: boolean) => void; title: string; detail: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 border-y border-line py-3">
      <div>
        <p id={id} className="text-[15px] font-medium text-brown-deep">
          {title}
        </p>
        <p className="text-[13px] text-muted">{detail}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} onClick={() => onChange(!checked)} className="tap inline-flex shrink-0 items-center justify-center">
        <span className={`relative inline-block h-7 w-12 rounded-full transition-colors ${checked ? "bg-[#3E7B2A]" : "bg-line-strong"}`}>
          <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-cream-raised shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
        </span>
      </button>
    </div>
  );
}

function DateField({ id, label: text, value, onChange, error }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className={label}>
          {text}
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className="min-h-8 text-[12px] text-brown underline-offset-4 hover:underline">
            Clear
          </button>
        )}
      </div>
      <input id={id} type="datetime-local" className="field" value={value} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="mt-1 text-[13px] text-error">{error}</p>}
    </div>
  );
}

function ImageField({
  label: text,
  required,
  hint: h,
  target,
  path,
  blob,
  dims: [w, hgt],
  state,
  error,
  onFile,
  onRemove,
}: {
  label: string;
  required: boolean;
  hint: string;
  target: number;
  path: string | null;
  blob?: string;
  dims: [number | null, number | null];
  state: UploadState;
  error?: string;
  onFile: (f: File | undefined) => void;
  onRemove?: () => void;
}) {
  const id = useId();
  const ratio = w && hgt ? w / hgt : null;
  const off = ratio != null && Math.abs(ratio - target) / target > 0.08;
  const has = Boolean(blob || path);
  return (
    <div>
      <p className={label}>
        {text} {required ? <span className="text-error">*</span> : <span className="font-normal text-muted">(optional)</span>}
      </p>
      <div className="flex items-start gap-3">
        <div className={`relative shrink-0 overflow-hidden bg-sand-image ${target < 1 ? "aspect-[4/5] w-20" : "aspect-[2/1] w-32"}`}>
          {blob ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={blob} alt="" className="h-full w-full object-cover" />
          ) : path ? (
            <PoshImage path={path} bucket="site" alt="" fill sizes="128px" className="object-cover" />
          ) : null}
          {state.status === "working" && (
            <span className="absolute inset-0 flex items-center justify-center bg-cream/80 text-[12px] text-brown-deep">{state.label}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <label htmlFor={id} className="btn btn-outline min-h-11 cursor-pointer px-4">
              {has ? "Replace" : "Upload"}
            </label>
            <input
              id={id}
              type="file"
              accept="image/*,.heic,.heif"
              className="sr-only"
              disabled={state.status === "working"}
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {onRemove && (
              <button type="button" onClick={onRemove} className="min-h-11 px-2 text-[13px] text-error">
                Remove
              </button>
            )}
          </div>
          {state.status === "error" ? (
            <p className="mt-1 text-[13px] text-error">{state.message}</p>
          ) : error ? (
            <p className="mt-1 text-[13px] text-error">{error}</p>
          ) : (
            <p className={hint}>{h}</p>
          )}
          {off && (
            <p className="mt-1 text-[12px] text-terracotta">
              This image is {w} × {hgt}, so the edges will be cropped. Check the preview.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductSearch({
  value,
  onChange,
  error,
}: {
  value: AdminHeroProduct | null;
  onChange: (p: AdminHeroProduct | null) => void;
  error?: string;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminHeroProduct[]>([]);
  const timer = useRef<number | undefined>(undefined);
  /** Bumped on every keystroke; responses for older terms are dropped. */
  const seq = useRef(0);

  function search(term: string) {
    setQ(term);
    window.clearTimeout(timer.current);
    const mine = ++seq.current;
    if (!term.trim()) return setResults([]);
    timer.current = window.setTimeout(async () => {
      const res = await searchProductsForRelated(term, "").catch(() => []);
      if (mine !== seq.current) return;
      setResults(
        res.map((r) => ({ id: r.id, name: r.name, slug: r.slug, status: r.status, imagePath: r.imagePath, price: r.price, compareAt: r.compareAt })),
      );
    }, 250);
  }

  if (value) {
    return (
      <div>
        <p className={label}>Product</p>
        <div className="flex items-center gap-3 border border-line bg-cream-raised p-2">
          <div className="relative aspect-[4/5] w-10 shrink-0 overflow-hidden bg-sand-image">
            {value.imagePath && <PoshImage path={value.imagePath} alt="" fill sizes="40px" className="object-cover" />}
          </div>
          <span className="min-w-0 flex-1 text-[14px]">
            {value.name}
            {value.status !== "published" && <span className="mt-0.5 block text-[12px] text-error">⚠ Not published — the slide won&apos;t show</span>}
          </span>
          <button type="button" className="min-h-11 px-3 text-[13px] text-brown" onClick={() => onChange(null)}>
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={label}>
        Product
      </label>
      <input id={id} type="search" className="field" placeholder="Search products by name" value={q} aria-invalid={!!error} onChange={(e) => search(e.target.value)} />
      {error && <p className="mt-1 text-[13px] text-error">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line border border-line bg-cream-raised">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-3 px-2 py-1.5 text-left text-[14px] hover:bg-sand"
                onClick={() => {
                  onChange(r);
                  setQ("");
                  setResults([]);
                }}
              >
                <span className="relative aspect-[4/5] w-8 shrink-0 overflow-hidden bg-sand-image">
                  {r.imagePath && <PoshImage path={r.imagePath} alt="" fill sizes="32px" className="object-cover" />}
                </span>
                <span className="flex-1">{r.name}</span>
                {r.status !== "published" && <span className="text-[12px] text-muted">{r.status}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
