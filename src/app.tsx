import React, { useEffect, useState, useRef, useCallback, use } from "react"; // Added React import
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { Message } from "@ai-sdk/react";
import type { tools } from "./tools";

// Component imports
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Avatar } from "@/components/avatar/Avatar";
import { Toggle } from "@/components/toggle/Toggle";
import { Textarea } from "@/components/textarea/Textarea";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { ToolInvocationCard } from "@/components/tool-invocation-card/ToolInvocationCard";

// Icon imports
import {
  Bug,
  Moon,
  Robot,
  Sun,
  Trash,
  PaperPlaneTilt,
  Stop,
  List,
} from "@phosphor-icons/react";

// Sidebar import
import { Sidebar } from "@/components/sidebar/Sidebar";

// Notification import
import { NotificationButton } from "@/components/notifications/NotificationButton";
import { useTaskMessageNotifications } from "@/hooks/useTaskMessageNotifications";
import { useNotificationContext } from "@/providers/NotificationProvider";

// MCP Agent imports
import { AgentQuickSelector } from "@/components/agent-selector/AgentQuickSelector";
import { AgentManagementPanel } from "@/components/agent-selector/AgentManagementPanel";

// List of tools that require human confirmation
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation",
];

// Define a type for the user data
interface User {
  username: string;
  userId: string;
}

// ChatInterface component to encapsulate chat functionality
const ChatInterface: React.FC<{
  enabled: boolean;
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  currentThreadId: string;
}> = ({ enabled, currentUser, setCurrentUser, currentThreadId }) => {
  // State to control when we can safely use the agent chat hook
  const [canUseAgentChat, setCanUseAgentChat] = useState(false);

  // Get notification context for cross-thread notifications
  const { addNotification } = useNotificationContext();

  const [historyMessages, setHistoryMessages] = useState<Message[] | undefined>(
    undefined
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

  const agent = useAgent({
    agent: "chat",
    name: `${currentUser?.userId}-${currentThreadId}`,
  });

  // Enable agent chat only when we have a valid user, thread, and history is loaded
  useEffect(() => {
    const expectedName = `${currentUser?.userId}-${currentThreadId}`;
    const shouldEnable =
      enabled &&
      !!currentUser?.userId &&
      !!currentThreadId &&
      !!agent.agent &&
      !isLoadingHistory &&
      historyMessages !== undefined;

    // Allow some flexibility with agent name during task execution
    const nameMatches =
      agent.name === expectedName ||
      (agent.name && agent.name === `${currentUser?.userId}-default`) ||
      (agent.name && agent.name === `${currentUser?.userId}-scheduled-task`);

    // When thread changes, immediately disable agent chat to force a clean state
    if (currentThreadId !== (window as any).lastThreadId) {
      console.log(
        `[THREAD_SWITCH] Thread changed from "${(window as any).lastThreadId}" to "${currentThreadId}"`
      );
      (window as any).lastThreadId = currentThreadId;
      setCanUseAgentChat(false);
      return;
    }

    if (shouldEnable) {
      if (nameMatches) {
        // Add a small delay to ensure agent connection is fully established
        const timer = setTimeout(() => {
          setCanUseAgentChat(true);
        }, 100);
        return () => clearTimeout(timer);
      } else {
        // Name doesn't match but other conditions are met - keep enabled for task execution
        console.log(
          `[AGENT] Name mismatch during task execution: expected "${expectedName}", got "${agent.name}"`
        );
        setCanUseAgentChat(true);
      }
    } else {
      setCanUseAgentChat(false);
    }
  }, [
    enabled,
    currentUser?.userId,
    currentThreadId,
    agent.agent,
    agent.name,
    isLoadingHistory,
    historyMessages,
  ]);

  // Debug agent info
  useEffect(() => {
    console.log("Agent info:", {
      agent: agent.agent,
      name: agent.name,
      currentThreadId,
      currentUser: currentUser?.userId,
      canUseAgentChat,
      isLoadingHistory,
      historyMessagesLength: historyMessages?.length,
      historyMessagesUndefined: historyMessages === undefined,
    });
  }, [
    agent,
    currentThreadId,
    currentUser,
    canUseAgentChat,
    isLoadingHistory,
    historyMessages,
  ]);

  // Monitor all threads for scheduled task notifications
  useEffect(() => {
    if (!currentUser?.userId) return;

    // Load previously notified task completions from localStorage
    const getNotifiedTaskCompletions = (): Set<string> => {
      try {
        const stored = localStorage.getItem("notifiedTaskCompletions");
        return stored ? new Set(JSON.parse(stored)) : new Set<string>();
      } catch {
        return new Set<string>();
      }
    };

    const saveNotifiedTaskCompletions = (completions: Set<string>) => {
      try {
        localStorage.setItem(
          "notifiedTaskCompletions",
          JSON.stringify([...completions])
        );
      } catch (error) {
        console.error("Failed to save notified task completions:", error);
      }
    };

    // Load and save thread message counts from localStorage
    const getThreadMessageCounts = (): Map<string, number> => {
      try {
        const stored = localStorage.getItem("threadMessageCounts");
        return stored ? new Map(JSON.parse(stored)) : new Map<string, number>();
      } catch {
        return new Map<string, number>();
      }
    };

    const saveThreadMessageCounts = (counts: Map<string, number>) => {
      try {
        localStorage.setItem(
          "threadMessageCounts",
          JSON.stringify([...counts])
        );
      } catch (error) {
        console.error("Failed to save thread message counts:", error);
      }
    };

    let initializationComplete = false;

    // Initialize tracking by syncing with existing notifications on first load
    const initializeTracking = async () => {
      try {
        console.log(
          `[NOTIFICATION_INIT] Starting initialization for user ${currentUser.userId}`
        );

        // Get existing notifications to avoid re-showing them
        const existingNotifications = localStorage.getItem("app_notifications");
        const notifications = existingNotifications
          ? JSON.parse(existingNotifications)
          : [];

        console.log(
          `[NOTIFICATION_INIT] Found ${notifications.length} existing notifications`
        );

        // Extract task completion IDs from existing scheduled task notifications
        const existingTaskCompletions = new Set<string>();
        notifications.forEach((notification: any) => {
          if (
            notification.title === "Scheduled Task Completed" &&
            notification.threadId
          ) {
            // We need to reverse-engineer the assistant message ID from the notification
            // For now, we'll mark this thread as having been processed
            console.log(
              `[NOTIFICATION_INIT] Found existing notification for thread ${notification.threadId}`
            );
          }
        });

        // Get all threads and set initial message counts to current state
        // This prevents re-detection of old messages on page refresh
        const threadsResponse = await fetch("/threads");
        if (threadsResponse.ok) {
          const threads = (await threadsResponse.json()) as Array<{
            id: string;
            title: string;
          }>;
          const initialCounts = new Map<string, number>();

          console.log(
            `[NOTIFICATION_INIT] Processing ${threads.length} threads`
          );

          for (const thread of threads) {
            try {
              const threadUrl =
                thread.id === "default"
                  ? "/chat/history"
                  : `/threads/${thread.id}`;
              const response = await fetch(threadUrl);
              if (response.ok) {
                const messages = (await response.json()) as Message[];
                initialCounts.set(thread.id, messages.length);

                // Also mark any existing scheduled task completions as already notified
                for (let i = 0; i < messages.length - 1; i++) {
                  const userMessage = messages[i];
                  const assistantMessage = messages[i + 1];

                  if (
                    userMessage?.role === "user" &&
                    userMessage.content.startsWith("Running scheduled task:") &&
                    assistantMessage?.role === "assistant" &&
                    assistantMessage.id
                  ) {
                    existingTaskCompletions.add(assistantMessage.id);
                  }
                }
              }
            } catch (error) {
              console.error(
                `Failed to initialize tracking for thread ${thread.id}:`,
                error
              );
            }
          }

          console.log(
            `[NOTIFICATION_INIT] Setting initial counts:`,
            Object.fromEntries(initialCounts)
          );
          console.log(
            `[NOTIFICATION_INIT] Marking ${existingTaskCompletions.size} existing task completions as notified`
          );

          // Force save to localStorage immediately
          saveThreadMessageCounts(initialCounts);
          saveNotifiedTaskCompletions(existingTaskCompletions);

          console.log(`[NOTIFICATION_INIT] Initialization complete`);
          initializationComplete = true;
        } else {
          console.error(
            `[NOTIFICATION_INIT] Failed to fetch threads:`,
            threadsResponse.status
          );
        }
      } catch (error) {
        console.error("Failed to initialize notification tracking:", error);
      }
    };

    // Run initialization once
    initializeTracking();

    const interval = setInterval(async () => {
      // Don't run monitoring until initialization is complete
      if (!initializationComplete) {
        console.log(
          `[NOTIFICATION_MONITOR] Waiting for initialization to complete...`
        );
        return;
      }
      try {
        // Get current notified completions and message counts from localStorage
        const notifiedTaskCompletions = getNotifiedTaskCompletions();
        const threadMessageCounts = getThreadMessageCounts();

        // Get all threads for the user
        const threadsResponse = await fetch("/threads");
        if (!threadsResponse.ok) return;

        const threads = (await threadsResponse.json()) as Array<{
          id: string;
          title: string;
        }>;

        let countsUpdated = false;

        // Check each thread for new scheduled task completions
        for (const thread of threads) {
          // Skip the current thread - user can see those messages directly
          if (thread.id === currentThreadId) continue;

          try {
            const threadUrl =
              thread.id === "default"
                ? "/chat/history"
                : `/threads/${thread.id}`;
            const response = await fetch(threadUrl);
            if (response.ok) {
              const messages = (await response.json()) as Message[];
              const previousCount = threadMessageCounts.get(thread.id) || 0;
              const currentCount = messages.length;

              // Update the count if it changed
              if (currentCount !== previousCount) {
                threadMessageCounts.set(thread.id, currentCount);
                countsUpdated = true;
              }

              // If there are new messages, check if any are scheduled task completions
              if (currentCount > previousCount && messages.length >= 2) {
                // Look for the pattern: user message "Running scheduled task:" followed by assistant response
                for (
                  let i = Math.max(0, previousCount);
                  i < messages.length - 1;
                  i++
                ) {
                  const userMessage = messages[i];
                  const assistantMessage = messages[i + 1];

                  if (
                    userMessage?.role === "user" &&
                    userMessage.content.startsWith("Running scheduled task:") &&
                    assistantMessage?.role === "assistant" &&
                    assistantMessage.id &&
                    !notifiedTaskCompletions.has(assistantMessage.id)
                  ) {
                    // Mark this completion as notified
                    notifiedTaskCompletions.add(assistantMessage.id);

                    // Save updated notified completions to localStorage
                    saveNotifiedTaskCompletions(notifiedTaskCompletions);

                    const taskDescription = userMessage.content.replace(
                      "Running scheduled task: ",
                      ""
                    );

                    console.log(
                      `[NOTIFICATION] Scheduled task completed in thread ${thread.id}: ${taskDescription}`
                    );

                    // Use the proper notification system
                    addNotification({
                      title: "Scheduled Task Completed",
                      message: `Task completed in "${thread.title}": "${taskDescription}"`,
                      type: "info",
                      threadId: thread.id,
                    });
                  }
                }
              }
            }
          } catch (threadError) {
            console.error(
              `Failed to check thread ${thread.id} for notifications:`,
              threadError
            );
          }
        }

        // Save updated message counts if any changed
        if (countsUpdated) {
          saveThreadMessageCounts(threadMessageCounts);
        }
      } catch (error) {
        console.error(
          "Failed to check for scheduled task notifications:",
          error
        );
      }
    }, 5000); // Check more frequently (every 5 seconds) for better responsiveness

    return () => clearInterval(interval);
  }, [currentUser?.userId, currentThreadId, addNotification]);

  useEffect(() => {
    if (enabled && currentUser?.userId && currentThreadId) {
      console.log(
        `[HISTORY_LOADING] Loading history for thread: ${currentThreadId}`
      );
      setIsLoadingHistory(true);
      const url =
        currentThreadId === "default"
          ? "/chat/history"
          : `/threads/${currentThreadId}`;
      fetch(url)
        .then((res) => {
          if (res.ok) {
            return res.json();
          }
          if (res.status === 401) {
            setCurrentUser(null);
          }
          console.error("Failed to fetch chat history, status:", res.status);
          return [];
        })
        .then((data: unknown) => {
          const messages = Array.isArray(data) ? (data as Message[]) : [];
          console.log(
            `[HISTORY_LOADED] Loaded ${messages.length} messages for thread: ${currentThreadId}`
          );
          setHistoryMessages(messages);
        })
        .catch((err) => {
          console.error("Error fetching/parsing chat history:", err);
          setHistoryMessages([]);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else if (!enabled) {
      setHistoryMessages(undefined);
      setIsLoadingHistory(true);
    }
  }, [enabled, currentUser?.userId, currentThreadId, setCurrentUser]);

  // Always call useAgentChat hook to avoid hook order violations
  const agentChatResult = useAgentChat({
    agent: agent,
    initialMessages: historyMessages,
    maxSteps: 5,
    onError: (err) => {
      console.error("Chat error:", err);
      if (
        err.message.includes("401") ||
        err.message.toLowerCase().includes("unauthorized")
      ) {
        setCurrentUser(null);
      }
    },
    onFinish: () => {
      // Refresh threads in sidebar when conversation finishes
      if (typeof (window as any).refreshThreads === "function") {
        (window as any).refreshThreads();
      }
    },
  });

  // Use actual values when ready, fallback values when not
  const {
    messages: agentMessages,
    input: agentInput,
    handleInputChange: handleAgentInputChange,
    handleSubmit: handleAgentSubmit,
    addToolResult,
    clearHistory,
    isLoading: isAgentLoading,
    stop,
  } = canUseAgentChat
    ? agentChatResult
    : {
        messages: [],
        input: "",
        handleInputChange: () => {},
        handleSubmit: () => {},
        addToolResult: () => {},
        clearHistory: () => {},
        isLoading: false,
        stop: () => {},
      };

  // Component remounting via key prop handles thread switching

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useTaskMessageNotifications(agentMessages, currentThreadId);

  useEffect(() => {
    if (agentMessages.length > 0) {
      scrollToBottom();
    }
  }, [agentMessages, scrollToBottom]);

  const [showDebug, setShowDebug] = useState(() => {
    const saved = localStorage.getItem("showDebug");
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => {
    localStorage.setItem("showDebug", JSON.stringify(showDebug));
  }, [showDebug]);

  const pendingToolCallConfirmation = agentMessages.some((m: Message) =>
    m.parts?.some(
      (part) =>
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "call" &&
        toolsRequiringConfirmation.includes(
          part.toolInvocation.toolName as keyof typeof tools
        )
    )
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const [textareaHeight, setTextareaHeight] = useState("auto");

  // Show loading state in the chat area while keeping sidebar functional
  const isLoadingAgent = enabled && (isLoadingHistory || !canUseAgentChat);

  if (isLoadingAgent) {
    return (
      <>
        {/* ChatInterface's own controls (Debug, Clear History) */}
        <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between sticky top-0 bg-background dark:bg-neutral-900 z-10">
          <div className="flex items-center gap-2">
            <Bug size={16} />
            <Toggle
              toggled={showDebug}
              aria-label="Toggle debug mode"
              onClick={() => setShowDebug((prev: boolean) => !prev)}
            />
            <span className="text-xs text-muted-foreground">Debug</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearHistory();
            }}
            aria-label="Clear chat history"
            disabled={true}
          >
            <Trash size={16} />
            <span className="ml-1 text-xs">Clear</span>
          </Button>
        </div>

        {/* Loading state in messages area */}
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground">
            {isLoadingHistory
              ? "Loading chat history..."
              : "Connecting to chat agent..."}
          </p>
        </div>

        {/* Disabled input form */}
        <form className="p-3 bg-neutral-50 absolute bottom-0 left-0 right-0 z-10 border-t border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Textarea
                disabled={true}
                placeholder="Connecting to chat agent..."
                className="flex w-full border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-base ring-offset-background placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl pb-10 dark:bg-neutral-900"
                value=""
                rows={2}
              />
              <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
                <button
                  type="button"
                  disabled={true}
                  className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                  aria-label="Send message"
                >
                  <PaperPlaneTilt size={16} />
                </button>
              </div>
            </div>
          </div>
        </form>
      </>
    );
  }

  if (!enabled && !isLoadingHistory) {
    return null;
  }

  return (
    <>
      {/* ChatInterface's own controls (Debug, Clear History) */}
      <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between sticky top-0 bg-background dark:bg-neutral-900 z-10">
        <div className="flex items-center gap-2">
          <Bug size={16} />
          <Toggle
            toggled={showDebug}
            aria-label="Toggle debug mode"
            onClick={() => setShowDebug((prev: boolean) => !prev)}
          />
          <span className="text-xs text-muted-foreground">Debug</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearHistory();
          }}
          aria-label="Clear chat history"
        >
          <Trash size={16} />
          <span className="ml-1 text-xs">Clear</span>
        </Button>
      </div>

      {/* Messages */}
      {/* Adjusted max-h for messages area, accounting for the ChatInterface controls bar + main app header + input form padding */}
      {/* Approximate calculation: 100vh - app_header_h - chat_controls_h - input_form_h - misc_padding */}
      {/* Let's assume app_header is ~3.5rem, chat_controls is ~3rem, input_form is ~4rem. Total ~10.5rem. Plus p-4 on main container (2rem). */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 max-h-[calc(100vh-12.5rem)]">
        {agentMessages.length === 0 && !isAgentLoading && (
          <div className="h-full flex items-center justify-center">
            <Card className="p-6 max-w-md mx-auto bg-neutral-100 dark:bg-neutral-900">
              <div className="text-center space-y-4">
                <div className="bg-[#F48120]/10 text-[#F48120] rounded-full p-3 inline-flex">
                  <Robot size={24} />
                </div>
                <h3 className="font-semibold text-lg">
                  {currentUser?.username
                    ? `Welcome, ${currentUser.username}!`
                    : "Welcome!"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {historyMessages && historyMessages.length > 0
                    ? "Continue your conversation or start a new one."
                    : "Start a conversation with your AI assistant."}
                </p>
              </div>
            </Card>
          </div>
        )}

        {agentMessages.map((m: Message, index) => {
          const isUser = m.role === "user";
          const showAvatar =
            index === 0 || agentMessages[index - 1]?.role !== m.role;
          const messageDate = m.createdAt
            ? new Date(m.createdAt as any)
            : new Date();

          return (
            <div key={m.id || `msg-${index}`}>
              {showDebug && (
                <pre className="text-xs text-muted-foreground overflow-scroll">
                  {JSON.stringify(m, null, 2)}
                </pre>
              )}
              <div
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex gap-2 max-w-[85%] ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {showAvatar && !isUser ? (
                    <Avatar username={"AI"} />
                  ) : (
                    !isUser && <div className="w-8" />
                  )}

                  <div>
                    <div>
                      {m.parts?.map((part, i) => {
                        if (part.type === "text") {
                          return (
                            <div key={i}>
                              <Card
                                className={`p-3 rounded-md bg-neutral-100 dark:bg-neutral-900 ${
                                  isUser
                                    ? "rounded-br-none"
                                    : "rounded-bl-none border-assistant-border"
                                } ${
                                  part.text.startsWith("scheduled message")
                                    ? "border-accent/50"
                                    : ""
                                } relative`}
                              >
                                {part.text.startsWith("scheduled message") && (
                                  <span className="absolute -top-3 -left-2 text-base">
                                    🕒
                                  </span>
                                )}
                                <MemoizedMarkdown
                                  id={`${m.id || `msg-${index}`}-${i}`}
                                  content={part.text.replace(
                                    /^scheduled message: /,
                                    ""
                                  )}
                                />
                              </Card>
                              <p
                                className={`text-xs text-muted-foreground mt-1 ${
                                  isUser ? "text-right" : "text-left"
                                }`}
                              >
                                {formatTime(messageDate)}
                              </p>
                            </div>
                          );
                        }

                        if (part.type === "tool-invocation") {
                          const toolInvocation = part.toolInvocation;
                          const toolCallId = toolInvocation.toolCallId;
                          const needsConfirmation =
                            toolsRequiringConfirmation.includes(
                              toolInvocation.toolName as keyof typeof tools
                            );

                          if (showDebug) return null;

                          return (
                            <ToolInvocationCard
                              key={`${toolCallId}-${i}`}
                              toolInvocation={toolInvocation}
                              toolCallId={toolCallId}
                              needsConfirmation={needsConfirmation}
                              addToolResult={addToolResult}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {isAgentLoading && agentMessages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground">Thinking...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!enabled || isAgentLoading) return;

          // Check if this is the first message in a new thread
          const isFirstMessage =
            agentMessages.length === 0 &&
            (!historyMessages || historyMessages.length === 0);

          handleAgentSubmit(e, {
            data: { annotations: { hello: "world" } },
          });
          setTextareaHeight("auto");

          // If this is the first message, refresh threads after a short delay
          if (isFirstMessage) {
            setTimeout(() => {
              if (typeof (window as any).refreshThreads === "function") {
                (window as any).refreshThreads();
              }
            }, 1000); // Give time for the message to be processed
          }
        }}
        className="p-3 bg-neutral-50 absolute bottom-0 left-0 right-0 z-10 border-t border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Textarea
              disabled={
                !enabled || pendingToolCallConfirmation || isAgentLoading
              }
              placeholder={
                pendingToolCallConfirmation
                  ? "Please respond to the tool confirmation above..."
                  : "Send a message..."
              }
              className="flex w-full border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-base ring-offset-background placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl pb-10 dark:bg-neutral-900"
              value={agentInput}
              onChange={(e) => {
                handleAgentInputChange(e);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
                setTextareaHeight(`${e.target.scrollHeight}px`);
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  enabled &&
                  !isAgentLoading
                ) {
                  e.preventDefault();

                  // Check if this is the first message in a new thread
                  const isFirstMessage =
                    agentMessages.length === 0 &&
                    (!historyMessages || historyMessages.length === 0);

                  handleAgentSubmit(e as unknown as React.FormEvent);
                  setTextareaHeight("auto");

                  // If this is the first message, refresh threads after a short delay
                  if (isFirstMessage) {
                    setTimeout(() => {
                      if (
                        typeof (window as any).refreshThreads === "function"
                      ) {
                        (window as any).refreshThreads();
                      }
                    }, 1000);
                  }
                }
              }}
              rows={2}
              style={{ height: textareaHeight }}
            />
            <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
              {isAgentLoading ? (
                <button
                  type="button"
                  onClick={stop}
                  disabled={!enabled}
                  className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                  aria-label="Stop generation"
                >
                  <Stop size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    !enabled ||
                    pendingToolCallConfirmation ||
                    !agentInput.trim() ||
                    isAgentLoading
                  }
                  className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                  aria-label="Send message"
                >
                  <PaperPlaneTilt size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </>
  );
};

export default function Chat() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Check localStorage first, default to dark if not found
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });
  // showDebug, textareaHeight, messagesEndRef are now part of ChatInterface or not needed at this level
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [currentThreadId, setCurrentThreadId] = useState<string>(() => {
    // Initialize from URL parameter if available
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const threadParam = urlParams.get("thread")?.trim();
      return threadParam || "default";
    }
    return "default";
  });

  // MCP Agent state management
  const [currentAgents, setCurrentAgents] = useState<any[]>([]);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [mcpGroups, setMcpGroups] = useState<any[]>([]);
  const [showAgentManagement, setShowAgentManagement] = useState(false);

  // Load available agents when user loads
  useEffect(() => {
    if (currentUser?.userId) {
      loadAvailableAgents();
      loadCurrentThreadAgents();
      loadMcpGroups();
    }
  }, [currentUser?.userId, currentThreadId]);

  const loadAvailableAgents = async () => {
    try {
      const response = await fetch("/api/agents");
      if (response.ok) {
        const data = await response.json() as any;
        const agents = data.agents || [];
        setAvailableAgents(Array.isArray(agents) ? agents : []);
      }
    } catch (error) {
      console.error("Failed to load available agents:", error);
    }
  };

  const loadCurrentThreadAgents = async () => {
    try {
      const response = await fetch(`/api/agents/thread/${currentThreadId}`);
      if (response.ok) {
        const data = await response.json() as any;
        const agents = data.agents || [];
        setCurrentAgents(Array.isArray(agents) ? agents : []);
      }
    } catch (error) {
      console.error("Failed to load thread agents:", error);
    }
  };

  const loadMcpGroups = async () => {
    try {
      const response = await fetch("/api/mcp-groups");
      if (response.ok) {
        const data = await response.json() as any;
        const groups = data.groups || [];
        setMcpGroups(Array.isArray(groups) ? groups : []);
      }
    } catch (error) {
      console.error("Failed to load MCP groups:", error);
    }
  };

  const handleAgentChange = async (agents: any[]) => {
    try {
      const response = await fetch(`/api/agents/thread/${currentThreadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentIds: agents.map(a => a.id) }),
      });
      if (response.ok) {
        setCurrentAgents(agents);
      }
    } catch (error) {
      console.error("Failed to update thread agents:", error);
    }
  };

  const handleCreateAgent = async (agentData: any) => {
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentData),
      });
      if (response.ok) {
        loadAvailableAgents();
      }
    } catch (error) {
      console.error("Failed to create agent:", error);
    }
  };

  const handleUpdateAgent = async (agentId: string, updates: any) => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        loadAvailableAgents();
        loadCurrentThreadAgents();
      }
    } catch (error) {
      console.error("Failed to update agent:", error);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        loadAvailableAgents();
        loadCurrentThreadAgents();
      }
    } catch (error) {
      console.error("Failed to delete agent:", error);
    }
  };
  // Sidebar should be open on desktop by default, closed on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    // Check if we're on desktop (this will be false during SSR, but that's ok)
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768; // md breakpoint
    }
    return false;
  });

  useEffect(() => {
    // Fetch user data when the component mounts
    fetch("/auth/me")
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        if (res.status === 401) {
          // Not authenticated
          setCurrentUser(null);
        }
        return null; // Or throw an error
      })
      .then((data: any) => {
        if (data && data.username) {
          setCurrentUser(data);
        }
      })
      .catch((error) => {
        console.error("Error fetching user:", error);
        setCurrentUser(null);
      })
      .finally(() => {
        setIsLoadingUser(false);
      });
  }, []);

  useEffect(() => {
    // Apply theme class on mount and when theme changes
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }

    // Save theme preference to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Update URL when thread changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (currentThreadId === "default") {
        url.searchParams.delete("thread");
      } else {
        url.searchParams.set("thread", currentThreadId);
      }

      // Update URL without adding to history
      window.history.replaceState({}, "", url.toString());
    }
  }, [currentThreadId]);

  // Handle window resize to manage sidebar state
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop && !isSidebarOpen) {
        setIsSidebarOpen(true);
      } else if (!isDesktop && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isSidebarOpen]);

  // Removed scrollToBottom and related useEffects from here, as they are now in ChatInterface

  const toggleTheme = () => {
    // Theme toggle can remain at app level
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const handleThreadSelect = (threadId: string) => {
    console.log(
      `[THREAD_SELECT] Switching from "${currentThreadId}" to "${threadId}"`
    );
    setCurrentThreadId(threadId);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  // Expose thread navigation globally for notifications
  useEffect(() => {
    (window as any).navigateToThread = handleThreadSelect;
    return () => {
      delete (window as any).navigateToThread;
    };
  }, [handleThreadSelect]);

  const handleNewThread = async () => {
    // Generate a new thread ID and create it immediately on the server
    const newThreadId = `thread_${crypto.randomUUID()}`;

    // Create the thread on the server first to prevent refresh issues
    await createThreadOnServer(newThreadId);

    // Then switch to it in the UI
    setCurrentThreadId(newThreadId);
    setIsSidebarOpen(false); // Close sidebar on mobile after creation
  };

  const createThreadOnServer = async (threadId: string) => {
    // Prevent duplicate creation calls for the same thread
    if ((createThreadOnServer as any).inProgress?.has(threadId)) {
      return;
    }

    if (!(createThreadOnServer as any).inProgress) {
      (createThreadOnServer as any).inProgress = new Set();
    }
    (createThreadOnServer as any).inProgress.add(threadId);

    try {
      const response = await fetch("/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ threadId }),
      });

      if (response.ok) {
        // Refresh threads in sidebar
        if (typeof (window as any).refreshThreads === "function") {
          (window as any).refreshThreads();
        }
      } else {
        console.error("Failed to create new thread on server");
      }
    } catch (error) {
      console.error("Error creating thread on server:", error);
    } finally {
      (createThreadOnServer as any).inProgress?.delete(threadId);
    }
  };

  // agent and useAgentChat hooks are now inside ChatInterface
  // Other states like pendingToolCallConfirmation, formatTime are also moved to ChatInterface

  return (
    <div className="h-[100vh] w-full flex bg-fixed overflow-hidden">
      <HasOpenAIKey />

      {/* Sidebar */}
      {currentUser && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentThreadId={currentThreadId}
          onThreadSelect={handleThreadSelect}
          onNewThread={handleNewThread}
          currentUser={currentUser}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-full w-full mx-auto max-w-4xl flex flex-col shadow-xl overflow-hidden relative border-l border-neutral-300 dark:border-neutral-800">
          {/* App-level Header for Login/Logout and Title */}
          <header className="p-4 border-b border-neutral-300 dark:border-neutral-800 flex justify-between items-center sticky top-0 z-20 bg-background dark:bg-neutral-950">
            <div className="flex items-center gap-4">
              {currentUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarOpen(true)}
                  className="md:hidden"
                >
                  <List size={20} />
                </Button>
              )}
              <h1 className="text-xl font-semibold">Chat Agent</h1>
              {currentUser && availableAgents.length > 0 && (
                <AgentQuickSelector
                  threadId={currentThreadId}
                  currentAgents={currentAgents}
                  availableAgents={availableAgents}
                  onAgentChange={handleAgentChange}
                  onManageAgents={() => setShowAgentManagement(true)}
                />
              )}
            </div>
            {/* Theme and other controls can be moved here if they are app-level */}
            {/* Or keep them in ChatInterface if they are chat-specific */}
            {/* For now, only login/logout status in this header */}
            <div>
              {isLoadingUser ? (
                <p className="text-sm">Loading user...</p>
              ) : currentUser ? (
                <div className="flex items-center gap-2 sm:gap-4">
                  <span className="text-sm hidden sm:block">
                    Welcome, {currentUser.username}!
                  </span>
                  <div className="flex items-center gap-1">
                    <NotificationButton onNavigateToChat={handleThreadSelect} />
                    <Button
                      variant="ghost"
                      size="sm"
                      shape="square"
                      className="rounded-full h-8 w-8"
                      onClick={toggleTheme}
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? (
                        <Sun size={18} />
                      ) : (
                        <Moon size={18} />
                      )}
                    </Button>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await fetch("/auth/logout", { method: "GET" });
                        setCurrentUser(null);
                        window.location.reload();
                      } catch (error) {
                        console.error("Logout failed:", error);
                        window.location.href = "/auth/logout";
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <a
                  href="/auth/github"
                  className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Login with GitHub
                </a>
              )}
            </div>
          </header>

          {/* Conditionally render ChatInterface or placeholder content */}
          {isLoadingUser && (
            <div className="flex-1 flex items-center justify-center p-4">
              {/* Using a simple text loader for now, replace with <Loader /> if available and desired */}
              <p className="text-xl text-muted-foreground">
                Loading session...
              </p>
            </div>
          )}

          {!isLoadingUser && currentUser && (
            <ChatInterface
              key={`chat-${currentUser.userId}-${currentThreadId}`}
              enabled={true}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              currentThreadId={currentThreadId}
            />
          )}

          {!isLoadingUser && !currentUser && (
            <div className="flex-1 flex items-center justify-center p-4 text-center">
              <div>
                <Robot
                  size={48}
                  className="mx-auto text-muted-foreground mb-4"
                />
                <p className="text-xl text-muted-foreground">
                  Please{" "}
                  <a
                    href="/auth/github"
                    className="text-blue-500 hover:underline"
                  >
                    log in
                  </a>{" "}
                  to start chatting.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent Management Modal */}
      {showAgentManagement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <AgentManagementPanel
              isOpen={showAgentManagement}
              onClose={() => setShowAgentManagement(false)}
              agents={availableAgents}
              mcpGroups={mcpGroups}
              onCreateAgent={handleCreateAgent}
              onUpdateAgent={handleUpdateAgent}
              onDeleteAgent={handleDeleteAgent}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const hasOpenAiKeyPromise = fetch("/check-open-ai-key").then((res) =>
  res.json<{ success: boolean }>()
);

function HasOpenAIKey() {
  const hasOpenAiKey = use(hasOpenAiKeyPromise);

  if (!hasOpenAiKey.success) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-labelledby="warningIcon"
                >
                  <title id="warningIcon">Warning Icon</title>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                  OpenAI API Key Not Configured
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 mb-1">
                  Requests to the API, including from the frontend UI, will not
                  work until an OpenAI API key is configured.
                </p>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Please configure an OpenAI API key by setting a{" "}
                  <a
                    href="https://developers.cloudflare.com/workers/configuration/secrets/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    secret
                  </a>{" "}
                  named{" "}
                  <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-sm">
                    OPENAI_API_KEY
                  </code>
                  . <br />
                  You can also use a different model provider by following these{" "}
                  <a
                    href="https://github.com/cloudflare/agents-starter?tab=readme-ov-file#use-a-different-ai-model-provider"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    instructions.
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
