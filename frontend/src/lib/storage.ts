"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ownKeys } from "./deviceData";

/**
 * Tiny localStorage-backed store with cross-component (and cross-window) updates.
 * Every read and write is guarded: storage can be unavailable in private windows.
 */
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return fallback;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

function write<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable; the in-memory listeners still update below.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Forget everything Samā4 keeps in this browser (every `sama4_` key, in local and session
 * storage) and tell every component, so theme, saved stories and the rest reset at once.
 */
export function clearDeviceData() {
  for (const area of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[area];
      ownKeys(storage).forEach((k) => storage.removeItem(k));
    } catch {
      // Storage unavailable: nothing to clear.
    }
  }
  cache.clear();
  listeners.forEach((l) => l());
}

export function useStoredValue<T>(key: string, fallback: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key, fallback);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      write(key, resolved);
    },
    // fallback is expected to be a stable literal per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set] as const;
}
