// src/components/notifications/NotificationItem.tsx
import React from 'react';

// Assuming TaskNotification is defined here or imported
export interface TaskNotification {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: 'task_completion' | 'task_failure';
  taskDescription: string;
  threadId?: string;
  // userId is not needed for frontend display if API is user-specific
}

interface NotificationItemProps {
  notification: TaskNotification;
  onMarkAsRead: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkAsRead }) => {
  const handleMarkAsRead = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div className={`notification-item ${notification.read ? 'read' : 'unread'}`}>
      <p>{notification.message}</p>
      <small>{new Date(notification.createdAt).toLocaleString()}</small>
      {!notification.read && (
        <button onClick={handleMarkAsRead}>Mark as read</button>
      )}
    </div>
  );
};

export default NotificationItem;
