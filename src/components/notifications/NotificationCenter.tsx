import React, { useState } from "react";
import { useNotificationContext } from "../../providers/NotificationProvider";
import { NotificationToast } from "./NotificationToast";
import { NotificationSettings } from "./NotificationSettings";

export const NotificationCenter: React.FC = () => {
  const { notifications, dismissNotification, clearAll, unreadCount } =
    useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 bg-white border border-gray-200 rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow z-50"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed top-16 right-4 w-80 max-h-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-medium">
              {showSettings ? "Notification Settings" : "Notifications"}
            </h3>
            <div className="flex space-x-2">
              {!showSettings && notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-sm text-gray-500 hover:text-gray-700"
                title={showSettings ? "Back to notifications" : "Settings"}
              >
                {showSettings ? "←" : "⚙️"}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close notifications"
              >
                ×
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-4">
            {showSettings ? (
              <NotificationSettings />
            ) : notifications.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No notifications</p>
            ) : (
              notifications.map((notification) => (
                <NotificationToast
                  key={notification.id}
                  notification={notification}
                  onDismiss={dismissNotification}
                />
              ))
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
};
