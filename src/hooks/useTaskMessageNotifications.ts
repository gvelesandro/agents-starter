import { useEffect } from "react";
import type { Message } from "@ai-sdk/react";
import { useNotificationContext } from "../providers/NotificationProvider";

export const useTaskMessageNotifications = (messages: Message[]) => {
  const { addNotification } = useNotificationContext();

  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];

    if (latestMessage.role === "assistant") {
      const content = latestMessage.content;

      if (content.includes("Task scheduled for type")) {
        const match = content.match(/Task scheduled for type "([^"]+)" : (.+)/);
        if (match) {
          const [, scheduleType, scheduleInput] = match;
          addNotification({
            title: "Task Scheduled Successfully",
            message: `New task scheduled (${scheduleType}): ${scheduleInput}`,
            type: "success",
          });
        }
      } else if (content.includes("has been successfully canceled")) {
        const match = content.match(
          /Task ([^\s]+) has been successfully canceled/
        );
        if (match) {
          const taskId = match[1];
          addNotification({
            title: "Task Canceled",
            message: `Task ${taskId} has been canceled`,
            type: "warning",
          });
        }
      } else if (content.includes("Error scheduling task")) {
        addNotification({
          title: "Task Scheduling Failed",
          message: "Failed to schedule the task. Please try again.",
          type: "error",
        });
      } else if (content.includes("Error canceling task")) {
        addNotification({
          title: "Task Cancellation Failed",
          message: "Failed to cancel the task. Please try again.",
          type: "error",
        });
      }
    } else if (
      latestMessage.role === "user" &&
      latestMessage.content.startsWith("Running scheduled task:")
    ) {
      const taskDescription = latestMessage.content.replace(
        "Running scheduled task: ",
        ""
      );
      addNotification({
        title: "Scheduled Task Executed",
        message: `Task completed: "${taskDescription}"`,
        type: "info",
      });
    }
  }, [messages, addNotification]);
};
