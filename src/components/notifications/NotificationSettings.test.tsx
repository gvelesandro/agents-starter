import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationSettings } from "./NotificationSettings";

// Mock the notification context
const mockRequestNotificationPermission = vi.fn();
const mockToggleBrowserNotifications = vi.fn();

vi.mock("../../providers/NotificationProvider", () => ({
  useNotificationContext: () => ({
    browserNotifications: {
      enabled: false,
      permission: "default" as NotificationPermission,
    },
    requestNotificationPermission: mockRequestNotificationPermission,
    toggleBrowserNotifications: mockToggleBrowserNotifications,
  }),
}));

describe("NotificationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders notification settings correctly", () => {
    render(<NotificationSettings />);

    expect(screen.getByText("Browser Notifications")).toBeInTheDocument();
    expect(screen.getByText("Desktop notifications")).toBeInTheDocument();
    expect(
      screen.getByText("Get notified when tasks are scheduled or executed")
    ).toBeInTheDocument();
  });

  it("shows correct permission status", () => {
    render(<NotificationSettings />);

    expect(screen.getByText("Permission status:")).toBeInTheDocument();
    expect(screen.getByText("Not requested")).toBeInTheDocument();
  });

  it("calls toggle function when enable button is clicked", async () => {
    render(<NotificationSettings />);

    const enableButton = screen.getByRole("button", { name: /enable/i });
    fireEvent.click(enableButton);

    expect(mockToggleBrowserNotifications).toHaveBeenCalledTimes(1);
  });

  it("shows help text for default permission", () => {
    render(<NotificationSettings />);

    expect(
      screen.getByText(/Click "Enable" to request permission/)
    ).toBeInTheDocument();
  });
});
