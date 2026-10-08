"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/inquiries", label: "Inquiries", icon: "M4 6h16v10H8l-4 4V6Z" },
  { href: "/admin/products", label: "Products", icon: "M5 8h14l-1 12H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2" },
  { href: "/admin/gallery", label: "Gallery", icon: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1.5 1.5 0 1 0 0-.01" },
  { href: "/admin/categories", label: "Categories", icon: "M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z" },
  { href: "/admin/settings", label: "Settings", icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3-2 .7-.6 1.5 1 1.9-1.4 1.4-1.9-1-1.5.6L13 20h-2l-.7-2-1.5-.6-1.9 1-1.4-1.4 1-1.9-.6-1.5L4 13v-2l2-.7.6-1.5-1-1.9 1.4-1.4 1.9 1 1.5-.6L11 4h2l.7 2 1.5.6 1.9-1 1.4 1.4-1 1.9.6 1.5 2 .6v2Z" },
];

export function AdminNavWithPathname() {
  return <AdminNav pathname={usePathname()} />;
}

export function AdminNav({ pathname }: { pathname: string }) {
  return (
    <>
      {/* Top bar (mobile) / rail header (desktop) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-cream/95 px-4 backdrop-blur lg:hidden">
        <Link href="/admin/inquiries" className="font-display text-[22px] font-semibold tracking-[0.24em] text-brown-deep">
          POSH <span className="font-sans text-[11px] font-medium tracking-[0.2em] text-bronze">ADMIN</span>
        </Link>
        <Link href="/" target="_blank" className="label-caps inline-flex min-h-11 items-center text-brown">
          View site ↗
        </Link>
      </header>

      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream-raised pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-t-0 lg:border-r lg:pb-0"
      >
        <div className="hidden px-6 pt-8 pb-10 lg:block">
          <Link href="/admin/inquiries" className="font-display text-[26px] font-semibold tracking-[0.24em] text-brown-deep">
            POSH
          </Link>
          <p className="text-[11px] font-medium tracking-[0.2em] text-bronze">ADMIN</p>
        </div>
        <ul className="grid grid-cols-5 lg:flex lg:flex-col lg:gap-1 lg:px-3">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[64px] flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-wide lg:h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-[14px] ${
                    active ? "text-brown lg:bg-sand" : "text-ink-soft hover:text-brown"
                  }`}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
                    <path d={t.icon} />
                  </svg>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto hidden px-6 pt-10 lg:block">
          <Link href="/" target="_blank" className="label-caps inline-flex min-h-11 items-center text-brown">
            View site ↗
          </Link>
        </div>
      </nav>
    </>
  );
}
