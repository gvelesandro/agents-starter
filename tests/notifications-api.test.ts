import {
  env as testEnv,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/server"; // Adjust if your worker entry point is different
import { type SessionData } from "../src/auth/session";
import { type TaskNotification } from "../src/server"; // Adjust if your TaskNotification type is elsewhere

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
const mockChatHistoryKv = {
  get: mockKvGet,
  put: mockKvPut,
  // delete is not used by notification endpoints yet
} as unknown as KVNamespace;

// Helper to create a mock environment
const createMockEnv = (): Env => ({
  AUTH_GITHUB_CLIENT_ID: "test_client_id",
  AUTH_GITHUB_CLIENT_SECRET: "test_client_secret",
  AUTH_GITHUB_AUTHORIZED_USERNAMES: "",
  SESSION_SECRET: "test_session_secret_for_notifications_api", // Ensure unique if needed
  OPENAI_API_KEY: "test_openai_key_for_notifications_api",
  CHAT_HISTORY_KV: mockChatHistoryKv,
  ...testEnv, // Includes other necessary test environment variables
}) as Env; // Cast to your Env type

let mockEnvInstance: Env;

beforeEach(() => {
  vi.resetAllMocks(); // Reset mocks before each test
  mockEnvInstance = createMockEnv();
});

const mockUserSession: SessionData = {
  userId: "user123",
  username: "testuser",
};

const sampleNotifications: TaskNotification[] = [
  { id: "notif1", userId: "user123", message: "Task A completed", createdAt: new Date().toISOString(), read: false, type: 'task_completion', taskDescription: "Do A" },
  { id: "notif2", userId: "user123", message: "Task B failed", createdAt: new Date().toISOString(), read: true, type: 'task_failure', taskDescription: "Do B" },
];

describe("Notifications API", () => {
  describe("GET /notifications", () => {
    it("should return 401 if user is not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);
      const request = new Request("http://localhost/notifications");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({ error: "Not authenticated. Please log in." }); // Or your specific error message
    });

    it("should return an empty array if authenticated user has no notifications", async () => {
      mockGetSession.mockResolvedValue(mockUserSession);
      mockKvGet.mockResolvedValue(null); // No notifications in KV

      const request = new Request("http://localhost/notifications");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json: TaskNotification[] = await response.json();
      expect(json).toEqual([]);
    });

    it("should return notifications for an authenticated user", async () => {
      mockGetSession.mockResolvedValue(mockUserSession);
      mockKvGet.mockResolvedValue(JSON.stringify(sampleNotifications));

      const request = new Request("http://localhost/notifications");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const json: TaskNotification[] = await response.json();
      expect(json).toEqual(sampleNotifications);
    });

    it("should return 500 if KV store fails (e.g., JSON parse error)", async () => {
      mockGetSession.mockResolvedValue(mockUserSession);
      mockKvGet.mockResolvedValue("this is not json"); // Invalid JSON

      const request = new Request("http://localhost/notifications");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toEqual({ error: "Could not load notifications" });
    });

    it("should return 500 if KV namespace is not available", async () => {
        mockGetSession.mockResolvedValue(mockUserSession);
        const envWithoutKv = { ...mockEnvInstance, CHAT_HISTORY_KV: undefined as any };

        const request = new Request("http://localhost/notifications");
        const ctx = createExecutionContext();
        const response = await worker.fetch(request, envWithoutKv, ctx);
        await waitOnExecutionContext(ctx);

        expect(response.status).toBe(500);
        const json = await response.json();
        expect(json).toEqual({ error: "Notification service not available" });
      });
  });

  describe("POST /notifications/:notificationId/read", () => {
    it("should return 401 if user is not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);
      const request = new Request("http://localhost/notifications/notif1/read", { method: "POST" });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
    });

    it("should mark a notification as read and return the updated notification", async () => {
      mockGetSession.mockResolvedValue(mockUserSession);
      // Deep copy for modification
      const initialNotifications = JSON.parse(JSON.stringify(sampleNotifications));
      mockKvGet.mockResolvedValue(JSON.stringify(initialNotifications));

      const request = new Request("http://localhost/notifications/notif1/read", { method: "POST" });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const updatedNotification: TaskNotification = await response.json();
      expect(updatedNotification.id).toBe("notif1");
      expect(updatedNotification.read).toBe(true);

      // Verify KV store was updated
      expect(mockKvPut).toHaveBeenCalledTimes(1);
      const updatedKvStore = JSON.parse(mockKvPut.mock.calls[0][1]);
      const changedNotifInKv = updatedKvStore.find((n: TaskNotification) => n.id === "notif1");
      expect(changedNotifInKv.read).toBe(true);
    });

    it("should return 404 if notification to mark as read does not exist", async () => {
      mockGetSession.mockResolvedValue(mockUserSession);
      mockKvGet.mockResolvedValue(JSON.stringify(sampleNotifications));

      const request = new Request("http://localhost/notifications/nonexistent/read", { method: "POST" });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json).toEqual({ error: "Notification not found" });
    });

    it("should handle marking an already read notification (idempotency)", async () => {
      mockGetSession.mockResolvedValue(mockUserSession);
      // "notif2" is already read in sampleNotifications
      mockKvGet.mockResolvedValue(JSON.stringify(sampleNotifications));

      const request = new Request("http://localhost/notifications/notif2/read", { method: "POST" });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const updatedNotification: TaskNotification = await response.json();
      expect(updatedNotification.id).toBe("notif2");
      expect(updatedNotification.read).toBe(true);

      // KV.put should still be called if the logic updates and saves,
      // or not called if it checks `read` status first and skips put.
      // Current server logic in previous steps updates and puts regardless.
      // If the server logic was changed to: if (!notification.read) { kv.put... } then this would be 0.
      // Based on the provided example, it does kv.put if found.
      // The prompt also said "if (!notifications[notificationIndex].read) { await kv.put...}"
      // So if it's already read, kv.put might not be called if that optimization is in place.
      // The current server.ts code from step 2 does:
      // if (!notifications[notificationIndex].read) {
      //   notifications[notificationIndex].read = true;
      //   await kv.put(notificationKey, JSON.stringify(notifications));
      // }
      // So, if already read, put is NOT called.
      expect(mockKvPut).not.toHaveBeenCalled();
    });

    it("should return 404 if no notifications list exists for user", async () => {
        mockGetSession.mockResolvedValue(mockUserSession);
        mockKvGet.mockResolvedValue(null); // Simulate no notifications key for the user

        const request = new Request("http://localhost/notifications/notif1/read", { method: "POST" });
        const ctx = createExecutionContext();
        const response = await worker.fetch(request, mockEnvInstance, ctx);
        await waitOnExecutionContext(ctx);

        expect(response.status).toBe(404);
        const json = await response.json();
        expect(json).toEqual({ error: "Notifications not found for user" });
      });

    it("should return 500 if KV fails during POST", async () => {
      mockGetSession.mockResolvedValue(mockUserSession);
      mockKvGet.mockResolvedValue(JSON.stringify(sampleNotifications));
      mockKvPut.mockRejectedValue(new Error("KV put error"));

      const request = new Request("http://localhost/notifications/notif1/read", { method: "POST" });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnvInstance, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toEqual({ error: "Could not mark notification as read" });
    });
  });
});
