import { describe, expect, it } from "vitest";
import { readerHref, storyPath } from "./routes";

describe("storyPath", () => {
  it("puts the id in the path, encoded", () => {
    expect(storyPath("abc-123")).toBe("/article/abc-123");
    expect(storyPath("a/b c")).toBe("/article/a%2Fb%20c");
  });
});

describe("readerHref", () => {
  it("links a story or the bare feed", () => {
    expect(readerHref("abc")).toBe("/article/abc");
    expect(readerHref(null)).toBe("/");
  });

  it("keeps other params and drops the old ?article=", () => {
    expect(readerHref("abc", "topic=tech&article=old")).toBe("/article/abc?topic=tech");
    expect(readerHref(null, "article=old")).toBe("/");
  });
});
