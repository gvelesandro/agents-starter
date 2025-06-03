import React, { useState } from "react";
import { Bell } from "@phosphor-icons/react";
import { useNotificationContext } from "../../providers/NotificationProvider";
import { NotificationPanel } from "./NotificationPanel";
import { Button } from "../button/Button";

interface NotificationButtonProps {
  onNavigateToChat?: (threadId: string) => void;
}

export const NotificationButton: React.FC<NotificationButtonProps> = ({
  onNavigateToChat,
}) => {
  const { unreadCount } = useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-50">
      <Button
        variant="ghost"
        size="sm"
        shape="square"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications (${unreadCount} unread)`}
        className="relative rounded-full h-8 w-8"
      >
        <Bell size={18} weight="bold" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-medium">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/5 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <NotificationPanel
            onClose={() => setIsOpen(false)}
            onNavigateToChat={(threadId) => {
              onNavigateToChat?.(threadId);
              setIsOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
};
