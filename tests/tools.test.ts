import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  tool: (def: any) => def,
}));

const scheduleMock = vi.fn();
const getSchedulesMock = vi.fn();
const cancelMock = vi.fn();

vi.mock("agents", () => ({
  getCurrentAgent: () => ({
    agent: {
      schedule: scheduleMock,
      getSchedules: getSchedulesMock,
      cancelSchedule: cancelMock,
    },
  }),
}));

vi.mock("agents/schedule", () => ({
  unstable_scheduleSchema: {},
}));

import { tools, executions } from "../src/tools";

describe("tool implementations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scheduleTask works for scheduled", async () => {
    const res = await tools.scheduleTask.execute({
      when: { type: "scheduled", date: "2024" },
      description: "d",
    });
    expect(scheduleMock).toHaveBeenCalledWith("2024", "executeTask", "d");
    expect(res).toContain("scheduled");
  });

  it("scheduleTask handles no schedule", async () => {
    const res = await tools.scheduleTask.execute({
      when: { type: "no-schedule" },
      description: "d",
    } as any);
    expect(res).toBe("Not a valid schedule input");
  });

  it("scheduleTask throws on invalid type", async () => {
    await expect(
      tools.scheduleTask.execute({ when: { type: "bad" } as any, description: "d" })
    ).rejects.toThrow();
  });

  it("getScheduledTasks returns tasks", async () => {
    getSchedulesMock.mockReturnValue(["t1"]);
    const res = await tools.getScheduledTasks.execute({});
    expect(res).toEqual(["t1"]);
  });

  it("getScheduledTasks handles empty", async () => {
    getSchedulesMock.mockReturnValue([]);
    const res = await tools.getScheduledTasks.execute({});
    expect(res).toBe("No scheduled tasks found.");
  });

  it("cancelScheduledTask calls cancel", async () => {
    const res = await tools.cancelScheduledTask.execute({ taskId: "x" });
    expect(cancelMock).toHaveBeenCalledWith("x");
    expect(res).toContain("x");
  });

  it("getWeatherInformation execution", async () => {
    const res = await executions.getWeatherInformation({ city: "Paris" });
    expect(res).toContain("Paris");
  });

  it("getLocalTime returns value", async () => {
    const res = await tools.getLocalTime.execute({ location: "NY" });
    expect(res).toBe("10am");
  });
});
