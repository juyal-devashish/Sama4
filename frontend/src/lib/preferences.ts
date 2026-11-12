"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStoredValue } from "./storage";
import { normalizeOnboarding, reduceOnboarding, type OnboardingEvent } from "./onboarding";
import type { ArticleCard } from "@/types";

// ---------- Theme ----------

export type ThemeChoice = "light" | "dark" | "system";

function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  return dark;
}

export function useTheme() {
  const [theme, setTheme] = useStoredValue<ThemeChoice>("sama4_theme", "system");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(applyTheme(theme));
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setIsDark(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return { theme, setTheme, isDark };
}

// ---------- Topics ----------

export const ALL_TOPICS = ["general", "tech", "business", "science", "world"] as const;
export type Topic = (typeof ALL_TOPICS)[number];

export const TOPIC_LABELS: Record<string, string> = {
  all: "All stories",
  general: "General",
  tech: "Tech",
  business: "Business",
  science: "Science",
  world: "World",
};

export function useTopics() {
  const [stored, setTopics] = useStoredValue<string[]>("sama4_categories", []);
  // Older builds saved capitalised names; normalise them.
  const topics = stored
    .map((t) => t.toLowerCase())
    .filter((t): t is Topic => (ALL_TOPICS as readonly string[]).includes(t));
  return [topics.length ? topics : [...ALL_TOPICS], setTopics] as const;
}

/** The old first-run flag. Only read now, by `useOnboarding()`, to recognise existing readers. */
export function useOnboarded() {
  return useStoredValue<boolean>("sama4_onboarded", false);
}

/**
 * First-run state (intro + in-app hints). See `lib/onboarding.ts` for the rules.
 * Until something is saved under the new key, it's derived from the old
 * `sama4_onboarded` flag so existing readers aren't interrupted.
 */
export function useOnboarding() {
  const [legacy] = useOnboarded();
  const [stored, setStored] = useStoredValue<unknown>("sama4_onboarding", null);
  const state = useMemo(() => normalizeOnboarding(stored, legacy), [stored, legacy]);

  const dispatch = useCallback(
    (event: OnboardingEvent) =>
      setStored((prev: unknown) => {
        const current = normalizeOnboarding(prev, legacy);
        const next = reduceOnboarding(current, event);
        // Skip the write (and every listener re-render) when nothing changed.
        return next === current && prev !== null ? prev : next;
      }),
    [setStored, legacy],
  );

  return { state, dispatch };
}

// ---------- Saved stories ----------

export type SavedStory = Pick<
  ArticleCard,
  "id" | "title" | "summary" | "image_url" | "published_at" | "reading_time_minutes"
> & { source: string; saved_at: string };

export function useSavedStories() {
  const [saved, setSaved] = useStoredValue<SavedStory[]>("sama4_saved", []);

  const isSaved = useCallback((id: string) => saved.some((s) => s.id === id), [saved]);

  const toggle = useCallback(
    (story: Omit<SavedStory, "saved_at">) => {
      setSaved((prev) =>
        prev.some((s) => s.id === story.id)
          ? prev.filter((s) => s.id !== story.id)
          : [{ ...story, saved_at: new Date().toISOString() }, ...prev],
      );
    },
    [setSaved],
  );

  const remove = useCallback(
    (id: string) => setSaved((prev) => prev.filter((s) => s.id !== id)),
    [setSaved],
  );

  /** Put back a story removed by mistake, in its original place (newest saved first). */
  const restore = useCallback(
    (story: SavedStory) =>
      setSaved((prev) =>
        prev.some((s) => s.id === story.id)
          ? prev
          : [...prev, story].sort((a, b) => b.saved_at.localeCompare(a.saved_at)),
      ),
    [setSaved],
  );

  return { saved, isSaved, toggle, remove, restore };
}

// ---------- Recent searches ----------

export function useRecentSearches() {
  const [recent, setRecent] = useStoredValue<string[]>("sama4_recent_searches", []);
  const add = useCallback(
    (q: string) => {
      const term = q.trim();
      if (!term) return;
      setRecent((prev) =>
        [term, ...prev.filter((p) => p.toLowerCase() !== term.toLowerCase())].slice(0, 8),
      );
    },
    [setRecent],
  );
  const clear = useCallback(() => setRecent([]), [setRecent]);
  return { recent, add, clear };
}
