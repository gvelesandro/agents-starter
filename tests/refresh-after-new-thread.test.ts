import {
  env as testEnv,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/server";
import { type SessionData } from "../src/auth/session";

// Mock getSession
vi.mock("../src/auth/session", async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return {
    ...actual,
    getSession: vi.fn(),
  };
});

const { getSession } = await import("../src/auth/session");
const mockGetSession = getSession as vi.MockedFunction<typeof getSession>;

describe("Refresh After New Thread Creation Bug", () => {
  let mockEnvInstance: any;

  beforeEach(() => {
    const kvStore = new Map<string, string>();
    mockEnvInstance = {
      ...testEnv,
      CHAT_HISTORY_KV: {
        get: (key: string) => Promise.resolve(kvStore.get(key) || null),
        put: (key: string, value: string) => {
          kvStore.set(key, value);
          return Promise.resolve();
        },
        delete: (key: string) => {
          kvStore.delete(key);
          return Promise.resolve();
        },
      },
    };
    mockGetSession.mockClear();
  });

  it("should not create duplicate threads when refreshing after new thread creation", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);

    // Simulate: User creates new thread (this happens in frontend)
    const newThreadId = `thread_${crypto.randomUUID()}`;

    // Step 1: Create thread on server (this now happens immediately in handleNewThread)
    const createRequest = new Request("http://localhost/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: newThreadId }),
    });

    const ctx1 = createExecutionContext();
    const createResponse = await worker.fetch(
      createRequest,
      mockEnvInstance,
      ctx1
    );
    await waitOnExecutionContext(ctx1);

    expect(createResponse.status).toBe(201);

    // Step 2: Simulate page refresh - frontend loads thread list
    const listRequest1 = new Request("http://localhost/threads");
    const ctx2 = createExecutionContext();
    const listResponse1 = await worker.fetch(
      listRequest1,
      mockEnvInstance,
      ctx2
    );
    await waitOnExecutionContext(ctx2);

    expect(listResponse1.status).toBe(200);
    const threadsAfterRefresh = await listResponse1.json();

    // Step 3: Verify the thread exists exactly once
    const matchingThreads = threadsAfterRefresh.filter(
      (t: any) => t.id === newThreadId
    );
    expect(matchingThreads).toHaveLength(1);

    // Step 4: Simulate frontend trying to load messages for this thread
    const messagesRequest = new Request(
      `http://localhost/threads/${newThreadId}`
    );
    const ctx3 = createExecutionContext();
    const messagesResponse = await worker.fetch(
      messagesRequest,
      mockEnvInstance,
      ctx3
    );
    await waitOnExecutionContext(ctx3);

    expect(messagesResponse.status).toBe(200);
    const messages = await messagesResponse.json();
    expect(Array.isArray(messages)).toBe(true);

    // Step 5: Fetch thread list again to ensure no duplication occurred
    const listRequest2 = new Request("http://localhost/threads");
    const ctx4 = createExecutionContext();
    const listResponse2 = await worker.fetch(
      listRequest2,
      mockEnvInstance,
      ctx4
    );
    await waitOnExecutionContext(ctx4);

    const threadsAfterMessageLoad = await listResponse2.json();

    // Still should be exactly one thread with this ID
    const finalMatchingThreads = threadsAfterMessageLoad.filter(
      (t: any) => t.id === newThreadId
    );
    expect(finalMatchingThreads).toHaveLength(1);

    // No threads with empty IDs should exist
    const emptyIdThreads = threadsAfterMessageLoad.filter(
      (t: any) => !t.id || t.id.trim() === ""
    );
    expect(emptyIdThreads).toHaveLength(0);
  });

  it("should handle the case where thread exists in URL but not on server", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);

    // Simulate: URL contains a thread ID that doesn't exist on server (old bug scenario)
    const nonExistentThreadId = `thread_${crypto.randomUUID()}`;

    // Try to load messages for non-existent thread
    const messagesRequest = new Request(
      `http://localhost/threads/${nonExistentThreadId}`
    );
    const ctx1 = createExecutionContext();
    const messagesResponse = await worker.fetch(
      messagesRequest,
      mockEnvInstance,
      ctx1
    );
    await waitOnExecutionContext(ctx1);

    expect(messagesResponse.status).toBe(200);
    const messages = await messagesResponse.json();
    expect(Array.isArray(messages)).toBe(true);
    expect(messages).toHaveLength(0); // Should return empty array for non-existent thread

    // Check that no duplicate or malformed thread was created
    const listRequest = new Request("http://localhost/threads");
    const ctx2 = createExecutionContext();
    const listResponse = await worker.fetch(listRequest, mockEnvInstance, ctx2);
    await waitOnExecutionContext(ctx2);

    const threads = await listResponse.json();

    // Should not have created the non-existent thread
    const matchingThreads = threads.filter(
      (t: any) => t.id === nonExistentThreadId
    );
    expect(matchingThreads).toHaveLength(0);

    // Should not have any threads with empty IDs
    const emptyIdThreads = threads.filter(
      (t: any) => !t.id || t.id.trim() === ""
    );
    expect(emptyIdThreads).toHaveLength(0);
  });

  it("should handle rapid refresh after thread creation", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);

    const newThreadId = `thread_${crypto.randomUUID()}`;

    // Create thread
    const createRequest = new Request("http://localhost/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: newThreadId }),
    });

    const ctx1 = createExecutionContext();
    const createResponse = await worker.fetch(
      createRequest,
      mockEnvInstance,
      ctx1
    );
    await waitOnExecutionContext(ctx1);

    expect(createResponse.status).toBe(201);

    // Simulate rapid multiple refreshes (multiple thread list requests)
    const refreshPromises = Array(5)
      .fill(null)
      .map(async () => {
        const listRequest = new Request("http://localhost/threads");
        const ctx = createExecutionContext();
        const response = await worker.fetch(listRequest, mockEnvInstance, ctx);
        await waitOnExecutionContext(ctx);
        return response.json();
      });

    const allRefreshResults = await Promise.all(refreshPromises);

    // All refreshes should return the same result
    allRefreshResults.forEach((threads) => {
      const matchingThreads = threads.filter((t: any) => t.id === newThreadId);
      expect(matchingThreads).toHaveLength(1);

      const emptyIdThreads = threads.filter(
        (t: any) => !t.id || t.id.trim() === ""
      );
      expect(emptyIdThreads).toHaveLength(0);
    });
  });
});
