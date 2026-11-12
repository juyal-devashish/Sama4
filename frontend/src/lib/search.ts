import type { ArticleCard } from "@/types";

export type DateRange = "any" | "day" | "week";

export interface SearchFilters {
  query: string;
  topic: string; // "all" or a topic id
  source: string; // "all" or a source name
  date: DateRange;
}

export const NO_FILTERS: Omit<SearchFilters, "query"> = {
  topic: "all",
  source: "all",
  date: "any",
};

const RANGE_MS: Record<Exclude<DateRange, "any">, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

function matchesQuery(a: ArticleCard, q: string): boolean {
  return (
    a.title.toLowerCase().includes(q) ||
    (a.summary ?? "").toLowerCase().includes(q) ||
    a.source.name.toLowerCase().includes(q)
  );
}

/** Stories matching the text query only (what the source/topic options are built from). */
export function matchQuery(stories: ArticleCard[], query: string): ArticleCard[] {
  const q = query.trim().toLowerCase();
  return q ? stories.filter((a) => matchesQuery(a, q)) : [];
}

/** Apply topic, source and date filters, newest first. */
export function applyFilters(
  stories: ArticleCard[],
  f: Omit<SearchFilters, "query">,
  now: number = Date.now(),
): ArticleCard[] {
  const since = f.date === "any" ? null : now - RANGE_MS[f.date];
  return stories
    .filter((a) => f.topic === "all" || a.categories.includes(f.topic))
    .filter((a) => f.source === "all" || a.source.name === f.source)
    .filter((a) => since === null || (a.published_at ? Date.parse(a.published_at) >= since : false))
    .sort((a, b) => Date.parse(b.published_at ?? "0") - Date.parse(a.published_at ?? "0"));
}

/** Distinct values with counts, most common first, for the filter menus. */
export function facet(stories: ArticleCard[], key: (a: ArticleCard) => string[]) {
  const counts = new Map<string, number>();
  for (const a of stories) for (const k of key(a)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (x, y) => y.count - x.count || x.value.localeCompare(y.value),
  );
}

export function hasFilters(f: Omit<SearchFilters, "query">): boolean {
  return f.topic !== "all" || f.source !== "all" || f.date !== "any";
}
