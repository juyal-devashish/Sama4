import { describe, expect, it } from "vitest";
import type { EntityInArticle } from "@/types";
import {
  cleanSpans,
  findMentions,
  paragraphRanges,
  segmentRange,
  uniqueEntities,
} from "./highlight";

const ent = (text: string, start = 0, priority = "medium", id = text): EntityInArticle => ({
  id,
  text,
  type: "PERSON",
  start,
  end: start + text.length,
  priority,
});

describe("cleanSpans", () => {
  it("drops out-of-range and empty spans", () => {
    expect(
      cleanSpans(
        [
          { start: -1, end: 2 },
          { start: 3, end: 3 },
          { start: 5, end: 20 },
          { start: 1, end: 4 },
        ],
        10,
      ),
    ).toEqual([{ start: 1, end: 4 }]);
  });

  it("keeps the earliest, then longest, of overlapping spans", () => {
    expect(
      cleanSpans(
        [
          { start: 2, end: 4 },
          { start: 0, end: 3 },
          { start: 0, end: 5 },
          { start: 5, end: 7 },
        ],
        10,
      ),
    ).toEqual([
      { start: 0, end: 5 },
      { start: 5, end: 7 },
    ]);
  });
});

describe("segmentRange", () => {
  it("splits text into plain and entity segments", () => {
    const content = "Ada met Babbage.";
    const spans = [ent("Ada", 0), ent("Babbage", 8)].map((e) => ({ ...e, entity: e }));
    const segs = segmentRange(content, 0, content.length, spans);
    expect(segs.map((s) => [s.text, s.entity?.text ?? null])).toEqual([
      ["Ada", "Ada"],
      [" met ", null],
      ["Babbage", "Babbage"],
      [".", null],
    ]);
  });

  it("skips spans that cross the range boundary", () => {
    const spans = [{ ...ent("cd", 2), entity: ent("cd", 2) }];
    expect(segmentRange("abcdef", 0, 3, spans)).toEqual([{ text: "abc", key: "t0" }]);
  });
});

describe("paragraphRanges", () => {
  it("splits on newlines and trims surrounding whitespace", () => {
    const text = "First para.\n\n  Second para.\nThird.";
    expect(paragraphRanges(text).map(([a, b]) => text.slice(a, b))).toEqual([
      "First para.",
      "Second para.",
      "Third.",
    ]);
  });

  it("returns nothing for empty text", () => {
    expect(paragraphRanges("")).toEqual([]);
  });
});

describe("uniqueEntities", () => {
  it("dedupes by lowercase name, keeping the highest priority", () => {
    const out = uniqueEntities([
      ent("Nvidia", 0, "low", "a"),
      ent("NVIDIA", 10, "high", "b"),
      ent("Huang", 20, "medium", "c"),
    ]);
    expect(out.map((e) => e.id).sort()).toEqual(["b", "c"]);
  });
});

describe("findMentions", () => {
  it("finds whole-word, case-insensitive mentions", () => {
    const spans = findMentions("nvidia rose; Nvidia's CEO spoke. Nvidiana is fake.", [
      ent("Nvidia"),
    ]);
    expect(spans.map((s) => [s.start, s.end])).toEqual([
      [0, 6],
      [13, 19],
    ]);
  });

  it("escapes regex characters in entity names", () => {
    expect(findMentions("Use C++ daily", [ent("C++")])).toHaveLength(1);
  });

  it("prefers the longer name when mentions overlap", () => {
    const spans = findMentions("Jensen Huang spoke", [ent("Huang"), ent("Jensen Huang")]);
    expect(spans.map((s) => s.entity.text)).toEqual(["Jensen Huang"]);
  });
});

describe("findMentions punctuation", () => {
  it("matches names ending in punctuation", () => {
    expect(findMentions("Ties with the U.S. grew.", [ent("U.S.")])).toHaveLength(1);
  });
});
