import { describe, it, expect, vi } from "vitest";

vi.mock("@ai-sdk/ui-utils", () => ({
  formatDataStreamPart: (type: string, data: any) => ({ type, data }),
}));

vi.mock("ai", () => ({
  convertToCoreMessages: (m: any) => m,
}));

import { processToolCalls } from "../src/utils";
import { APPROVAL } from "../src/shared";

const writer = { write: vi.fn() } as any;

describe("processToolCalls", () => {
  it("returns original messages when no tool invocation", async () => {
    const messages = [{ id: "1", role: "user", content: "hi" } as any];
    const result = await processToolCalls({
      tools: {},
      dataStream: writer,
      messages,
      executions: {},
    });
    expect(result).toEqual(messages);
  });

  it("executes tool when approved", async () => {
    const exec = vi.fn().mockResolvedValue("ok");
    const messages = [
      {
        id: "1",
        role: "assistant",
        parts: [
          {
            type: "tool-invocation",
            toolInvocation: {
              toolName: "t",
              state: "result",
              result: APPROVAL.YES,
              args: { a: 1 },
              toolCallId: "tc1",
            },
          },
        ],
      } as any,
    ];
    const out = await processToolCalls({
      tools: { t: {} } as any,
      dataStream: writer,
      messages,
      executions: { t: exec },
    });
    expect(exec).toHaveBeenCalled();
    expect(writer.write).toHaveBeenCalledWith({
      type: "tool_result",
      data: { toolCallId: "tc1", result: "ok" },
    });
    expect(out[out.length - 1].parts[0].toolInvocation.result).toBe("ok");
  });

  it("handles denied execution", async () => {
    writer.write.mockClear();
    const messages = [
      {
        id: "1",
        role: "assistant",
        parts: [
          {
            type: "tool-invocation",
            toolInvocation: {
              toolName: "t",
              state: "result",
              result: APPROVAL.NO,
              args: {},
              toolCallId: "tc2",
            },
          },
        ],
      } as any,
    ];
    const out = await processToolCalls({
      tools: { t: {} } as any,
      dataStream: writer,
      messages,
      executions: { t: vi.fn() },
    });
    expect(writer.write).toHaveBeenCalled();
    expect(out[out.length - 1].parts[0].toolInvocation.result).toContain("denied");
  });
});
