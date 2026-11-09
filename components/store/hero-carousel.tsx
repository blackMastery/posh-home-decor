"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { MotionConfig, useReducedMotion } from "motion/react";
import { AUTOPLAY_MS, type HeroSlideView } from "@/lib/hero";
import { HeroSlide } from "./hero-slide";
import { HomeHero } from "./home-hero";
import { trackClick, trackView } from "./hero-tracking";

const VIEW_DWELL_MS = 1000;

/** Drops slides whose end time has passed (cached HTML can outlive a sale). */
function useUnexpired(initial: HeroSlideView[]) {
  const [slides, setSlides] = useState(initial);
  useEffect(() => {
    const prune = () =>
      setSlides((list) => {
        const now = Date.now();
        const next = list.filter((s) => !s.endsAt || Date.parse(s.endsAt) > now);
        return next.length === list.length ? list : next;
      });
    prune();
    const t = window.setInterval(prune, 60_000);
    return () => window.clearInterval(t);
  }, []);
  return slides;
}

export function HeroCarousel({ slides: initial }: { slides: HeroSlideView[] }) {
  const slides = useUnexpired(initial);
  if (slides.length === 0) return <HomeHero />;
  return <Carousel slides={slides} />;
}

function Carousel({ slides }: { slides: HeroSlideView[] }) {
  const multi = slides.length > 1;
  const reduce = useReducedMotion();
  // We drive play/stop ourselves (see shouldPlay), so all built-in stop rules are off.
  const [autoplay] = useState(() =>
    Autoplay({ delay: AUTOPLAY_MS, playOnInit: false, stopOnInteraction: false, stopOnMouseEnter: false, stopOnFocusIn: false }),
  );
  const [viewportRef, api] = useEmblaCarousel({ loop: multi, active: multi, duration: 28 }, [autoplay]);

  const rootRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(0);
  const [userStopped, setUserStopped] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [inView, setInView] = useState(false);
  const [docVisible, setDocVisible] = useState(true);
  const [playing, setPlaying] = useState(false);

  // Embla events: selection, and any drag/swipe stops autoplay for good.
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    const onPointerDown = () => setUserStopped(true);
    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    onSelect();
    api.on("select", onSelect).on("reInit", onSelect).on("pointerDown", onPointerDown);
    api.on("autoplay:play", onPlay).on("autoplay:stop", onStop);
    return () => {
      api.off("select", onSelect).off("reInit", onSelect).off("pointerDown", onPointerDown);
      api.off("autoplay:play", onPlay).off("autoplay:stop", onStop);
    };
  }, [api]);

  // ≥50% on screen, and tab visible.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    io.observe(el);
    const onVis = () => setDocVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const shouldPlay = multi && !reduce && !userStopped && !hovering && !focusWithin && inView && docVisible;
  useEffect(() => {
    // plugins() is undefined while Embla is inactive (a single slide).
    const ap = api?.plugins()?.autoplay;
    if (!ap) return;
    if (shouldPlay) ap.play();
    else ap.stop();
  }, [api, shouldPlay]);

  // A slide counts as viewed after 1s on screen while active.
  const current = slides[selected];
  useEffect(() => {
    if (!current || !inView || !docVisible) return;
    const t = window.setTimeout(() => trackView(current.id), VIEW_DWELL_MS);
    return () => window.clearTimeout(t);
  }, [current, inView, docVisible]);

  const goTo = useCallback(
    (i: number) => {
      setUserStopped(true);
      api?.scrollTo(i);
    },
    [api],
  );

  const showProgress = playing && shouldPlay;

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={rootRef}
        aria-roledescription="carousel"
        aria-label="Featured"
        className="@container relative bg-brown-deep"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={(e) => {
          // Keyboard focus inside pauses (WCAG 2.2.2); a mouse click on a control is handled by goTo.
          if (e.target.matches(":focus-visible")) setFocusWithin(true);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
        }}
      >
        {/* Stable page heading; slide headlines are h2 so SEO doesn't change with the promo. */}
        <h1 className="sr-only">Posh Home Decor — Inspired Living</h1>

        <div ref={viewportRef} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {slides.map((s, i) => (
              <div
                key={s.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${slides.length}`}
                inert={multi && i !== selected}
                className="min-w-0 shrink-0 grow-0 basis-full"
              >
                <HeroSlide
                  slide={s}
                  priority={i === 0}
                  active={i === selected}
                  animateIn
                  onLinkClick={() => trackClick(s.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {multi && (
          <div className="container-posh flex h-14 items-center justify-between gap-4 text-cream">
            <div className="flex items-center">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Show slide ${i + 1}${s.headline ? `: ${s.headline}` : ""}`}
                  aria-current={i === selected ? "true" : undefined}
                  className="tap -ml-2 inline-flex items-center justify-center px-2 first:ml-0"
                >
                  <span className="relative block h-0.5 w-8 overflow-hidden bg-cream/30 @3xl:w-12">
                    {i === selected && (
                      <span
                        key={`${selected}-${showProgress}`}
                        className="absolute inset-0 origin-left bg-gold"
                        style={showProgress ? { animation: `hero-progress ${AUTOPLAY_MS}ms linear forwards` } : undefined}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <span className="mr-2 text-[12px] tracking-[0.14em] text-cream/70 tabular-nums" aria-hidden>
                {String(selected + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => {
                  setUserStopped(true);
                  api?.scrollPrev();
                }}
                aria-label="Previous slide"
                className="tap hidden items-center justify-center hover:text-gold @3xl:inline-flex"
              >
                <Chevron dir="left" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserStopped(true);
                  api?.scrollNext();
                }}
                aria-label="Next slide"
                className="tap hidden items-center justify-center hover:text-gold @3xl:inline-flex"
              >
                <Chevron dir="right" />
              </button>
              {!reduce && (
                <button
                  type="button"
                  onClick={() => setUserStopped((v) => !v)}
                  aria-label={userStopped ? "Play slideshow" : "Pause slideshow"}
                  className="tap inline-flex items-center justify-center hover:text-gold"
                >
                  {userStopped ? <PlayIcon /> : <PauseIcon />}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Announce the slide only when it changed because of the user, not every 6s. */}
        <p className="sr-only" aria-live={playing ? "off" : "polite"} aria-atomic="true">
          {multi ? `Slide ${selected + 1} of ${slides.length}${current?.headline ? `: ${current.headline}` : current?.alt ? `: ${current.alt}` : ""}` : ""}
        </p>
      </section>
    </MotionConfig>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5v14l12-7L7 5Z" />
    </svg>
  );
}
