import { describe, expect, it } from "vitest";
import type { ArticleCard } from "@/types";
import { NO_BASELINE, isNewSince, resolveVisit } from "./lastVisit";

const NOW = Date.parse("2026-11-15T09:00:00Z");
const story = (over: Partial<ArticleCard>): ArticleCard => ({
  id: "a",
  title: "T",
  source: { name: "BBC" },
  categories: [],
  entity_count: 0,
  ...over,
});

describe("resolveVisit", () => {
  it("a first-ever visit has no baseline and records the visit", () => {
    expect(resolveVisit(null, null, NOW)).toEqual({
      baseline: null,
      storeLastVisit: NOW,
      storeBaseline: NO_BASELINE,
    });
  });

  it("a returning visit uses the stored time as its baseline for the whole session", () => {
    const last = NOW - 86_400_000;
    expect(resolveVisit(null, String(last), NOW)).toEqual({
      baseline: last,
      storeLastVisit: NOW,
      storeBaseline: String(last),
    });
    // A reload in the same session keeps the baseline and does not move it forward.
    expect(resolveVisit(String(last), String(NOW), NOW + 5_000)).toEqual({
      baseline: last,
      storeLastVisit: null,
      storeBaseline: null,
    });
    expect(resolveVisit(NO_BASELINE, String(NOW), NOW + 5_000).baseline).toBeNull();
  });

  it("ignores a corrupt stored value", () => {
    expect(resolveVisit(null, "garbage", NOW).baseline).toBeNull();
  });
});

describe("isNewSince", () => {
  const baseline = NOW - 10 * 3_600_000;
  it("marks stories stored after the baseline, by the time they were added", () => {
    // Published yesterday evening but stored at 03:00 today: new to someone who left at 23:00.
    const added = new Date(NOW - 6 * 3_600_000).toISOString();
    const published = new Date(NOW - 14 * 3_600_000).toISOString();
    expect(isNewSince(story({ added_at: added, published_at: published }), baseline)).toBe(true);
    expect(isNewSince(story({ added_at: new Date(baseline - 1).toISOString() }), baseline)).toBe(
      false,
    );
  });
  it("falls back to the publish time for an older server", () => {
    expect(isNewSince(story({ published_at: new Date(NOW).toISOString() }), baseline)).toBe(true);
  });
  it("marks nothing without a baseline or a date", () => {
    expect(isNewSince(story({ added_at: new Date(NOW).toISOString() }), null)).toBe(false);
    expect(isNewSince(story({}), baseline)).toBe(false);
  });
});
