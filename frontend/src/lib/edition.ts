import type { ArticleCard } from "@/types";

/**
 * Stories from one nightly run are stored within minutes of each other; runs are a day
 * apart. Anything stored this much before the newest story belongs to an earlier edition.
 */
export const EDITION_GAP_MS = 12 * 60 * 60 * 1000;

function addedAt(story: ArticleCard): number {
  return Date.parse(story.added_at ?? story.published_at ?? "");
}

/** When the newest edition was stored (ms), or null when no story says. */
export function newestEditionAt(stories: ArticleCard[]): number | null {
  const times = stories.map(addedAt).filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

/**
 * Index of the first story from an earlier edition than the newest one, or null when all
 * are from the same edition. The feed is newest edition first, so everything after it is
 * earlier too.
 */
export function firstEarlierIndex(stories: ArticleCard[]): number | null {
  const newest = newestEditionAt(stories);
  if (newest === null) return null;
  const i = stories.findIndex((s) => {
    const t = addedAt(s);
    return Number.isFinite(t) && newest - t > EDITION_GAP_MS;
  });
  return i === -1 ? null : i;
}
