"use client";

import Link from "next/link";
import { getImageProps } from "next/image";
import { motion } from "motion/react";
import { IMAGE_TRANSFORM } from "@/lib/env";
import { supabaseLoader } from "@/components/ui/posh-image";
import { Price } from "@/components/store/price";
import { ArrowRight } from "@/components/ui/icons";
import type { HeroImage, HeroSlideView } from "@/lib/hero";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Desktop art direction kicks in at the same width as the @3xl container layout (48rem). */
const DESKTOP_MEDIA = "(min-width: 768px)";

/** Scrim classes are listed literally so Tailwind can see them. */
const SCRIM: Record<string, string> = {
  "light-soft-bottom": "bg-[linear-gradient(180deg,rgba(59,35,20,0)_35%,rgba(59,35,20,0.78)_100%)]",
  "light-strong-bottom": "bg-[linear-gradient(180deg,rgba(59,35,20,0.25)_0%,rgba(59,35,20,0.94)_100%)]",
  "light-soft-center": "bg-[rgba(59,35,20,0.35)]",
  "light-strong-center": "bg-[rgba(59,35,20,0.6)]",
  "dark-soft-bottom": "bg-[linear-gradient(180deg,rgba(249,245,238,0)_35%,rgba(249,245,238,0.85)_100%)]",
  "dark-strong-bottom": "bg-[linear-gradient(180deg,rgba(249,245,238,0.3)_0%,rgba(249,245,238,0.96)_100%)]",
  "dark-soft-center": "bg-[rgba(249,245,238,0.45)]",
  "dark-strong-center": "bg-[rgba(249,245,238,0.72)]",
};

const POSITION = {
  "bottom-left": { wrap: "items-end justify-start text-left", inner: "items-start" },
  "bottom-center": { wrap: "items-end justify-center text-center", inner: "items-center" },
  center: { wrap: "items-center justify-center text-center", inner: "items-center" },
} as const;

/**
 * `priority` is deprecated in Next 16. For <picture> art direction the docs recommend
 * loading="eager" + fetchPriority="high" (not `preload`, which would preload only one variant).
 */
function imgProps(img: HeroImage, alt: string, priority: boolean) {
  const local = img.src.startsWith("blob:");
  return getImageProps({
    src: img.src,
    width: img.width,
    height: img.height,
    alt,
    sizes: "100vw",
    quality: 85,
    loading: priority ? "eager" : "lazy",
    fetchPriority: priority ? "high" : undefined,
    unoptimized: local,
    loader: !local && IMAGE_TRANSFORM ? supabaseLoader : undefined,
  }).props;
}

/**
 * One hero slide. Layout uses container queries (`@3xl`), so the admin preview frames
 * render exactly like the storefront at phone and desktop widths. The parent must be `@container`.
 *
 * `variant` forces the mobile or desktop image (admin preview); otherwise <picture> picks by viewport.
 */
export function HeroSlide({
  slide,
  priority = false,
  active = true,
  animateIn = false,
  variant,
  onLinkClick,
}: {
  slide: HeroSlideView;
  priority?: boolean;
  active?: boolean;
  /** Fade the copy up when the slide becomes active. */
  animateIn?: boolean;
  variant?: "mobile" | "desktop";
  onLinkClick?: () => void;
}) {
  const artwork = slide.kind === "artwork";
  const alt = artwork ? slide.alt : "";
  const forced = variant === "desktop" && slide.desktop ? slide.desktop : variant ? slide.mobile : null;

  let picture;
  if (forced) {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    picture = <img {...imgProps(forced, alt, priority)} className="absolute inset-0 h-full w-full object-cover" />;
  } else {
    const mobile = imgProps(slide.mobile, alt, priority);
    const desktop = slide.desktop ? imgProps(slide.desktop, alt, priority) : null;
    picture = (
      <picture>
        {desktop && <source media={DESKTOP_MEDIA} srcSet={desktop.srcSet} sizes={desktop.sizes} width={desktop.width} height={desktop.height} />}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
        <img {...mobile} className="absolute inset-0 h-full w-full object-cover" />
      </picture>
    );
  }

  const linkProps = slide.href
    ? {
        href: slide.href,
        onClick: onLinkClick,
        ...(slide.external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
      }
    : null;

  const frame = "relative aspect-[4/5] w-full overflow-hidden bg-brown-deep @3xl:aspect-[2/1]";

  if (artwork) {
    return (
      <div className={frame}>
        {picture}
        {linkProps && (
          <Link {...linkProps} aria-label={slide.alt} className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-gold" />
        )}
      </div>
    );
  }

  const pos = POSITION[slide.textPosition];
  const scrimKey = `${slide.textTone}-${slide.scrim}-${slide.textPosition === "center" ? "center" : "bottom"}`;
  const light = slide.textTone === "light";

  return (
    <div className={frame}>
      {picture}
      {slide.scrim !== "none" && <div aria-hidden className={`absolute inset-0 ${SCRIM[scrimKey]}`} />}
      {/* No button label: the whole slide is the link, named by the headline. */}
      {linkProps && !slide.ctaLabel && <Link {...linkProps} aria-label={slide.headline} className="absolute inset-0" />}
      <div className={`absolute inset-0 flex ${pos.wrap} ${linkProps && !slide.ctaLabel ? "pointer-events-none" : ""}`}>
        <motion.div
          className={`container-posh flex flex-col ${pos.inner} pt-16 pb-[clamp(28px,7cqw,88px)] ${light ? "text-cream" : "text-brown-deep"}`}
          initial={animateIn ? { opacity: 0, y: 20 } : false}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: EASE, delay: active && animateIn ? 0.15 : 0 }}
        >
          {slide.eyebrow && (
            <p className={`eyebrow flex items-center gap-3 ${light ? "text-gold" : "text-bronze"}`}>
              <span aria-hidden className={`h-px w-8 ${light ? "bg-gold" : "bg-bronze"} ${slide.textPosition === "bottom-left" ? "" : "hidden"}`} />
              {slide.eyebrow}
            </p>
          )}
          <h2 className="mt-3 max-w-[16ch] font-display text-[clamp(34px,8.5cqw,96px)] leading-[0.98] font-medium text-balance @3xl:text-[clamp(44px,6cqw,96px)]">
            {slide.headline}
          </h2>
          {slide.body && (
            <p className={`mt-3 max-w-[44ch] text-[15px] leading-relaxed @3xl:mt-4 @3xl:text-[17px] ${light ? "text-cream/85" : "text-ink-soft"}`}>
              {slide.body}
            </p>
          )}
          {slide.price && (
            <Price
              price={slide.price.price}
              compareAt={slide.price.compareAt}
              className={`mt-3 text-[18px] font-medium @3xl:text-[20px] ${light ? "[&_.text-brown]:text-cream [&_s]:text-cream/70" : ""}`}
            />
          )}
          {linkProps && slide.ctaLabel && (
            <Link
              {...linkProps}
              // Stretched link: the whole slide is the tap target; Embla suppresses the click after a swipe.
              className={`btn mt-5 after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 @3xl:mt-7 ${
                light ? "btn-gold focus-visible:outline-gold" : "bg-brown-deep text-cream hover:bg-brown focus-visible:outline-brown"
              }`}
            >
              {slide.ctaLabel}
              <ArrowRight size={14} />
            </Link>
          )}
        </motion.div>
      </div>
    </div>
  );
}
