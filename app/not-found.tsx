import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-28 text-center">
      <p className="eyebrow text-bronze">Not found</p>
      <h1 className="mt-4 font-display text-[48px] leading-none font-medium text-garnet-deep">Page not found</h1>
      <Link href="/" className="btn btn-primary mt-10">
        Go to the shop
      </Link>
    </main>
  );
}
