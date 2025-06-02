import React, { useState, useEffect } from "react";
import { Button } from "@/components/button/Button";
import { Plus, Chat, Trash, X } from "@phosphor-icons/react";

interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentThreadId: string;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => void;
  currentUser?: { userId: string; username: string } | null;
  onThreadsChange?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  currentThreadId,
  onThreadSelect,
  onNewThread,
  currentUser,
  onThreadsChange,
}) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadThreads();
    } else {
      setThreads([]);
      setIsLoading(false);
    }
  }, [currentUser]);

  // Also load threads when sidebar opens (for mobile)
  useEffect(() => {
    if (isOpen && currentUser && threads.length === 0) {
      loadThreads();
    }
  }, [isOpen, currentUser, threads.length]);

  // Expose refresh function to parent
  useEffect(() => {
    if (onThreadsChange) {
      // Create a function that can be called to refresh threads
      (window as any).refreshThreads = loadThreads;
    }
  }, [onThreadsChange]);

  const loadThreads = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/threads");

      if (response.ok) {
        const data = await response.json();
        setThreads(Array.isArray(data) ? data : []);
      } else {
        console.error("Failed to load threads, status:", response.status);
        setThreads([]);
      }
    } catch (error) {
      console.error("Error loading threads:", error);
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteThread = async (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (threads.length <= 1) {
      // Don't allow deleting the last thread
      return;
    }

    try {
      const response = await fetch(`/threads/${threadId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId));

        // If we deleted the current thread, switch to the first remaining thread
        if (threadId === currentThreadId) {
          const remainingThreads = threads.filter((t) => t.id !== threadId);
          if (remainingThreads.length > 0) {
            onThreadSelect(remainingThreads[0].id);
          }
        }
      } else {
        console.error("Failed to delete thread");
      }
    } catch (error) {
      console.error("Error deleting thread:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed top-0 left-0 h-full w-80 bg-white dark:bg-neutral-900 
        border-r border-neutral-200 dark:border-neutral-700 
        transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:z-auto
      `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewThread}
              className="flex items-center gap-2"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="md:hidden"
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-neutral-500">
              Loading conversations...
            </div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-center text-neutral-500">
              <div className="mb-2">No conversations yet</div>
              <div className="text-xs text-neutral-400">
                Start a new conversation to see it here
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => onThreadSelect(thread.id)}
                  className={`
                    group flex items-center justify-between p-3 rounded-lg cursor-pointer
                    hover:bg-neutral-100 dark:hover:bg-neutral-800
                    ${
                      currentThreadId === thread.id
                        ? "bg-neutral-100 dark:bg-neutral-800 border-l-2 border-blue-500"
                        : ""
                    }
                  `}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Chat
                      size={16}
                      className="text-neutral-500 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {thread.title}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {formatDate(thread.updatedAt)}
                      </div>
                    </div>
                  </div>

                  {threads.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => deleteThread(thread.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
                    >
                      <Trash size={14} className="text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
