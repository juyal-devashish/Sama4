import { describe, expect, it } from "vitest";
import type { EntityInArticle } from "@/types";
import {
  bodySpans,
  cleanSpans,
  findMentions,
  limitPerParagraph,
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

describe("bodySpans", () => {
  it("keeps mentions whose text sits at their offsets (case-insensitive)", () => {
    const content = "Ada met Babbage.";
    const spans = bodySpans(content, [ent("ada", 0), ent("Babbage", 8)]);
    expect(spans.map((s) => s.entity.text)).toEqual(["ada", "Babbage"]);
  });

  it("drops misaligned mentions, e.g. a headline term stored at offset 0", () => {
    const content = "A short teaser about chemistry.";
    const spans = bodySpans(content, [ent("Hideki Shirakawa", 0), ent("chemistry", 21)]);
    expect(spans.map((s) => s.entity.text)).toEqual(["chemistry"]);
  });
});

describe("limitPerParagraph", () => {
  const content = "Ada met Babbage and Byron in London.\n\nAda wrote to Ada about Ada.";
  const spans = (es: EntityInArticle[]) => bodySpans(content, es);

  it("keeps the most important terms in a paragraph, in reading order", () => {
    const es = [
      ent("Ada", 0, "low", "ada"),
      ent("Babbage", 8, "high", "babbage"),
      ent("Byron", 20, "medium", "byron"),
      ent("London", 29, "high", "london"),
    ];
    const kept = limitPerParagraph(content, spans(es), 3).map((s) => s.entity.text);
    // Low-priority Ada is the one dropped; the rest stay in the order they appear.
    expect(kept).toEqual(["Babbage", "Byron", "London"]);
  });

  it("highlights a term once per paragraph", () => {
    const second = content.indexOf("Ada wrote");
    const es = [
      ent("Ada", second, "high", "ada"),
      ent("Ada", second + 13, "high", "ada"),
      ent("Ada", second + 23, "high", "ada"),
    ];
    expect(limitPerParagraph(content, spans(es), 3).map((s) => s.start)).toEqual([second]);
  });

  it("counts each paragraph separately", () => {
    const second = content.indexOf("Ada wrote");
    const es = [ent("Babbage", 8, "high", "babbage"), ent("Ada", second, "high", "ada")];
    expect(limitPerParagraph(content, spans(es), 1)).toHaveLength(2);
  });

  it("defaults to a small number per paragraph", () => {
    const text = "One Two Three Four Five";
    const es = ["One", "Two", "Three", "Four", "Five"].map((w) =>
      ent(w, text.indexOf(w), "medium", w),
    );
    expect(limitPerParagraph(text, bodySpans(text, es)).map((s) => s.entity.text)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });
});
