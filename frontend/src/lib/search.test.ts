import { describe, expect, it } from "vitest";
import type { ArticleCard } from "@/types";
import { NO_FILTERS, applyFilters, facet, matchQuery } from "./search";

const NOW = Date.parse("2026-11-12T12:00:00Z");
const story = (id: string, source: string, topic: string, hoursAgo: number): ArticleCard => ({
  id,
  title: `Nature story ${id}`,
  source: { name: source },
  categories: [topic],
  entity_count: 0,
  published_at: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
});
const STORIES = [
  story("a", "BBC", "science", 2),
  story("b", "Reuters", "world", 30),
  story("c", "BBC", "world", 200),
];

describe("search", () => {
  it("matches the query in title, summary or source", () => {
    expect(matchQuery(STORIES, "nature").length).toBe(3);
    expect(matchQuery(STORIES, "reuters").map((s) => s.id)).toEqual(["b"]);
    expect(matchQuery(STORIES, "  ")).toEqual([]);
  });

  it("narrows by topic, source and date, newest first", () => {
    expect(applyFilters(STORIES, NO_FILTERS, NOW).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(applyFilters(STORIES, { ...NO_FILTERS, topic: "world" }, NOW).map((s) => s.id)).toEqual([
      "b",
      "c",
    ]);
    expect(applyFilters(STORIES, { ...NO_FILTERS, source: "BBC" }, NOW).map((s) => s.id)).toEqual([
      "a",
      "c",
    ]);
    expect(applyFilters(STORIES, { ...NO_FILTERS, date: "day" }, NOW).map((s) => s.id)).toEqual([
      "a",
    ]);
    expect(applyFilters(STORIES, { ...NO_FILTERS, date: "week" }, NOW).map((s) => s.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("counts facet values, most common first", () => {
    expect(facet(STORIES, (s) => [s.source.name])).toEqual([
      { value: "BBC", count: 2 },
      { value: "Reuters", count: 1 },
    ]);
  });
});
