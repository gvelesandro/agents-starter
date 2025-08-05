import { useState, useCallback, useEffect } from "react";
import type { MCPNotificationExtension } from "../types/mcp";

export interface Notification extends MCPNotificationExtension {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: Date;
  taskId?: string;
  threadId?: string;
  read?: boolean;
}

interface BrowserNotificationOptions {
  enabled: boolean;
  permission: NotificationPermission;
}

const STORAGE_KEY = "app_notifications";

const loadNotificationsFromStorage = (): Notification[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
      }
    }
  } catch (error) {
    console.error("Failed to load notifications from storage:", error);
  }
  return [];
};

const saveNotificationsToStorage = (notifications: Notification[]) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error("Failed to save notifications to storage:", error);
  }
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    loadNotificationsFromStorage()
  );
  const [browserNotifications, setBrowserNotifications] =
    useState<BrowserNotificationOptions>({
      enabled: false,
      permission: "default",
    });

  // Save to localStorage whenever notifications change
  useEffect(() => {
    saveNotificationsToStorage(notifications);
  }, [notifications]);

  // Initialize browser notification state
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserNotifications({
        enabled: localStorage.getItem("browserNotifications") === "true",
        permission: Notification.permission,
      });
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    setBrowserNotifications((prev) => ({ ...prev, permission }));

    if (permission === "granted") {
      setBrowserNotifications((prev) => ({ ...prev, enabled: true }));
      localStorage.setItem("browserNotifications", "true");
      return true;
    }

    return false;
  }, []);

  const toggleBrowserNotifications = useCallback(async () => {
    if (browserNotifications.permission !== "granted") {
      const granted = await requestNotificationPermission();
      return granted;
    }

    const newEnabled = !browserNotifications.enabled;
    setBrowserNotifications((prev) => ({ ...prev, enabled: newEnabled }));
    localStorage.setItem("browserNotifications", newEnabled.toString());
    return newEnabled;
  }, [browserNotifications, requestNotificationPermission]);

  const sendBrowserNotification = useCallback(
    (title: string, message: string, type: Notification["type"]) => {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        !browserNotifications.enabled ||
        browserNotifications.permission !== "granted"
      ) {
        return;
      }

      // Only send browser notifications when page is hidden
      if (!document.hidden) {
        return;
      }

      try {
        const notification = new window.Notification(title, {
          body: message,
          icon: `/favicon.ico`,
          badge: `/favicon.ico`,
          tag: `task-notification-${Date.now()}`,
          requireInteraction: type === "error",
          silent: false,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error("Failed to create browser notification:", error);
      }
    },
    [browserNotifications]
  );

  const addNotification = useCallback(
    (notification: Omit<Notification, "id" | "timestamp">) => {
      const newNotification: Notification = {
        ...notification,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        read: false,
      };

      setNotifications((prev) => [newNotification, ...prev]);

      // Send browser notification
      sendBrowserNotification(
        notification.title,
        notification.message,
        notification.type
      );

      return newNotification.id;
    },
    [sendBrowserNotification]
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markThreadAsRead = useCallback((threadId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.threadId === threadId ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    // Also clear the persisted notified task completions and thread message counts when clearing all notifications
    try {
      localStorage.removeItem("notifiedTaskCompletions");
      localStorage.removeItem("threadMessageCounts");
    } catch (error) {
      console.error(
        "Failed to clear notified task completions and thread counts:",
        error
      );
    }
  }, []);

  const getThreadsWithNotifications = useCallback(() => {
    const threadsWithNotifications = new Set<string>();
    notifications.forEach((notification) => {
      if (notification.threadId && !notification.read) {
        threadsWithNotifications.add(notification.threadId);
      }
    });
    return threadsWithNotifications;
  }, [notifications]);

  // Agent-specific notification methods
  const addAgentToThread = useCallback(
    (
      threadId: string,
      agentName: string,
      reason?: string,
      toolsAdded?: string[]
    ) => {
      return addNotification({
        title: "Specialist Added",
        message: `${agentName} joined the conversation${reason ? `: ${reason}` : ""}`,
        type: "info",
        threadId,
        mcpEventType: "agent_added",
        specialistChange: {
          action: "added",
          agentName,
          reason,
          toolsAdded,
        },
      });
    },
    [addNotification]
  );

  const removeAgentFromThread = useCallback(
    (
      threadId: string,
      agentName: string,
      reason?: string,
      toolsRemoved?: string[]
    ) => {
      return addNotification({
        title: "Specialist Removed",
        message: `${agentName} left the conversation${reason ? `: ${reason}` : ""}`,
        type: "info",
        threadId,
        mcpEventType: "agent_removed",
        specialistChange: {
          action: "removed",
          agentName,
          reason,
          toolsRemoved,
        },
      });
    },
    [addNotification]
  );

  const addMCPAuthRequired = useCallback(
    (serverName: string, serverId: string, groupId?: string) => {
      return addNotification({
        title: "Authentication Required",
        message: `Please authenticate with ${serverName} to access its tools`,
        type: "warning",
        mcpEventType: "mcp_auth_required",
        mcpServerId: serverId,
        mcpGroupId: groupId,
        mcpActionRequired: true,
      });
    },
    [addNotification]
  );

  const addMCPConnectionFailed = useCallback(
    (serverName: string, serverId: string, error: string) => {
      return addNotification({
        title: "Server Connection Failed",
        message: `Could not connect to ${serverName}: ${error}`,
        type: "error",
        mcpEventType: "mcp_connection_failed",
        mcpServerId: serverId,
      });
    },
    [addNotification]
  );

  const addToolsUpdated = useCallback(
    (
      agentName: string,
      toolsAdded: string[],
      toolsRemoved: string[],
      threadId?: string
    ) => {
      const changes = [];
      if (toolsAdded.length > 0)
        changes.push(`Added: ${toolsAdded.join(", ")}`);
      if (toolsRemoved.length > 0)
        changes.push(`Removed: ${toolsRemoved.join(", ")}`);

      return addNotification({
        title: "Tools Updated",
        message: `${agentName} tools changed. ${changes.join("; ")}`,
        type: "info",
        threadId,
        mcpEventType: "tools_updated",
        specialistChange: {
          action: "added", // This represents a change, not specifically add/remove
          agentName,
          toolsAdded,
          toolsRemoved,
        },
      });
    },
    [addNotification]
  );

  // Clean up old notifications (older than 7 days) periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications((prev) =>
        prev.filter((n) => {
          const ageInDays =
            (Date.now() - n.timestamp.getTime()) / (1000 * 60 * 60 * 24);
          return ageInDays < 7;
        })
      );
    }, 60000 * 60); // Check every hour

    return () => clearInterval(interval);
  }, []);

  return {
    notifications,
    addNotification,
    dismissNotification,
    markAsRead,
    markThreadAsRead,
    markAllAsRead,
    clearAll,
    unreadCount: notifications.filter((n) => !n.read).length,
    getThreadsWithNotifications,
    browserNotifications,
    requestNotificationPermission,
    toggleBrowserNotifications,
    // Agent and MCP specific methods
    addAgentToThread,
    removeAgentFromThread,
    addMCPAuthRequired,
    addMCPConnectionFailed,
    addToolsUpdated,
  };
};
