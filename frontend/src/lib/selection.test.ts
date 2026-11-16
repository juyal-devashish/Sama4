import { describe, expect, it } from "vitest";
import { normalizeSelection } from "./selection";

describe("normalizeSelection", () => {
  it("returns the text as one tidy line", () => {
    expect(normalizeSelection("  quantitative\n  easing ")).toBe("quantitative easing");
  });
  it("rejects selections that are too short, too long or not words", () => {
    expect(normalizeSelection("a")).toBeNull();
    expect(normalizeSelection("   ")).toBeNull();
    expect(normalizeSelection("x".repeat(121))).toBeNull();
    expect(normalizeSelection("12.5% 2026")).toBeNull();
  });
  it("rejects whole passages", () => {
    const sentence = "the central bank said on Tuesday that it would keep buying bonds for now";
    expect(normalizeSelection(sentence)).toBeNull();
    expect(normalizeSelection("central bank")).toBe("central bank");
  });
  it("accepts names in any script", () => {
    expect(normalizeSelection("Ñandú")).toBe("Ñandú");
    expect(normalizeSelection("東京")).toBe("東京");
  });
});
