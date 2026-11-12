import { afterEach, describe, expect, it, vi } from "vitest";
import { entityColor, entityKind, formatTimeAgo } from "./utils";

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
