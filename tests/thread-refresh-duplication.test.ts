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

describe("Thread Refresh Duplication Bug", () => {
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

  it("should not create duplicate threads after refresh", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);

    // Step 1: Create a new thread via POST
    const threadId = `thread_${crypto.randomUUID()}`;
    const createRequest = new Request("http://localhost/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });

    const ctx1 = createExecutionContext();
    const createResponse = await worker.fetch(createRequest, mockEnvInstance, ctx1);
    await waitOnExecutionContext(ctx1);

    expect(createResponse.status).toBe(201);

    // Step 2: Fetch threads list (simulating refresh)
    const listRequest = new Request("http://localhost/threads");
    const ctx2 = createExecutionContext();
    const listResponse = await worker.fetch(listRequest, mockEnvInstance, ctx2);
    await waitOnExecutionContext(ctx2);

    expect(listResponse.status).toBe(200);
    const threads = await listResponse.json();

    // Step 3: Verify no duplicates exist
    const threadsWithSameId = threads.filter((t: any) => t.id === threadId);
    expect(threadsWithSameId).toHaveLength(1);

    // Step 4: Verify no threads with empty/undefined IDs
    const threadsWithEmptyId = threads.filter((t: any) => !t.id || t.id.trim() === "");
    expect(threadsWithEmptyId).toHaveLength(0);

    // Step 5: Check that all threads have valid UUID format
    const validThreads = threads.filter((t: any) => 
      t.id === "default" || t.id.startsWith("thread_")
    );
    expect(validThreads).toHaveLength(threads.length);
  });

  it("should handle thread creation with empty body gracefully", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);

    // Create thread with empty body
    const createRequest = new Request("http://localhost/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // Empty body, no threadId
    });

    const ctx1 = createExecutionContext();
    const createResponse = await worker.fetch(createRequest, mockEnvInstance, ctx1);
    await waitOnExecutionContext(ctx1);

    expect(createResponse.status).toBe(201);
    const createdThread = await createResponse.json();

    // Should create a thread with auto-generated UUID, not empty ID
    expect(createdThread.id).toBeDefined();
    expect(createdThread.id).not.toBe("");
    expect(createdThread.id.startsWith("thread_")).toBe(true);

    // Verify thread appears correctly in list
    const listRequest = new Request("http://localhost/threads");
    const ctx2 = createExecutionContext();
    const listResponse = await worker.fetch(listRequest, mockEnvInstance, ctx2);
    await waitOnExecutionContext(ctx2);

    const threads = await listResponse.json();
    const matchingThreads = threads.filter((t: any) => t.id === createdThread.id);
    expect(matchingThreads).toHaveLength(1);
  });

  it("should handle thread creation with malformed threadId", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);

    // Test various malformed thread IDs
    const malformedIds = ["", "   ", null, undefined, "\n\t"];

    for (const malformedId of malformedIds) {
      const createRequest = new Request("http://localhost/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: malformedId }),
      });

      const ctx = createExecutionContext();
      const createResponse = await worker.fetch(createRequest, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(createResponse.status).toBe(201);
      const createdThread = await createResponse.json();

      // Should auto-generate a valid thread ID
      expect(createdThread.id).toBeDefined();
      expect(createdThread.id.startsWith("thread_")).toBe(true);
    }

    // Verify all threads in list are valid
    const listRequest = new Request("http://localhost/threads");
    const ctx = createExecutionContext();
    const listResponse = await worker.fetch(listRequest, mockEnvInstance, ctx);
    await waitOnExecutionContext(ctx);

    const threads = await listResponse.json();
    
    // No empty or duplicate thread IDs
    const threadIds = threads.map((t: any) => t.id);
    const uniqueIds = new Set(threadIds);
    expect(uniqueIds.size).toBe(threadIds.length); // No duplicates

    const emptyIds = threadIds.filter((id: string) => !id || id.trim() === "");
    expect(emptyIds).toHaveLength(0); // No empty IDs
  });

  it("should handle concurrent thread creation and refresh", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);

    // Create multiple threads concurrently
    const threadIds = Array(3).fill(null).map(() => `thread_${crypto.randomUUID()}`);
    
    const createPromises = threadIds.map(threadId => {
      const createRequest = new Request("http://localhost/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      
      const ctx = createExecutionContext();
      return worker.fetch(createRequest, mockEnvInstance, ctx).then(async (response) => {
        await waitOnExecutionContext(ctx);
        return response;
      });
    });

    const createResponses = await Promise.all(createPromises);
    
    // All should succeed
    createResponses.forEach(response => {
      expect(response.status).toBe(201);
    });

    // Fetch final thread list
    const listRequest = new Request("http://localhost/threads");
    const ctx = createExecutionContext();
    const listResponse = await worker.fetch(listRequest, mockEnvInstance, ctx);
    await waitOnExecutionContext(ctx);

    const threads = await listResponse.json();

    // Verify each thread ID appears exactly once
    threadIds.forEach(threadId => {
      const matchingThreads = threads.filter((t: any) => t.id === threadId);
      expect(matchingThreads).toHaveLength(1);
    });

    // Verify no duplicate or empty threads
    const threadIds_inList = threads.map((t: any) => t.id);
    const uniqueIds = new Set(threadIds_inList);
    expect(uniqueIds.size).toBe(threadIds_inList.length);
  });
});