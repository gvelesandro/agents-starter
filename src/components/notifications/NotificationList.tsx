// src/components/notifications/NotificationList.tsx
import React, { useEffect, useState, useCallback } from 'react';
import NotificationItem, { TaskNotification } from './NotificationItem'; // Assuming TaskNotification is exported from Item

const NotificationList: React.FC = () => {
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/notifications');
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }
      const data: TaskNotification[] = await response.json();
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setNotifications([]); // Clear notifications on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch(`/notifications/${id}/read`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to mark as read' }));
        throw new Error(errorData.message || `Failed to mark as read: ${response.statusText}`);
      }
      const updatedNotification = await response.json();
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...updatedNotification } : n)) // updatedNotification should be complete
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
      // Optionally set an error state here for this specific action for the user
      setError(err instanceof Error ? err.message : 'Could not mark notification as read');
    }
  };

  if (isLoading && notifications.length === 0) return <p>Loading notifications...</p>;
  // Show error prominently if it occurs
  if (error && notifications.length === 0) return <p>Error loading notifications: {error} <button onClick={fetchNotifications}>Retry</button></p>;


  return (
    <div className="notification-list">
      <h3>Notifications</h3>
      <button onClick={fetchNotifications} disabled={isLoading}>
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </button>
      {/* Display error related to mark as read or other non-critical errors here if needed */}
      {error && notifications.length > 0 && <p style={{ color: 'red' }}>Error: {error}</p>}

      {notifications.length === 0 && !isLoading ? (
        <p>No notifications.</p>
      ) : (
        notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={handleMarkAsRead}
          />
        ))
      )}
    </div>
  );
};

export default NotificationList;
