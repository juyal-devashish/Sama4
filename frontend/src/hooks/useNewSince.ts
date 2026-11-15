"use client";

import { useEffect, useState } from "react";
import { BASELINE_KEY, LAST_VISIT_KEY, resolveVisit } from "@/lib/lastVisit";

/**
 * The time of the reader's previous visit (ms), or null for a first visit. Read after
 * mount so the server render and first client render agree. Every storage access is
 * guarded: it can be unavailable (private windows).
 */
export function useNewSince(): number | null {
  const [baseline, setBaseline] = useState<number | null>(null);

  useEffect(() => {
    let sessionBaseline: string | null = null;
    let lastVisit: string | null = null;
    try {
      sessionBaseline = window.sessionStorage.getItem(BASELINE_KEY);
      lastVisit = window.localStorage.getItem(LAST_VISIT_KEY);
    } catch {
      /* storage unavailable: no markers */
    }
    const visit = resolveVisit(sessionBaseline, lastVisit, Date.now());
    try {
      if (visit.storeBaseline !== null)
        window.sessionStorage.setItem(BASELINE_KEY, visit.storeBaseline);
      if (visit.storeLastVisit !== null)
        window.localStorage.setItem(LAST_VISIT_KEY, String(visit.storeLastVisit));
    } catch {
      /* ignore */
    }
    setBaseline(visit.baseline);

    // Leaving counts as the end of this visit, so what arrives after it is new next time.
    const stamp = () => {
      if (document.visibilityState === "hidden") {
        try {
          window.localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("visibilitychange", stamp);
    return () => document.removeEventListener("visibilitychange", stamp);
  }, []);

  return baseline;
}
