import { describe, it, expect } from "vitest";

vi.mock("clsx", () => ({
  default: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("tailwind-merge", () => ({
  twMerge: (...args: any[]) => args.join(" "),
}));

import { cn } from "../src/lib/utils";

describe("cn helper", () => {
  it("merges class names", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
