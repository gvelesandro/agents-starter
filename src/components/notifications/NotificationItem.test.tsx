import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationItem, { TaskNotification } from './NotificationItem';
import { vi } from 'vitest';

describe('NotificationItem', () => {
  const mockOnMarkAsRead = vi.fn();
  const unreadNotification: TaskNotification = {
    id: '1', message: 'Test unread', createdAt: new Date().toISOString(), read: false, type: 'task_completion', taskDescription: 'desc'
  };
  const readNotification: TaskNotification = {
    id: '2', message: 'Test read', createdAt: new Date().toISOString(), read: true, type: 'task_completion', taskDescription: 'desc'
  };

  beforeEach(() => {
    mockOnMarkAsRead.mockClear();
  });

  it('renders unread notification correctly', () => {
    render(<NotificationItem notification={unreadNotification} onMarkAsRead={mockOnMarkAsRead} />);
    expect(screen.getByText('Test unread')).toBeInTheDocument();
    // Check for button text specifically, as role 'button' can be broad
    const button = screen.getByRole('button', { name: /mark as read/i });
    expect(button).toBeInTheDocument();

    // Check class for unread status
    const itemDiv = screen.getByText('Test unread').closest('.notification-item');
    expect(itemDiv).toHaveClass('unread');
    expect(itemDiv).not.toHaveClass('read');
  });

  it('renders read notification correctly', () => {
    render(<NotificationItem notification={readNotification} onMarkAsRead={mockOnMarkAsRead} />);
    expect(screen.getByText('Test read')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as read/i })).not.toBeInTheDocument();

    // Check class for read status
    const itemDiv = screen.getByText('Test read').closest('.notification-item');
    expect(itemDiv).toHaveClass('read');
    expect(itemDiv).not.toHaveClass('unread');
  });

  it('calls onMarkAsRead when button is clicked for unread notification', () => {
    render(<NotificationItem notification={unreadNotification} onMarkAsRead={mockOnMarkAsRead} />);
    fireEvent.click(screen.getByRole('button', { name: /mark as read/i }));
    expect(mockOnMarkAsRead).toHaveBeenCalledWith('1');
  });

  it('does not call onMarkAsRead if button is somehow clicked for an already read notification (though button should not be present)', () => {
    // This case is mostly defensive, button shouldn't be there.
    // We are testing the component logic itself.
    render(<NotificationItem notification={readNotification} onMarkAsRead={mockOnMarkAsRead} />);
    // Attempt to simulate a click if a button were there, or simply ensure no call if no button
    const button = screen.queryByRole('button', { name: /mark as read/i });
    if (button) {
      fireEvent.click(button);
    }
    expect(mockOnMarkAsRead).not.toHaveBeenCalled();
  });

  it('displays formatted date correctly', () => {
    const date = new Date(2023, 0, 15, 14, 30, 0); // Jan 15, 2023, 2:30 PM
    const notificationWithSpecificDate: TaskNotification = {
      id: '3', message: 'Date test', createdAt: date.toISOString(), read: false, type: 'task_completion', taskDescription: 'desc date'
    };
    render(<NotificationItem notification={notificationWithSpecificDate} onMarkAsRead={mockOnMarkAsRead} />);
    // toLocaleString() can be locale-dependent, so this might need adjustment
    // For more robust date testing, consider mocking Date or using a date formatting library consistently
    expect(screen.getByText(date.toLocaleString())).toBeInTheDocument();
  });
});
