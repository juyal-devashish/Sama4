import { describe, expect, it } from "vitest";
import {
  HINTS,
  INITIAL_ONBOARDING,
  ONBOARDING_VERSION,
  eligibleHint,
  nextIntroStep,
  normalizeOnboarding,
  reduceOnboarding,
  startScreen,
  FIRST_VISIT_SCRIPT,
  GATE_ATTR,
  SPLASH_FAILSAFE_MS,
  type HintContext,
  type OnboardingState,
} from "./onboarding";

const ctx = (over: Partial<HintContext> = {}): HintContext => ({
  articleWithTerms: false,
  contextPanelOpen: false,
  desktop: true,
  introShowing: false,
  ...over,
});

const withStories = (n: number, over: Partial<OnboardingState> = {}): OnboardingState => ({
  ...INITIAL_ONBOARDING,
  introDone: true,
  storiesOpened: Array.from({ length: n }, (_, i) => `s${i}`),
  ...over,
});

describe("normalizeOnboarding", () => {
  it("starts fresh for a new visitor", () => {
    expect(normalizeOnboarding(null, false)).toEqual(INITIAL_ONBOARDING);
  });

  it("lets readers of the old welcome dialog skip the intro and every hint", () => {
    const s = normalizeOnboarding(null, true);
    expect(s.introDone).toBe(true);
    expect(s.hintsSeen).toEqual([...HINTS]);
  });

  it("prefers the new saved state over the legacy flag", () => {
    const stored = { ...INITIAL_ONBOARDING, introDone: true, hintsSeen: ["select-term"] };
    expect(normalizeOnboarding(stored, true).hintsSeen).toEqual(["select-term"]);
  });

  it("drops junk field by field instead of throwing", () => {
    const s = normalizeOnboarding(
      {
        version: ONBOARDING_VERSION,
        introDone: "yes",
        hintsSeen: ["select-term", "nope", 4, "select-term"],
        dismissals: { "save-story": 2, bogus: 1, "ask-follow-up": -1 },
        storiesOpened: ["a", "a", 7, "b"],
      },
      false,
    );
    expect(s).toEqual({
      version: ONBOARDING_VERSION,
      introDone: false,
      hintsSeen: ["select-term"],
      dismissals: { "save-story": 2 },
      storiesOpened: ["a", "b"],
    });
    expect(normalizeOnboarding("garbage", false)).toEqual(INITIAL_ONBOARDING);
  });

  it("shows the intro again after a version bump, keeping hint progress", () => {
    const s = normalizeOnboarding(
      { version: ONBOARDING_VERSION - 1, introDone: true, hintsSeen: ["save-story"] },
      false,
    );
    expect(s.introDone).toBe(false);
    expect(s.hintsSeen).toEqual(["save-story"]);
  });
});

describe("reduceOnboarding", () => {
  it("finishes the intro", () => {
    expect(reduceOnboarding(INITIAL_ONBOARDING, { type: "intro-finished" }).introDone).toBe(true);
  });

  it("counts distinct stories, up to what the thresholds need", () => {
    let s = INITIAL_ONBOARDING;
    for (const id of ["a", "a", "b", "c", "d", "e", "f", "g"]) {
      s = reduceOnboarding(s, { type: "story-opened", id });
    }
    expect(s.storiesOpened).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("retires the select-term hint after three dismissals, others after one", () => {
    let s = INITIAL_ONBOARDING;
    s = reduceOnboarding(s, { type: "hint-dismissed", hint: "select-term" });
    s = reduceOnboarding(s, { type: "hint-dismissed", hint: "select-term" });
    expect(s.hintsSeen).not.toContain("select-term");
    s = reduceOnboarding(s, { type: "hint-dismissed", hint: "select-term" });
    expect(s.hintsSeen).toEqual(["select-term"]);

    s = reduceOnboarding(s, { type: "hint-dismissed", hint: "save-story" });
    expect(s.hintsSeen).toEqual(["select-term", "save-story"]);
  });

  it("marks a hint seen when the reader acts on it, once", () => {
    let s = reduceOnboarding(INITIAL_ONBOARDING, { type: "hint-done", hint: "ask-follow-up" });
    s = reduceOnboarding(s, { type: "hint-done", hint: "ask-follow-up" });
    expect(s.hintsSeen).toEqual(["ask-follow-up"]);
  });

  it("replays the intro and hints but keeps reading history", () => {
    const s = reduceOnboarding(withStories(4, { hintsSeen: [...HINTS] }), { type: "replay" });
    expect(s.introDone).toBe(false);
    expect(s.hintsSeen).toEqual([]);
    expect(s.storiesOpened).toHaveLength(4);
  });
});

describe("startScreen", () => {
  it("shows the splash to first-timers only", () => {
    expect(startScreen(INITIAL_ONBOARDING, { deepLink: false })).toBe("splash");
    expect(startScreen(withStories(0), { deepLink: false })).toBe("app");
  });

  it("never puts the splash in front of a shared story", () => {
    expect(startScreen(INITIAL_ONBOARDING, { deepLink: true })).toBe("app");
  });
});

describe("nextIntroStep", () => {
  it("walks welcome then topics, then ends", () => {
    expect(nextIntroStep("welcome")).toBe("topics");
    expect(nextIntroStep("topics")).toBeNull();
  });
});

describe("eligibleHint", () => {
  it("shows nothing over the intro", () => {
    expect(
      eligibleHint(INITIAL_ONBOARDING, ctx({ articleWithTerms: true, introShowing: true })),
    ).toBeNull();
  });

  it("teaches selecting a term first, even to deep-link visitors who skipped the intro", () => {
    expect(eligibleHint(INITIAL_ONBOARDING, ctx({ articleWithTerms: true }))).toBe("select-term");
    expect(eligibleHint(INITIAL_ONBOARDING, ctx())).toBeNull();
  });

  it("offers follow-ups only once the panel is open and terms are understood", () => {
    const open = ctx({ articleWithTerms: true, contextPanelOpen: true });
    expect(eligibleHint(INITIAL_ONBOARDING, open)).toBeNull();
    expect(eligibleHint(withStories(0, { hintsSeen: ["select-term"] }), open)).toBe(
      "ask-follow-up",
    );
  });

  it("holds the later tips until enough stories have been read", () => {
    const base = { hintsSeen: ["select-term", "ask-follow-up"] as OnboardingState["hintsSeen"] };
    const reading = ctx({ articleWithTerms: true });
    expect(eligibleHint(withStories(2, base), reading)).toBeNull();
    expect(eligibleHint(withStories(3, base), reading)).toBe("keyboard-shortcuts");
    expect(eligibleHint(withStories(3, base), { ...reading, desktop: false })).toBeNull();

    const shortcutsSeen = {
      hintsSeen: [...base.hintsSeen, "keyboard-shortcuts"] as OnboardingState["hintsSeen"],
    };
    expect(eligibleHint(withStories(4, shortcutsSeen), reading)).toBeNull();
    expect(eligibleHint(withStories(5, shortcutsSeen), reading)).toBe("save-story");
  });

  it("shows nothing once every hint is seen", () => {
    const done = withStories(5, { hintsSeen: [...HINTS] });
    expect(eligibleHint(done, ctx({ articleWithTerms: true, contextPanelOpen: true }))).toBeNull();
  });
});

describe("FIRST_VISIT_SCRIPT", () => {
  /** Run the inline script against fake browser globals; return the classes it added. */
  function run(path: string, storage: Record<string, string>) {
    const added: string[] = [];
    const url = new URL(path, "https://www.sama4.online");
    const document = {
      documentElement: { classList: { add: (...c: string[]) => added.push(...c) } },
    };
    const location = { pathname: url.pathname, search: url.search };
    const localStorage = { getItem: (k: string) => storage[k] ?? null };
    new Function("document", "location", "localStorage", "setTimeout", FIRST_VISIT_SCRIPT)(
      document,
      location,
      localStorage,
      () => {},
    );
    return added;
  }

  const save = (v: unknown) => JSON.stringify(v);
  const cases: [string, Record<string, string>][] = [
    ["new visitor", {}],
    ["old welcome dialog done", { sama4_onboarded: "true" }],
    ["old flag false", { sama4_onboarded: "false" }],
    ["intro done", { sama4_onboarding: save({ ...INITIAL_ONBOARDING, introDone: true }) }],
    ["intro not done", { sama4_onboarding: save(INITIAL_ONBOARDING) }],
    [
      "intro done on an older version",
      { sama4_onboarding: save({ version: ONBOARDING_VERSION - 1, introDone: true }) },
    ],
    [
      "new state wins over old flag",
      { sama4_onboarding: save(INITIAL_ONBOARDING), sama4_onboarded: "true" },
    ],
    ["corrupt new state", { sama4_onboarding: "{oops", sama4_onboarded: "true" }],
  ];

  for (const [name, storage] of cases) {
    it(`agrees with startScreen: ${name}`, () => {
      const parse = (k: string) => {
        try {
          return storage[k] === undefined ? null : JSON.parse(storage[k]);
        } catch {
          return null;
        }
      };
      const state = normalizeOnboarding(
        parse("sama4_onboarding"),
        parse("sama4_onboarded") === true,
      );
      const expected = startScreen(state, { deepLink: false }) === "splash";
      expect(run("/", storage).length > 0).toBe(expected);
    });
  }

  it("never fires on deep links", () => {
    for (const path of [
      "/?article=abc",
      "/?topic=tech&article=abc",
      "/settings",
      "/early-access",
    ]) {
      expect(run(path, {})).toEqual([]);
    }
    expect(run("/?topic=tech", {})).toEqual(["intro", "intro-splash"]);
  });

  it("reveals the app by itself if the JavaScript app never starts", () => {
    const classes = new Set<string>();
    const attrs = new Set<string>();
    const timers: [() => void, number][] = [];
    const html = {
      classList: {
        add: (...c: string[]) => c.forEach((x) => classes.add(x)),
        remove: (...c: string[]) => c.forEach((x) => classes.delete(x)),
      },
      hasAttribute: (a: string) => attrs.has(a),
    };
    const exec = () =>
      new Function("document", "location", "localStorage", "setTimeout", FIRST_VISIT_SCRIPT)(
        { documentElement: html },
        { pathname: "/", search: "" },
        { getItem: () => null },
        (fn: () => void, ms: number) => timers.push([fn, ms]),
      );

    exec();
    expect(Array.from(classes)).toEqual(["intro", "intro-splash"]);
    expect(timers[0][1]).toBe(SPLASH_FAILSAFE_MS);
    timers[0][0](); // the app never mounted
    expect(Array.from(classes)).toEqual([]);

    // When the gate has mounted, the failsafe leaves the intro alone.
    timers.length = 0;
    exec();
    attrs.add(GATE_ATTR);
    timers[0][0]();
    expect(Array.from(classes)).toEqual(["intro", "intro-splash"]);
  });

  it("does nothing when storage throws", () => {
    const document = {
      documentElement: {
        classList: {
          add: () => {
            throw new Error("added");
          },
        },
      },
    };
    const localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() =>
      new Function("document", "location", "localStorage", FIRST_VISIT_SCRIPT)(
        document,
        { pathname: "/", search: "" },
        localStorage,
      ),
    ).not.toThrow();
  });
});
