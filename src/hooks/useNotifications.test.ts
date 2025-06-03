import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotifications } from "./useNotifications";

// Mock crypto.randomUUID with incrementing IDs
let mockIdCounter = 0;
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: vi.fn(() => `test-uuid-${++mockIdCounter}`),
  },
});

// Mock browser Notification API
const mockNotification = vi.fn();
Object.defineProperty(global, "Notification", {
  value: mockNotification,
  configurable: true,
});

// Mock window properties (preserve existing window/document from jsdom)
Object.defineProperty(window, "Notification", {
  value: mockNotification,
  writable: true,
  configurable: true,
});

// Mock document.hidden property
Object.defineProperty(document, "hidden", {
  value: false,
  writable: true,
  configurable: true,
});

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};
Object.defineProperty(global, "localStorage", {
  value: mockLocalStorage,
  configurable: true,
});

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIdCounter = 0; // Reset counter for each test
    mockLocalStorage.getItem.mockReturnValue(null);
    mockNotification.permission = "default";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should add a notification", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification({
        title: "Test Notification",
        message: "This is a test",
        type: "info",
      });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]).toMatchObject({
      id: "test-uuid-1",
      title: "Test Notification",
      message: "This is a test",
      type: "info",
    });
  });

  it("should auto-dismiss non-error notifications after 5 seconds", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification({
        title: "Auto Dismiss",
        message: "This should be dismissed",
        type: "success",
      });
    });

    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("should not auto-dismiss error notifications", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification({
        title: "Error",
        message: "This should not be dismissed",
        type: "error",
      });
    });

    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.notifications).toHaveLength(1);
  });

  it("should dismiss notification by id", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification({
        title: "Test",
        message: "Test message",
        type: "info",
      });
    });

    const notificationId = result.current.notifications[0].id;

    act(() => {
      result.current.dismissNotification(notificationId);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("should mark notification as read", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification({
        title: "Test",
        message: "Test message",
        type: "info",
      });
    });

    const notificationId = result.current.notifications[0].id;

    act(() => {
      result.current.markAsRead(notificationId);
    });

    expect(result.current.notifications[0].dismissed).toBe(true);
  });

  it("should clear all notifications", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification({
        title: "Test 1",
        message: "Test message 1",
        type: "info",
      });
      result.current.addNotification({
        title: "Test 2",
        message: "Test message 2",
        type: "success",
      });
    });

    expect(result.current.notifications).toHaveLength(2);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("should calculate unread count correctly", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      // Use error type to prevent auto-dismiss
      result.current.addNotification({
        title: "Test 1",
        message: "Test message 1",
        type: "error",
      });
      result.current.addNotification({
        title: "Test 2",
        message: "Test message 2",
        type: "error",
      });
    });

    expect(result.current.unreadCount).toBe(2);

    const firstNotificationId = result.current.notifications[0].id;

    act(() => {
      result.current.markAsRead(firstNotificationId);
    });

    expect(result.current.unreadCount).toBe(1);
  });

  it("should clean up old notifications after 30 minutes", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification({
        title: "Old Notification",
        message: "This should be cleaned up",
        type: "info",
      });
    });

    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(31 * 60 * 1000); // 31 minutes
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("should initialize browser notifications state", () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.browserNotifications).toEqual({
      enabled: false,
      permission: "default",
    });
  });

  it("should request notification permission", async () => {
    mockNotification.requestPermission = vi.fn().mockResolvedValue("granted");
    const { result } = renderHook(() => useNotifications());

    let permissionGranted;
    await act(async () => {
      permissionGranted = await result.current.requestNotificationPermission();
    });

    expect(mockNotification.requestPermission).toHaveBeenCalled();
    expect(permissionGranted).toBe(true);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      "browserNotifications",
      "true"
    );
  });

  it("should toggle browser notifications", async () => {
    mockNotification.requestPermission = vi.fn().mockResolvedValue("granted");
    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.toggleBrowserNotifications();
    });

    expect(result.current.browserNotifications.enabled).toBe(true);
  });

  it("should not send browser notification when page is visible", () => {
    mockNotification.permission = "granted";
    mockLocalStorage.getItem.mockReturnValue("true");
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification({
        title: "Test",
        message: "Test message",
        type: "info",
      });
    });

    expect(mockNotification).not.toHaveBeenCalled();
  });
});
