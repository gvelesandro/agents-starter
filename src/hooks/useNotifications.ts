import { useState, useCallback, useEffect } from "react";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: Date;
  taskId?: string;
  dismissed?: boolean;
}

interface BrowserNotificationOptions {
  enabled: boolean;
  permission: NotificationPermission;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [browserNotifications, setBrowserNotifications] =
    useState<BrowserNotificationOptions>({
      enabled: false,
      permission: "default",
    });

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

      // Don't send browser notifications if the page is visible
      if (!document.hidden) {
        return;
      }

      const iconMap = {
        success: "✅",
        warning: "⚠️",
        error: "❌",
        info: "ℹ️",
      };

      new Notification(title, {
        body: message,
        icon: `/favicon.ico`, // You can customize this
        badge: `/favicon.ico`,
        tag: `task-notification-${Date.now()}`,
        requireInteraction: type === "error",
        silent: false,
      });
    },
    [browserNotifications]
  );

  const addNotification = useCallback(
    (notification: Omit<Notification, "id" | "timestamp">) => {
      const newNotification: Notification = {
        ...notification,
        id: crypto.randomUUID(),
        timestamp: new Date(),
      };

      setNotifications((prev) => [newNotification, ...prev]);

      // Send browser notification
      sendBrowserNotification(
        notification.title,
        notification.message,
        notification.type
      );

      if (notification.type !== "error") {
        setTimeout(() => {
          dismissNotification(newNotification.id);
        }, 5000);
      }

      return newNotification.id;
    },
    [sendBrowserNotification]
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n))
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications((prev) =>
        prev.filter((n) => {
          const ageInMinutes =
            (Date.now() - n.timestamp.getTime()) / (1000 * 60);
          return ageInMinutes < 30;
        })
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return {
    notifications,
    addNotification,
    dismissNotification,
    markAsRead,
    clearAll,
    unreadCount: notifications.filter((n) => !n.dismissed).length,
    browserNotifications,
    requestNotificationPermission,
    toggleBrowserNotifications,
  };
};
