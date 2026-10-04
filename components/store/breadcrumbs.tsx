import Link from "next/link";

export function Breadcrumbs({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 text-[12px] tracking-[0.12em] text-muted uppercase">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="text-ink-soft">
                  {c.label}
                </span>
              ) : (
                <>
                  <Link href={c.href} className="inline-flex min-h-8 items-center hover:text-garnet">
                    {c.label}
                  </Link>
                  <span aria-hidden>/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
