"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SPRING =
  "linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.017 19.4%, 1.067, 1.099 24.3%, 1.108 26%, 1.1, 1.084 30.6%, 1.019 39.1%, 1.002 42.4%, 0.993 47.4%, 1.001 63.2%, 1)";
const HIDDEN = { opacity: 0, transform: "translateY(28px)" };

/**
 * Damped-spring scroll reveal for [data-reveal] elements.
 * Hidden state is held with the Web Animations API — never via attributes or
 * inline styles — so it can't disturb hydration, content stays visible without
 * JS, and it's a no-op under prefers-reduced-motion.
 */
export function Reveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;
    const easing = CSS.supports("animation-timing-function", SPRING) ? SPRING : "cubic-bezier(.2,.8,.2,1)";

    const seen = new WeakSet<Element>();
    const holds = new Map<Element, { anim: Animation; delay: number }>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          io.unobserve(el);
          const hold = holds.get(el);
          holds.delete(el);
          el.animate([HIDDEN, { opacity: 1, transform: "translateY(0)" }], {
            duration: 900,
            delay: hold?.delay ?? 0,
            easing,
            fill: "backwards",
          });
          hold?.anim.cancel();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    const prepare = () => {
      let i = 0;
      document.querySelectorAll("[data-reveal]").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // on screen: leave visible
        const anim = el.animate([HIDDEN, HIDDEN], { duration: 1, fill: "forwards" });
        holds.set(el, { anim, delay: (i++ % 4) * 70 });
        io.observe(el);
      });
    };
    const raf = window.requestAnimationFrame(prepare);
    const mo = new MutationObserver(prepare);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.cancelAnimationFrame(raf);
      mo.disconnect();
      io.disconnect();
      holds.forEach((h) => h.anim.cancel());
    };
  }, [pathname]);
  return null;
}
