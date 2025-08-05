import React, { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useNotifications } from "../hooks/useNotifications";
import type { Notification } from "../hooks/useNotifications";

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp">
  ) => string;
  dismissNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markThreadAsRead: (threadId: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  unreadCount: number;
  getThreadsWithNotifications: () => Set<string>;
  browserNotifications: {
    enabled: boolean;
    permission: NotificationPermission;
  };
  requestNotificationPermission: () => Promise<boolean>;
  toggleBrowserNotifications: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within a NotificationProvider"
    );
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const notificationState = useNotifications();

  return (
    <NotificationContext.Provider value={notificationState}>
      {children}
    </NotificationContext.Provider>
  );
};
