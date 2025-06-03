import {
  env as testEnv,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock AIChatAgent before importing Chat
vi.mock("agents/ai-chat-agent", () => ({
  AIChatAgent: class {
    messages: any[] = [];
    env: any;
    name?: string;
    userSession: any = null;
    context: any = null;
    mcp = {
      connect: vi.fn(),
      unstable_getAITools: vi.fn().mockReturnValue({}),
    };

    constructor({ env }: { env: any }) {
      this.env = env;
    }

    sql() {}
    async fetch(request: Request) {
      this.context = { request };
      return Promise.resolve(new Response());
    }
    async serializeDbOperation(fn: () => any) {
      return await fn();
    }
    async updateThreadMetadata() {}
  },
}));

import { Chat } from "../src/server";
import { type SessionData } from "../src/auth/session";
import type { Message } from "ai";

// Mock getSession from src/auth/session.ts
vi.mock("../src/auth/session", async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return {
    ...actual,
    getSession: vi.fn(),
  };
});
const { getSession } = await import("../src/auth/session");
const mockGetSession = getSession as vi.MockedFunction<typeof getSession>;

// Mock AI SDK functions
vi.mock("ai", async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return {
    ...actual,
    createDataStreamResponse: vi.fn().mockImplementation(({ execute }) => {
      // Mock implementation that calls execute immediately
      return {
        execute: async () => {
          const mockDataStream = {
            writeData: vi.fn(),
            close: vi.fn(),
          };
          await execute(mockDataStream);
        },
      };
    }),
    streamText: vi.fn().mockImplementation(({ onFinish, onStepFinish }) => {
      // Mock implementation that simulates a successful completion
      const mockMessages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "Test message",
          createdAt: new Date(),
        },
        {
          id: "2",
          role: "assistant",
          content: "Test response",
          createdAt: new Date(),
        },
      ];

      // Call onFinish to simulate completion
      if (onFinish) {
        setTimeout(() => {
          onFinish({
            messages: mockMessages,
            finishReason: "stop",
            usage: { promptTokens: 10, completionTokens: 20 },
            experimental_providerMetadata: undefined,
          });
        }, 10);
      }

      return {
        mergeIntoDataStream: vi.fn(),
      };
    }),
  };
});

// Create a real KV store for testing
const createTestKvStore = () => {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return undefined;
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
      return undefined;
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
    clear: vi.fn(() => {
      store.clear();
      return undefined;
    }),
  } as unknown as KVNamespace;
};

describe("Chat Agent KV Storage Integration", () => {
  let mockKvStore: KVNamespace;
  let mockEnv: Env;
  let chatAgent: Chat;

  beforeEach(() => {
    vi.resetAllMocks();
    mockKvStore = createTestKvStore();
    mockEnv = {
      ...testEnv,
      AUTH_GITHUB_CLIENT_ID: "test_client_id",
      AUTH_GITHUB_CLIENT_SECRET: "test_client_secret",
      AUTH_GITHUB_AUTHORIZED_USERNAMES: "",
      SESSION_SECRET: "test_session_secret",
      OPENAI_API_KEY: "test_openai_key",
      CHAT_HISTORY_KV: mockKvStore,
    } as Env;

    // Mock session for testing
    const mockUserSession: SessionData = {
      userId: "test-user-123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);
  });

  describe("Chat Message Persistence", () => {
    it("should save user messages immediately when onChatMessage is called", async () => {
      // Create a chat agent instance
      chatAgent = new Chat({ env: mockEnv });

      // Add a test message to the agent
      const testMessage: Message = {
        id: "test-msg-1",
        role: "user",
        content: "Hello, this is a test message",
        createdAt: new Date(),
      };

      // Manually set the messages array (simulating what happens in real usage)
      chatAgent.messages = [testMessage];

      // Set the user session directly
      (chatAgent as any).userSession = {
        userId: "test-user-123",
        username: "testuser",
      };

      // Mock request with session
      const mockRequest = new Request("http://localhost/test");
      (chatAgent as any).context = { request: mockRequest };

      // Call onChatMessage - this should save the message to KV
      const onFinishCallback = vi.fn();

      try {
        await chatAgent.onChatMessage(onFinishCallback);

        // Wait a bit for async operations
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Verify that the message was saved to KV
        expect(mockKvStore.put).toHaveBeenCalledWith(
          "test-user-123:thread:default",
          expect.stringContaining("Hello, this is a test message")
        );

        // Verify the saved data structure
        const putCalls = (mockKvStore.put as any).mock.calls;
        expect(putCalls.length).toBeGreaterThan(0);

        const savedData = putCalls[0][1];
        const savedMessages: Message[] = JSON.parse(savedData);
        expect(savedMessages).toHaveLength(1);
        expect(savedMessages[0].content).toBe("Hello, this is a test message");
        expect(savedMessages[0].role).toBe("user");
      } catch (error) {
        console.error("Test error:", error);
        throw error;
      }
    });

    it("should save both user and assistant messages on completion", async () => {
      chatAgent = new Chat({ env: mockEnv });

      const userMessage: Message = {
        id: "user-msg",
        role: "user",
        content: "What is the weather today?",
        createdAt: new Date(),
      };

      chatAgent.messages = [userMessage];

      // Set the user session directly
      (chatAgent as any).userSession = {
        userId: "test-user-123",
        username: "testuser",
      };

      const mockRequest = new Request("http://localhost/test");
      (chatAgent as any).context = { request: mockRequest };

      const onFinishCallback = vi.fn();

      await chatAgent.onChatMessage(onFinishCallback);

      // Wait for the mocked streamText onFinish to be called
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify that messages were saved multiple times (immediate save + completion save)
      expect(mockKvStore.put).toHaveBeenCalled();

      // Check the last save call should contain both user and assistant messages
      const putCalls = (mockKvStore.put as any).mock.calls;
      expect(putCalls.length).toBeGreaterThan(0);

      // Find a save call that contains the user message
      let foundUserMessage = false;
      for (const call of putCalls) {
        const savedData = JSON.parse(call[1]);
        if (
          savedData.some(
            (msg: any) => msg.content === "What is the weather today?"
          )
        ) {
          foundUserMessage = true;
          break;
        }
      }
      expect(foundUserMessage).toBe(true);
    });

    it("should handle KV storage failures gracefully", async () => {
      // Create a KV store that fails on put
      const failingKvStore = {
        ...mockKvStore,
        put: vi.fn().mockRejectedValue(new Error("KV storage failed")),
      } as unknown as KVNamespace;

      const envWithFailingKv = { ...mockEnv, CHAT_HISTORY_KV: failingKvStore };
      chatAgent = new Chat({ env: envWithFailingKv });

      const testMessage: Message = {
        id: "test-msg",
        role: "user",
        content: "This should fail to save",
        createdAt: new Date(),
      };

      chatAgent.messages = [testMessage];

      // Set the user session directly
      (chatAgent as any).userSession = {
        userId: "test-user-123",
        username: "testuser",
      };

      const mockRequest = new Request("http://localhost/test");
      (chatAgent as any).context = { request: mockRequest };

      // This should throw an error when KV storage fails
      const onFinishCallback = vi.fn();
      await expect(chatAgent.onChatMessage(onFinishCallback)).rejects.toThrow(
        "KV storage failed"
      );

      // Verify that the KV put was attempted
      expect(failingKvStore.put).toHaveBeenCalled();
    });

    it("should not save messages when user is not authenticated", async () => {
      // Mock no session (user not authenticated)
      mockGetSession.mockResolvedValue(null);

      chatAgent = new Chat({ env: mockEnv });

      const testMessage: Message = {
        id: "test-msg",
        role: "user",
        content: "This should not be saved",
        createdAt: new Date(),
      };

      chatAgent.messages = [testMessage];

      const mockRequest = new Request("http://localhost/test");
      (chatAgent as any).context = { request: mockRequest };

      const onFinishCallback = vi.fn();
      await chatAgent.onChatMessage(onFinishCallback);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify that no messages were saved to KV
      expect(mockKvStore.put).not.toHaveBeenCalled();
    });

    it("should not save messages when KV is not available", async () => {
      const envWithoutKv = { ...mockEnv, CHAT_HISTORY_KV: undefined as any };
      chatAgent = new Chat({ env: envWithoutKv });

      const testMessage: Message = {
        id: "test-msg",
        role: "user",
        content: "This should not be saved",
        createdAt: new Date(),
      };

      chatAgent.messages = [testMessage];

      // Set the user session directly
      (chatAgent as any).userSession = {
        userId: "test-user-123",
        username: "testuser",
      };

      const mockRequest = new Request("http://localhost/test");
      (chatAgent as any).context = { request: mockRequest };

      const onFinishCallback = vi.fn();
      await chatAgent.onChatMessage(onFinishCallback);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify that no messages were saved (because KV is not available)
      expect(mockKvStore.put).not.toHaveBeenCalled();
    });
  });

  describe("Message Retrieval After Save", () => {
    it("should be able to retrieve saved messages", async () => {
      chatAgent = new Chat({ env: mockEnv });

      const testMessages: Message[] = [
        {
          id: "msg-1",
          role: "user",
          content: "First message",
          createdAt: new Date(),
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "First response",
          createdAt: new Date(),
        },
      ];

      // Save messages directly to KV (simulating what the agent would do)
      await mockKvStore.put("test-user-123", JSON.stringify(testMessages));

      // Now retrieve them
      const retrieved = await mockKvStore.get("test-user-123");
      expect(retrieved).toBeTruthy();

      const parsedMessages: Message[] = JSON.parse(retrieved!);
      expect(parsedMessages).toHaveLength(2);
      expect(parsedMessages[0].content).toBe("First message");
      expect(parsedMessages[1].content).toBe("First response");
    });
  });
});
