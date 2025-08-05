/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 * Now supports both built-in tools and MCP (Model Context Protocol) tools
 */
import { tool } from "ai";
import { z } from "zod";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { unstable_scheduleSchema } from "agents/schedule";
import { mcpConnectionManager } from "./lib/mcp-connection";
import type { MCPTool } from "./types/mcp";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  parameters: z.object({ city: z.string() }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  },
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  parameters: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  },
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  parameters: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  },
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  parameters: z.object({
    taskId: z.string().describe("The ID of the task to cancel"),
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  },
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
};

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  },
};

/**
 * Enhanced tool system for MCP integration
 * These functions combine built-in tools with MCP tools for specific threads/agents
 */

/**
 * Get combined tools for a specific thread (built-in + MCP)
 * This will be called by the agent system to provide all available tools
 */
export async function getCombinedToolsForThread(
  threadId: string
): Promise<Record<string, any>> {
  // Start with built-in tools
  const combinedTools = { ...tools };

  // TODO: Add MCP tools based on thread's active agents
  // const mcpTools = await getMCPToolsForThread(threadId);
  // Object.assign(combinedTools, mcpTools);

  return combinedTools;
}

/**
 * Get combined executions for a specific thread (built-in + MCP)
 * This includes both confirmation-required and auto-execute functions
 */
export async function getCombinedExecutionsForThread(
  threadId: string
): Promise<Record<string, any>> {
  // Start with built-in executions
  const combinedExecutions = { ...executions };

  // TODO: Add MCP executions based on thread's active agents
  // const mcpExecutions = await getMCPExecutionsForThread(threadId);
  // Object.assign(combinedExecutions, mcpExecutions);

  return combinedExecutions;
}

/**
 * Create MCP tool wrapper that follows the same pattern as built-in tools
 * This converts MCP tools to the format expected by the AI system
 */
export function createMCPToolWrapper(mcpTool: MCPTool) {
  const { name, description, schema, requiresConfirmation, serverId } = mcpTool;

  if (requiresConfirmation) {
    // Create tool that requires confirmation (no execute function)
    return tool({
      description,
      parameters: z.object(schema.properties || {}),
      // No execute function = requires confirmation
    });
  } else {
    // Create auto-executing tool
    return tool({
      description,
      parameters: z.object(schema.properties || {}),
      execute: async (parameters: any) => {
        try {
          const execution = await mcpConnectionManager.executeTool(
            serverId,
            name,
            parameters
          );

          if (execution.error) {
            console.error(`MCP tool ${name} failed:`, execution.error);
            return `Tool temporarily unavailable: ${execution.error}`;
          }

          return execution.result;
        } catch (error) {
          console.error(`MCP tool execution error:`, error);
          return `Tool temporarily unavailable. Please try again later.`;
        }
      },
    });
  }
}

/**
 * Create MCP execution function for confirmation-required tools
 * This handles the actual execution after user confirmation
 */
export function createMCPExecutionWrapper(mcpTool: MCPTool) {
  return async (parameters: any) => {
    try {
      const execution = await mcpConnectionManager.executeTool(
        mcpTool.serverId,
        mcpTool.name,
        parameters
      );

      if (execution.error) {
        console.error(`MCP tool ${mcpTool.name} failed:`, execution.error);
        throw new Error(`Tool failed: ${execution.error}`);
      }

      return execution.result;
    } catch (error) {
      console.error(`MCP execution error:`, error);
      throw error;
    }
  };
}

// Export MCP utilities for use in other parts of the system
export { mcpConnectionManager } from "./lib/mcp-connection";
export type { MCPTool } from "./types/mcp";
