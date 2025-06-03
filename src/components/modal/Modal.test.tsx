import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Modal } from "./Modal";

// Mock the hooks
vi.mock("@/hooks/useClickOutside", () => ({
  default: vi.fn(() => ({ current: null })),
}));

// Mock Phosphor Icons
vi.mock("@phosphor-icons/react", () => ({
  X: ({ size }: { size?: number }) => (
    <span data-testid="x-icon" data-size={size}>
      ×
    </span>
  ),
}));

describe("Modal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body overflow style
    document.body.style.overflow = "";
  });

  afterEach(() => {
    // Clean up body overflow style
    document.body.style.overflow = "";
  });

  it("does not render when isOpen is false", () => {
    render(
      <Modal isOpen={false} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.queryByText("Modal Content")).not.toBeInTheDocument();
  });

  it("renders modal content when isOpen is true", () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.getByText("Modal Content")).toBeInTheDocument();
  });

  it("renders close button", () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const closeButton = screen.getByRole("button", { name: /close modal/i });
    expect(closeButton).toBeInTheDocument();
    expect(screen.getByTestId("x-icon")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const closeButton = screen.getByRole("button", { name: /close modal/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("applies custom className to modal card", () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} className="custom-modal">
        <div>Modal Content</div>
      </Modal>
    );

    // The modal content should have the custom class
    const modal = document.querySelector(".custom-modal");
    expect(modal).toBeInTheDocument();
  });

  it("sets body overflow to hidden when modal is open", () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("resets body overflow when modal is closed", () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal isOpen={false} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("");
  });

  it("has proper modal structure and styling", () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    // Check backdrop
    const backdrop = document.querySelector(".fade");
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveClass(
      "fixed",
      "top-0",
      "left-0",
      "h-full",
      "w-full",
      "bg-black/5",
      "backdrop-blur-[2px]"
    );

    // Check modal card
    const modalCard = document.querySelector(".reveal");
    expect(modalCard).toBeInTheDocument();
    expect(modalCard).toHaveClass("reveal-sm", "relative", "z-50", "max-w-md");
  });

  it("close button has correct styling and position", () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const closeButton = screen.getByRole("button", { name: /close modal/i });
    expect(closeButton).toHaveClass("absolute", "top-2", "right-2");
    expect(closeButton).toHaveAttribute("aria-label", "Close Modal");
  });

  it("renders x icon with correct size", () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const xIcon = screen.getByTestId("x-icon");
    expect(xIcon).toHaveAttribute("data-size", "16");
  });

  it("modal has correct z-index and positioning", () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const modalContainer = document.querySelector(".fixed.top-0.left-0");
    expect(modalContainer).toBeInTheDocument();
    expect(modalContainer).toHaveClass(
      "z-50",
      "flex",
      "h-screen",
      "w-full",
      "items-center",
      "justify-center"
    );
  });

  it("modal card has tabIndex -1", () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const modalCard = document.querySelector('[tabindex="-1"]');
    expect(modalCard).toBeInTheDocument();
  });

  it("handles clickOutsideToClose prop", () => {
    // Test with clickOutsideToClose true
    render(
      <Modal isOpen={true} onClose={mockOnClose} clickOutsideToClose={true}>
        <div>Modal Content True</div>
      </Modal>
    );

    expect(screen.getByText("Modal Content True")).toBeInTheDocument();
  });

  it("handles clickOutsideToClose false", () => {
    // Test with clickOutsideToClose false - separate test to avoid hook order issues
    render(
      <Modal isOpen={true} onClose={mockOnClose} clickOutsideToClose={false}>
        <div>Modal Content False</div>
      </Modal>
    );

    expect(screen.getByText("Modal Content False")).toBeInTheDocument();
  });

  it("renders modal content correctly", () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <h1>Modal Title</h1>
        <p>Modal description text</p>
        <button>Action Button</button>
      </Modal>
    );

    expect(screen.getByText("Modal Title")).toBeInTheDocument();
    expect(screen.getByText("Modal description text")).toBeInTheDocument();
    expect(screen.getByText("Action Button")).toBeInTheDocument();
  });

  it("cleanup resets body overflow on unmount", () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={mockOnClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("");
  });
});
