import Link from "next/link";

export function Breadcrumbs({
  items,
  hideCurrentOnMobile = false,
}: {
  items: { href: string; label: string }[];
  /** Drop the last crumb below the nav breakpoint, e.g. when the page heading repeats it. */
  hideCurrentOnMobile?: boolean;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 text-[12px] tracking-[0.12em] text-muted uppercase">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.href} className={`items-center gap-2 ${last && hideCurrentOnMobile ? "hidden nav:flex" : "flex"}`}>
              {/* Separator leads its crumb, so hiding a crumb hides its slash too. */}
              {i > 0 && <span aria-hidden>/</span>}
              {last ? (
                <span aria-current="page" className="text-ink-soft">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="inline-flex min-h-8 items-center hover:text-brown">
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
