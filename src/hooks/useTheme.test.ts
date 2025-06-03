import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import useTheme from "./useTheme";

describe("useTheme", () => {
  let originalHtml: HTMLElement | null;

  beforeEach(() => {
    // Save original HTML element
    originalHtml = document.querySelector("html");

    // Clean up any existing dark class
    originalHtml?.classList.remove("dark");
  });

  afterEach(() => {
    // Clean up after each test
    originalHtml?.classList.remove("dark");
  });

  it("adds dark class when theme is dark", () => {
    renderHook(() => useTheme("dark"));

    const html = document.querySelector("html");
    expect(html?.classList.contains("dark")).toBe(true);
  });

  it("removes dark class when theme is light", () => {
    // First add dark class
    const html = document.querySelector("html");
    html?.classList.add("dark");
    expect(html?.classList.contains("dark")).toBe(true);

    // Then set theme to light
    renderHook(() => useTheme("light"));

    expect(html?.classList.contains("dark")).toBe(false);
  });

  it("does not remove dark class when theme is light and dark class is not present", () => {
    const html = document.querySelector("html");
    expect(html?.classList.contains("dark")).toBe(false);

    renderHook(() => useTheme("light"));

    expect(html?.classList.contains("dark")).toBe(false);
  });

  it("does nothing when theme is undefined", () => {
    const html = document.querySelector("html");
    const initialClasses = html?.className || "";

    renderHook(() => useTheme(undefined));

    expect(html?.className).toBe(initialClasses);
  });

  it("updates theme when theme prop changes", () => {
    const { rerender } = renderHook(({ theme }) => useTheme(theme), {
      initialProps: { theme: "light" as const },
    });

    const html = document.querySelector("html");
    expect(html?.classList.contains("dark")).toBe(false);

    // Change to dark theme
    rerender({ theme: "dark" });
    expect(html?.classList.contains("dark")).toBe(true);

    // Change back to light theme
    rerender({ theme: "light" });
    expect(html?.classList.contains("dark")).toBe(false);
  });

  it("handles null html element gracefully", () => {
    // Mock querySelector to return null
    const originalQuerySelector = document.querySelector;
    document.querySelector = () => null;

    // Should not throw error
    expect(() => {
      renderHook(() => useTheme("dark"));
    }).not.toThrow();

    // Restore original querySelector
    document.querySelector = originalQuerySelector;
  });
});
