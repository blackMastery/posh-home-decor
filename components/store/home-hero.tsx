"use client";

import Image from "next/image";
import heroCollage from "@/public/images/hero-collage.jpg";
import Link from "next/link";
import { useRef } from "react";
import { MotionConfig, motion, useReducedMotion, useScroll, useTransform, type Variants } from "motion/react";
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

// Hero copy is hard-coded rather than read from the settings table.
const EYEBROW = "BEAUTIFUL SPACES";
const HEADLINE = "Inspired Living";
const DESCRIPTION =
  "Curated home decor and unique accent pieces to help you create spaces you love.";

export function HomeHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  // Scroll: copy lifts and fades out.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -80]);
  const copyOpacity = useTransform(scrollYProgress, [0.15, 0.75], [1, reduce ? 1 : 0]);

  const headWords = HEADLINE.split(/\s+/).filter(Boolean);

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={ref}
        className="relative isolate flex min-h-[max(520px,min(calc(100svh-7.5rem),880px))] items-end overflow-hidden bg-brown-deep text-cream"
      >
        {/* Background: chair, sideboard and box photos combined into one wide image (public/hero-section). */}
        <Image src={heroCollage} alt="" fill priority sizes="100vw" className="-z-30 object-cover" />

        {/* Brown wash: darker at the bottom and left so the copy stays legible over light photos */}
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(59,35,20,0.15)_0%,rgba(59,35,20,0.4)_45%,rgba(59,35,20,0.9)_100%)]" />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(59,35,20,0.55)_0%,rgba(59,35,20,0)_65%)]" />

        <motion.div
          className="container-posh pt-24 pb-[clamp(48px,9vh,112px)]"
          style={{ y: copyY, opacity: copyOpacity }}
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fadeUp} className="flex items-center gap-4">
              <motion.span
                aria-hidden
                className="h-px w-12 origin-left bg-gold"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1, delay: 0.3, ease: EASE }}
              />
              <p className="eyebrow text-gold">{EYEBROW}</p>
            </motion.div>

          <h1
            aria-label={HEADLINE}
            className="mt-5 max-w-[14ch] font-display text-[clamp(44px,min(7vw,12svh),108px)] leading-[0.98] font-medium"
          >
            {headWords.map((w, i) => (
              <Word key={`h${i}`}>{w}</Word>
            ))}
          </h1>

          <motion.p variants={fadeUp} className="mt-6 max-w-[46ch] text-[clamp(16px,1.4vw,19px)] leading-relaxed text-cream/85">
            {DESCRIPTION}
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/shop" className="group btn btn-gold shadow-[0_12px_40px_-12px_rgba(217,179,106,0.6)]">
                Shop the collection
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/gallery" className="btn border border-cream/60 text-cream backdrop-blur-sm hover:border-cream hover:bg-cream/10">
                View the gallery
              </Link>
            </motion.div>
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
