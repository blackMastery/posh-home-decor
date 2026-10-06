import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import showroom from "@/public/hero-section/5675675.jpeg";
import { ADDRESS, MAPS_URL } from "@/lib/contact";
import { BRAND_NAME, baseOpenGraph } from "@/lib/seo";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ArrowRight } from "@/components/ui/icons";

const title = "About us";
const description =
  "Posh Home Decor is a Georgetown showroom for curated home decor and accent pieces, with free styling advice on every order.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: { ...baseOpenGraph, title: `${title} | ${BRAND_NAME}`, description, url: "/about" },
  twitter: { card: "summary_large_image", title: `${title} | ${BRAND_NAME}`, description },
};

export default function AboutPage() {
  return (
    <>
      {/* 1. Intro */}
      <section className="container-posh pt-10 pb-[clamp(48px,8vw,96px)] nav:pt-14">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/about", label: "About" },
          ]}
        />
        <p className="eyebrow mt-10 text-bronze">Our story</p>
        <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(40px,6vw,80px)] leading-[0.98] font-medium text-brown-deep">
          Beautiful homes start with <em className="text-bronze">beautiful pieces</em>
        </h1>
        <p className="mt-6 max-w-[56ch] text-[clamp(16px,1.4vw,19px)] leading-relaxed text-ink-soft">
          {BRAND_NAME} is a home decor showroom in Georgetown, Guyana. We bring together furniture, accent pieces and
          finishing touches that make a house feel warm, considered and entirely yours.
        </p>
      </section>

      {/* 2. Story */}
      <section className="bg-sand/60 py-[clamp(64px,10vw,120px)]" aria-labelledby="story-heading">
        <div className="container-posh grid items-center gap-12 md:grid-cols-2 md:gap-16 lg:gap-24">
          <div className="relative aspect-[4/5] overflow-hidden bg-sand-image" data-reveal>
            <Image
              src={showroom}
              alt="A walnut sideboard with woven panels, styled with a sculpture, a glass vase of blossoms and a wooden wall clock"
              fill
              placeholder="blur"
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div data-reveal>
            <p className="eyebrow text-bronze">Who we are</p>
            <h2 id="story-heading" className="mt-3 font-display text-[clamp(32px,4vw,52px)] leading-none font-medium text-brown-deep">
              Inspired <em className="text-bronze">living</em>
            </h2>
            <div className="mt-6 space-y-5 text-[16px] leading-relaxed text-ink-soft">
              <p>
                We believe the spaces you live in should lift you up. A well-chosen clock, a soft throw, a sculpted vase
                on the right sideboard: small things that change how a room feels every time you walk in.
              </p>
              <p>
                That&rsquo;s why we curate rather than stock. We look for pieces with character, natural textures and
                lasting quality, then style them in our showroom so you can picture them at home.
              </p>
              <p>
                Whether you&rsquo;re furnishing a new home or refreshing a single corner, we&rsquo;re here to help you
                create spaces you love.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Visit (contact details live in the footer just below) */}
      <section className="py-[clamp(64px,10vw,120px)]" aria-labelledby="visit-heading">
        <div className="container-posh flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between" data-reveal>
          <div>
            <p className="eyebrow text-bronze">Visit the showroom</p>
            <h2 id="visit-heading" className="mt-3 font-display text-[clamp(32px,4vw,52px)] leading-none font-medium text-brown-deep">
              Come and see it <em className="text-bronze">in person</em>
            </h2>
            <p className="mt-6 max-w-[48ch] text-[16px] leading-relaxed text-ink-soft">
              Find us at {ADDRESS.street}, {ADDRESS.city}. Message us on WhatsApp or give us a call to ask about a
              piece, arrange a visit or get styling advice.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/shop" className="group btn btn-gold">
              Shop the collection
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              Get directions
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
