"use client";

/**
 * Hero slide stats. Views are counted once per slide per browser session (the caller
 * decides when a slide was really seen); clicks every time. Events are batched and sent
 * with sendBeacon so navigation away from the page doesn't drop them.
 */

const ENDPOINT = "/api/hero-events";
const SEEN_KEY = "posh-hero-seen";
const MAX_BATCH = 10;

type Counts = { v: number; c: number };
const queue = new Map<string, Counts>();
let timer: number | undefined;
let listening = false;

function seen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function bump(id: string, key: keyof Counts) {
  const c = queue.get(id) ?? { v: 0, c: 0 };
  c[key] += 1;
  queue.set(id, c);
  if (!listening) {
    listening = true;
    // pagehide fires on mobile Safari when visibilitychange may not.
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  }
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, 10_000);
}

export function trackView(id: string) {
  const s = seen();
  if (s.has(id)) return;
  s.add(id);
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    // Storage blocked (private mode): still count it once for this page load.
  }
  bump(id, "v");
}

export function trackClick(id: string) {
  bump(id, "c");
  // A click usually navigates away; send now rather than waiting for pagehide.
  flush();
}

function flush() {
  window.clearTimeout(timer);
  if (!queue.size) return;
  const events = [...queue].slice(0, MAX_BATCH).map(([id, n]) => ({ id, ...n }));
  queue.clear();
  const body = JSON.stringify({ events });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // fall through to fetch
  }
  void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}
