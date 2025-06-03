import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Loader } from "./Loader";

describe("Loader", () => {
  it("renders loader svg", () => {
    const { container } = render(<Loader />);
    const loader = container.querySelector("svg");
    expect(loader).toBeInTheDocument();
    expect(loader?.tagName).toBe("svg");
  });

  it("applies custom className", () => {
    const { container } = render(<Loader className="custom-loader" />);
    const loader = container.querySelector("svg");
    expect(loader).toHaveClass("custom-loader");
  });

  it("has proper accessibility title", () => {
    render(<Loader />);
    const title = screen.getByText("Loading...");
    expect(title).toBeInTheDocument();
  });
});
