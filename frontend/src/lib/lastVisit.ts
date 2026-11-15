import type { ArticleCard } from "@/types";

/**
 * "New since your last visit". A visit is a browser session: the first time the app opens
 * in a session, the time stored from the previous visit becomes this session's baseline
 * (kept in sessionStorage, so a reload doesn't clear the markers), and now is stored for
 * next time. A first-ever visitor has no baseline, so nothing is marked.
 */
export const LAST_VISIT_KEY = "sama4_last_visit";
export const BASELINE_KEY = "sama4_visit_baseline";
export const NO_BASELINE = "none";

export interface VisitState {
  /** Baseline for this session: ms since epoch, or null when there was no earlier visit. */
  baseline: number | null;
  /** Value to store as the last-visit time, or null to leave it as is. */
  storeLastVisit: number | null;
  /** Value to keep for the session (a string for sessionStorage), or null to leave it. */
  storeBaseline: string | null;
}

/** Decide the baseline from what is stored. Pure, so it is tested. */
export function resolveVisit(
  sessionBaseline: string | null,
  lastVisit: string | null,
  now: number,
): VisitState {
  if (sessionBaseline !== null) {
    // Already decided for this session: just reuse it.
    const n = Number(sessionBaseline);
    return {
      baseline: sessionBaseline === NO_BASELINE || !Number.isFinite(n) ? null : n,
      storeLastVisit: null,
      storeBaseline: null,
    };
  }
  const previous = lastVisit === null ? NaN : Number(lastVisit);
  const baseline = Number.isFinite(previous) && previous > 0 ? previous : null;
  return {
    baseline,
    storeLastVisit: now,
    storeBaseline: baseline === null ? NO_BASELINE : String(baseline),
  };
}

/** True when the story was stored after the baseline. Falls back to the publish time. */
export function isNewSince(story: ArticleCard, baseline: number | null): boolean {
  if (baseline === null) return false;
  const at = Date.parse(story.added_at ?? story.published_at ?? "");
  return Number.isFinite(at) && at > baseline;
}
