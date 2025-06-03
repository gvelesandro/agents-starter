import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("renders input element", () => {
    const handleValueChange = vi.fn();
    render(
      <Input onValueChange={handleValueChange} placeholder="Enter text" />
    );
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("handles value changes", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(<Input onValueChange={handleValueChange} placeholder="Type here" />);

    const input = screen.getByPlaceholderText("Type here");
    await user.type(input, "Hello");

    expect(handleValueChange).toHaveBeenCalled();
  });

  it("can be disabled", () => {
    const handleValueChange = vi.fn();
    render(
      <Input
        onValueChange={handleValueChange}
        disabled
        placeholder="Disabled input"
      />
    );
    expect(screen.getByPlaceholderText("Disabled input")).toBeDisabled();
  });

  it("applies custom className", () => {
    const handleValueChange = vi.fn();
    render(
      <Input
        onValueChange={handleValueChange}
        className="custom-input"
        placeholder="Custom input"
      />
    );
    const input = screen.getByPlaceholderText("Custom input");
    expect(input).toHaveClass("custom-input");
  });

  it("shows initial value", () => {
    const handleValueChange = vi.fn();
    render(
      <Input
        onValueChange={handleValueChange}
        initialValue="initial text"
        placeholder="Input"
      />
    );
    expect(screen.getByDisplayValue("initial text")).toBeInTheDocument();
  });

  it("shows validation state", () => {
    const handleValueChange = vi.fn();
    render(
      <Input
        onValueChange={handleValueChange}
        isValid={false}
        placeholder="Invalid input"
      />
    );
    const input = screen.getByPlaceholderText("Invalid input");
    expect(input).toHaveClass("text-ob-destructive");
  });
});
