import { describe, it, expect, vi } from "vitest";

vi.mock("agents/ai-chat-agent", () => ({
  AIChatAgent: class {
    messages: any[] = [];
    sql() {}
    fetch() {
      return Promise.resolve(new Response());
    }
  },
}));

vi.mock("agents", () => ({ routeAgentRequest: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ openai: () => ({}) }));

import { Chat } from "../src/server";

describe("Chat.generateThreadTitle", () => {
  it("uses first user message", () => {
    const chat = new Chat({ env: {} as any });
    (chat as any).messages = [{ role: "user", content: "Hello world" }];
    const title = (chat as any).generateThreadTitle();
    expect(title).toBe("Hello world");
  });

  it("falls back to default", () => {
    const chat = new Chat({ env: {} as any });
    (chat as any).messages = [];
    const title = (chat as any).generateThreadTitle();
    expect(title).toContain("New Chat");
  });
});
