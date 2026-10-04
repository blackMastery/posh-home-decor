"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import {
  MotionConfig,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "motion/react";
import { ArrowRight } from "@/components/ui/icons";

const EASE = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { delayChildren: 0.35, staggerChildren: 0.08 } },
};
// Words rise out of an overflow-hidden mask, so text is clipped (not faded) while hidden.
const word: Variants = {
  hidden: { y: "110%", rotate: 4 },
  show: { y: "0%", rotate: 0, transition: { duration: 1.1, ease: EASE } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

// Fixed values (not Math.random) so server and client render identically.
const MOTES = [
  { x: 8, size: 3, dur: 14, delay: 0.5, sway: 14 },
  { x: 19, size: 2, dur: 18, delay: 4, sway: -10 },
  { x: 31, size: 4, dur: 16, delay: 2, sway: 18 },
  { x: 44, size: 2, dur: 20, delay: 7, sway: -12 },
  { x: 52, size: 3, dur: 15, delay: 1.2, sway: 10 },
  { x: 61, size: 2, dur: 19, delay: 5.5, sway: -16 },
  { x: 70, size: 4, dur: 17, delay: 3, sway: 12 },
  { x: 79, size: 2, dur: 21, delay: 8, sway: -8 },
  { x: 88, size: 3, dur: 15, delay: 2.5, sway: 16 },
  { x: 95, size: 2, dur: 18, delay: 6, sway: -14 },
];

type Props = { eyebrow: string; headline: string; accent: string };

export function HomeHero({ eyebrow, headline, accent }: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  // Scroll: background drifts slower than the page, copy lifts and fades out.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "18%"]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -80]);
  const copyOpacity = useTransform(scrollYProgress, [0.15, 0.75], [1, reduce ? 1 : 0]);

  // Pointer: a soft gold glow follows the cursor (fine pointers only).
  const px = useMotionValue(70);
  const py = useMotionValue(30);
  const gx = useSpring(px, { stiffness: 60, damping: 20 });
  const gy = useSpring(py, { stiffness: 60, damping: 20 });
  const glow = useMotionTemplate`radial-gradient(600px circle at ${gx}% ${gy}%, rgba(227,192,122,0.22), transparent 60%)`;

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width) * 100);
    py.set(((e.clientY - r.top) / r.height) * 100);
  }

  const headWords = headline.split(/\s+/).filter(Boolean);
  const accentWords = accent.split(/\s+/).filter(Boolean);

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={ref}
        onPointerMove={onPointerMove}
        className="relative isolate flex min-h-[max(520px,min(calc(100svh-7.5rem),880px))] items-end overflow-hidden bg-garnet-deep text-cream"
      >
        {/* Static background: slow Ken Burns settle + scroll parallax */}
        <motion.div className="absolute inset-x-0 -top-[18%] bottom-0 -z-30" style={{ y: bgY }}>
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.18, opacity: 0 }}
            animate={{ scale: 1.06, opacity: 1 }}
            transition={{ duration: 2.4, ease: EASE }}
          >
            <Image src="/images/hero.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
          </motion.div>
        </motion.div>

        {/* Garnet wash + cursor glow */}
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(62,7,16,0.25)_0%,rgba(62,7,16,0.45)_45%,rgba(62,7,16,0.92)_100%)]" />
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden md:block" style={{ background: glow }} />

        {/* Candle-light motes drifting upward */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          {MOTES.map((m, i) => (
            <motion.span
              key={i}
              className="absolute bottom-0 rounded-full bg-gold-light shadow-[0_0_12px_2px_rgba(227,192,122,0.55)]"
              style={{ left: `${m.x}%`, width: m.size, height: m.size }}
              initial={{ y: 0, opacity: 0 }}
              animate={reduce ? { opacity: 0 } : { y: "-85vh", opacity: [0, 0.9, 0.9, 0], x: [0, m.sway, -m.sway, 0] }}
              transition={{ duration: m.dur, delay: m.delay, repeat: Infinity, ease: "linear" }}
            />
          ))}
        </div>

        <motion.div
          className="container-posh pt-24 pb-[clamp(48px,9vh,112px)]"
          style={{ y: copyY, opacity: copyOpacity }}
          variants={container}
          initial="hidden"
          animate="show"
        >
          {eyebrow && (
            <motion.div variants={fadeUp} className="flex items-center gap-4">
              <motion.span
                aria-hidden
                className="h-px w-12 origin-left bg-gold"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1, delay: 0.3, ease: EASE }}
              />
              <p className="eyebrow text-gold">{eyebrow}</p>
            </motion.div>
          )}

          <h1
            aria-label={`${headline} ${accent}`.trim()}
            className="mt-5 max-w-[14ch] font-display text-[clamp(44px,min(7vw,12svh),108px)] leading-[0.98] font-medium"
          >
            {headWords.map((w, i) => (
              <Word key={`h${i}`}>{w}</Word>
            ))}
            {accentWords.map((w, i) => (
              <Word key={`a${i}`}>
                <em className="hero-shimmer font-normal">{w}</em>
              </Word>
            ))}
          </h1>

          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/shop" className="group btn btn-gold shadow-[0_12px_40px_-12px_rgba(217,179,106,0.6)]">
                Shop the collection
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
            <Link
              href="#styling-studio"
              className="label-caps group inline-flex min-h-11 items-center gap-2 text-cream/90 hover:text-gold-light"
            >
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-1 transition-[background-size] duration-500 group-hover:bg-[length:100%_1px]">
                Book a stylist
              </span>
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          aria-hidden
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 1 }}
        >
          <span className="text-[10px] tracking-[0.3em] text-cream/60 uppercase">Scroll</span>
          <span className="relative h-10 w-px overflow-hidden bg-cream/20">
            <motion.span
              className="absolute inset-x-0 top-0 h-1/2 bg-gold"
              animate={{ y: ["-100%", "200%"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          </span>
        </motion.div>
      </section>
    </MotionConfig>
  );
}

function Word({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="inline-block overflow-hidden pr-[0.22em] pb-[0.08em] align-bottom">
      <motion.span variants={word} className="inline-block origin-bottom-left">
        {children}
      </motion.span>
    </span>
  );
}
