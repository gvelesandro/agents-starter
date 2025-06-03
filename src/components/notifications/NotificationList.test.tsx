import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationList from './NotificationList';
import { TaskNotification } from './NotificationItem'; // Assuming type export from NotificationItem
import { vi } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock NotificationItem to simplify testing NotificationList behavior
// We already tested NotificationItem separately.
vi.mock('./NotificationItem', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual, // Export TaskNotification type if it's there
    default: vi.fn(({ notification, onMarkAsRead }) => (
      <div data-testid={`notification-item-${notification.id}`} className={notification.read ? 'read' : 'unread'}>
        <p>{notification.message}</p>
        {!notification.read && (
          <button onClick={() => onMarkAsRead(notification.id)}>Mark as read</button>
        )}
      </div>
    )),
  };
});


const mockNotifications: TaskNotification[] = [
  { id: '1', message: 'First mock unread', createdAt: new Date().toISOString(), read: false, type: 'task_completion', taskDescription: 'd1' },
  { id: '2', message: 'Second mock read', createdAt: new Date().toISOString(), read: true, type: 'task_completion', taskDescription: 'd2' },
  { id: '3', message: 'Third mock unread', createdAt: new Date().toISOString(), read: false, type: 'task_completion', taskDescription: 'd3' },
];

describe('NotificationList', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Clear mock calls for the NotificationItem mock if needed, though not strictly necessary here
    // (NotificationItem as vi.Mock).mockClear();
  });

  it('shows loading state initially then displays "No notifications" if fetch returns empty', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    render(<NotificationList />);
    expect(screen.getByText(/loading notifications.../i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/loading notifications.../i)).not.toBeInTheDocument());
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
  });

  it('fetches and displays notifications', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockNotifications });
    render(<NotificationList />);
    await waitFor(() => {
      expect(screen.getByText('First mock unread')).toBeInTheDocument();
      expect(screen.getByText('Second mock read')).toBeInTheDocument();
      expect(screen.getByText('Third mock unread')).toBeInTheDocument();
    });
  });

  it('displays error message if fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    render(<NotificationList />);
    await waitFor(() => {
      expect(screen.getByText(/error loading notifications: Network error/i)).toBeInTheDocument();
    });
  });

  it('displays error message if response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Server Error' });
    render(<NotificationList />);
    await waitFor(() => {
      expect(screen.getByText(/error loading notifications: Failed to fetch notifications: Server Error/i)).toBeInTheDocument();
    });
  });

  it('allows refreshing notifications', async () => {
    // First fetch (initial)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [mockNotifications[0]] });
    render(<NotificationList />);
    await waitFor(() => expect(screen.getByText('First mock unread')).toBeInTheDocument());

    // Second fetch (after refresh click)
    const refreshedNotifications = [mockNotifications[1], mockNotifications[2]];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => refreshedNotifications });

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(screen.queryByText('First mock unread')).not.toBeInTheDocument();
      expect(screen.getByText('Second mock read')).toBeInTheDocument();
      expect(screen.getByText('Third mock unread')).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + Refresh
  });

  it('marks notification as read and updates UI', async () => {
    const initialNotification = { id: 'test1', message: 'Mark me as read', createdAt: new Date().toISOString(), read: false, type: 'task_completion', taskDescription: 'd-mr' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [initialNotification] });
    render(<NotificationList />);

    await waitFor(() => expect(screen.getByText('Mark me as read')).toBeInTheDocument());

    // Check that the item is initially unread (button exists)
    let markAsReadButton = screen.getByRole('button', { name: /mark as read/i });
    expect(markAsReadButton).toBeInTheDocument();
    expect(screen.getByTestId('notification-item-test1')).toHaveClass('unread');


    const updatedNotificationFromServer = { ...initialNotification, read: true };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => updatedNotificationFromServer });

    fireEvent.click(markAsReadButton);

    await waitFor(() => {
      // The mock NotificationItem should re-render without the button if 'read' is true
      expect(screen.queryByRole('button', { name: /mark as read/i })).not.toBeInTheDocument();
    });

    // Verify the item now has the 'read' class (or visual equivalent from the mock)
    // Our mock NotificationItem applies 'read'/'unread' class based on the prop
    expect(screen.getByTestId('notification-item-test1')).toHaveClass('read');

    expect(mockFetch).toHaveBeenCalledWith('/notifications/test1/read', { method: 'POST' });
  });

  it('handles error when marking notification as read', async () => {
    const initialNotification = { id: 'errNotif', message: 'Error on read', createdAt: new Date().toISOString(), read: false, type: 'task_completion', taskDescription: 'd-err' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [initialNotification] });
    render(<NotificationList />);

    await waitFor(() => expect(screen.getByText('Error on read')).toBeInTheDocument());

    // Mock for POST request failing
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Failed to mark',
      json: async () => ({ message: 'Server error on read' }) // Optional: if your API returns JSON error
    });

    fireEvent.click(screen.getByRole('button', { name: /mark as read/i }));

    await waitFor(() => {
      // Check for an error message specific to the mark as read action
      // This depends on how NotificationList is designed to show such errors.
      // The current NotificationList.tsx sets a general error state.
      expect(screen.getByText(/error: Server error on read/i)).toBeInTheDocument();
    });

    // Ensure the notification did NOT change its state visually
    expect(screen.getByRole('button', { name: /mark as read/i })).toBeInTheDocument(); // Button should still be there
    expect(screen.getByTestId('notification-item-errNotif')).toHaveClass('unread');

  });

});
