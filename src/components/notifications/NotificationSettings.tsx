import React from "react";
import { useNotificationContext } from "../../providers/NotificationProvider";
import { Button } from "../button/Button";

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
        };
      case "denied":
        return {
          text: "Denied",
          color: "text-red-600",
        };
      default:
        return {
          text: "Not requested",
          color: "text-gray-600",
        };
    }
  };

  const permissionStatus = getPermissionStatus();

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="font-medium mb-3">Browser Notifications</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Desktop notifications</p>
            <p className="text-xs text-gray-500">
              Get notified when tasks are scheduled or executed
            </p>
          </div>
          <Button
            variant={browserNotifications.enabled ? "default" : "outline"}
            size="sm"
            onClick={handleToggleNotifications}
            disabled={browserNotifications.permission === "denied"}
          >
            {browserNotifications.enabled ? "Enabled" : "Enable"}
          </Button>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Permission status:</span>
          <span className={permissionStatus.color}>
            {permissionStatus.text}
          </span>
        </div>

        {browserNotifications.permission === "denied" && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <p className="text-yellow-800">
              Browser notifications are blocked. To enable them, click the
              notification icon in your browser's address bar and allow
              notifications for this site.
            </p>
          </div>
        )}

        {browserNotifications.permission === "default" && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <p className="text-blue-800">
              Click "Enable" to request permission for browser notifications.
              You'll only receive notifications when the page is not visible.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
