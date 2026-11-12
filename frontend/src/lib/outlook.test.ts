import { describe, expect, it } from "vitest";
import { basisNote, methodSummary } from "./outlook";

describe("methodSummary", () => {
  it("never claims a simulation when the fallback wrote the outlook", () => {
    const m = methodSummary("language_model", 500, 30, 5);
    expect(m).toMatchObject({ label: "Viewpoints written", value: "5" });
    expect(m.help).toMatch(/No crowd simulation ran/);
    expect(methodSummary(undefined, 500, 30, 5).value).toBe("5");
  });

  it("explains the agent count when a simulation ran", () => {
    const m = methodSummary("simulation", 500, 30, 5);
    expect(m).toMatchObject({ label: "Agents simulated", value: "500" });
    expect(m.help).toMatch(/500 AI agents .* 30 rounds\. The 5 viewpoints/);
  });
});

describe("basisNote", () => {
  it("warns when the source text is a short excerpt or missing", () => {
    expect(basisNote("Reuters", 90, false)).toMatch(
      /90-word text .* Reuters\. That's a short excerpt/,
    );
    expect(basisNote("Reuters", 900, false)).not.toMatch(/short excerpt/);
    expect(basisNote("Reuters", 0, true)).toMatch(/only on samā4's summary/);
  });
});
