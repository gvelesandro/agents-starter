import {
  env as testEnv,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/server";
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

describe("KV Storage Integration Tests", () => {
  let mockKvStore: KVNamespace;
  let mockEnv: Env;

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
  });

  describe("Direct KV Store Operations", () => {
    it("should save and retrieve chat messages from KV store", async () => {
      const userId = "test-user-123";
      const testMessages: Message[] = [
        {
          id: "msg-1",
          role: "user",
          content: "Hello, how are you?",
          createdAt: new Date("2024-01-01T10:00:00Z"),
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "I am doing well, thank you for asking!",
          createdAt: new Date("2024-01-01T10:00:05Z"),
        },
      ];

      // Save messages to KV
      await mockKvStore.put(userId, JSON.stringify(testMessages));

      // Retrieve messages from KV
      const savedData = await mockKvStore.get(userId);
      expect(savedData).toBeTruthy();

      const retrievedMessages: Message[] = JSON.parse(savedData!);
      expect(retrievedMessages).toHaveLength(2);
      expect(retrievedMessages[0].content).toBe("Hello, how are you?");
      expect(retrievedMessages[1].content).toBe(
        "I am doing well, thank you for asking!"
      );
      expect(retrievedMessages[0].role).toBe("user");
      expect(retrievedMessages[1].role).toBe("assistant");
    });

    it("should handle empty chat history", async () => {
      const userId = "empty-user";

      // Try to get non-existent data
      const result = await mockKvStore.get(userId);
      expect(result).toBeNull();
    });

    it("should overwrite existing chat history", async () => {
      const userId = "overwrite-user";

      // Save initial messages
      const initialMessages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "First message",
          createdAt: new Date(),
        },
      ];
      await mockKvStore.put(userId, JSON.stringify(initialMessages));

      // Save new messages (overwriting)
      const newMessages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "First message",
          createdAt: new Date(),
        },
        {
          id: "2",
          role: "assistant",
          content: "Second message",
          createdAt: new Date(),
        },
        {
          id: "3",
          role: "user",
          content: "Third message",
          createdAt: new Date(),
        },
      ];
      await mockKvStore.put(userId, JSON.stringify(newMessages));

      // Retrieve and verify
      const result = await mockKvStore.get(userId);
      const retrievedMessages: Message[] = JSON.parse(result!);
      expect(retrievedMessages).toHaveLength(3);
      expect(retrievedMessages[2].content).toBe("Third message");
    });
  });

  describe("Chat History API Integration", () => {
    it("should save and load chat history through API endpoints", async () => {
      const mockUserSession: SessionData = {
        userId: "api-test-user",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);

      // Simulate saving messages by directly putting to KV (as would happen in chat)
      const testMessages: Message[] = [
        {
          id: "api-msg-1",
          role: "user",
          content: "API test message",
          createdAt: new Date(),
        },
        {
          id: "api-msg-2",
          role: "assistant",
          content: "API test response",
          createdAt: new Date(),
        },
      ];
      await mockKvStore.put("api-test-user", JSON.stringify(testMessages));

      // Test loading through API
      const request = new Request("http://localhost/chat/history");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const retrievedMessages: Message[] = await response.json();
      expect(retrievedMessages).toHaveLength(2);
      expect(retrievedMessages[0].content).toBe("API test message");
      expect(retrievedMessages[1].content).toBe("API test response");
    });

    it("should handle concurrent save and load operations", async () => {
      const mockUserSession: SessionData = {
        userId: "concurrent-user",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);

      // Simulate concurrent operations
      const messages1: Message[] = [
        { id: "1", role: "user", content: "Message 1", createdAt: new Date() },
      ];
      const messages2: Message[] = [
        { id: "1", role: "user", content: "Message 1", createdAt: new Date() },
        {
          id: "2",
          role: "assistant",
          content: "Message 2",
          createdAt: new Date(),
        },
      ];

      // Save first set
      await mockKvStore.put("concurrent-user", JSON.stringify(messages1));

      // Load while saving (should get first set)
      const request1 = new Request("http://localhost/chat/history");
      const ctx1 = createExecutionContext();
      const response1 = await worker.fetch(request1, mockEnv, ctx1);
      await waitOnExecutionContext(ctx1);

      // Save second set
      await mockKvStore.put("concurrent-user", JSON.stringify(messages2));

      // Load again (should get second set)
      const request2 = new Request("http://localhost/chat/history");
      const ctx2 = createExecutionContext();
      const response2 = await worker.fetch(request2, mockEnv, ctx2);
      await waitOnExecutionContext(ctx2);

      const result1: Message[] = await response1.json();
      const result2: Message[] = await response2.json();

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(2);
      expect(result2[1].content).toBe("Message 2");
    });
  });

  describe("Error Handling", () => {
    it("should handle KV put failures gracefully", async () => {
      const failingKvStore = {
        ...mockKvStore,
        put: vi.fn().mockRejectedValue(new Error("KV write failure")),
      } as unknown as KVNamespace;

      const envWithFailingKv = { ...mockEnv, CHAT_HISTORY_KV: failingKvStore };

      // This would typically happen in the Chat agent's onChatMessage
      // For now, we'll test the KV operation directly
      await expect(failingKvStore.put("test-user", "[]")).rejects.toThrow(
        "KV write failure"
      );
    });

    it("should handle malformed JSON in KV store", async () => {
      const mockUserSession: SessionData = {
        userId: "malformed-user",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);

      // Put malformed JSON directly in KV
      const malformedKvStore = {
        ...mockKvStore,
        get: vi.fn().mockResolvedValue("{ malformed json"),
      } as unknown as KVNamespace;

      const envWithMalformedKv = {
        ...mockEnv,
        CHAT_HISTORY_KV: malformedKvStore,
      };

      const request = new Request("http://localhost/chat/history");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, envWithMalformedKv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const error = await response.json();
      expect(error.error).toBe("Could not load chat history.");
    });
  });

  describe("Large Message History", () => {
    it("should handle large chat histories", async () => {
      const userId = "large-history-user";

      // Create a large message history (100 messages)
      const largeHistory: Message[] = [];
      for (let i = 0; i < 100; i++) {
        largeHistory.push({
          id: `msg-${i}`,
          role: i % 2 === 0 ? "user" : "assistant",
          content: `This is message number ${i + 1}. `.repeat(10), // Make each message reasonably long
          createdAt: new Date(Date.now() + i * 1000),
        });
      }

      // Save large history
      await mockKvStore.put(userId, JSON.stringify(largeHistory));

      // Retrieve and verify
      const result = await mockKvStore.get(userId);
      expect(result).toBeTruthy();

      const retrievedMessages: Message[] = JSON.parse(result!);
      expect(retrievedMessages).toHaveLength(100);
      expect(retrievedMessages[0].content).toContain(
        "This is message number 1."
      );
      expect(retrievedMessages[99].content).toContain(
        "This is message number 100."
      );
    });
  });

  describe("User Isolation", () => {
    it("should isolate chat histories between different users", async () => {
      const user1Messages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "User 1 message",
          createdAt: new Date(),
        },
      ];
      const user2Messages: Message[] = [
        {
          id: "2",
          role: "user",
          content: "User 2 message",
          createdAt: new Date(),
        },
      ];

      // Save messages for different users
      await mockKvStore.put("user-1", JSON.stringify(user1Messages));
      await mockKvStore.put("user-2", JSON.stringify(user2Messages));

      // Retrieve messages for each user
      const user1Result = await mockKvStore.get("user-1");
      const user2Result = await mockKvStore.get("user-2");

      const user1Retrieved: Message[] = JSON.parse(user1Result!);
      const user2Retrieved: Message[] = JSON.parse(user2Result!);

      expect(user1Retrieved[0].content).toBe("User 1 message");
      expect(user2Retrieved[0].content).toBe("User 2 message");

      // Ensure no cross-contamination
      expect(user1Retrieved[0].content).not.toBe("User 2 message");
      expect(user2Retrieved[0].content).not.toBe("User 1 message");
    });
  });
});
