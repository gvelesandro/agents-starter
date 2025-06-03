import {
  env as testEnv, // Renamed to avoid conflict with Env type if imported directly
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/server"; // Adjust path to your worker entry point
import { type SessionData } from "../src/auth/session"; // Adjust path
import type { Message } from "ai"; // Adjust path if necessary

// Mock getSession from src/auth/session.ts
vi.mock("../src/auth/session", async (importOriginal) => {
  const actual = (await importOriginal()) as object; // Cast to object
  return {
    ...actual,
    getSession: vi.fn(),
  };
});
const { getSession } = await import("../src/auth/session");
const mockGetSession = getSession as vi.MockedFunction<typeof getSession>;

// Mock KVNamespace
const mockKvGet = vi.fn();
const mockKvPut = vi.fn(); // Although not directly testing put here, good for consistency
const mockChatHistoryKv = {
  get: mockKvGet,
  put: mockKvPut,
} as unknown as KVNamespace;

const createMockEnv = (): Env =>
  ({
    AUTH_GITHUB_CLIENT_ID: "test_client_id",
    AUTH_GITHUB_CLIENT_SECRET: "test_client_secret",
    AUTH_GITHUB_AUTHORIZED_USERNAMES: "",
    SESSION_SECRET: "test_session_secret",
    OPENAI_API_KEY: "test_openai_key",
    CHAT_HISTORY_KV: mockChatHistoryKv,
    // Populate with other variables from the existing `env` if necessary, or mock them.
    // For properties from the 'cloudflare:test' env, they might need to be merged or handled.
    // Example: AI: testEnv.AI (if AI is part of your Env and available in cloudflare:test's env)
  }) as Env; // Cast to Env to satisfy type requirements, ensure all required fields are present or mocked

let mockEnvInstance: Env; // Use a different name to avoid conflict with the global `env` from cloudflare:test

beforeEach(() => {
  vi.resetAllMocks();
  // Create a fresh mock environment for each test
  // We merge with `testEnv` from `cloudflare:test` to include any bindings it provides,
  // overriding with our specific mocks where needed (like CHAT_HISTORY_KV).
  mockEnvInstance = { ...testEnv, ...createMockEnv() };
});

declare module "cloudflare:test" {
  // Controls the type of `import("cloudflare:test").env`
  interface ProvidedEnv extends Env {} // Assuming Env is your global Worker environment type
}

describe("Chat worker", () => {
  it("responds with Not found for unknown routes", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);
    const request = new Request("http://example.com/unknownroute");
    const ctx = createExecutionContext();
    // Use the merged mockEnvInstance here
    const response = await worker.fetch(request, mockEnvInstance, ctx);
    await waitOnExecutionContext(ctx);
    expect(await response.text()).toBe("Not found");
    expect(response.status).toBe(404);
  });
});

describe("GET /chat/history endpoint", () => {
  it("should return 401 if user is not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const request = new Request("http://localhost/chat/history", {
      headers: { "Accept": "application/json" }
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnvInstance, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toEqual({ error: "Not authenticated. Please log in." });
  });

  it("should return an empty array if no history is found for an authenticated user", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);
    mockKvGet.mockResolvedValue(null); // No history in KV

    const request = new Request("http://localhost/chat/history");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnvInstance, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const messages = await response.json();
    expect(messages).toEqual([]);
    expect(mockKvGet).toHaveBeenCalledWith("user123:thread:default");
  });

  it("should return chat history if found for an authenticated user", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);

    const mockHistory: Message[] = [
      { id: "1", role: "user", content: "Hello", createdAt: new Date() },
      {
        id: "2",
        role: "assistant",
        content: "Hi there!",
        createdAt: new Date(),
      },
    ];
    mockKvGet.mockResolvedValue(JSON.stringify(mockHistory));

    const request = new Request("http://localhost/chat/history");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnvInstance, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const messages: Message[] = await response.json();
    // Dates will be stringified, then re-parsed. For comparison, re-stringify or parse createdAt.
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe("Hello");
    expect(messages[1].content).toBe("Hi there!");
    expect(mockKvGet).toHaveBeenCalledWith("user123:thread:default");
  });

  it("should return 500 if CHAT_HISTORY_KV is not configured", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);

    // Create an environment instance where CHAT_HISTORY_KV is explicitly undefined
    const envWithoutKv = {
      ...mockEnvInstance,
      CHAT_HISTORY_KV: undefined as any,
    };

    const request = new Request("http://localhost/chat/history");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, envWithoutKv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual([]);
  });

  it("should return 500 if KV store returns invalid JSON", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);
    mockKvGet.mockResolvedValue("this is not json");

    const request = new Request("http://localhost/chat/history");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnvInstance, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Could not load chat history.");
  });

  it("should return 500 if KV get fails unexpectedly", async () => {
    const mockUserSession: SessionData = {
      userId: "user123",
      username: "testuser",
    };
    mockGetSession.mockResolvedValue(mockUserSession);
    mockKvGet.mockRejectedValue(new Error("KV network error"));

    const request = new Request("http://localhost/chat/history");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnvInstance, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Could not load chat history.");
    expect(json.details).toBe("KV network error");
  });
});
