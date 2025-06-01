import React, { useEffect, useState } from 'react';

interface SidebarProps {
  currentUserId: string | null; // To fetch threads for this user
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: () => void;
  // onLogout: () => void; // Consider if logout should be here or in app header
}

interface Thread {
  threadId: string;
  // lastMessage?: string; // For future enhancement
  // timestamp?: string; // For future enhancement
}

const Sidebar: React.FC<SidebarProps> = ({
  currentUserId,
  currentThreadId,
  onSelectThread,
  onCreateNewThread,
}) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      setThreads([]);
      return;
    }

    const fetchThreads = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/chat/history');
        if (!response.ok) {
          if (response.status === 401) {
            // Handle unauthorized, maybe call onLogout or redirect
            setError('Unauthorized. Please log in again.');
            // Potentially call a prop like onSessionExpired()
          } else {
            throw new Error(`Failed to fetch threads: ${response.statusText}`);
          }
          setThreads([]); // Clear threads on error
          return;
        }
        const data = await response.json();
        // Assuming data is an array of objects like [{ threadId: "id1" }, { threadId: "id2" }]
        setThreads(data);
      } catch (err) {
        console.error('Error fetching threads:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        setThreads([]); // Clear threads on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchThreads();
  }, [currentUserId]); // Re-fetch if userId changes

  return (
    <div className="w-64 bg-neutral-100 dark:bg-neutral-800 h-full p-4 flex flex-col border-r border-neutral-300 dark:border-neutral-700">
      <div className="mb-4">
        <button
          onClick={onCreateNewThread}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800"
        >
          New Chat
        </button>
      </div>

      <h2 className="text-lg font-semibold mb-2 text-neutral-700 dark:text-neutral-200">Threads</h2>
      {isLoading && <p className="text-xs text-neutral-500 dark:text-neutral-400">Loading threads...</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex-grow overflow-y-auto space-y-2">
        {threads.length === 0 && !isLoading && !error && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">No threads yet.</p>
        )}
        {threads.map((thread) => (
          <button
            key={thread.threadId}
            onClick={() => onSelectThread(thread.threadId)}
            className={`w-full text-left px-3 py-2 text-sm rounded-md truncate focus:outline-none
              ${currentThreadId === thread.threadId
                ? 'bg-blue-500 text-white'
                : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }
            `}
            title={thread.threadId} // Show full ID on hover if truncated
          >
            {/* For now, just display threadId. Later, can be a summary or title */}
            Thread: {thread.threadId.substring(0, 8)}...
          </button>
        ))}
      </div>

      {/* Placeholder for user info/logout at the bottom of sidebar */}
      {/* <div className="mt-auto">
        {currentUserId && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">User: {currentUserId}</p>
        )}
        <button
          // onClick={onLogout}
          className="w-full px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-200 dark:bg-neutral-700 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-600 focus:outline-none"
        >
          Logout
        </button>
      </div> */}
    </div>
  );
};

export default Sidebar;
