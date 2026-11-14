import { afterEach, describe, expect, it, vi } from "vitest";
import {
  entityColor,
  entityKind,
  formatExactTime,
  formatShortDate,
  formatTimeAgo,
  metaDescription,
} from "./utils";

describe("entityKind", () => {
  it.each([
    ["PERSON", "person"],
    ["ORG", "organization"],
    ["GPE", "location"],
    ["NORP", "organization"],
    ["EVENT", "event"],
    ["something-new", "concept"],
    [undefined, "concept"],
  ])("maps %s -> %s", (input, expected) => {
    expect(entityKind(input)).toBe(expected);
  });

  it("entityColor uses the CSS variable for the kind", () => {
    expect(entityColor("LOC")).toBe("var(--entity-location)");
  });
});

describe("formatTimeAgo", () => {
  afterEach(() => vi.useRealTimers());

  it("formats relative times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
    expect(formatTimeAgo(undefined)).toBe("");
    expect(formatTimeAgo("2026-11-11T11:59:45Z")).toBe("Just now");
    expect(formatTimeAgo("2026-11-11T11:15:00Z")).toBe("45m ago");
    expect(formatTimeAgo("2026-11-11T07:00:00Z")).toBe("5h ago");
    expect(formatTimeAgo("2026-11-08T12:00:00Z")).toBe("3d ago");
  });
});

describe("formatExactTime", () => {
  it("is empty without a valid date", () => {
    expect(formatExactTime(undefined)).toBe("");
    expect(formatExactTime("not a date")).toBe("");
  });

  it("includes the year and the time of day", () => {
    const out = formatExactTime("2026-11-11T07:00:00Z");
    expect(out).toContain("2026");
    expect(out).toMatch(/\d:\d\d/);
  });
});

describe("formatShortDate", () => {
  it("gives the date with the year, or nothing", () => {
    expect(formatShortDate("2026-11-11T12:00:00Z")).toContain("2026");
    expect(formatShortDate(undefined)).toBe("");
    expect(formatShortDate("nope")).toBe("");
  });
});

describe("metaDescription", () => {
  it("keeps short text, collapsing whitespace", () => {
    expect(metaDescription("  A short\n summary. ")).toBe("A short summary.");
  });

  it("cuts long text at a word boundary with an ellipsis", () => {
    const out = metaDescription("one two three four five six", 16);
    expect(out).toBe("one two three…");
    expect(out.length).toBeLessThanOrEqual(16);
  });

  it("drops trailing punctuation before the ellipsis", () => {
    expect(metaDescription("alpha beta, gamma delta", 13)).toBe("alpha beta…");
  });
});
