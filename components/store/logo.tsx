import Image from "next/image";
import logoMark from "@/public/images/logo-mark.png";

export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const ink = tone === "dark" ? "text-garnet-deep" : "text-cream";
  return (
    <span className={`inline-flex items-center gap-3 ${ink}`}>
      <Image src={logoMark} alt="" width={44} height={44} loading="eager" className="size-11 shrink-0 rounded-full" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[24px] font-semibold tracking-[0.28em]">POSH</span>
        <span className={`mt-1 text-[8.5px] tracking-[0.3em] uppercase ${tone === "dark" ? "text-bronze" : "text-gold"}`}>
          Home Decor
        </span>
      </span>
    </span>
  );
}
