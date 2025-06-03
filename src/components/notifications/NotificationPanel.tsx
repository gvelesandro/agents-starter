import React, { useState } from "react";
import { Bell, Gear, X, Trash, ArrowLeft } from "@phosphor-icons/react";
import { useNotificationContext } from "../../providers/NotificationProvider";
import { NotificationToast } from "./NotificationToast";
import { NotificationSettings } from "./NotificationSettings";
import { Button } from "../button/Button";
import { Card } from "../card/Card";

interface NotificationPanelProps {
  onClose: () => void;
  onNavigateToChat?: (threadId: string) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  onClose,
  onNavigateToChat,
}) => {
  const {
    notifications,
    dismissNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotificationContext();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <Card
      variant="secondary"
      className="absolute top-full right-0 mt-2 w-80 max-h-96 shadow-xl z-50 overflow-hidden p-0 bg-white dark:bg-neutral-900 border border-[var(--color-ob-border)]"
    >
      <div className="p-4 border-b border-[var(--color-ob-border)] flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text-color-ob-base-200)]">
          {showSettings ? "Settings" : "Notifications"}
        </h3>
        <div className="flex items-center gap-1">
          {!showSettings && notifications.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-[var(--text-color-ob-base-300)]"
                tooltip="Mark all as read"
              >
                <Bell size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-[var(--text-color-ob-base-300)]"
                tooltip="Clear all notifications"
              >
                <Trash size={14} />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="text-[var(--text-color-ob-base-300)]"
            tooltip={showSettings ? "Back to notifications" : "Settings"}
          >
            {showSettings ? <ArrowLeft size={14} /> : <Gear size={14} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-[var(--text-color-ob-base-300)]"
            aria-label="Close notifications"
          >
            <X size={14} />
          </Button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {showSettings ? (
          <div className="p-4">
            <NotificationSettings />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell
              size={24}
              className="mx-auto mb-2 text-[var(--text-color-ob-base-300)]"
            />
            <p className="text-[var(--text-color-ob-base-300)] text-sm">
              No notifications
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {notifications.map((notification) => (
              <NotificationToast
                key={notification.id}
                notification={notification}
                onDismiss={dismissNotification}
                onMarkAsRead={markAsRead}
                onNavigateToChat={onNavigateToChat}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
