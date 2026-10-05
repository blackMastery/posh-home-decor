import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-posh flex flex-col items-center py-28 text-center">
      <p className="eyebrow text-bronze">Not found</p>
      <h1 className="mt-4 font-display text-[clamp(38px,5vw,64px)] leading-none font-medium text-brown-deep">
        This piece has <em className="text-bronze">moved on.</em>
      </h1>
      <p className="mt-5 max-w-md text-[16px] text-ink-soft">It may have sold or been renamed. Have a look at what&apos;s in the showroom now.</p>
      <Link href="/shop" className="btn btn-primary mt-10">
        View all pieces
      </Link>
    </div>
  );
}
