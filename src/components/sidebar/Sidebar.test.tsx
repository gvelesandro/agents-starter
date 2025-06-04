import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "./Sidebar";

// Mock the Button component
vi.mock("@/components/button/Button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

// Mock phosphor-icons
vi.mock("@phosphor-icons/react", () => ({
  Plus: () => <div data-testid="plus-icon" />,
  Chat: () => <div data-testid="chat-icon" />,
  Trash: () => <div data-testid="trash-icon" />,
  X: () => <div data-testid="x-icon" />,
}));

// Mock fetch for threads API
global.fetch = vi.fn();

const mockProps = {
  isOpen: true,
  onClose: vi.fn(),
  currentThreadId: "thread-1",
  onThreadSelect: vi.fn(),
  onNewThread: vi.fn(),
  currentUser: { userId: "user-1", username: "testuser" },
  onThreadsChange: vi.fn(),
};

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  it("renders sidebar with proper flex layout for scrolling", () => {
    const { container } = render(<Sidebar {...mockProps} />);
    
    // Find the main sidebar container
    const sidebarContainer = container.querySelector('[class*="fixed top-0 left-0"]');
    expect(sidebarContainer).toBeInTheDocument();
    
    // Verify it has flex and flex-col classes for proper layout
    expect(sidebarContainer).toHaveClass("flex");
    expect(sidebarContainer).toHaveClass("flex-col");
  });

  it("has a thread list container with overflow-y-auto for scrolling", () => {
    const { container } = render(<Sidebar {...mockProps} />);
    
    // Find the thread list container
    const threadListContainer = container.querySelector('[class*="flex-1 overflow-y-auto"]');
    expect(threadListContainer).toBeInTheDocument();
    expect(threadListContainer).toHaveClass("flex-1");
    expect(threadListContainer).toHaveClass("overflow-y-auto");
  });

  it("displays header with conversations title", () => {
    render(<Sidebar {...mockProps} />);
    expect(screen.getByText("Conversations")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<Sidebar {...mockProps} />);
    expect(screen.getByText("Loading conversations...")).toBeInTheDocument();
  });
});