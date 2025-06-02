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
  onThreadChange: (threadId: string) => void;
  createThreadOnServer: (threadId: string) => Promise<void>;
}> = ({
  enabled,
  currentUser,
  setCurrentUser,
  currentThreadId,
  onThreadChange,
  createThreadOnServer,
}) => {
  // State to control when we can safely use the agent chat hook
  const [canUseAgentChat, setCanUseAgentChat] = useState(false);

  const agent = useAgent({
    agent: "chat",
    name: `${currentUser?.userId}-${currentThreadId}`,
  });

  // Enable agent chat only when we have a valid user and thread
  useEffect(() => {
    setCanUseAgentChat(
      enabled && !!currentUser?.userId && !!currentThreadId && !!agent.agent
    );
  }, [enabled, currentUser?.userId, currentThreadId, agent.agent]);

  // Debug agent info
  useEffect(() => {
    console.log("Agent info:", {
      agent: agent.agent,
      name: agent.name,
      currentThreadId,
      currentUser: currentUser?.userId,
      canUseAgentChat,
    });
  }, [agent, currentThreadId, currentUser, canUseAgentChat]);

  const [historyMessages, setHistoryMessages] = useState<Message[] | undefined>(
    undefined
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

  useEffect(() => {
    if (enabled && currentUser?.userId && currentThreadId) {
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
          setHistoryMessages(Array.isArray(data) ? (data as Message[]) : []);
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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

  if (enabled && isLoadingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-muted-foreground">Loading chat history...</p>
      </div>
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

          // If this is a new thread (not default), create it on the server first
          if (isFirstMessage && currentThreadId !== "default") {
            createThreadOnServer(currentThreadId);
          }

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

                  // If this is a new thread (not default), create it on the server first
                  if (isFirstMessage && currentThreadId !== "default") {
                    createThreadOnServer(currentThreadId);
                  }

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
  const [currentThreadId, setCurrentThreadId] = useState<string>("default");
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
    setCurrentThreadId(threadId);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const handleNewThread = () => {
    // Just generate a new thread ID and switch to it
    // Don't create it on the server until the user sends a message
    const newThreadId = `thread_${Date.now()}`;
    setCurrentThreadId(newThreadId);
    setIsSidebarOpen(false); // Close sidebar on mobile after creation
  };

  const createThreadOnServer = async (threadId: string) => {
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
            </div>
            {/* Theme and other controls can be moved here if they are app-level */}
            {/* Or keep them in ChatInterface if they are chat-specific */}
            {/* For now, only login/logout status in this header */}
            <div>
              {isLoadingUser ? (
                <p className="text-sm">Loading user...</p>
              ) : currentUser ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm">
                    Welcome, {currentUser.username}!
                  </span>
                  {/* Theme toggle button can be here if it's app-level */}
                  <Button
                    variant="ghost"
                    size="sm" // Adjusted size
                    shape="square"
                    className="rounded-full h-8 w-8" // Adjusted size
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                  >
                    {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                  </Button>
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
              key={`${currentUser.userId}-${currentThreadId}`}
              enabled={true}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              currentThreadId={currentThreadId}
              onThreadChange={handleThreadSelect}
              createThreadOnServer={createThreadOnServer}
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
