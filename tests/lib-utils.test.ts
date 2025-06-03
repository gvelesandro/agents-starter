import { describe, it, expect, vi } from "vitest";

vi.mock("clsx", () => ({
  clsx: (inputs: any[]) => inputs.filter(Boolean).join(" "),
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
