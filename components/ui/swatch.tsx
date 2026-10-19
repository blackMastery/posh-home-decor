import type { CSSProperties } from "react";
import type { Swatch as SwatchKind } from "@/lib/catalog/types";

/** A colour dot. `hex` null falls back to sand (or the metallic/multi preset). */
export function Swatch({ hex, swatch, size = 16, className = "" }: { hex: string | null; swatch: SwatchKind; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      data-swatch={swatch}
      className={`swatch ${className}`}
      style={{ width: size, height: size, ...(hex ? ({ "--swatch": hex } as CSSProperties) : null) }}
    />
  );
}
