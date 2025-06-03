import { describe, it, expect } from "vitest";
import { APPROVAL } from "../src/shared";

describe("shared constants", () => {
  it("should have correct APPROVAL values", () => {
    expect(APPROVAL.YES).toBe("Yes, confirmed.");
    expect(APPROVAL.NO).toBe("No, denied.");
  });

  it("should export APPROVAL object", () => {
    expect(APPROVAL).toBeDefined();
    expect(typeof APPROVAL).toBe("object");
    expect(Object.keys(APPROVAL)).toEqual(["YES", "NO"]);
  });
});
