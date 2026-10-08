"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { submitInquiry } from "@/app/actions/inquiry";
import { bag, customerStore, saveLastInquiry, type CustomerDetails } from "@/lib/bag/stores";
import { useHydrated } from "@/lib/bag/local-store";
import { normalisePhone, PHONE_ERROR } from "@/lib/phone/normalize";
import { buildOrderMessage } from "@/lib/whatsapp/message";
import { track } from "@/lib/analytics";
import { WhatsAppIcon } from "@/components/ui/icons";
import { SubtotalValue, UnpricedNote, useBagLines, type BagLine } from "./bag-lines";
import { StepLabel } from "./cart-view";
import { useStore } from "./store-provider";

const NOTE_MAX = 500;

function isMobileDevice() {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

type Fields = CustomerDetails & { note: string; website: string };
type Errors = Partial<Record<"name" | "phone" | "address" | "bag", string>>;

function validate(f: Fields, lines: BagLine[]): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Please enter your name";
  if (!normalisePhone(f.phone)) e.phone = PHONE_ERROR;
  if (f.fulfilment === "delivery" && !f.address.trim()) e.address = "Please enter a delivery address";
  if (lines.length === 0) e.bag = "Your bag is empty";
  return e;
}

export function CheckoutView() {
  const hydrated = useHydrated();
  const { refreshBag } = useStore();
  const { lines, ready, storedCount } = useBagLines();

  useEffect(() => {
    refreshBag();
  }, [refreshBag]);

  if (!hydrated || (!ready && storedCount > 0 && lines.length === 0)) {
    return (
      <div className="container-posh pt-10 pb-24 nav:pt-14">
        <StepLabel step={2} />
        <p className="mt-10 text-muted" aria-busy="true">
          Loading…
        </p>
      </div>
    );
  }
  if (storedCount === 0) {
    return (
      <div className="container-posh pt-10 pb-24 nav:pt-14">
        <div className="flex flex-col items-center bg-sand px-6 py-20 text-center">
          <p className="font-display text-[32px] text-brown-deep">Your bag is empty</p>
          <p className="mt-2 text-[15px] text-ink-soft">Add a few pieces, then send your order on WhatsApp.</p>
          <Link href="/shop" className="btn btn-primary mt-8">
            Browse the collection
          </Link>
        </div>
      </div>
    );
  }
  // Mount the form only after hydration so remembered details seed initial state.
  return <CheckoutForm initial={customerStore.read()} />;
}

function CheckoutForm({ initial }: { initial: CustomerDetails }) {
  const router = useRouter();
  const { whatsappNumber, pricePrefix } = useStore();
  const { lines, subtotal, count, unpricedCount } = useBagLines();
  const allUnpriced = unpricedCount > 0 && unpricedCount === lines.length;
  const [f, setF] = useState<Fields>({ ...initial, note: "", website: "" });
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const nonce = useRef<string | null>(null);
  const ids = useId();

  // A nonce per checkout visit makes double-taps idempotent on the server.
  useEffect(() => {
    nonce.current = crypto.randomUUID();
  }, []);

  const errors = tried ? validate(f, lines) : {};
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const phone = normalisePhone(f.phone);
  const preview = buildOrderMessage(
    {
      ref: "PH-•••••",
      lines: lines.map((l) => ({ name: l.product.name, qty: l.qty, lineTotal: l.lineTotal, availability: l.product.availability })),
      subtotal,
      fulfilment: f.fulfilment,
      name: f.name.trim() || "Your name",
      phoneDisplay: phone?.display ?? (f.phone.trim() || "Your WhatsApp number"),
      address: f.address.trim() || (f.fulfilment === "delivery" ? "Your address" : null),
      note: f.note.trim() || null,
      pricePrefix,
    },
    whatsappNumber,
  ).text;

  function send() {
    setTried(true);
    setServerError(null);
    const errs = validate(f, lines);
    if (Object.keys(errs).length) {
      const first = (["name", "phone", "address"] as const).find((k) => errs[k]);
      if (first) document.getElementById(`${ids}-${first}`)?.focus();
      return;
    }

    const mobile = isMobileDevice();
    // Must open synchronously inside the tap handler, or popup blockers will stop it.
    let win: Window | null = null;
    if (!mobile) {
      win = window.open("", "_blank");
      if (win) {
        try {
          win.opener = null;
          win.document.title = "Opening WhatsApp…";
          win.document.body.innerHTML =
            '<p style="font-family:system-ui;padding:2rem;color:#3B2314">Opening WhatsApp…</p>';
        } catch {
          // ignore
        }
      }
    }
    setPending(true);
    void finish(win, mobile);
  }

  async function finish(win: Window | null, mobile: boolean) {
    const firstName = f.name.trim().split(/\s+/)[0] ?? "";
    let ref: string;
    let url: string;
    let fallback = false;
    try {
      const res = await submitInquiry({
        clientNonce: nonce.current ?? crypto.randomUUID(),
        name: f.name,
        phone: f.phone,
        fulfilment: f.fulfilment,
        address: f.fulfilment === "delivery" ? f.address : "",
        note: f.note,
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        website: f.website,
      });
      if (res.ok) {
        ref = res.ref;
        url = res.waUrl;
      } else if (res.code === "validation" && res.error !== "These pieces are no longer listed") {
        // Server disagreed with client validation: show it, keep the form.
        win?.close();
        setPending(false);
        setTried(true);
        setServerError(res.error);
        return;
      } else {
        throw new Error(res.code);
      }
    } catch {
      // Never block a sale: build the message locally with a generic ref.
      fallback = true;
      ref = "PH-WEB";
      url = buildOrderMessage(
        {
          ref,
          lines: lines.map((l) => ({ name: l.product.name, qty: l.qty, lineTotal: l.lineTotal, availability: l.product.availability })),
          subtotal,
          fulfilment: f.fulfilment,
          name: f.name.trim(),
          phoneDisplay: normalisePhone(f.phone)?.display ?? f.phone.trim(),
          address: f.fulfilment === "delivery" ? f.address.trim() : null,
          note: f.note.trim() || null,
          pricePrefix,
        },
        whatsappNumber,
      ).url;
    }

    track("inquiry_sent", { fallback, items: count });
    customerStore.write({ name: f.name.trim(), phone: f.phone.trim(), fulfilment: f.fulfilment, address: f.address.trim() });
    const sameTab = mobile || !win || win.closed;
    saveLastInquiry({ ref, firstName, fulfilment: f.fulfilment, waUrl: url, pendingOpen: sameTab });
    bag.clear();

    if (!sameTab && win) {
      win.location.href = url;
    }
    // On mobile (or when the popup was blocked) the confirmation page opens
    // WhatsApp in this tab, so Back returns to the confirmation.
    router.push(`/order/${ref}`);
  }

  const labelCls = "label-caps mb-2 block text-ink-soft";
  const errCls = "mt-2 text-[13px] text-error";

  return (
    <div className="container-posh pt-10 pb-24 nav:pt-14">
      <StepLabel step={2} />
      <h1 className="mt-3 font-display text-[clamp(38px,5vw,64px)] leading-none font-medium text-brown-deep">
        Send your order
      </h1>
      <p className="mt-3 max-w-xl text-[15px] text-ink-soft">
        We&apos;ll open WhatsApp with your order ready to send. Nothing is charged on the website.
      </p>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) send();
        }}
        className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_440px]"
      >
        <div className="space-y-7">
          {serverError && (
            <p role="alert" className="border border-error/40 bg-error/5 px-4 py-3 text-[14px] text-error">
              {serverError}
            </p>
          )}
          {tried && Object.keys(errors).length > 0 && (
            <p role="alert" className="border border-error/40 bg-error/5 px-4 py-3 text-[14px] text-error">
              Please check the highlighted details.
            </p>
          )}

          <div>
            <label htmlFor={`${ids}-name`} className={labelCls}>
              Full name
            </label>
            <input
              id={`${ids}-name`}
              className="field"
              autoComplete="name"
              maxLength={80}
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${ids}-name-err` : undefined}
            />
            {errors.name && (
              <p id={`${ids}-name-err`} className={errCls}>
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${ids}-phone`} className={labelCls}>
              WhatsApp number
            </label>
            <input
              id={`${ids}-phone`}
              className="field"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. 674 0000"
              maxLength={20}
              value={f.phone}
              onChange={(e) => set("phone", e.target.value)}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={`${ids}-phone-hint${errors.phone ? ` ${ids}-phone-err` : ""}`}
            />
            <p id={`${ids}-phone-hint`} className="mt-2 text-[13px] text-muted">
              Guyana numbers don&apos;t need +592.
            </p>
            {errors.phone && (
              <p id={`${ids}-phone-err`} className={errCls}>
                {errors.phone}
              </p>
            )}
          </div>

          <fieldset>
            <legend className={labelCls}>Delivery or collection</legend>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "delivery", title: "Delivery", desc: "Fee confirmed on WhatsApp" },
                  { value: "collection", title: "Collect", desc: "From the showroom" },
                ] as const
              ).map((o) => (
                <label
                  key={o.value}
                  className={`flex min-h-[72px] cursor-pointer flex-col justify-center border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold ${
                    f.fulfilment === o.value ? "border-brown bg-cream-raised" : "border-line-strong hover:border-brown/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfilment"
                    value={o.value}
                    checked={f.fulfilment === o.value}
                    onChange={() => set("fulfilment", o.value)}
                    className="sr-only"
                  />
                  <span className="font-display text-[20px] leading-tight text-brown-deep">{o.title}</span>
                  <span className="mt-0.5 text-[13px] text-muted">{o.desc}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {f.fulfilment === "delivery" && (
            <div>
              <label htmlFor={`${ids}-address`} className={labelCls}>
                Delivery address
              </label>
              <textarea
                id={`${ids}-address`}
                className="field min-h-[96px] resize-y"
                autoComplete="street-address"
                maxLength={300}
                value={f.address}
                onChange={(e) => set("address", e.target.value)}
                aria-invalid={errors.address ? true : undefined}
                aria-describedby={errors.address ? `${ids}-address-err` : undefined}
              />
              {errors.address && (
                <p id={`${ids}-address-err`} className={errCls}>
                  {errors.address}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor={`${ids}-note`} className={labelCls}>
              Note <span className="normal-case tracking-normal text-muted">(optional)</span>
            </label>
            <textarea
              id={`${ids}-note`}
              className="field min-h-[96px] resize-y"
              maxLength={NOTE_MAX}
              value={f.note}
              onChange={(e) => set("note", e.target.value)}
              aria-describedby={`${ids}-note-count`}
              placeholder="Anything we should know?"
            />
            <p id={`${ids}-note-count`} className="mt-2 text-right text-[12px] text-muted" aria-live="polite">
              {f.note.length}/{NOTE_MAX}
            </p>
          </div>

          {/* Honeypot: hidden from people, tempting to bots. */}
          <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                name="website"
                value={f.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </label>
          </div>
        </div>

        <aside className="self-start lg:sticky lg:top-[150px]" aria-label="Message preview">
          <p className="label-caps text-ink-soft">Your WhatsApp message</p>
          <div className="mt-3 bg-[#EFE7DD] p-4 sm:p-5">
            <div className="relative ml-auto max-w-[95%] rounded-lg rounded-tr-none bg-[#DCF8C6] px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap text-[#111B21] shadow-sm">
              {preview}
              <span className="mt-1 block text-right text-[11px] text-[#667781]">Preview</span>
            </div>
          </div>
          <div className="mt-5 flex items-baseline justify-between">
            <span className="label-caps text-ink-soft">Subtotal</span>
            <span className="text-[20px] font-medium text-brown">
              <SubtotalValue subtotal={subtotal} allUnpriced={allUnpriced} />
            </span>
          </div>
          <UnpricedNote count={unpricedCount} allUnpriced={allUnpriced} />
          <p className="mt-1 text-[13px] text-muted">Delivery (if any) is confirmed in the chat. All prices in GYD.</p>
          {errors.bag && <p className={errCls}>{errors.bag}</p>}
          <button type="submit" disabled={pending} className="btn btn-gold mt-5 w-full" aria-busy={pending}>
            <WhatsAppIcon size={18} />
            {pending ? "Opening WhatsApp…" : "Send order on WhatsApp"}
          </button>
          <Link href="/cart" className="label-caps mt-4 inline-flex min-h-11 items-center text-brown hover:underline">
            ← Back to bag
          </Link>
        </aside>
      </form>
    </div>
  );
}
