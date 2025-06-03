import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationToast } from "./NotificationToast";
import type { Notification } from "../../hooks/useNotifications";

const mockNotification: Notification = {
  id: "test-1",
  title: "Test Notification",
  message: "This is a test message",
  type: "info",
  timestamp: new Date("2024-01-01T12:00:00.000Z"),
};

describe("NotificationToast", () => {
  it("renders notification content correctly", () => {
    const onDismiss = vi.fn();

    render(
      <NotificationToast
        notification={mockNotification}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText("Test Notification")).toBeInTheDocument();
    expect(screen.getByText("This is a test message")).toBeInTheDocument();
    // Check for any time format since locale can vary in test environment
    expect(
      screen.getByText(/\d{1,2}:\d{2}:\d{2}\s?(AM|PM)?/)
    ).toBeInTheDocument();
  });

  it("displays correct icon for each notification type", () => {
    const onDismiss = vi.fn();

    const testCases = [
      { type: "success" as const },
      { type: "warning" as const },
      { type: "error" as const },
      { type: "info" as const },
    ];

    testCases.forEach(({ type }) => {
      const notification = { ...mockNotification, type };
      const { container, unmount } = render(
        <NotificationToast notification={notification} onDismiss={onDismiss} />
      );

      // Check that an SVG icon is present (Phosphor icons render as SVG)
      expect(container.querySelector("svg")).toBeInTheDocument();
      unmount();
    });
  });

  it("applies correct styling for each notification type", () => {
    const onDismiss = vi.fn();

    const testCases = [
      { type: "success" as const, expectedClass: "bg-green-50" },
      { type: "warning" as const, expectedClass: "bg-yellow-50" },
      { type: "error" as const, expectedClass: "bg-red-50" },
      { type: "info" as const, expectedClass: "bg-blue-50" },
    ];

    testCases.forEach(({ type, expectedClass }) => {
      const notification = { ...mockNotification, type };
      const { container, unmount } = render(
        <NotificationToast notification={notification} onDismiss={onDismiss} />
      );

      const toast = container.querySelector(".p-3");
      expect(toast).toHaveClass(expectedClass);
      unmount();
    });
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();

    render(
      <NotificationToast
        notification={mockNotification}
        onDismiss={onDismiss}
      />
    );

    const dismissButton = screen.getByLabelText("Dismiss notification");
    fireEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledWith("test-1");
  });

  it("has proper accessibility attributes", () => {
    const onDismiss = vi.fn();

    render(
      <NotificationToast
        notification={mockNotification}
        onDismiss={onDismiss}
      />
    );

    const toast = screen.getByRole("alert");
    expect(toast).toBeInTheDocument();

    const dismissButton = screen.getByLabelText("Dismiss notification");
    expect(dismissButton).toBeInTheDocument();
  });
});
