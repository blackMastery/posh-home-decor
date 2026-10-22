"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "@/components/ui/icons";

/** Floating "back to top" button, shown once the visitor has scrolled past roughly one screen. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`fixed right-[max(16px,env(safe-area-inset-right))] bottom-[max(16px,env(safe-area-inset-bottom))] z-40 inline-flex size-12 items-center justify-center bg-brown-deep text-cream shadow-lg transition-[opacity,translate] duration-300 hover:bg-brown sm:right-[max(24px,env(safe-area-inset-right))] sm:bottom-[max(24px,env(safe-area-inset-bottom))] ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <ChevronUp size={22} />
    </button>
  );
}
