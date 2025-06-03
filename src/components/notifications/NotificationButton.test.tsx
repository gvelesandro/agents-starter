import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationButton } from "./NotificationButton";

// Mock the notification context
const mockNotifications = [];
const mockDismissNotification = vi.fn();
const mockClearAll = vi.fn();

vi.mock("../../providers/NotificationProvider", () => ({
  useNotificationContext: () => ({
    notifications: mockNotifications,
    dismissNotification: mockDismissNotification,
    clearAll: mockClearAll,
    unreadCount: 0,
  }),
}));

// Mock the NotificationPanel component
vi.mock("./NotificationPanel", () => ({
  NotificationPanel: ({
    onClose,
    onNavigateToChat,
  }: {
    onClose: () => void;
    onNavigateToChat?: (threadId: string) => void;
  }) => (
    <div data-testid="notification-panel">
      <button onClick={onClose}>Close</button>
      <button onClick={() => onNavigateToChat?.("test-thread")}>
        Navigate
      </button>
    </div>
  ),
}));

describe("NotificationButton", () => {
  it("renders notification button correctly", () => {
    render(<NotificationButton />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Notifications (0 unread)");
  });

  it("shows notification panel when clicked", () => {
    render(<NotificationButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();
  });

  it("closes notification panel when backdrop is clicked", () => {
    render(<NotificationButton />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Panel should be visible
    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();

    // Click the backdrop
    const backdrop = document.querySelector('[aria-hidden="true"]');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    // Panel should be hidden
    expect(screen.queryByTestId("notification-panel")).not.toBeInTheDocument();
  });
});
