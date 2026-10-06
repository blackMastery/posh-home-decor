import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatPrice } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/time";
import { CopyButton } from "@/components/admin/copy-button";
import { waUrl } from "@/lib/whatsapp/message";
import { PoshImage } from "@/components/ui/posh-image";

export const metadata: Metadata = { title: "Inquiry" };

type Item = {
  product_id: string;
  slug: string;
  name: string;
  note: string | null;
  unit_price: number;
  qty: number;
  line_total: number;
  was_available: boolean;
  image_path: string | null;
};

export default async function InquiryDetail({ params }: PageProps<"/admin/inquiries/[id]">) {
  const { supabase } = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: inq } = await supabase.from("inquiries").select("*").eq("id", id).maybeSingle();
  if (!inq) notFound();

  const items = (inq.items as unknown as Item[]) ?? [];
  const { data: current } = await supabase
    .from("products")
    .select("id, price, is_available, status, slug")
    .in("id", items.map((i) => i.product_id));
  const now = new Map((current ?? []).map((p) => [p.id, p]));

  const card = "border border-line bg-cream-raised p-4";
  const label = "text-[12px] font-medium tracking-[0.12em] text-muted uppercase";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <Link href="/admin/inquiries" className="inline-flex min-h-11 items-center text-[14px] text-brown">
        ← Inquiries
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-[26px] font-medium tracking-wide text-brown-deep">{inq.ref}</h1>
        <CopyButton text={inq.ref} label="Copy ref" />
      </div>
      <p className="mt-1 text-[14px] text-muted">{formatDateTime(inq.created_at)}</p>

      <section className={`${card} mt-6`}>
        <p className={label}>Customer</p>
        <p className="mt-1 text-[18px] font-medium text-brown-deep">{inq.customer_name}</p>
        <p className="mt-0.5 text-[15px]">
          <a href={`tel:${inq.phone_e164}`} className="underline-offset-4 hover:underline">
            {inq.phone_e164}
          </a>
          {inq.phone_raw !== inq.phone_e164 && <span className="text-muted"> (typed “{inq.phone_raw}”)</span>}
        </p>
        <a
          href={waUrl(
            inq.phone_e164.replace(/\D/g, ""),
            `Hello ${inq.customer_name.split(" ")[0]}, this is Posh Home Decor about your order ${inq.ref}.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary mt-4 w-full sm:w-auto"
        >
          Open chat
        </a>
      </section>

      <section className={`${card} mt-4 grid gap-4 sm:grid-cols-2`}>
        <div>
          <p className={label}>Fulfilment</p>
          <p className="mt-1 text-[15px]">{inq.fulfilment === "delivery" ? "Delivery" : "Collection from the showroom"}</p>
          {inq.address && <p className="mt-1 text-[15px] whitespace-pre-line text-ink-soft">{inq.address}</p>}
        </div>
        {inq.note && (
          <div className="sm:col-span-2">
            <p className={label}>Note</p>
            <p className="mt-1 text-[15px] whitespace-pre-line">{inq.note}</p>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-[18px] font-medium text-brown-deep">
          Items <span className="text-muted">({inq.item_count})</span>
        </h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {items.map((i) => {
            const live = now.get(i.product_id);
            const notes: string[] = [];
            if (!live || live.status === "archived") notes.push("No longer listed");
            else {
              if (live.status === "draft") notes.push("Now unpublished");
              if (i.was_available && !live.is_available) notes.push("Now sold out");
              if (!i.was_available && live.is_available) notes.push("Now available");
              if (live.price !== i.unit_price) notes.push(`Now ${formatPrice(live.price)}`);
            }
            return (
              <li key={i.product_id} className="flex gap-3 py-4">
                <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-sand-image">
                  {i.image_path && <PoshImage path={i.image_path} alt="" fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-brown-deep">{i.name}</p>
                  <p className="text-[13px] text-muted">
                    {i.qty} × {formatPrice(i.unit_price)}
                    {!i.was_available && " · marked sold out when sent"}
                  </p>
                  {notes.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {notes.map((n) => (
                        <span key={n} className="bg-gold/25 px-2 py-0.5 text-[12px] font-medium text-brown-deep">
                          {n}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-[15px] font-medium text-brown">{formatPrice(i.line_total)}</p>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex justify-between text-[16px]">
          <span className="text-ink-soft">Subtotal at the time</span>
          <span className="font-medium text-brown">{formatPrice(inq.subtotal)}</span>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-medium text-brown-deep">Message sent to WhatsApp</h2>
          <CopyButton text={inq.message_text} label="Copy" />
        </div>
        <pre className="mt-3 overflow-x-auto bg-sand p-4 font-sans text-[14px] leading-relaxed whitespace-pre-wrap">
          {inq.message_text}
        </pre>
      </section>
    </div>
  );
}
