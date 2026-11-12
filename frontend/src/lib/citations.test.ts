import { describe, expect, it } from "vitest";
import { splitCitations } from "./citations";

describe("splitCitations", () => {
  it("separates source tags from the text they follow", () => {
    expect(splitCitations("Nvidia makes chips [explanation]. It sold out [article].")).toEqual([
      { text: "Nvidia makes chips" },
      { tag: "explanation" },
      { text: ". It sold out" },
      { tag: "article" },
      { text: "." },
    ]);
  });

  it("normalises case and keeps unknown brackets as text", () => {
    expect(splitCitations("Founded 1993 [wikipedia] [see note]")).toEqual([
      { text: "Founded 1993" },
      { tag: "Wikipedia" },
      { text: " [see note]" },
    ]);
  });

  it("returns plain text untouched", () => {
    expect(splitCitations("No sources here.")).toEqual([{ text: "No sources here." }]);
  });
});
