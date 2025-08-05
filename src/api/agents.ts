/**
 * Agent Management API Functions
 * Handles CRUD operations for agents, MCP groups, and thread-agent assignments
 * These functions are called from the main server router
 */

import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { Agent, MCPGroup } from "../types/mcp";

// Validation schemas
const createAgentSchema = z.object({
    name: z.string().min(1).max(50),
    description: z.string().optional(),
    persona: z.string().optional(),
    mcpGroupIds: z.array(z.string()),
    color: z.string().default("blue"),
});

const updateAgentSchema = createAgentSchema.partial();

const createMCPGroupSchema = z.object({
    name: z.string().min(1).max(50),
    description: z.string().optional(),
    color: z.string().default("blue"),
});

const addAgentToThreadSchema = z.object({
    agentId: z.string(),
    role: z.enum(["primary", "specialist"]).default("primary"),
    reason: z.string().optional(),
});

/**
 * Helper function to parse and validate JSON request body
 */
async function parseJsonBody<T>(
    request: Request,
    schema: z.ZodSchema<T>
): Promise<T> {
    try {
        const body = await request.json();
        return schema.parse(body);
    } catch (error) {
        throw new Error(
            `Invalid request body: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

/**
 * Get user ID from session (placeholder for now)
 */
function getUserId(): string {
    return "demo-user"; // TODO: Get from auth context
}

// Agent CRUD operations
export async function getAgents(env: Env): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        const agents = await db
            .prepare(
                `
      SELECT * FROM agents 
      WHERE user_id = ? 
      ORDER BY last_used DESC, created_at DESC
    `
            )
            .bind(userId)
            .all();

        // Get MCP group associations for each agent
        const agentsWithGroups = await Promise.all(
            agents.results.map(async (agent: any) => {
                const groups = await db
                    .prepare(
                        `
          SELECT group_id FROM agent_mcp_groups 
          WHERE agent_id = ?
        `
                    )
                    .bind(agent.id)
                    .all();

                return {
                    ...agent,
                    mcpGroupIds: groups.results.map((g: any) => g.group_id),
                    lastUsed: agent.last_used ? new Date(agent.last_used) : undefined,
                    createdAt: new Date(agent.created_at),
                    updatedAt: new Date(agent.updated_at),
                };
            })
        );

        return new Response(JSON.stringify({ agents: agentsWithGroups }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error fetching agents:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch agents" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}

export async function createAgent(
    request: Request,
    env: Env
): Promise<Response> {
    try {
        const userId = getUserId();
        const data = await parseJsonBody(request, createAgentSchema);
        const db = env.DB;

        const agentId = uuidv4();
        const now = new Date().toISOString();

        // Create agent
        await db
            .prepare(
                `
      INSERT INTO agents (id, name, description, persona, user_id, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
            )
            .bind(
                agentId,
                data.name,
                data.description || null,
                data.persona || null,
                userId,
                data.color,
                now,
                now
            )
            .run();

        // Associate with MCP groups
        if (data.mcpGroupIds.length > 0) {
            const stmt = db.prepare(`
        INSERT INTO agent_mcp_groups (agent_id, group_id, user_id)
        VALUES (?, ?, ?)
      `);

            for (const groupId of data.mcpGroupIds) {
                await stmt.bind(agentId, groupId, userId).run();
            }
        }

        const agent: Agent = {
            id: agentId,
            name: data.name,
            description: data.description,
            persona: data.persona,
            mcpGroupIds: data.mcpGroupIds,
            userId,
            color: data.color || "blue",
            isActive: false,
            usageCount: 0,
            createdAt: new Date(now),
            updatedAt: new Date(now),
        };

        return new Response(JSON.stringify({ agent }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error creating agent:", error);
        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error ? error.message : "Failed to create agent",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

export async function updateAgent(
    request: Request,
    env: Env,
    agentId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const data = await parseJsonBody(request, updateAgentSchema);
        const db = env.DB;

        const now = new Date().toISOString();

        // Update agent
        const updateFields = [];
        const updateValues = [];

        if (data.name !== undefined) {
            updateFields.push("name = ?");
            updateValues.push(data.name);
        }
        if (data.description !== undefined) {
            updateFields.push("description = ?");
            updateValues.push(data.description);
        }
        if (data.persona !== undefined) {
            updateFields.push("persona = ?");
            updateValues.push(data.persona);
        }
        if (data.color !== undefined) {
            updateFields.push("color = ?");
            updateValues.push(data.color);
        }

        updateFields.push("updated_at = ?");
        updateValues.push(now);
        updateValues.push(agentId, userId);

        await db
            .prepare(
                `
      UPDATE agents 
      SET ${updateFields.join(", ")} 
      WHERE id = ? AND user_id = ?
    `
            )
            .bind(...updateValues)
            .run();

        // Update MCP group associations if provided
        if (data.mcpGroupIds !== undefined) {
            // Delete existing associations
            await db
                .prepare(
                    `
        DELETE FROM agent_mcp_groups 
        WHERE agent_id = ? AND user_id = ?
      `
                )
                .bind(agentId, userId)
                .run();

            // Add new associations
            if (data.mcpGroupIds.length > 0) {
                const stmt = db.prepare(`
          INSERT INTO agent_mcp_groups (agent_id, group_id, user_id)
          VALUES (?, ?, ?)
        `);

                for (const groupId of data.mcpGroupIds) {
                    await stmt.bind(agentId, groupId, userId).run();
                }
            }
        }

        return new Response(
            JSON.stringify({ message: "Agent updated successfully" }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error updating agent:", error);
        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error ? error.message : "Failed to update agent",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

export async function deleteAgent(
    env: Env,
    agentId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        // Delete agent (cascading deletes will handle associations)
        await db
            .prepare(
                `
      DELETE FROM agents 
      WHERE id = ? AND user_id = ?
    `
            )
            .bind(agentId, userId)
            .run();

        return new Response(
            JSON.stringify({ message: "Agent deleted successfully" }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error deleting agent:", error);
        return new Response(JSON.stringify({ error: "Failed to delete agent" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}

// Thread-Agent Management
export async function getThreadAgents(
    env: Env,
    threadId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        const threadAgents = await db
            .prepare(
                `
      SELECT ta.*, a.name as agent_name, a.color
      FROM thread_agents ta
      JOIN agents a ON ta.agent_id = a.id
      WHERE ta.thread_id = ? AND ta.user_id = ? AND ta.is_active = TRUE
      ORDER BY ta.added_at ASC
    `
            )
            .bind(threadId, userId)
            .all();

        const activeAgents = threadAgents.results.map((ta: any) => ({
            agentId: ta.agent_id,
            agentName: ta.agent_name,
            role: ta.role,
            addedAt: new Date(ta.added_at),
            addedReason: ta.added_reason,
            toolGroups: [], // TODO: Populate with actual tool groups
        }));

        return new Response(JSON.stringify({ activeAgents }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error fetching thread agents:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch thread agents" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

export async function addAgentToThread(
    request: Request,
    env: Env,
    threadId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const data = await parseJsonBody(request, addAgentToThreadSchema);
        const db = env.DB;

        const assignmentId = uuidv4();
        const now = new Date().toISOString();

        // Add agent to thread
        await db
            .prepare(
                `
      INSERT INTO thread_agents (id, thread_id, agent_id, user_id, role, added_reason, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
            )
            .bind(
                assignmentId,
                threadId,
                data.agentId,
                userId,
                data.role,
                data.reason || null,
                now
            )
            .run();

        // Update agent usage stats
        await db
            .prepare(
                `
      UPDATE agents 
      SET usage_count = usage_count + 1, last_used = ?
      WHERE id = ? AND user_id = ?
    `
            )
            .bind(now, data.agentId, userId)
            .run();

        return new Response(
            JSON.stringify({ message: "Agent added to thread successfully" }),
            {
                status: 201,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error adding agent to thread:", error);
        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to add agent to thread",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

export async function removeAgentFromThread(
    env: Env,
    threadId: string,
    agentId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        const now = new Date().toISOString();

        // Mark agent as inactive in thread (soft delete)
        await db
            .prepare(
                `
      UPDATE thread_agents 
      SET is_active = FALSE, removed_at = ?
      WHERE thread_id = ? AND agent_id = ? AND user_id = ? AND is_active = TRUE
    `
            )
            .bind(now, threadId, agentId, userId)
            .run();

        return new Response(
            JSON.stringify({ message: "Agent removed from thread successfully" }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error removing agent from thread:", error);
        return new Response(
            JSON.stringify({ error: "Failed to remove agent from thread" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

// MCP Group management
export async function getMCPGroups(env: Env): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        const groups = await db
            .prepare(
                `
      SELECT * FROM mcp_groups 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `
            )
            .bind(userId)
            .all();

        const groupsWithServers = await Promise.all(
            groups.results.map(async (group: any) => {
                const servers = await db
                    .prepare(
                        `
          SELECT id FROM mcp_servers 
          WHERE group_id = ? AND user_id = ?
        `
                    )
                    .bind(group.id, userId)
                    .all();

                return {
                    ...group,
                    serverIds: servers.results.map((s: any) => s.id),
                    createdAt: new Date(group.created_at),
                };
            })
        );

        return new Response(JSON.stringify({ groups: groupsWithServers }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error fetching MCP groups:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch MCP groups" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

export async function createMCPGroup(
    request: Request,
    env: Env
): Promise<Response> {
    try {
        const userId = getUserId();
        const data = await parseJsonBody(request, createMCPGroupSchema);
        const db = env.DB;

        const groupId = uuidv4();
        const now = new Date().toISOString();

        await db
            .prepare(
                `
      INSERT INTO mcp_groups (id, name, description, color, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
            )
            .bind(
                groupId,
                data.name,
                data.description || null,
                data.color,
                userId,
                now,
                now
            )
            .run();

        const group: MCPGroup = {
            id: groupId,
            name: data.name,
            description: data.description,
            color: data.color || "blue",
            serverIds: [],
            userId,
            createdAt: new Date(now),
        };

        return new Response(JSON.stringify({ group }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error creating MCP group:", error);
        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error ? error.message : "Failed to create MCP group",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
