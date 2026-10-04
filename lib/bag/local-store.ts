"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store with cross-tab sync (storage event).
 * Every read/write is guarded: storage can be unavailable (private mode, etc).
 */
export function createLocalStore<T>(key: string, fallback: T, parse: (raw: unknown) => T) {
  let cache: { raw: string | null; value: T } | null = null;
  const listeners = new Set<() => void>();

  function read(): T {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      // ignore
    }
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    if (raw) {
      try {
        value = parse(JSON.parse(raw));
      } catch {
        value = fallback;
      }
    }
    cache = { raw, value };
    return value;
  }

  function write(next: T) {
    const raw = JSON.stringify(next);
    try {
      window.localStorage.setItem(key, raw);
      cache = { raw, value: next };
    } catch {
      cache = { raw: null, value: next };
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, read, () => fallback);
  }

  return { read, write, subscribe, useValue, update: (fn: (prev: T) => T) => write(fn(read())) };
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
