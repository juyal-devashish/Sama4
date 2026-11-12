/**
 * First-run flow: which screen a visitor starts on, and which in-app hint (if any) to show.
 *
 * Pure logic only. The state is saved by `useOnboarding()` in `lib/preferences.ts`;
 * components send events and ask `startScreen()` / `eligibleHint()` what to render.
 */

/** Bump to show the intro again to everyone (e.g. after a big redesign). */
export const ONBOARDING_VERSION = 1;

/** In-app hints, in priority order: when several are eligible, the first one wins. */
export const HINTS = ["select-term", "ask-follow-up", "keyboard-shortcuts", "save-story"] as const;
export type HintId = (typeof HINTS)[number];

/** How many dismissals retire a hint for good. The core interaction gets a few chances. */
const DISMISS_LIMIT: Record<HintId, number> = {
  "select-term": 3,
  "ask-follow-up": 1,
  "keyboard-shortcuts": 1,
  "save-story": 1,
};

/** Stories a reader must have opened before the later tips appear. */
export const STORIES_BEFORE_SHORTCUTS = 3;
export const STORIES_BEFORE_SAVE = 5;
const STORIES_TRACKED = Math.max(STORIES_BEFORE_SHORTCUTS, STORIES_BEFORE_SAVE);

export interface OnboardingState {
  version: number;
  /** The splash and intro have been completed or skipped. */
  introDone: boolean;
  /** Hints that are finished: acted on, or dismissed up to their limit. */
  hintsSeen: HintId[];
  dismissals: Partial<Record<HintId, number>>;
  /** Distinct stories opened, capped at the largest threshold we need. */
  storiesOpened: string[];
}

export const INITIAL_ONBOARDING: OnboardingState = {
  version: ONBOARDING_VERSION,
  introDone: false,
  hintsSeen: [],
  dismissals: {},
  storiesOpened: [],
};

/** Everything done: what existing readers from before this flow get. */
const COMPLETED: OnboardingState = {
  ...INITIAL_ONBOARDING,
  introDone: true,
  hintsSeen: [...HINTS],
};

const unique = <T>(xs: T[]) => xs.filter((x, i) => xs.indexOf(x) === i);

const isHint = (v: unknown): v is HintId =>
  typeof v === "string" && (HINTS as readonly string[]).includes(v);

/**
 * Turn whatever is in storage into a valid state.
 *
 * `legacyOnboarded` is the old `sama4_onboarded` flag: readers who finished the old
 * welcome dialog skip the intro and every hint, so nothing new interrupts them.
 * Unreadable or partial values fall back field by field instead of throwing.
 */
export function normalizeOnboarding(stored: unknown, legacyOnboarded: boolean): OnboardingState {
  if (!stored || typeof stored !== "object") {
    return legacyOnboarded ? { ...COMPLETED } : { ...INITIAL_ONBOARDING };
  }
  const s = stored as Record<string, unknown>;
  const version = typeof s.version === "number" ? s.version : 0;
  const hintsSeen = Array.isArray(s.hintsSeen) ? unique(s.hintsSeen.filter(isHint)) : [];
  const dismissals: Partial<Record<HintId, number>> = {};
  if (s.dismissals && typeof s.dismissals === "object") {
    for (const [k, v] of Object.entries(s.dismissals)) {
      if (isHint(k) && typeof v === "number" && v > 0) dismissals[k] = Math.floor(v);
    }
  }
  const storiesOpened = Array.isArray(s.storiesOpened)
    ? unique(s.storiesOpened.filter((x): x is string => typeof x === "string")).slice(
        0,
        STORIES_TRACKED,
      )
    : [];
  return {
    version: ONBOARDING_VERSION,
    // An older intro version means there is a newer intro to see.
    introDone: version >= ONBOARDING_VERSION && s.introDone === true,
    hintsSeen,
    dismissals,
    storiesOpened,
  };
}

export type OnboardingEvent =
  | { type: "intro-finished" }
  | { type: "story-opened"; id: string }
  /** The reader did what the hint asked (e.g. selected a term). */
  | { type: "hint-done"; hint: HintId }
  | { type: "hint-dismissed"; hint: HintId }
  /** "Replay introduction" in Settings: intro and hints again, reading history kept. */
  | { type: "replay" };

export function reduceOnboarding(state: OnboardingState, event: OnboardingEvent): OnboardingState {
  switch (event.type) {
    case "intro-finished":
      return state.introDone ? state : { ...state, introDone: true };

    case "story-opened": {
      if (state.storiesOpened.includes(event.id)) return state;
      if (state.storiesOpened.length >= STORIES_TRACKED) return state;
      return { ...state, storiesOpened: [...state.storiesOpened, event.id] };
    }

    case "hint-done":
      return markSeen(state, event.hint);

    case "hint-dismissed": {
      if (state.hintsSeen.includes(event.hint)) return state;
      const count = (state.dismissals[event.hint] ?? 0) + 1;
      const next = { ...state, dismissals: { ...state.dismissals, [event.hint]: count } };
      return count >= DISMISS_LIMIT[event.hint] ? markSeen(next, event.hint) : next;
    }

    case "replay":
      return { ...INITIAL_ONBOARDING, storiesOpened: state.storiesOpened };
  }
}

function markSeen(state: OnboardingState, hint: HintId): OnboardingState {
  if (state.hintsSeen.includes(hint)) return state;
  return { ...state, hintsSeen: [...state.hintsSeen, hint] };
}

export type StartScreen = "splash" | "app";

/**
 * Where a visit starts. First-timers get the splash (which leads into the intro);
 * anyone arriving on a link to a specific story goes straight to it, and the
 * in-app hints teach them instead.
 */
export function startScreen(state: OnboardingState, opts: { deepLink: boolean }): StartScreen {
  return !state.introDone && !opts.deepLink ? "splash" : "app";
}

export const INTRO_STEPS = ["welcome", "topics"] as const;
export type IntroStep = (typeof INTRO_STEPS)[number];

/** The step after `step`, or null when the intro is over. */
export function nextIntroStep(step: IntroStep): IntroStep | null {
  return INTRO_STEPS[INTRO_STEPS.indexOf(step) + 1] ?? null;
}

/** What is on screen right now, as far as hints are concerned. */
export interface HintContext {
  /** A story is open and has at least one highlighted term. */
  articleWithTerms: boolean;
  /** The explanation panel for a term is open. */
  contextPanelOpen: boolean;
  /** Wide enough for keyboard use (shortcut tips are pointless on a phone). */
  desktop: boolean;
  /** The splash or intro is showing; no hints over it. */
  introShowing: boolean;
}

/** The one hint to show now, or null. Never more than one at a time. */
export function eligibleHint(state: OnboardingState, ctx: HintContext): HintId | null {
  if (ctx.introShowing) return null;
  const seen = (h: HintId) => state.hintsSeen.includes(h);
  const read = state.storiesOpened.length;

  const rules: Record<HintId, boolean> = {
    "select-term": ctx.articleWithTerms && !ctx.contextPanelOpen,
    // Only after they've found highlights, and only while the panel is in view.
    "ask-follow-up": ctx.contextPanelOpen && seen("select-term"),
    "keyboard-shortcuts": ctx.desktop && read >= STORIES_BEFORE_SHORTCUTS,
    "save-story": ctx.articleWithTerms && !ctx.contextPanelOpen && read >= STORIES_BEFORE_SAVE,
  };
  return HINTS.find((h) => !seen(h) && rules[h]) ?? null;
}
