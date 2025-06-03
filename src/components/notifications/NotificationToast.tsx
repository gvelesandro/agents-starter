import React from "react";
import { CheckCircle, Warning, XCircle, Info, X } from "@phosphor-icons/react";
import type { Notification } from "../../hooks/useNotifications";
import { Button } from "../button/Button";

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onNavigateToChat?: (threadId: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onMarkAsRead,
  onNavigateToChat,
}) => {
  const getTypeConfig = () => {
    switch (notification.type) {
      case "success":
        return {
          icon: CheckCircle,
          colorClass: "text-green-600",
          bgClass:
            "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
        };
      case "warning":
        return {
          icon: Warning,
          colorClass: "text-yellow-600",
          bgClass:
            "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800",
        };
      case "error":
        return {
          icon: XCircle,
          colorClass: "text-red-600",
          bgClass:
            "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800",
        };
      default:
        return {
          icon: Info,
          colorClass: "text-blue-600",
          bgClass:
            "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800",
        };
    }
  };

  const { icon: IconComponent, colorClass, bgClass } = getTypeConfig();

  const handleClick = () => {
    // Mark as read when clicked
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }

    // Navigate to chat if threadId exists
    if (notification.threadId && onNavigateToChat) {
      onNavigateToChat(notification.threadId);
    }
  };

  const isClickable = notification.threadId && onNavigateToChat;

  return (
    <div
      className={`w-full rounded-lg p-3 transition-all duration-300 ${bgClass} border btn-secondary ${
        isClickable ? "cursor-pointer hover:bg-opacity-80" : ""
      } ${!notification.read ? "ring-2 ring-blue-500/20" : ""}`}
      role="alert"
      onClick={isClickable ? handleClick : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <IconComponent
            size={18}
            weight="fill"
            className={`${colorClass} flex-shrink-0 mt-0.5`}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-[var(--text-color-ob-base-200)] text-sm">
                {notification.title}
              </h4>
              {!notification.read && (
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
              )}
            </div>
            <p className="text-[var(--text-color-ob-base-300)] text-xs mt-1 leading-relaxed">
              {notification.message}
            </p>
            <div className="flex items-center justify-between mt-2">
              <time className="text-[var(--text-color-ob-base-300)] text-xs opacity-70">
                {notification.timestamp.toLocaleTimeString()}
              </time>
              {isClickable && (
                <span className="text-[var(--text-color-ob-base-300)] text-xs opacity-70">
                  Click to open chat
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(notification.id);
          }}
          className="text-[var(--text-color-ob-base-300)] hover:text-[var(--text-color-ob-base-200)] flex-shrink-0"
          aria-label="Dismiss notification"
        >
          <X size={12} />
        </Button>
      </div>
    </div>
  );
};
