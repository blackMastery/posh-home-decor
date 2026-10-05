"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { loadInquiries } from "@/app/admin/actions/inquiries";
import type { InquiryListItem, InquiryRange } from "@/lib/admin/inquiries";
import { formatPrice } from "@/lib/format/money";
import { relativeTime } from "@/lib/format/time";

const PAGE = 30;
const LAST_VISIT_KEY = "posh-admin-inquiries-last-visit";
const RANGES: { value: InquiryRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All" },
];

export function InquiryList({ initial, q, range }: { initial: InquiryListItem[]; q: string; range: InquiryRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState(initial.length < PAGE);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(q);
  const [lastVisit, setLastVisit] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // "New since last visit" dot: device-local, no server state.
  useEffect(() => {
    let prev = 0;
    try {
      prev = Number(window.localStorage.getItem(LAST_VISIT_KEY)) || 0;
      window.localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setLastVisit(prev);
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loading) return;
      setLoading(true);
      try {
        const more = await loadInquiries({ q, range }, items.length);
        setItems((prev) => [...prev, ...more]);
        if (more.length < PAGE) setDone(true);
      } finally {
        setLoading(false);
      }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, done, loading, q, range]);

  const navigate = (next: { q?: string; range?: InquiryRange }) => {
    const params = new URLSearchParams();
    const nq = next.q ?? q;
    const nr = next.range ?? range;
    if (nq.trim()) params.set("q", nq.trim());
    if (nr !== "all") params.set("range", nr);
    const s = params.toString();
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname));
  };

  return (
    <div className="mt-6">
      <input
        type="search"
        placeholder="Search ref, name or phone"
        aria-label="Search inquiries"
        className="field"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          window.clearTimeout(timer.current);
          const v = e.target.value;
          timer.current = window.setTimeout(() => navigate({ q: v }), 350);
        }}
      />
      <div className="mt-3 flex gap-2" role="group" aria-label="Date range">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => navigate({ range: r.value })}
            aria-pressed={range === r.value}
            className={`min-h-11 flex-1 border text-[13px] ${
              range === r.value ? "border-brown bg-brown text-cream" : "border-line-strong text-ink-soft"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-10 bg-sand px-4 py-12 text-center text-[15px] text-ink-soft">
          {q ? "No inquiries match that search." : "No inquiries yet in this period."}
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {items.map((i) => {
            const isNew = lastVisit !== null && new Date(i.created_at).getTime() > lastVisit;
            return (
              <li key={i.id}>
                <Link href={`/admin/inquiries/${i.id}`} className="flex items-center gap-3 py-4 hover:bg-cream-raised">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${isNew ? "bg-brown" : "bg-transparent"}`}
                    aria-label={isNew ? "New" : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[16px] font-medium text-brown-deep">{i.customer_name}</p>
                      <p className="shrink-0 text-[15px] font-medium text-brown">{formatPrice(i.subtotal)}</p>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[13px] text-muted">
                      <span className="font-mono tracking-wide">
                        {i.ref} · {i.item_count} {i.item_count === 1 ? "item" : "items"}
                      </span>
                      <time dateTime={i.created_at} suppressHydrationWarning>
                        {relativeTime(i.created_at)}
                      </time>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={sentinel} className="py-6 text-center text-[13px] text-muted">
        {loading ? "Loading more…" : done && items.length > 0 ? "That's everything." : ""}
      </div>
    </div>
  );
}
