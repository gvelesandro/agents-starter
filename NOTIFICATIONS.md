# Browser Notifications for Scheduled Tasks

The notification system has been extended to support browser notifications (native OS notifications) in addition to in-app notifications.

## Features

### In-App Notifications
- ✅ Toast notifications within the app interface
- ✅ Notification center with bell icon and unread count
- ✅ Auto-dismiss functionality (5 seconds for non-error notifications)
- ✅ Manual dismiss and clear all functionality
- ✅ Automatic cleanup (removes notifications older than 30 minutes)

### Browser Notifications (NEW)
- ✅ Native OS notifications for task events
- ✅ Permission management with user consent
- ✅ Only sends when page is not visible (avoids notification spam)
- ✅ Persistent settings via localStorage
- ✅ Settings interface to enable/disable browser notifications

## How It Works

### Permission Flow
1. User clicks the notification bell icon in the top-right corner
2. User clicks the settings gear icon (⚙️) in the notification panel
3. User clicks "Enable" to request browser notification permission
4. Browser shows native permission dialog
5. If granted, notifications will be sent when the page is not visible

### Notification Types
All task-related events trigger both in-app and browser notifications:
- **Task Scheduled Successfully** (success) - When a task is scheduled
- **Task Canceled** (warning) - When a task is canceled
- **Scheduled Task Executed** (info) - When a scheduled task runs
- **Task Scheduling Failed** (error) - When task scheduling fails
- **Task Cancellation Failed** (error) - When task cancellation fails

### Smart Delivery
Browser notifications are only sent when:
- User has granted permission
- Browser notifications are enabled in settings
- The page is not currently visible (`document.hidden === true`)

This prevents duplicate notifications when the user is actively using the app.

## Usage

### For Users
1. Open the notification center (🔔 icon)
2. Click the settings icon (⚙️)
3. Click "Enable" to request browser notification permission
4. Allow notifications in the browser dialog
5. Browser notifications will now be sent when the page is not visible

### For Developers

#### Basic Usage
```typescript
import { useNotificationContext } from '@/providers/NotificationProvider';

const { addNotification, browserNotifications, toggleBrowserNotifications } = useNotificationContext();

// Add a notification (automatically triggers browser notification if enabled)
addNotification({
  title: 'Task Completed',
  message: 'Your scheduled task has finished',
  type: 'success'
});

// Check browser notification status
console.log(browserNotifications.enabled); // boolean
console.log(browserNotifications.permission); // 'default' | 'granted' | 'denied'

// Toggle browser notifications
await toggleBrowserNotifications();
```

#### Advanced Usage
```typescript
import { useNotifications } from '@/hooks/useNotifications';

const {
  notifications,
  addNotification,
  browserNotifications,
  requestNotificationPermission,
  toggleBrowserNotifications
} = useNotifications();

// Request permission programmatically
const granted = await requestNotificationPermission();
if (granted) {
  console.log('Browser notifications enabled');
}
```

## Technical Details

### Components
- `NotificationCenter` - Main notification UI with settings
- `NotificationSettings` - Browser notification configuration panel
- `NotificationToast` - Individual notification display

### Hooks
- `useNotifications` - Core notification state management
- `useTaskNotifications` - Helper functions for task-specific notifications
- `useTaskMessageNotifications` - Automatic notifications from chat messages

### Storage
- Browser notification preferences are stored in `localStorage`
- Key: `browserNotifications` (value: `"true"` or `"false"`)

### Browser Compatibility
- Works in all modern browsers that support the Notifications API
- Gracefully degrades to in-app notifications only if not supported
- Requires HTTPS in production (localhost works for development)

## Testing

Tests are included for:
- ✅ Notification permission management
- ✅ Browser notification sending logic
- ✅ Settings component functionality
- ✅ Integration with existing notification system

Run tests with:
```bash
npm run test:frontend
```