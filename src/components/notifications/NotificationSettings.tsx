import React from "react";
import { Bell, BellSlash, Warning, Info } from "@phosphor-icons/react";
import { useNotificationContext } from "../../providers/NotificationProvider";
import { Button } from "../button/Button";
import { Card } from "../card/Card";

export const NotificationSettings: React.FC = () => {
  const {
    browserNotifications,
    requestNotificationPermission,
    toggleBrowserNotifications,
  } = useNotificationContext();

  const handleToggleNotifications = async () => {
    await toggleBrowserNotifications();
  };

  const getPermissionStatus = () => {
    switch (browserNotifications.permission) {
      case "granted":
        return {
          text: "Granted",
          color: "text-green-600",
          icon: Bell,
        };
      case "denied":
        return {
          text: "Denied",
          color: "text-red-600",
          icon: BellSlash,
        };
      default:
        return {
          text: "Not requested",
          color: "text-[var(--text-color-ob-base-300)]",
          icon: Bell,
        };
    }
  };

  const permissionStatus = getPermissionStatus();
  const PermissionIcon = permissionStatus.icon;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium text-[var(--text-color-ob-base-200)] mb-2 flex items-center gap-2">
          <Bell size={16} />
          Browser Notifications
        </h4>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-color-ob-base-200)]">
                Desktop notifications
              </p>
              <p className="text-xs text-[var(--text-color-ob-base-300)] mt-1">
                Get notified when tasks are scheduled or executed
              </p>
            </div>
            <Button
              variant={browserNotifications.enabled ? "primary" : "secondary"}
              size="sm"
              onClick={handleToggleNotifications}
              disabled={browserNotifications.permission === "denied"}
            >
              {browserNotifications.enabled ? "Enabled" : "Enable"}
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm py-2 border-t border-[var(--color-ob-border)]">
            <span className="text-[var(--text-color-ob-base-300)]">
              Permission status:
            </span>
            <div className="flex items-center gap-1">
              <PermissionIcon size={14} className={permissionStatus.color} />
              <span className={permissionStatus.color}>
                {permissionStatus.text}
              </span>
            </div>
          </div>

          {browserNotifications.permission === "denied" && (
            <Card className="p-3 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800 border">
              <div className="flex items-start gap-2">
                <Warning
                  size={16}
                  className="text-red-600 flex-shrink-0 mt-0.5"
                />
                <p className="text-red-800 dark:text-red-200 text-xs">
                  Browser notifications are blocked. To enable them, click the
                  notification icon in your browser's address bar and allow
                  notifications for this site.
                </p>
              </div>
            </Card>
          )}

          {browserNotifications.permission === "default" && (
            <Card className="p-3 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 border">
              <div className="flex items-start gap-2">
                <Info
                  size={16}
                  className="text-blue-600 flex-shrink-0 mt-0.5"
                />
                <p className="text-blue-800 dark:text-blue-200 text-xs">
                  Click "Enable" to request permission for browser
                  notifications. You'll only receive notifications when the page
                  is not visible.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
