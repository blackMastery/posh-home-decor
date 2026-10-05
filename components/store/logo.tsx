import Image from "next/image";
import logoFull from "@/public/images/logo-full.png";
import logoFullLight from "@/public/images/logo-full-light.png";

/** Brand lockup. `light` is the gold-only version for dark backgrounds. */
export function Logo({ tone = "dark", className = "h-14 nav:h-16" }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <Image
      src={tone === "dark" ? logoFull : logoFullLight}
      alt="Posh Home Decor & Home Styling Studio"
      loading="eager"
      sizes="240px"
      className={`w-auto shrink-0 ${className}`}
    />
  );
}
