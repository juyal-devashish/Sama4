import { describe, expect, it } from "vitest";
import { firstEarlierIndex, newestEditionAt } from "./edition";
import type { ArticleCard } from "@/types";

const HOUR = 3_600_000;
const T0 = Date.parse("2026-11-15T08:00:00Z");
const story = (hoursBefore: number | null): ArticleCard =>
  ({
    id: String(hoursBefore),
    title: "t",
    source: { name: "s" },
    added_at: hoursBefore === null ? null : new Date(T0 - hoursBefore * HOUR).toISOString(),
    published_at: null,
  }) as unknown as ArticleCard;

describe("editions", () => {
  it("finds the newest edition's time", () => {
    expect(newestEditionAt([story(0.5), story(0), story(24)])).toBe(T0);
    expect(newestEditionAt([])).toBeNull();
    expect(newestEditionAt([story(null)])).toBeNull();
  });

  it("marks where the earlier edition starts", () => {
    // Four stories stored over twenty minutes, then yesterday's run.
    const feed = [story(0), story(0.1), story(0.3), story(24), story(24.2)];
    expect(firstEarlierIndex(feed)).toBe(3);
  });

  it("marks nothing when every story is from one edition", () => {
    expect(firstEarlierIndex([story(0), story(0.2), story(5)])).toBeNull();
    expect(firstEarlierIndex([])).toBeNull();
  });
});
