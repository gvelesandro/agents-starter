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
    createSessionCookie: vi.fn(),
    clearSessionCookie: vi.fn(),
  };
});

const { getSession, createSessionCookie, clearSessionCookie } = await import("../src/auth/session");
const mockGetSession = getSession as vi.MockedFunction<typeof getSession>;
const mockCreateSessionCookie = createSessionCookie as vi.MockedFunction<typeof createSessionCookie>;
const mockClearSessionCookie = clearSessionCookie as vi.MockedFunction<typeof clearSessionCookie>;

const createMockEnv = (): Env => ({
  AUTH_GITHUB_CLIENT_ID: "test_client_id",
  AUTH_GITHUB_CLIENT_SECRET: "test_client_secret",
  AUTH_GITHUB_AUTHORIZED_USERNAMES: "testuser,admin",
  SESSION_SECRET: "test_session_secret",
  OPENAI_API_KEY: "test_openai_key",
  CHAT_HISTORY_KV: {} as KVNamespace,
  ...testEnv,
}) as Env;

let mockEnvInstance: Env;

beforeEach(() => {
  vi.resetAllMocks();
  mockEnvInstance = createMockEnv();
  mockCreateSessionCookie.mockReturnValue("__session=mocked_cookie; HttpOnly; Path=/");
  mockClearSessionCookie.mockReturnValue("__session=; Max-Age=0; Path=/");
});

describe("Authentication Routes", () => {
  describe("GET /auth/github", () => {
    it("should redirect to GitHub OAuth", async () => {
      const request = new Request("http://localhost/auth/github");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(302);
      const location = response.headers.get("Location");
      expect(location).toContain("https://github.com/login/oauth/authorize");
      expect(location).toContain("client_id=");
      expect(location).toContain("scope=");
    });
  });

  describe("GET /auth/me", () => {
    it("should return user info when authenticated", async () => {
      const mockSession: SessionData = {
        userId: "123",
        username: "testuser",
      };
      mockGetSession.mockResolvedValue(mockSession);

      const request = new Request("http://localhost/auth/me");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        username: "testuser",
        userId: "123",
      });
    });

    it("should return 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = new Request("http://localhost/auth/me");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({ error: "Not authenticated" });
    });
  });

  describe("GET /auth/logout", () => {
    it("should clear session and redirect", async () => {
      const request = new Request("http://localhost/auth/logout");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/");
      expect(response.headers.get("Set-Cookie")).toContain("__session=");
      expect(mockClearSessionCookie).toHaveBeenCalled();
    });
  });

  describe("GET /check-open-ai-key", () => {
    it("should return true when API key is set", async () => {
      const request = new Request("http://localhost/check-open-ai-key");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ success: true });
    });

    it("should return false when API key is not set", async () => {
      const envWithoutKey = { ...mockEnvInstance, OPENAI_API_KEY: "" };
      const request = new Request("http://localhost/check-open-ai-key");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, envWithoutKey, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ success: false });
    });
  });

  describe("GitHub OAuth Callback", () => {
    it("should handle missing code parameter", async () => {
      const request = new Request("http://localhost/auth/github/callback");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain("Invalid OAuth state or code");
    });

    it("should handle missing state parameter", async () => {
      const request = new Request("http://localhost/auth/github/callback?code=test123");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain("Invalid OAuth state or code");
    });
  });
});