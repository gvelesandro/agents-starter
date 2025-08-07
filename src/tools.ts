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
 * Get MCP tools for a specific thread based on its active agents and assigned MCP servers
 * This queries the database and establishes MCP connections to provide real available tools
 */
async function getMCPToolsForThread(threadId: string): Promise<Record<string, any>> {
  const mcpTools: Record<string, any> = {};

  try {
    console.log(`[MCP] Loading MCP tools for thread: ${threadId}`);

    // Since we're in a server-side context, we need access to the database
    // This will be called from the server context where env.DB is available
    // For now, we'll return tools based on connected MCP servers in the connection manager

    // Get all available MCP server configs and their connections
    // In a real implementation, we would:
    // 1. Query thread_agents to get active agents for this thread
    // 2. Query agent_mcp_groups to get MCP groups for those agents  
    // 3. Query mcp_servers to get servers in those groups
    // 4. Query thread_mcp_servers to get directly assigned MCP servers
    // 5. Connect to those servers and get their tools

    // For now, we'll work with any connected servers in the connection manager
    // This will be enhanced when we have the database context available

    // Check if we have any test MCP connections available
    // The math server is running at localhost:56460
    const testMathServerConfig = {
      id: "test-math-server",
      name: "Test Math Server", 
      url: "http://localhost:56460/sse",
      transport: "sse" as const,
      userId: "demo-user",
      groupId: "test-group",
      auth: { type: "none" as const },
      status: "disconnected" as const,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      // Try to connect to the math server if available
      const connection = await mcpConnectionManager.connectToServer(testMathServerConfig);
      
      if (connection.status === "connected" && connection.tools.length > 0) {
        console.log(`[MCP] Connected to ${testMathServerConfig.name}, found ${connection.tools.length} tools`);
        
        // Convert MCP tools to the format expected by the AI system
        for (const mcpTool of connection.tools) {
          const toolName = `mcp_${mcpTool.serverId}_${mcpTool.name}`;
          mcpTools[toolName] = createMCPToolWrapper(mcpTool);
          console.log(`[MCP] Added tool: ${toolName} - ${mcpTool.description}`);
        }
      }
    } catch (error) {
      console.log(`[MCP] Could not connect to test math server: ${error}`);
      // This is expected if the server isn't running, continue without it
    }

    // TODO: Implement real database integration
    // This would look something like:
    /*
    if (env?.DB) {
      // Get thread agents and their MCP groups
      const threadAgents = await env.DB.prepare(`
        SELECT DISTINCT a.id, a.name, amg.group_id
        FROM thread_agents ta
        JOIN agents a ON ta.agent_id = a.id  
        JOIN agent_mcp_groups amg ON a.id = amg.agent_id
        WHERE ta.thread_id = ? AND ta.is_active = TRUE
      `).bind(threadId).all();

      // Get directly assigned MCP servers for this thread
      const threadMCPServers = await env.DB.prepare(`
        SELECT mis.* FROM thread_mcp_servers tms
        JOIN mcp_servers_independent mis ON tms.server_id = mis.id
        WHERE tms.thread_id = ? AND tms.is_active = TRUE
      `).bind(threadId).all();

      // Get MCP servers from agent groups
      const groupIds = threadAgents.results.map(agent => agent.group_id);
      if (groupIds.length > 0) {
        const groupServers = await env.DB.prepare(`
          SELECT ms.* FROM mcp_servers ms
          WHERE ms.group_id IN (${groupIds.map(() => '?').join(',')}) AND ms.is_enabled = TRUE
        `).bind(...groupIds).all();
        
        // Connect to all servers and collect their tools
        for (const serverConfig of [...threadMCPServers.results, ...groupServers.results]) {
          try {
            const connection = await mcpConnectionManager.connectToServer(serverConfig);
            if (connection.status === "connected") {
              for (const mcpTool of connection.tools) {
                const toolName = `mcp_${mcpTool.serverId}_${mcpTool.name}`;
                mcpTools[toolName] = createMCPToolWrapper(mcpTool);
              }
            }
          } catch (error) {
            console.error(`Failed to connect to MCP server ${serverConfig.name}:`, error);
          }
        }
      }
    }
    */

  } catch (error) {
    console.error("[MCP] Error loading MCP tools:", error);
  }

  console.log(`[MCP] Loaded ${Object.keys(mcpTools).length} MCP tools for thread ${threadId}`);
  return mcpTools;
}

/**
 * Get combined tools for a specific thread (built-in + MCP)
 * This will be called by the agent system to provide all available tools
 */
export async function getCombinedToolsForThread(
  threadId: string,
  db?: any // D1Database instance
): Promise<Record<string, any>> {
  // Start with built-in tools
  const combinedTools = { ...tools };

  try {
    // Get MCP tools based on thread's active agents and assigned servers
    let mcpTools: Record<string, any> = {};
    
    if (db) {
      // Use database-aware version from mcp-connection.ts
      mcpTools = await import('./lib/mcp-connection').then(module => 
        module.getMCPToolsForThread(threadId, db)
      );
    } else {
      // Fallback to local implementation for threads without database context
      mcpTools = await getMCPToolsForThread(threadId);
    }
    
    Object.assign(combinedTools, mcpTools);
  } catch (error) {
    console.error("Error loading MCP tools for thread:", error);
    // Continue with built-in tools only if MCP fails
  }

  console.log(`[TOOLS] Combined tools for thread ${threadId}: ${Object.keys(combinedTools).length} tools`);
  return combinedTools;
}

/**
 * Get combined executions for a specific thread (built-in + MCP)
 * This includes both confirmation-required and auto-execute functions
 */
export async function getCombinedExecutionsForThread(
  threadId: string,
  db?: any // D1Database instance  
): Promise<Record<string, any>> {
  // Start with built-in executions
  const combinedExecutions = { ...executions };

  try {
    // Get MCP executions based on thread's active agents and assigned servers
    let mcpExecutions: Record<string, any> = {};
    
    if (db) {
      // Use database-aware version from mcp-connection.ts
      mcpExecutions = await import('./lib/mcp-connection').then(module =>
        module.getMCPExecutionsForThread(threadId, db)
      );
    } else {
      // Fallback to local implementation
      mcpExecutions = await getMCPExecutionsForThread(threadId);
    }
    
    Object.assign(combinedExecutions, mcpExecutions);
  } catch (error) {
    console.error("Error loading MCP executions for thread:", error);
    // Continue with built-in executions only if MCP fails
  }

  console.log(`[TOOLS] Combined executions for thread ${threadId}: ${Object.keys(combinedExecutions).length} handlers`);
  return combinedExecutions;
}

/**
 * Get MCP executions for confirmation-required tools
 * This handles the actual execution after user confirmation for tools that require approval
 */
async function getMCPExecutionsForThread(threadId: string): Promise<Record<string, any>> {
  const mcpExecutions: Record<string, any> = {};

  try {
    console.log(`[MCP] Loading MCP executions for thread: ${threadId}`);

    // Get all MCP connections for this thread and create execution functions
    // for any tools that require confirmation
    
    // For tools that were added in getMCPToolsForThread and require confirmation,
    // we need to create corresponding execution functions here
    
    // The execution functions will use the mcpConnectionManager to actually
    // call the MCP server tools after user confirmation

    // TODO: Query database to get MCP servers for this thread
    // and create execution functions for confirmation-required tools

    // Example of how this would work:
    /*
    if (env?.DB) {
      const mcpServers = await getMCPServersForThread(threadId, env.DB);
      
      for (const server of mcpServers) {
        const connection = mcpConnectionManager.getConnectionStatus(server.id);
        if (connection?.status === "connected") {
          for (const tool of connection.tools) {
            if (tool.requiresConfirmation) {
              const executionName = `mcp_${tool.serverId}_${tool.name}`;
              mcpExecutions[executionName] = createMCPExecutionWrapper(tool);
            }
          }
        }
      }
    }
    */

  } catch (error) {
    console.error("[MCP] Error loading MCP executions:", error);
  }

  console.log(`[MCP] Loaded ${Object.keys(mcpExecutions).length} MCP execution handlers for thread ${threadId}`);
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
