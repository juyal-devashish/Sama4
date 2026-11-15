import { describe, expect, it } from "vitest";
import { trapTarget } from "./focus";

describe("trapTarget", () => {
  it("lets the browser move focus inside the group", () => {
    expect(trapTarget(1, 4, false)).toBeNull();
    expect(trapTarget(2, 4, true)).toBeNull();
  });
  it("wraps from the last element to the first and back", () => {
    expect(trapTarget(3, 4, false)).toBe(0);
    expect(trapTarget(0, 4, true)).toBe(3);
  });
  it("pulls focus in from outside the group", () => {
    expect(trapTarget(-1, 4, false)).toBe(0);
    expect(trapTarget(-1, 4, true)).toBe(3);
  });
  it("does nothing for a group with nothing to focus", () => {
    expect(trapTarget(-1, 0, false)).toBeNull();
  });
});
