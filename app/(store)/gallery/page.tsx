import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GALLERY_PAGE_SIZE, getGalleryPage, getGalleryPhoto } from "@/lib/data/gallery";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { GalleryGrid } from "@/components/store/gallery-grid";
import { storageUrl } from "@/lib/images";
import { BRAND_NAME, baseOpenGraph } from "@/lib/seo";

type Props = PageProps<"/gallery">;

const MAX_PAGE = 40;
const title = "Gallery";
const description = "Styled rooms and showroom moments from Posh Home Decor, Georgetown. Tap a photo to shop the look.";

function parse(sp: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));
  const photo = /^[0-9a-f-]{36}$/i.test(one(sp.photo)) ? one(sp.photo) : null;
  return { page, photo };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { photo: photoId, page } = parse(await searchParams);
  const photo = photoId ? await getGalleryPhoto(photoId) : null;
  const pageTitle = photo?.caption ? `${photo.caption} | Gallery` : title;
  return {
    title: pageTitle,
    description,
    alternates: { canonical: "/gallery" },
    openGraph: {
      ...baseOpenGraph,
      title: `${pageTitle} | ${BRAND_NAME}`,
      description,
      url: photo ? `/gallery?photo=${photo.id}` : "/gallery",
      ...(photo && { images: [{ url: storageUrl(photo.storage_path, "site"), alt: photo.alt ?? photo.caption ?? "" }] }),
    },
    robots: photo || page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default function GalleryPage(props: Props) {
  return (
    <div className="container-posh pt-10 pb-24 nav:pt-14">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/gallery", label: "Gallery" },
        ]}
      />
      <header className="mt-4 max-w-2xl">
        <p className="eyebrow text-bronze">Inspiration</p>
        <h1 className="mt-3 font-display text-[clamp(38px,5vw,68px)] leading-none font-medium text-brown-deep">
          The <em className="text-bronze">gallery</em>
        </h1>
        <p className="mt-4 text-[clamp(15px,1.3vw,18px)] leading-relaxed text-ink-soft">
          Styled rooms and showroom moments. Tap a photo to see it up close and shop the pieces in it.
        </p>
      </header>
      <Suspense fallback={<GallerySkeleton />}>
        <GalleryContent {...props} />
      </Suspense>
    </div>
  );
}

async function GalleryContent({ searchParams }: Props) {
  const { page, photo } = parse(await searchParams);
  let { photos, total } = await getGalleryPage(page * GALLERY_PAGE_SIZE);
  // A shared link to a photo further down the list: load enough to include it.
  if (photo && !photos.some((p) => p.id === photo) && photos.length < total) {
    ({ photos, total } = await getGalleryPage(MAX_PAGE * GALLERY_PAGE_SIZE));
  }

  if (photos.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center bg-sand px-6 py-20 text-center">
        <p className="font-display text-[32px] leading-tight text-brown-deep">New photos coming soon</p>
        <p className="mt-3 max-w-sm text-[15px] text-ink-soft">We&apos;re styling the showroom. In the meantime, have a look around the shop.</p>
        <Link href="/shop" className="btn btn-primary mt-8">
          Shop all pieces
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-10">
        <GalleryGrid photos={photos} initialPhotoId={photo} />
      </div>
      {photos.length < total && page < MAX_PAGE && (
        <div className="mt-16 flex flex-col items-center gap-3">
          <p className="text-[13px] text-muted">
            Showing {photos.length} of {total}
          </p>
          <Link href={`/gallery?page=${page + 1}`} scroll={false} className="btn btn-outline">
            Load more
          </Link>
        </div>
      )}
    </>
  );
}

function GallerySkeleton() {
  const heights = ["h-64", "h-48", "h-80", "h-56", "h-72", "h-52", "h-64", "h-44"];
  return (
    <div className="mt-10 columns-2 gap-3 sm:gap-4 md:columns-3 lg:columns-4" aria-busy="true">
      {heights.map((h, i) => (
        <div key={i} className={`mb-3 animate-pulse break-inside-avoid bg-sand-image sm:mb-4 ${h}`} />
      ))}
      <span className="sr-only">Loading photos…</span>
    </div>
  );
}
