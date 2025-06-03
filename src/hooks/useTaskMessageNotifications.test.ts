import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Message } from "@ai-sdk/react";
import { useTaskMessageNotifications } from "./useTaskMessageNotifications";

// Mock the notification context
const mockAddNotification = vi.fn();
vi.mock("../providers/NotificationProvider", () => ({
  useNotificationContext: () => ({
    addNotification: mockAddNotification,
  }),
}));

describe("useTaskMessageNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMessage = (
    role: "user" | "assistant",
    content: string
  ): Message => ({
    id: "test-id",
    role,
    content,
    createdAt: new Date(),
  });

  it("should notify when a task is scheduled successfully", () => {
    const messages = [
      createMessage("assistant", 'Task scheduled for type "delayed" : 300'),
    ];

    renderHook(() => useTaskMessageNotifications(messages));

    expect(mockAddNotification).toHaveBeenCalledWith({
      title: "Task Scheduled Successfully",
      message: "New task scheduled (delayed): 300",
      type: "success",
    });
  });

  it("should notify when a task is canceled successfully", () => {
    const messages = [
      createMessage(
        "assistant",
        "Task task-123 has been successfully canceled."
      ),
    ];

    renderHook(() => useTaskMessageNotifications(messages));

    expect(mockAddNotification).toHaveBeenCalledWith({
      title: "Task Canceled",
      message: "Task task-123 has been canceled",
      type: "warning",
    });
  });

  it("should notify when task scheduling fails", () => {
    const messages = [
      createMessage("assistant", "Error scheduling task: Invalid date format"),
    ];

    renderHook(() => useTaskMessageNotifications(messages));

    expect(mockAddNotification).toHaveBeenCalledWith({
      title: "Task Scheduling Failed",
      message: "Failed to schedule the task. Please try again.",
      type: "error",
    });
  });

  it("should notify when task cancellation fails", () => {
    const messages = [
      createMessage(
        "assistant",
        "Error canceling task task-456: Task not found"
      ),
    ];

    renderHook(() => useTaskMessageNotifications(messages));

    expect(mockAddNotification).toHaveBeenCalledWith({
      title: "Task Cancellation Failed",
      message: "Failed to cancel the task. Please try again.",
      type: "error",
    });
  });

  it("should notify when a scheduled task is executed", () => {
    const messages = [
      createMessage("user", "Running scheduled task: Send weekly report"),
    ];

    renderHook(() => useTaskMessageNotifications(messages));

    expect(mockAddNotification).toHaveBeenCalledWith({
      title: "Scheduled Task Executed",
      message: 'Task completed: "Send weekly report"',
      type: "info",
    });
  });

  it("should not notify for regular messages", () => {
    const messages = [
      createMessage("user", "Hello, how are you?"),
      createMessage("assistant", "I am doing well, thank you!"),
    ];

    renderHook(() => useTaskMessageNotifications(messages));

    expect(mockAddNotification).not.toHaveBeenCalled();
  });

  it("should only process the latest message", () => {
    const messages = [
      createMessage("assistant", 'Task scheduled for type "cron" : 0 9 * * 1'),
      createMessage("assistant", 'Task scheduled for type "delayed" : 600'),
    ];

    renderHook(() => useTaskMessageNotifications(messages));

    // Should only process the latest message
    expect(mockAddNotification).toHaveBeenCalledTimes(1);
    expect(mockAddNotification).toHaveBeenCalledWith({
      title: "Task Scheduled Successfully",
      message: "New task scheduled (delayed): 600",
      type: "success",
    });
  });

  it("should not notify for empty message array", () => {
    const messages: Message[] = [];

    renderHook(() => useTaskMessageNotifications(messages));

    expect(mockAddNotification).not.toHaveBeenCalled();
  });
});
