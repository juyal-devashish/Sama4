import { describe, expect, it } from "vitest";
import { exportSaved, mergeSaved, ownKeys, parseSavedImport } from "./deviceData";
import type { SavedStory } from "./preferences";

const story = (id: string, savedAt: string): SavedStory => ({
  id,
  title: `Story ${id}`,
  source: "Example",
  saved_at: savedAt,
});

describe("saved stories file", () => {
  it("round-trips through export and import", () => {
    const saved = [story("a", "2026-11-14T10:00:00Z"), story("b", "2026-11-13T10:00:00Z")];
    const result = parseSavedImport(exportSaved(saved, new Date("2026-11-15T00:00:00Z")));
    expect(result).toEqual({ ok: true, stories: saved });
  });

  it("refuses files that aren't saved-stories files", () => {
    expect(parseSavedImport("not json").ok).toBe(false);
    expect(parseSavedImport(JSON.stringify({ hello: 1 })).ok).toBe(false);
    expect(parseSavedImport(JSON.stringify({ saved: [{ id: 1 }] })).ok).toBe(false);
  });

  it("accepts an empty list and skips unreadable entries among good ones", () => {
    expect(parseSavedImport(JSON.stringify({ saved: [] }))).toEqual({ ok: true, stories: [] });
    const good = story("a", "2026-11-14T10:00:00Z");
    expect(parseSavedImport(JSON.stringify({ saved: [good, { id: "x" }] }))).toEqual({
      ok: true,
      stories: [good],
    });
  });
});

describe("mergeSaved", () => {
  it("adds only stories not already saved, newest saved first", () => {
    const mine = [story("a", "2026-11-14T10:00:00Z")];
    const theirs = [
      story("a", "2026-11-01T10:00:00Z"),
      story("b", "2026-11-15T10:00:00Z"),
      story("b", "2026-11-15T10:00:00Z"),
    ];
    const merged = mergeSaved(mine, theirs);
    expect(merged.map((s) => s.id)).toEqual(["b", "a"]);
    expect(merged.find((s) => s.id === "a")?.saved_at).toBe("2026-11-14T10:00:00Z");
  });
});

describe("ownKeys", () => {
  it("finds only Samā4's keys", () => {
    const items = ["sama4_saved", "other", "sama4_theme"];
    const storage = { length: items.length, key: (i: number) => items[i] ?? null };
    expect(ownKeys(storage)).toEqual(["sama4_saved", "sama4_theme"]);
  });
});
