import {
  env as testEnv,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/server";
import { type SessionData } from "../src/auth/session";

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

// Mock KVNamespace
const mockKvGet = vi.fn();
const mockKvPut = vi.fn();
const mockKvDelete = vi.fn();
const mockChatHistoryKv = {
  get: mockKvGet,
  put: mockKvPut,
  delete: mockKvDelete,
} as unknown as KVNamespace;

const createMockEnv = (): Env => ({
  AUTH_GITHUB_CLIENT_ID: "test_client_id",
  AUTH_GITHUB_CLIENT_SECRET: "test_client_secret",
  AUTH_GITHUB_AUTHORIZED_USERNAMES: "",
  SESSION_SECRET: "test_session_secret",
  OPENAI_API_KEY: "test_openai_key",
  CHAT_HISTORY_KV: mockChatHistoryKv,
  ...testEnv,
}) as Env;

let mockEnvInstance: Env;

beforeEach(() => {
  vi.resetAllMocks();
  mockEnvInstance = createMockEnv();
});

describe("Threads API", () => {
  describe("GET /threads", () => {
    it("should return 401 if user is not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);
      const request = new Request("http://localhost/threads", {
        headers: { "Accept": "application/json" }
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({ error: "Not authenticated. Please log in." });
    });

    it("should return empty array when no threads exist", async () => {
      const mockUserSession: SessionData = {
        userId: "user123",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);
      mockKvGet.mockResolvedValue(null);

      const request = new Request("http://localhost/threads");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual([]);
    });

    it("should return threads when they exist", async () => {
      const mockUserSession: SessionData = {
        userId: "user123",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);
      
      const request = new Request("http://localhost/threads");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(Array.isArray(json)).toBe(true);
    });

    it("should return empty array when KV is not available", async () => {
      const mockUserSession: SessionData = {
        userId: "user123",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);

      const envWithoutKv = { ...mockEnvInstance, CHAT_HISTORY_KV: undefined as any };
      const request = new Request("http://localhost/threads");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, envWithoutKv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual([]);
    });
  });

  describe("POST /threads", () => {
    it("should create a new thread", async () => {
      const mockUserSession: SessionData = {
        userId: "user123",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);

      const requestBody = { title: "New Chat Thread" };
      const request = new Request("http://localhost/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json).toHaveProperty("id");
      expect(json).toHaveProperty("updatedAt");
    });

    it("should return 500 when KV is not available for POST", async () => {
      const mockUserSession: SessionData = {
        userId: "user123",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);

      const envWithoutKv = { ...mockEnvInstance, CHAT_HISTORY_KV: undefined as any };
      const requestBody = { title: "New Chat Thread" };
      const request = new Request("http://localhost/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, envWithoutKv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toEqual({ error: "KV not available" });
    });
  });

  describe("GET /threads/:threadId", () => {
    it("should return thread messages when thread exists", async () => {
      const mockUserSession: SessionData = {
        userId: "user123",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);

      const request = new Request("http://localhost/threads/thread123");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(Array.isArray(json)).toBe(true);
    });

    it("should return empty array when thread does not exist", async () => {
      const mockUserSession: SessionData = {
        userId: "user123",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);
      mockKvGet.mockResolvedValue(null);

      const request = new Request("http://localhost/threads/nonexistent");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual([]);
    });
  });

  describe("DELETE /threads/:threadId", () => {
    it("should delete thread and return success", async () => {
      const mockUserSession: SessionData = {
        userId: "user123",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);

      const request = new Request("http://localhost/threads/thread2", {
        method: "DELETE",
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toHaveProperty("success");
    });

    it("should return 500 when KV is not available for DELETE", async () => {
      const mockUserSession: SessionData = {
        userId: "user123",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockUserSession);

      const envWithoutKv = { ...mockEnvInstance, CHAT_HISTORY_KV: undefined as any };
      const request = new Request("http://localhost/threads/thread123", {
        method: "DELETE",
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, envWithoutKv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toEqual({ error: "KV not available" });
    });
  });
});