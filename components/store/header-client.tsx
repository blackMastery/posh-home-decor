"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBagCount } from "@/lib/bag/stores";
import { useHydrated } from "@/lib/bag/local-store";
import { BagIcon, ChevronDown, CloseIcon, MenuIcon } from "@/components/ui/icons";
import { useDialog } from "@/components/ui/use-dialog";
import { useStore } from "./store-provider";
import { Logo } from "./logo";

export type NavCategory = { name: string; path: string; children: NavCategory[] };

const PRIMARY = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/cart", label: "Cart" },
  { href: "/about", label: "About" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/shop") return pathname.startsWith("/shop") || pathname.startsWith("/products");
  return pathname.startsWith(href);
}

type HeaderProps = { categories: NavCategory[]; showNew: boolean; showSale: boolean };

/** Reads the pathname (runtime data), so it renders inside <Suspense>. */
export function HeaderWithPathname(props: HeaderProps) {
  return <HeaderClient {...props} pathname={usePathname()} />;
}

/** Without a pathname (static shell / Suspense fallback) nothing is marked active. */
export function HeaderClient({ categories, showNew, showSale, pathname }: HeaderProps & { pathname: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { openBag } = useStore();
  const count = useBagCount();
  const hydrated = useHydrated();

  // Close the mobile menu on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/90">
      <div className="container-posh flex h-[68px] items-center justify-between gap-4 nav:h-[76px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="tap -ml-2.5 inline-flex items-center justify-center text-brown-deep nav:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <MenuIcon size={24} />
          </button>
          <Link href="/" className="inline-flex min-h-11 items-center" aria-label="Posh Home Decor — home">
            <Logo />
          </Link>
        </div>

        <nav aria-label="Primary" className="hidden nav:block">
          <ul className="flex items-center gap-10">
            {PRIMARY.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`label-caps relative inline-flex min-h-11 items-center transition-colors hover:text-brown ${
                      active
                        ? "text-brown after:absolute after:inset-x-0 after:bottom-2 after:h-px after:bg-brown"
                        : "text-ink-soft"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          onClick={openBag}
          className="tap relative -mr-2.5 inline-flex items-center justify-center text-brown-deep transition-colors hover:text-brown"
          aria-label={hydrated && count > 0 ? `Open bag, ${count} item${count === 1 ? "" : "s"}` : "Open bag"}
        >
          <BagIcon size={24} />
          {hydrated && count > 0 && (
            <span className="absolute top-1 right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brown px-1 text-[10px] font-medium text-cream">
              {count}
            </span>
          )}
        </button>
      </div>

      <CategoryBar categories={categories} showNew={showNew} showSale={showSale} pathname={pathname} />

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        categories={categories}
        showNew={showNew}
        showSale={showSale}
        pathname={pathname}
      />
    </header>
  );
}

// ---------------------------------------------------------------------------
// Desktop category bar + data-driven mega menu
// ---------------------------------------------------------------------------

function CategoryBar({
  categories,
  showNew,
  showSale,
  pathname,
}: {
  categories: NavCategory[];
  showNew: boolean;
  showSale: boolean;
  pathname: string;
}) {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpenPath(null);
  }

  const open = (path: string | null) => {
    window.clearTimeout(closeTimer.current);
    setOpenPath(path);
  };
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenPath(null), 120);
  };

  const linkClass = (active: boolean) =>
    `label-caps inline-flex min-h-11 items-center gap-1 transition-colors hover:text-brown ${active ? "text-brown" : "text-ink-soft"}`;

  return (
    <nav aria-label="Categories" className="relative hidden border-t border-line nav:block" onMouseLeave={scheduleClose}>
      <ul className="container-posh flex items-center justify-center gap-x-9">
        {categories.map((c) => {
          const hasMenu = c.children.length > 0;
          const isOpen = openPath === c.path;
          const active = pathname === `/shop/${c.path}` || pathname.startsWith(`/shop/${c.path}/`);
          return (
            <li
              key={c.path}
              onMouseEnter={() => open(hasMenu ? c.path : null)}
              onFocus={() => open(hasMenu ? c.path : null)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) scheduleClose();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && isOpen) {
                  setOpenPath(null);
                  (e.currentTarget.querySelector("a") as HTMLElement | null)?.focus();
                }
              }}
            >
              <Link
                href={`/shop/${c.path}`}
                className={linkClass(active)}
                aria-haspopup={hasMenu ? "true" : undefined}
                aria-expanded={hasMenu ? isOpen : undefined}
              >
                {c.name}
                {hasMenu && <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />}
              </Link>
              {hasMenu && isOpen && <MegaMenu category={c} />}
            </li>
          );
        })}
        {showNew && (
          <li onMouseEnter={() => open(null)}>
            <Link href="/shop/new" className={linkClass(pathname === "/shop/new")}>
              New
            </Link>
          </li>
        )}
        {showSale && (
          <li onMouseEnter={() => open(null)}>
            <Link href="/shop/sale" className={`${linkClass(pathname === "/shop/sale")} !text-brown`}>
              Sale
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

function MegaMenu({ category }: { category: NavCategory }) {
  const groups = category.children;
  return (
    <div className="absolute inset-x-0 top-full z-30 border-t border-line border-b bg-cream-raised shadow-[0_24px_40px_-24px_rgba(59,35,20,0.25)] [animation:slide-down_.18s_ease-out]">
      <div className="container-posh grid grid-cols-[minmax(180px,220px)_1fr] gap-10 py-10">
        <div>
          <p className="eyebrow text-bronze">Shop</p>
          <p className="mt-2 font-display text-[34px] leading-none font-medium text-brown-deep">{category.name}</p>
          <Link
            href={`/shop/${category.path}`}
            className="label-caps mt-5 inline-flex min-h-11 items-center text-brown underline-offset-4 hover:underline"
          >
            Shop all {category.name}
          </Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-8 gap-y-8">
          {groups.map((g, i) => {
            const wide = i === 0 && g.children.length > 8;
            return (
              <div key={g.path} className={wide ? "col-span-2" : ""}>
                <Link
                  href={`/shop/${g.path}`}
                  className="font-display text-[19px] font-medium text-brown-deep hover:text-brown"
                >
                  {g.name}
                </Link>
                {g.children.length > 0 && (
                  <ul className={`mt-3 ${wide ? "columns-2 gap-8" : ""}`}>
                    {g.children.map((leaf) => (
                      <li key={leaf.path} className="break-inside-avoid">
                        <Link
                          href={`/shop/${leaf.path}`}
                          className="inline-flex min-h-9 items-center text-[14px] text-ink-soft hover:text-brown"
                        >
                          {leaf.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile menu
// ---------------------------------------------------------------------------

function MobileMenu({
  open,
  onClose,
  categories,
  showNew,
  showSale,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  categories: NavCategory[];
  showNew: boolean;
  showSale: boolean;
  pathname: string;
}) {
  const ref = useDialog<HTMLDivElement>(open, onClose);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!open) return null;

  const chip =
    "inline-flex min-h-11 items-center border border-gold/40 px-4 text-[13px] text-cream/90 hover:border-gold hover:text-gold";

  // Portal: the sticky header's backdrop-filter would otherwise contain `fixed`.
  return createPortal(
    <div
      id="mobile-menu"
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-brown-deep text-cream [animation:fade-in_.2s_ease-out] nav:hidden"
    >
      <div className="container-posh flex h-[68px] shrink-0 items-center justify-between">
        <Logo tone="light" />
        <button type="button" onClick={onClose} className="tap -mr-2.5 inline-flex items-center justify-center" aria-label="Close menu">
          <CloseIcon size={24} />
        </button>
      </div>
      <nav aria-label="Mobile" className="container-posh pb-12">
        <ul className="border-b border-cream/15 pb-6">
          {PRIMARY.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className="flex min-h-14 items-center font-display text-[32px] leading-none aria-[current=page]:text-gold-light"
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/saved" className="flex min-h-14 items-center font-display text-[32px] leading-none">
              Saved
            </Link>
          </li>
        </ul>

        <p className="eyebrow mt-8 mb-3 text-gold">Shop by category</p>
        <ul>
          {categories.map((c) => {
            const isOpen = expanded === c.path;
            const panelId = `mm-${c.path}`;
            return (
              <li key={c.path} className="border-b border-cream/10">
                {c.children.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : c.path)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="flex min-h-14 w-full items-center justify-between text-left text-[17px]"
                    >
                      {c.name}
                      <ChevronDown size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div id={panelId} className="flex flex-wrap gap-2 pb-5">
                        <Link href={`/shop/${c.path}`} className={`${chip} border-gold text-gold`}>
                          All {c.name}
                        </Link>
                        {c.children.map((g) => (
                          <Link key={g.path} href={`/shop/${g.path}`} className={chip}>
                            {g.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link href={`/shop/${c.path}`} className="flex min-h-14 items-center text-[17px]">
                    {c.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          {showNew && (
            <Link href="/shop/new" className={chip}>
              New arrivals
            </Link>
          )}
          {showSale && (
            <Link href="/shop/sale" className={chip}>
              Sale
            </Link>
          )}
        </div>
      </nav>
    </div>,
    document.body,
  );
}
