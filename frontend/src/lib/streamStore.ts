"use client";

import { useSyncExternalStore } from "react";

/**
 * The text of an explanation that is still being written, by query key. React Query holds
 * the finished result; this holds what has arrived so far so the panel can show it.
 */
const partials = new Map<string, string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const partialStore = {
  append(key: string, text: string) {
    partials.set(key, (partials.get(key) ?? "") + text);
    notify();
  },
  clear(key: string) {
    if (partials.delete(key)) notify();
  },
  get(key: string): string {
    return partials.get(key) ?? "";
  },
};

export function usePartialText(key: string): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => partialStore.get(key),
    () => "",
  );
}
