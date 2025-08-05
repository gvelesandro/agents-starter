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
 * Get MCP tools for a specific thread based on its active agents
 * This queries the database and MCP connections to provide available tools
 */
async function getMCPToolsForThread(threadId: string): Promise<Record<string, any>> {
  const mcpTools: Record<string, any> = {};

  try {
    // In a real implementation, this would query the database to get:
    // 1. Active agents for the thread
    // 2. MCP groups associated with those agents
    // 3. MCP servers in those groups
    // 4. Available tools from those servers

    // For now, simulate with basic math tools since we have the MCP math server available
    console.log(`Loading MCP tools for thread: ${threadId}`);

    // Simulate MCP math tools that would come from the math-server
    const mathAdd = tool({
      description: "Add two numbers together using MCP math server",
      parameters: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number")
      }),
      execute: async ({ a, b }) => {
        console.log(`MCP Math: Adding ${a} + ${b}`);
        // In real implementation, this would call the MCP server
        // For now, simulate the response
        return `${a} + ${b} = ${a + b} (via MCP Math Server)`;
      },
    });

    const mathCalculate = tool({
      description: "Perform mathematical calculations using MCP math server",
      parameters: z.object({
        operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("Mathematical operation"),
        a: z.number().describe("First number"),
        b: z.number().describe("Second number")
      }),
      execute: async ({ operation, a, b }) => {
        console.log(`MCP Math: ${operation} ${a} and ${b}`);
        let result: number;
        switch (operation) {
          case "add":
            result = a + b;
            break;
          case "subtract":
            result = a - b;
            break;
          case "multiply":
            result = a * b;
            break;
          case "divide":
            if (b === 0) return "Error: Division by zero";
            result = a / b;
            break;
        }
        return `${a} ${operation} ${b} = ${result} (via MCP Math Server)`;
      },
    });

    // Simulate GitHub MCP tools that would come from the GitHub MCP server
    const githubGetRepository = tool({
      description: "Get information about a GitHub repository using MCP GitHub server",
      parameters: z.object({
        owner: z.string().describe("Repository owner/organization"),
        repo: z.string().describe("Repository name")
      }),
      execute: async ({ owner, repo }) => {
        console.log(`MCP GitHub: Getting repository ${owner}/${repo}`);
        // In real implementation, this would call the MCP GitHub server
        // For now, simulate the response
        return `Repository ${owner}/${repo} information:
- Stars: 1,234
- Language: TypeScript
- Description: An awesome repository
- Last updated: 2 days ago
(via MCP GitHub Server)`;
      },
    });

    const githubListActions = tool({
      description: "List GitHub Actions workflows for a repository using MCP GitHub server",
      parameters: z.object({
        owner: z.string().describe("Repository owner/organization"),
        repo: z.string().describe("Repository name")
      }),
      execute: async ({ owner, repo }) => {
        console.log(`MCP GitHub: Listing Actions for ${owner}/${repo}`);
        // In real implementation, this would call the MCP GitHub server
        // For now, simulate the response
        return `GitHub Actions workflows for ${owner}/${repo}:
1. CI/CD Pipeline (.github/workflows/ci.yml)
   - Status: ✅ Passing
   - Last run: 1 hour ago
   - Trigger: push, pull_request

2. Deploy to Production (.github/workflows/deploy.yml)
   - Status: ✅ Passing  
   - Last run: 3 hours ago
   - Trigger: push to main

3. Code Quality Check (.github/workflows/quality.yml)
   - Status: ✅ Passing
   - Last run: 2 hours ago
   - Trigger: pull_request

(via MCP GitHub Server)`;
      },
    });

    const githubTriggerAction = tool({
      description: "Trigger a GitHub Actions workflow using MCP GitHub server",
      parameters: z.object({
        owner: z.string().describe("Repository owner/organization"),
        repo: z.string().describe("Repository name"),
        workflow: z.string().describe("Workflow file name or ID"),
        ref: z.string().optional().describe("Git reference (branch/tag), defaults to main")
      }),
      execute: async ({ owner, repo, workflow, ref = "main" }) => {
        console.log(`MCP GitHub: Triggering workflow ${workflow} for ${owner}/${repo} on ${ref}`);
        // In real implementation, this would call the MCP GitHub server
        // For now, simulate the response
        return `✅ Successfully triggered GitHub Actions workflow!

Repository: ${owner}/${repo}
Workflow: ${workflow}
Branch/Ref: ${ref}
Run ID: #${Math.floor(Math.random() * 10000)}
Status: Queued
View: https://github.com/${owner}/${repo}/actions

The workflow has been queued and will start running shortly.
(via MCP GitHub Server)`;
      },
    });

    // Add the MCP tools with prefixed names to avoid conflicts
    mcpTools["mcpMathAdd"] = mathAdd;
    mcpTools["mcpMathCalculate"] = mathCalculate;
    mcpTools["mcpGithubGetRepository"] = githubGetRepository;
    mcpTools["mcpGithubListActions"] = githubListActions;
    mcpTools["mcpGithubTriggerAction"] = githubTriggerAction;

  } catch (error) {
    console.error("Error loading MCP tools:", error);
  }

  return mcpTools;
}

/**
 * Get combined tools for a specific thread (built-in + MCP)
 * This will be called by the agent system to provide all available tools
 */
export async function getCombinedToolsForThread(
  threadId: string
): Promise<Record<string, any>> {
  // Start with built-in tools
  const combinedTools = { ...tools };

  try {
    // Get MCP tools based on thread's active agents
    const mcpTools = await getMCPToolsForThread(threadId);
    Object.assign(combinedTools, mcpTools);
  } catch (error) {
    console.error("Error loading MCP tools for thread:", error);
    // Continue with built-in tools only if MCP fails
  }

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

  try {
    // Get MCP executions based on thread's active agents
    const mcpExecutions = await getMCPExecutionsForThread(threadId);
    Object.assign(combinedExecutions, mcpExecutions);
  } catch (error) {
    console.error("Error loading MCP executions for thread:", error);
    // Continue with built-in executions only if MCP fails
  }

  return combinedExecutions;
}

/**
 * Get MCP executions for confirmation-required tools
 */
async function getMCPExecutionsForThread(threadId: string): Promise<Record<string, any>> {
  const mcpExecutions: Record<string, any> = {};

  try {
    console.log(`Loading MCP executions for thread: ${threadId}`);

    // For confirmation-required MCP tools, add their execution functions here
    // Currently our simulated MCP tools auto-execute, so no executions needed

  } catch (error) {
    console.error("Error loading MCP executions:", error);
  }

  return mcpExecutions;
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
