import { afterEach, describe, expect, it, vi } from "vitest";
import {
  displaySummary,
  possessive,
  formatFullDate,
  formatLongDate,
  formatWeekday,
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

describe("possessive", () => {
  it("adds ’s, or only ’ after a final s", () => {
    expect(possessive("BBC")).toBe("BBC’s");
    expect(possessive("Reuters")).toBe("Reuters’");
    expect(possessive("The New York Times")).toBe("The New York Times’");
  });
});

describe("displaySummary", () => {
  it("hides fragments cut at an abbreviation", () => {
    expect(displaySummary("Existing U.S.")).toBeNull();
    expect(
      displaySummary("A tanker ran aground near the coast, officials said, and Louisiana Gov."),
    ).toBeNull();
  });

  it("hides empty and very short summaries", () => {
    expect(displaySummary(null)).toBeNull();
    expect(displaySummary("  ")).toBeNull();
    expect(displaySummary("Markets fell.")).toBeNull();
  });

  it("keeps whole sentences", () => {
    const s = "The Fed held rates steady on Wednesday and signalled two cuts next year.";
    expect(displaySummary(`  ${s} `)).toBe(s);
  });

  it("hides briefs cut mid-sentence", () => {
    expect(
      displaySummary(
        "Prime Minister Burnham will tell MPs that the EU deal agreed on Friday is a…",
      ),
    ).toBeNull();
    expect(
      displaySummary("The Senate passed the bill late on Tuesday with more than..."),
    ).toBeNull();
  });
});

describe("dates follow the reader's time zone", () => {
  // 21:00 on Saturday 14 November in New York is already Sunday in UTC, where the server
  // renders. The audit caught the page saying Sunday.
  const evening = new Date("2026-11-15T02:00:00Z");

  it("names Saturday in New York and Sunday in UTC", () => {
    const ny = { locale: "en-US", timeZone: "America/New_York" };
    const utc = { locale: "en-US", timeZone: "UTC" };
    expect(formatWeekday(evening, ny)).toBe("Saturday");
    expect(formatFullDate(evening, ny)).toBe("November 14, 2026");
    expect(formatLongDate(evening, ny)).toBe("Saturday, November 14");
    expect(formatWeekday(evening, utc)).toBe("Sunday");
  });
});
