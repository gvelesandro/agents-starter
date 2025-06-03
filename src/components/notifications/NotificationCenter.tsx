import React, { useState } from "react";
import { Bell, Gear, X, Trash, ArrowLeft } from "@phosphor-icons/react";
import { useNotificationContext } from "../../providers/NotificationProvider";
import { NotificationToast } from "./NotificationToast";
import { NotificationSettings } from "./NotificationSettings";
import { Button } from "../button/Button";
import { Card } from "../card/Card";

export const NotificationCenter: React.FC = () => {
  const { notifications, dismissNotification, clearAll, unreadCount } =
    useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="ghost"
          shape="circular"
          size="md"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={`Notifications (${unreadCount} unread)`}
          className="relative shadow-lg hover:shadow-xl transition-shadow bg-[var(--color-ob-base-100)] border border-[var(--color-ob-border)]"
        >
          <Bell size={20} weight="bold" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </div>

      {isOpen && (
        <Card className="fixed top-16 right-4 w-80 max-h-96 shadow-xl z-40 overflow-hidden p-0">
          <div className="p-4 border-b border-[var(--color-ob-border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-color-ob-base-200)]">
              {showSettings ? "Settings" : "Notifications"}
            </h3>
            <div className="flex items-center gap-1">
              {!showSettings && notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="text-[var(--text-color-ob-base-300)]"
                  tooltip="Clear all notifications"
                >
                  <Trash size={14} />
                </Button>
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
                onClick={() => setIsOpen(false)}
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
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
};
