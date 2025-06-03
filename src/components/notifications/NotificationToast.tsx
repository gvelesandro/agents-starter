import React from "react";
import type { Notification } from "../../hooks/useNotifications";

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
}) => {
  const getTypeStyles = () => {
    switch (notification.type) {
      case "success":
        return "bg-green-50 border-green-200 text-green-800";
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "error":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-blue-50 border-blue-200 text-blue-800";
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case "success":
        return "✓";
      case "warning":
        return "⚠";
      case "error":
        return "✕";
      default:
        return "ℹ";
    }
  };

  return (
    <div
      className={`p-4 border rounded-lg shadow-sm mb-2 transition-all duration-300 ${getTypeStyles()}`}
      role="alert"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <span className="text-lg" aria-hidden="true">
            {getIcon()}
          </span>
          <div className="flex-1">
            <h4 className="font-medium">{notification.title}</h4>
            <p className="text-sm opacity-90 mt-1">{notification.message}</p>
            <time className="text-xs opacity-70 mt-2 block">
              {notification.timestamp.toLocaleTimeString()}
            </time>
          </div>
        </div>
        <button
          onClick={() => onDismiss(notification.id)}
          className="text-current opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};
