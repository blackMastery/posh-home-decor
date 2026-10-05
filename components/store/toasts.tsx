"use client";

import Link from "next/link";
import { useStore } from "./store-provider";

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-md items-center gap-4 bg-brown-deep px-5 py-3 text-sm text-cream shadow-lg [animation:toast-in_.3s_ease-out]"
        >
          <span>{t.message}</span>
          {t.action &&
            (t.action.href ? (
              <Link
                href={t.action.href}
                onClick={() => dismissToast(t.id)}
                className="label-caps tap inline-flex items-center text-gold underline-offset-4 hover:underline"
              >
                {t.action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick?.();
                  dismissToast(t.id);
                }}
                className="label-caps tap text-gold underline-offset-4 hover:underline"
              >
                {t.action.label}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
