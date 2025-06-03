import { useCallback } from "react";
import { useNotificationContext } from "../providers/NotificationProvider";

export const useTaskNotifications = () => {
  const { addNotification } = useNotificationContext();

  const notifyTaskScheduled = useCallback(
    (taskType: string, scheduleInput: string, description: string) => {
      addNotification({
        title: "Task Scheduled",
        message: `Task "${description}" scheduled for ${taskType}: ${scheduleInput}`,
        type: "success",
      });
    },
    [addNotification]
  );

  const notifyTaskExecuted = useCallback(
    (description: string) => {
      addNotification({
        title: "Task Executed",
        message: `Scheduled task completed: "${description}"`,
        type: "info",
      });
    },
    [addNotification]
  );

  const notifyTaskCanceled = useCallback(
    (taskId: string) => {
      addNotification({
        title: "Task Canceled",
        message: `Task ${taskId} has been canceled`,
        type: "warning",
        taskId,
      });
    },
    [addNotification]
  );

  const notifyTaskError = useCallback(
    (description: string, error?: string) => {
      addNotification({
        title: "Task Error",
        message: `Error with task "${description}": ${error || "Unknown error"}`,
        type: "error",
      });
    },
    [addNotification]
  );

  const notifyUpcomingTask = useCallback(
    (description: string, timeUntil: string) => {
      addNotification({
        title: "Upcoming Task",
        message: `Task "${description}" will run in ${timeUntil}`,
        type: "info",
      });
    },
    [addNotification]
  );

  return {
    notifyTaskScheduled,
    notifyTaskExecuted,
    notifyTaskCanceled,
    notifyTaskError,
    notifyUpcomingTask,
  };
};
