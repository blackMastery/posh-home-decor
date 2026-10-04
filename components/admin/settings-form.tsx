"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { saveSettings, type SettingsInputT } from "@/app/admin/actions/settings";
import { createClient } from "@/lib/supabase/browser";
import { PoshImage } from "@/components/ui/posh-image";
import { prepareImage } from "./image-prep";

type Values = Omit<SettingsInputT, "newWindowDays"> & { newWindowDays: number };

export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const ids = useId();
  const [v, setV] = useState<Values>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [heroStatus, setHeroStatus] = useState<string | null>(null);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));

  const digits = v.whatsappNumber.replace(/\D/g, "");
  const label = "mb-2 block text-[13px] font-medium tracking-[0.08em] text-ink-soft uppercase";
  const err = (k: string) => fieldErrors[k] && <p className="mt-1.5 text-[13px] text-error">{fieldErrors[k]}</p>;

  async function onHero(file: File) {
    try {
      setHeroStatus("Preparing…");
      const prepared = await prepareImage(file, (p) => setHeroStatus(`Preparing ${p}%`));
      setHeroStatus("Uploading…");
      const path = `hero/${crypto.randomUUID()}.jpg`;
      const { error } = await createClient().storage.from("site").upload(path, prepared.blob, { contentType: "image/jpeg" });
      if (error) throw new Error("Upload failed — check your connection");
      set("heroImagePath", path);
      setHeroStatus("Uploaded — press Save to publish it.");
    } catch (e) {
      setHeroStatus(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setFieldErrors({});
    const res = await saveSettings(v).catch(() => ({ ok: false as const, error: "Couldn't reach the server — try again.", fieldErrors: undefined }));
    setSaving(false);
    if (!res.ok) {
      setFieldErrors(res.fieldErrors ?? {});
      setMsg({ ok: false, text: res.error });
      return;
    }
    setMsg({ ok: true, text: "Settings saved." });
    setHeroStatus(null);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-10">
      <section className="space-y-5">
        <h2 className="text-[18px] font-medium text-garnet-deep">Shop</h2>
        <div>
          <label htmlFor={`${ids}-wa`} className={label}>
            WhatsApp number
          </label>
          <div className="flex gap-2">
            <input
              id={`${ids}-wa`}
              className="field"
              inputMode="numeric"
              value={v.whatsappNumber}
              onChange={(e) => set("whatsappNumber", e.target.value)}
              aria-describedby={`${ids}-wa-hint`}
              aria-invalid={fieldErrors.whatsappNumber ? true : undefined}
            />
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline shrink-0 px-4">
              Test
            </a>
          </div>
          <p id={`${ids}-wa-hint`} className="mt-1.5 text-[12px] text-muted">
            Digits only, with country code — e.g. 5926748619. Orders are sent to this number.
          </p>
          {err("whatsappNumber")}
        </div>
        <div>
          <label htmlFor={`${ids}-dp`} className={label}>
            Display phone (footer)
          </label>
          <input id={`${ids}-dp`} className="field" value={v.displayPhone} onChange={(e) => set("displayPhone", e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${ids}-nw`} className={label}>
            “New” badge lasts (days)
          </label>
          <input
            id={`${ids}-nw`}
            className="field max-w-[140px]"
            inputMode="numeric"
            value={v.newWindowDays}
            onChange={(e) => set("newWindowDays", Math.max(1, Math.min(365, Number(e.target.value.replace(/\D/g, "")) || 1)))}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-ss`} className={label}>
            Styling Studio WhatsApp message
          </label>
          <textarea id={`${ids}-ss`} className="field min-h-[80px]" value={v.stylingStudioMessage} onChange={(e) => set("stylingStudioMessage", e.target.value)} />
        </div>
      </section>

      <section className="space-y-5 border-t border-line pt-8">
        <h2 className="text-[18px] font-medium text-garnet-deep">Home page hero</h2>
        <div className="relative aspect-[16/9] overflow-hidden bg-garnet-deep">
          {v.heroImagePath ? (
            <PoshImage path={v.heroImagePath} bucket="site" alt="" fill sizes="(max-width: 1024px) 100vw, 720px" className="object-cover opacity-80" />
          ) : (
            <Image src="/images/hero.jpg" alt="" fill sizes="(max-width: 1024px) 100vw, 720px" className="object-cover opacity-80" />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(62,7,16,0.85))] p-4 text-cream">
            <p className="text-[10px] tracking-[0.24em] text-gold uppercase">{v.heroEyebrow}</p>
            <p className="font-display text-[26px] leading-tight">
              {v.heroHeadline} <em className="text-gold-light">{v.heroHeadlineAccent}</em>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn btn-outline min-h-11 cursor-pointer px-4">
            Change image
            <input type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(e) => e.target.files?.[0] && void onHero(e.target.files[0])} />
          </label>
          {v.heroImagePath && (
            <button type="button" className="min-h-11 px-3 text-[14px] text-error" onClick={() => set("heroImagePath", null)}>
              Use default image
            </button>
          )}
          {heroStatus && (
            <span role="status" className="text-[13px] text-muted">
              {heroStatus}
            </span>
          )}
        </div>
        <div>
          <label htmlFor={`${ids}-he`} className={label}>
            Eyebrow
          </label>
          <input id={`${ids}-he`} className="field" value={v.heroEyebrow} onChange={(e) => set("heroEyebrow", e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${ids}-hh`} className={label}>
            Headline
          </label>
          <input id={`${ids}-hh`} className="field" value={v.heroHeadline} onChange={(e) => set("heroHeadline", e.target.value)} />
          {err("heroHeadline")}
        </div>
        <div>
          <label htmlFor={`${ids}-ha`} className={label}>
            Headline accent (gold italic)
          </label>
          <input id={`${ids}-ha`} className="field" value={v.heroHeadlineAccent} onChange={(e) => set("heroHeadlineAccent", e.target.value)} />
        </div>
      </section>

      <section className="space-y-5 border-t border-line pt-8">
        <h2 className="text-[18px] font-medium text-garnet-deep">Product page defaults</h2>
        <p className="-mt-3 text-[13px] text-muted">Pre-filled on new products. Existing products keep their own text.</p>
        {(
          [
            ["defaultDetailsText", "Details"],
            ["defaultCareText", "Care"],
            ["defaultDeliveryText", "Delivery & collection"],
          ] as const
        ).map(([k, t]) => (
          <div key={k}>
            <label htmlFor={`${ids}-${k}`} className={label}>
              {t}
            </label>
            <textarea id={`${ids}-${k}`} className="field min-h-[96px]" value={v[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
      </section>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-line bg-cream-raised/95 px-4 py-3 backdrop-blur lg:bottom-0">
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`mb-2 text-[14px] ${msg.ok ? "text-[#2F5320]" : "text-error"}`}>
            {msg.text}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
