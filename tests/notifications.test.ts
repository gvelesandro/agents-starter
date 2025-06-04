import { describe, it, expect, vi } from "vitest";

vi.mock("agents/ai-chat-agent", () => ({
  AIChatAgent: class {
    messages: any[] = [];
    env: any;
    constructor({ env }: { env: any }) {
      this.env = env;
    }
    sql() {}
    async fetch() {
      return Promise.resolve(new Response());
    }
    async serializeDbOperation(fn: () => any) {
      return await fn();
    }
    async updateThreadMetadata() {}
    async saveMessages(m: any[]) {
      this.messages = m;
    }
  },
}));

vi.mock("agents", () => ({ routeAgentRequest: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ openai: () => ({}) }));

import { Chat } from "../src/server";

describe("Chat.executeTask", () => {
  it("adds scheduled message prefix", async () => {
    const chat = new Chat({ env: {} as any });
    await (chat as any).executeTask("do something", {} as any);
    expect((chat as any).messages[0].content).toContain("scheduled message");
  });
});
