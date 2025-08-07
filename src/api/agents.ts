/**
 * Agent Management API Functions
 * Handles CRUD operations for agents, MCP groups, and thread-agent assignments
 * These functions are called from the main server router
 */

import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { Agent, MCPGroup } from "../types/mcp";

// Type definition for Cloudflare Worker environment
interface Env {
    DB: any; // D1Database type
    [key: string]: any;
}

// Validation schemas
const createAgentSchema = z.object({
    name: z.string().min(1).max(50),
    description: z.string().optional(),
    persona: z.string().optional(),
    mcpGroupIds: z.array(z.string()),
    mcpServerIds: z.array(z.string()).optional().default([]),
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

const addMCPServerToThreadSchema = z.object({
    serverId: z.string(),
    reason: z.string().optional(),
});

const createMCPServerSchema = z.object({
    name: z.string().min(1).max(50),
    url: z.string().url(),
    transport: z.enum(["websocket", "sse"]),
    groupId: z.string(),
    authType: z.enum(["none", "apikey", "basic", "oauth2", "custom"]).default("none"),
    credentials: z.object({
        apiKey: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        oauth2: z.object({
            clientId: z.string(),
            clientSecret: z.string().optional(),
            authUrl: z.string().url(),
            tokenUrl: z.string().url(),
            scopes: z.array(z.string()).default([]),
        }).optional(),
        customHeaders: z.record(z.string()).optional(),
    }).optional(),
    isEnabled: z.boolean().default(true),
});

const updateMCPServerSchema = createMCPServerSchema.partial();

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

        // Get MCP group and server associations for each agent
        const agentsWithAssociations = await Promise.all(
            agents.results.map(async (agent: any) => {
                // Get MCP group associations
                const groups = await db
                    .prepare(`
          SELECT group_id FROM agent_mcp_groups 
          WHERE agent_id = ?
        `)
                    .bind(agent.id)
                    .all();

                // Get direct MCP server associations
                const servers = await db
                    .prepare(`
          SELECT server_id FROM agent_mcp_servers 
          WHERE agent_id = ?
        `)
                    .bind(agent.id)
                    .all();

                return {
                    ...agent,
                    mcpGroupIds: groups.results.map((g: any) => g.group_id),
                    mcpServerIds: servers.results.map((s: any) => s.server_id),
                    lastUsed: agent.last_used ? new Date(agent.last_used) : undefined,
                    createdAt: new Date(agent.created_at),
                    updatedAt: new Date(agent.updated_at),
                };
            })
        );

        return new Response(JSON.stringify({ agents: agentsWithAssociations }), {
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

        // Associate with independent MCP servers
        if (data.mcpServerIds && data.mcpServerIds.length > 0) {
            const stmt = db.prepare(`
        INSERT INTO agent_mcp_servers (agent_id, server_id, user_id)
        VALUES (?, ?, ?)
      `);

            for (const serverId of data.mcpServerIds) {
                await stmt.bind(agentId, serverId, userId).run();
            }
        }

        const agent: Agent = {
            id: agentId,
            name: data.name,
            description: data.description,
            persona: data.persona,
            mcpGroupIds: data.mcpGroupIds,
            mcpServerIds: data.mcpServerIds || [],
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
                .prepare(`
        DELETE FROM agent_mcp_groups 
        WHERE agent_id = ? AND user_id = ?
      `)
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

        // Update MCP server associations if provided
        if (data.mcpServerIds !== undefined) {
            // Delete existing associations
            await db
                .prepare(`
        DELETE FROM agent_mcp_servers 
        WHERE agent_id = ? AND user_id = ?
      `)
                .bind(agentId, userId)
                .run();

            // Add new associations
            if (data.mcpServerIds.length > 0) {
                const stmt = db.prepare(`
          INSERT INTO agent_mcp_servers (agent_id, server_id, user_id)
          VALUES (?, ?, ?)
        `);

                for (const serverId of data.mcpServerIds) {
                    await stmt.bind(agentId, serverId, userId).run();
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

        console.log(`[API] Loading thread agents for threadId: ${threadId}, userId: ${userId}`);

        const threadAgents = await db
            .prepare(
                `
      SELECT ta.agent_id, ta.role, ta.added_at, ta.added_reason, 
             a.name as agent_name, a.description, a.color, a.is_active, 
             a.usage_count, a.last_used, a.created_at, a.updated_at
      FROM thread_agents ta
      JOIN agents a ON ta.agent_id = a.id
      WHERE ta.thread_id = ? AND ta.user_id = ? AND ta.is_active = TRUE
        AND ta.added_at = (
          SELECT MAX(ta2.added_at) 
          FROM thread_agents ta2 
          WHERE ta2.agent_id = ta.agent_id 
            AND ta2.thread_id = ta.thread_id 
            AND ta2.user_id = ta.user_id 
            AND ta2.is_active = TRUE
        )
      ORDER BY ta.added_at ASC
    `
            )
            .bind(threadId, userId)
            .all();

        console.log(`[API] Thread agents query results:`, threadAgents.results);

        const activeAgents = await Promise.all(
            threadAgents.results.map(async (ta: any) => {
                // Get MCP group associations for each agent
                const groups = await db
                    .prepare(
                        `
          SELECT group_id FROM agent_mcp_groups 
          WHERE agent_id = ?
        `
                    )
                    .bind(ta.agent_id)
                    .all();

                return {
                    id: ta.agent_id,
                    name: ta.agent_name,
                    description: ta.description,
                    color: ta.color || 'blue',
                    isActive: ta.is_active,
                    usageCount: ta.usage_count || 0,
                    lastUsed: ta.last_used ? new Date(ta.last_used) : undefined,
                    createdAt: new Date(ta.created_at),
                    updatedAt: new Date(ta.updated_at),
                    mcpGroupIds: groups.results.map((g: any) => g.group_id),
                    userId: userId,
                    role: ta.role,
                    addedAt: new Date(ta.added_at),
                    addedReason: ta.added_reason,
                    toolGroups: [], // TODO: Populate with actual tool groups
                };
            })
        );

        console.log(`[API] Processed active agents:`, activeAgents);

        return new Response(JSON.stringify({ agents: activeAgents }), {
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

// Thread-MCP Server Management
export async function getThreadMCPServers(
    env: Env,
    threadId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        console.log(`[API] Loading thread MCP servers for threadId: ${threadId}, userId: ${userId}`);

        const threadServers = await db
            .prepare(
                `
      SELECT tms.server_id, tms.added_at, tms.added_reason, 
             mis.name, mis.description, mis.url, mis.transport, mis.auth_type,
             mis.is_enabled, mis.status, mis.tools, mis.last_tested,
             mis.created_at, mis.updated_at
      FROM thread_mcp_servers tms
      JOIN mcp_servers_independent mis ON tms.server_id = mis.id
      WHERE tms.thread_id = ? AND tms.user_id = ? AND tms.is_active = TRUE
        AND tms.added_at = (
          SELECT MAX(tms2.added_at) 
          FROM thread_mcp_servers tms2 
          WHERE tms2.server_id = tms.server_id 
            AND tms2.thread_id = tms.thread_id 
            AND tms2.user_id = tms.user_id 
            AND tms2.is_active = TRUE
        )
      ORDER BY tms.added_at ASC
    `
            )
            .bind(threadId, userId)
            .all();

        console.log(`[API] Thread MCP servers query results:`, threadServers.results);

        const activeServers = threadServers.results.map((ts: any) => ({
            id: ts.server_id,
            name: ts.name,
            description: ts.description,
            url: ts.url,
            transport: ts.transport,
            authType: ts.auth_type,
            isEnabled: ts.is_enabled,
            status: ts.status,
            tools: ts.tools ? JSON.parse(ts.tools) : [],
            lastTested: ts.last_tested ? new Date(ts.last_tested) : undefined,
            createdAt: new Date(ts.created_at),
            updatedAt: new Date(ts.updated_at),
            userId: userId,
            addedAt: new Date(ts.added_at),
            addedReason: ts.added_reason,
        }));

        console.log(`[API] Processed active MCP servers:`, activeServers);

        return new Response(JSON.stringify({ servers: activeServers }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error fetching thread MCP servers:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch thread MCP servers" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

export async function addMCPServerToThread(
    request: Request,
    env: Env,
    threadId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const data = await parseJsonBody(request, addMCPServerToThreadSchema);
        const db = env.DB;

        const assignmentId = uuidv4();
        const now = new Date().toISOString();

        // Add MCP server to thread
        await db
            .prepare(
                `
      INSERT INTO thread_mcp_servers (id, thread_id, server_id, user_id, added_reason, added_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
            )
            .bind(
                assignmentId,
                threadId,
                data.serverId,
                userId,
                data.reason || null,
                now
            )
            .run();

        return new Response(
            JSON.stringify({ message: "MCP server added to thread successfully" }),
            {
                status: 201,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error adding MCP server to thread:", error);
        return new Response(
            JSON.stringify({
                error:
                    error instanceof z.ZodError
                        ? "Invalid request data"
                        : "Failed to add MCP server to thread",
            }),
            {
                status: error instanceof z.ZodError ? 400 : 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

export async function removeMCPServerFromThread(
    env: Env,
    threadId: string,
    serverId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        const now = new Date().toISOString();

        // Mark MCP server as inactive in thread (soft delete)
        await db
            .prepare(
                `
      UPDATE thread_mcp_servers 
      SET is_active = FALSE, removed_at = ?
      WHERE thread_id = ? AND server_id = ? AND user_id = ? AND is_active = TRUE
    `
            )
            .bind(now, threadId, serverId, userId)
            .run();

        return new Response(
            JSON.stringify({ message: "MCP server removed from thread successfully" }),
            {
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error removing MCP server from thread:", error);
        return new Response(
            JSON.stringify({ error: "Failed to remove MCP server from thread" }),
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
          SELECT id, name, url, transport, status, is_enabled FROM mcp_servers 
          WHERE group_id = ? AND user_id = ?
        `
                    )
                    .bind(group.id, userId)
                    .all();

                return {
                    ...group,
                    serverIds: servers.results.map((s: any) => s.id),
                    servers: servers.results.map((s: any) => ({
                        id: s.id,
                        name: s.name,
                        url: s.url,
                        transport: s.transport,
                        status: s.status,
                        isEnabled: s.is_enabled,
                    })),
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

export async function createMCPServer(
    request: Request,
    env: Env
): Promise<Response> {
    try {
        const userId = getUserId();
        const data = await parseJsonBody(request, createMCPServerSchema);
        const db = env.DB;

        const serverId = uuidv4();
        const now = new Date().toISOString();

        // Encrypt credentials if provided
        let encryptedCredentials = null;
        if (data.credentials) {
            // In a real implementation, you would encrypt these credentials
            // For now, we'll store them as JSON (not secure for production)
            encryptedCredentials = JSON.stringify(data.credentials);
        }

        await db
            .prepare(
                `
      INSERT INTO mcp_servers (id, name, url, transport, user_id, group_id, auth_type, encrypted_credentials, is_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
            )
            .bind(
                serverId,
                data.name,
                data.url,
                data.transport,
                userId,
                data.groupId,
                data.authType || 'none',
                encryptedCredentials,
                data.isEnabled ?? true,
                now,
                now
            )
            .run();

        const server = {
            id: serverId,
            name: data.name,
            url: data.url,
            transport: data.transport,
            userId,
            groupId: data.groupId,
            authType: data.authType || 'none',
            status: 'disconnected' as const,
            isEnabled: data.isEnabled ?? true,
            createdAt: new Date(now),
            updatedAt: new Date(now),
        };

        return new Response(JSON.stringify({ server }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error creating MCP server:", error);
        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error ? error.message : "Failed to create MCP server",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

export async function updateMCPServer(
    request: Request,
    env: Env,
    serverId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const data = await parseJsonBody(request, updateMCPServerSchema);
        const db = env.DB;

        const now = new Date().toISOString();

        // Encrypt credentials if provided
        let encryptedCredentials = null;
        if (data.credentials) {
            encryptedCredentials = JSON.stringify(data.credentials);
        }

        const updateFields = [];
        const updateValues = [];

        if (data.name !== undefined) {
            updateFields.push('name = ?');
            updateValues.push(data.name);
        }
        if (data.url !== undefined) {
            updateFields.push('url = ?');
            updateValues.push(data.url);
        }
        if (data.transport !== undefined) {
            updateFields.push('transport = ?');
            updateValues.push(data.transport);
        }
        if (data.authType !== undefined) {
            updateFields.push('auth_type = ?');
            updateValues.push(data.authType);
        }
        if (encryptedCredentials !== null) {
            updateFields.push('encrypted_credentials = ?');
            updateValues.push(encryptedCredentials);
        }
        if (data.isEnabled !== undefined) {
            updateFields.push('is_enabled = ?');
            updateValues.push(data.isEnabled);
        }

        updateFields.push('updated_at = ?');
        updateValues.push(now);
        updateValues.push(serverId, userId);

        await db
            .prepare(
                `
      UPDATE mcp_servers 
      SET ${updateFields.join(', ')}
      WHERE id = ? AND user_id = ?
    `
            )
            .bind(...updateValues)
            .run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error updating MCP server:", error);
        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error ? error.message : "Failed to update MCP server",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

export async function deleteMCPServer(
    env: Env,
    serverId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        await db
            .prepare(
                `
      DELETE FROM mcp_servers 
      WHERE id = ? AND user_id = ?
    `
            )
            .bind(serverId, userId)
            .run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error deleting MCP server:", error);
        return new Response(
            JSON.stringify({
                error:
                    error instanceof Error ? error.message : "Failed to delete MCP server",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

// Independent MCP Server Management
export async function getIndependentMCPServers(env: Env): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        const servers = await db
            .prepare(`
                SELECT 
                    id, name, description, url, transport, auth_type, auth_config,
                    is_enabled, status, tools, last_tested, created_at, updated_at
                FROM mcp_servers_independent 
                WHERE user_id = ? 
                ORDER BY name ASC
            `)
            .bind(userId)
            .all();

        const formattedServers = servers.results.map((server: any) => ({
            id: server.id,
            name: server.name,
            description: server.description,
            url: server.url,
            transport: server.transport,
            authType: server.auth_type,
            authConfig: server.auth_config ? JSON.parse(server.auth_config) : undefined,
            isEnabled: Boolean(server.is_enabled),
            status: server.status,
            tools: server.tools ? JSON.parse(server.tools) : undefined,
            lastTested: server.last_tested ? new Date(server.last_tested) : undefined,
            createdAt: new Date(server.created_at),
            updatedAt: new Date(server.updated_at)
        }));

        return new Response(JSON.stringify({ servers: formattedServers }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("Error fetching independent MCP servers:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch MCP servers" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

export async function createIndependentMCPServer(
    request: Request,
    env: Env
): Promise<Response> {
    try {
        const userId = getUserId();
        const body: any = await request.json();
        const data = {
            name: body.name as string,
            description: body.description as string | undefined,
            url: body.url as string,
            transport: (body.transport as 'websocket' | 'sse') || 'websocket',
            authType: (body.authType as 'none' | 'apikey' | 'basic' | 'oauth2' | 'custom') || 'none',
            credentials: body.credentials,
            isEnabled: body.isEnabled !== undefined ? (body.isEnabled as boolean) : true
        };
        const db = env.DB;

        const serverId = uuidv4();
        const now = new Date().toISOString();

        await db
            .prepare(`
                INSERT INTO mcp_servers_independent 
                (id, name, description, url, transport, auth_type, auth_config, is_enabled, user_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
                serverId,
                data.name,
                data.description || null,
                data.url,
                data.transport,
                data.authType,
                data.credentials ? JSON.stringify(data.credentials) : null,
                data.isEnabled,
                userId,
                now,
                now
            )
            .run();

        return new Response(
            JSON.stringify({
                server: {
                    id: serverId,
                    name: data.name,
                    description: data.description,
                    url: data.url,
                    transport: data.transport,
                    authType: data.authType,
                    credentials: data.credentials,
                    isEnabled: data.isEnabled,
                    createdAt: new Date(now),
                    updatedAt: new Date(now)
                }
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error creating independent MCP server:", error);
        return new Response(
            JSON.stringify({ error: "Failed to create MCP server" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

export async function updateIndependentMCPServer(
    request: Request,
    env: Env,
    serverId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const body: any = await request.json();
        const data = {
            name: body.name as string | undefined,
            description: body.description as string | undefined,
            url: body.url as string | undefined,
            transport: body.transport as 'websocket' | 'sse' | undefined,
            authType: body.authType as 'none' | 'apikey' | 'basic' | 'oauth2' | 'custom' | undefined,
            credentials: body.credentials,
            isEnabled: body.isEnabled as boolean | undefined
        };
        const db = env.DB;

        const updateFields: string[] = [];
        const updateValues: any[] = [];

        if (data.name !== undefined) {
            updateFields.push('name = ?');
            updateValues.push(data.name);
        }
        if (data.description !== undefined) {
            updateFields.push('description = ?');
            updateValues.push(data.description);
        }
        if (data.url !== undefined) {
            updateFields.push('url = ?');
            updateValues.push(data.url);
        }
        if (data.transport !== undefined) {
            updateFields.push('transport = ?');
            updateValues.push(data.transport);
        }
        if (data.authType !== undefined) {
            updateFields.push('auth_type = ?');
            updateValues.push(data.authType);
        }
        if (data.credentials !== undefined) {
            updateFields.push('auth_config = ?');
            updateValues.push(data.credentials ? JSON.stringify(data.credentials) : null);
        }
        if (data.isEnabled !== undefined) {
            updateFields.push('is_enabled = ?');
            updateValues.push(data.isEnabled);
        }

        if (updateFields.length === 0) {
            return new Response(
                JSON.stringify({ error: "No fields to update" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        updateFields.push('updated_at = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(serverId, userId);

        await db
            .prepare(`
                UPDATE mcp_servers_independent 
                SET ${updateFields.join(', ')}
                WHERE id = ? AND user_id = ?
            `)
            .bind(...updateValues)
            .run();

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error updating independent MCP server:", error);
        return new Response(
            JSON.stringify({ error: "Failed to update MCP server" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

export async function deleteIndependentMCPServer(
    env: Env,
    serverId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        // Remove server from all groups first
        await db
            .prepare('DELETE FROM mcp_group_servers WHERE server_id = ? AND user_id = ?')
            .bind(serverId, userId)
            .run();

        // Delete the server
        await db
            .prepare('DELETE FROM mcp_servers_independent WHERE id = ? AND user_id = ?')
            .bind(serverId, userId)
            .run();

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error deleting independent MCP server:", error);
        return new Response(
            JSON.stringify({ error: "Failed to delete MCP server" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
export async function testIndependentMCPServer(
    env: Env,
    serverId: string
): Promise<Response> {
    try {
        const userId = getUserId();
        const db = env.DB;

        // Get server details
        const server = await db
            .prepare('SELECT * FROM mcp_servers_independent WHERE id = ? AND user_id = ?')
            .bind(serverId, userId)
            .first();

        if (!server) {
            return new Response(
                JSON.stringify({ error: "Server not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // Extract server details
        const serverUrl = server.url as string;
        const transport = server.transport as string;

        console.log(`=== MCP SERVER TEST START ===`);
        console.log(`Server ID: ${serverId}`);
        console.log(`Server Name: ${server.name}`);
        console.log(`Server URL: ${serverUrl}`);
        console.log(`Transport: ${transport}`);
        console.log(`Auth Type: ${server.auth_type}`);

        // Initialize test result
        let testResult: { success: boolean; message: string; tools?: string[] };

        try {
            // Execute test with overall timeout
            testResult = await Promise.race([
                testServerConnection(serverUrl, transport),
                new Promise<{ success: boolean; message: string; tools?: string[] }>((_, reject) =>
                    setTimeout(() => reject(new Error("Overall test timeout after 10 seconds")), 10000)
                )
            ]);
        } catch (timeoutError) {
            console.error("Test timeout:", timeoutError);
            testResult = {
                success: false,
                message: timeoutError instanceof Error ? timeoutError.message : "Test timeout",
                tools: []
            };
        }

        console.log(`=== TEST COMPLETED ===`);
        console.log(`Result: ${testResult.success ? 'SUCCESS' : 'FAILURE'}`);
        console.log(`Message: ${testResult.message}`);

        // Update server status and test timestamp
        const now = new Date().toISOString();
        await db
            .prepare(`
                UPDATE mcp_servers_independent 
                SET status = ?, tools = ?, last_tested = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
            `)
            .bind(
                testResult.success ? 'connected' : 'error',
                JSON.stringify(testResult.tools || []),
                now,
                now,
                serverId,
                userId
            )
            .run();

        return new Response(
            JSON.stringify(testResult),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error in testIndependentMCPServer:", error);
        return new Response(
            JSON.stringify({
                success: false,
                message: "Test failed: " + (error instanceof Error ? error.message : 'Unknown error')
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

// Helper function to test server connection and discover tools
async function testServerConnection(
    serverUrl: string,
    transport: string
): Promise<{ success: boolean; message: string; tools?: string[] }> {

    if (transport === "websocket") {
        return {
            success: false,
            message: 'WebSocket testing not implemented yet. Please use SSE transport for now.',
            tools: []
        };
    }

    // SSE server testing with tool discovery
    console.log(`Testing SSE connection to: ${serverUrl}`);

    // Validate URL
    try {
        const urlObj = new URL(serverUrl);
        console.log(`Valid URL - Protocol: ${urlObj.protocol}, Host: ${urlObj.host}`);
    } catch (error) {
        return {
            success: false,
            message: `Invalid server URL: ${serverUrl}`,
            tools: []
        };
    }

    try {
        // For external URLs, use a simpler connectivity test to avoid auth issues
        const urlObj = new URL(serverUrl);
        if (urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
            console.log(`Testing external MCP server: ${serverUrl}`);

            // Try to discover tools for external servers too
            try {
                const toolsResult = await discoverMCPTools(serverUrl);
                if (toolsResult.success) {
                    return {
                        success: true,
                        message: `✅ External MCP server connected successfully. Found ${toolsResult.tools.length} tools: ${toolsResult.tools.join(', ')}`,
                        tools: toolsResult.tools
                    };
                } else {
                    // Try MCP SDK approach for external servers too
                    console.log(`External server custom discovery failed, trying MCP SDK...`);
                    try {
                        const sdkResult = await testWithMCPSDK(serverUrl);
                        if (sdkResult.success) {
                            return {
                                success: true,
                                message: `✅ External MCP server connected via SDK! Found ${sdkResult.tools.length} tools: ${sdkResult.tools.join(', ')}`,
                                tools: sdkResult.tools
                            };
                        }
                    } catch (sdkError) {
                        console.log(`External MCP SDK test also failed:`, sdkError);
                    }

                    // Fall back to simple connectivity test
                    const connectivityTest = await Promise.race([
                        fetch(serverUrl, {
                            method: 'GET',
                            headers: {
                                'Accept': 'text/event-stream',
                                'User-Agent': 'MCP-Agent/1.0'
                            }
                        }),
                        new Promise<Response>((_, reject) =>
                            setTimeout(() => reject(new Error("Connection timeout after 8 seconds")), 8000)
                        )
                    ]);

                    console.log(`External server response: ${connectivityTest.status} ${connectivityTest.statusText}`);

                    if (connectivityTest.status === 200 || connectivityTest.status === 302) {
                        return {
                            success: true,
                            message: `⚠️ External MCP server is reachable but both custom and SDK tool discovery failed: ${toolsResult.error}`,
                            tools: []
                        };
                    } else {
                        return {
                            success: false,
                            message: `External server returned status ${connectivityTest.status} ${connectivityTest.statusText}`,
                            tools: []
                        };
                    }
                }
            } catch (error) {
                return {
                    success: false,
                    message: `Failed to connect to external server: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    tools: []
                };
            }
        }

        // For local servers, try full MCP protocol with tool discovery
        console.log(`Testing local MCP server with full protocol: ${serverUrl}`);

        const toolsResult = await discoverMCPTools(serverUrl);
        if (toolsResult.success) {
            return {
                success: true,
                message: `✅ MCP server connected successfully! Found ${toolsResult.tools.length} tools: ${toolsResult.tools.join(', ')}`,
                tools: toolsResult.tools
            };
        }

        // Try MCP SDK approach as fallback
        console.log(`Custom discovery failed, trying MCP SDK approach...`);
        try {
            const sdkResult = await testWithMCPSDK(serverUrl);
            if (sdkResult.success) {
                return {
                    success: true,
                    message: `✅ MCP server connected via SDK! Found ${sdkResult.tools.length} tools: ${sdkResult.tools.join(', ')}`,
                    tools: sdkResult.tools
                };
            }
        } catch (sdkError) {
            console.log(`MCP SDK test also failed:`, sdkError);
        }        // Fall back to basic connectivity test if tool discovery fails
        console.log(`Tool discovery failed (${toolsResult.error}), falling back to basic connectivity test...`);

        const handshakeResponse = await Promise.race([
            fetch(serverUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/event-stream',
                    'Accept-Encoding': 'identity',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'User-Agent': 'MCP-Agent/1.0'
                }
            }),
            new Promise<Response>((_, reject) =>
                setTimeout(() => {
                    console.error(`TIMEOUT: Handshake timeout after 5 seconds for ${serverUrl}`);
                    reject(new Error("Handshake timeout after 5 seconds"));
                }, 5000)
            )
        ]);

        console.log(`Handshake response status: ${handshakeResponse.status} ${handshakeResponse.statusText}`);
        console.log(`Content-Type: ${handshakeResponse.headers.get('Content-Type')}`);

        if (!handshakeResponse.ok) {
            if (handshakeResponse.status === 406) {
                return {
                    success: false,
                    message: `Server returned 406 Not Acceptable - this usually means the server doesn't support SSE or requires different headers. Tool discovery error: ${toolsResult.error}`,
                    tools: []
                };
            } else if (handshakeResponse.status === 404) {
                return {
                    success: false,
                    message: `Server returned 404 Not Found - the MCP server endpoint '${serverUrl}' doesn't exist. Check the URL path.`,
                    tools: []
                };
            } else {
                return {
                    success: false,
                    message: `Server returned status ${handshakeResponse.status} ${handshakeResponse.statusText}. Tool discovery error: ${toolsResult.error}`,
                    tools: []
                };
            }
        }

        const contentType = handshakeResponse.headers.get('Content-Type') || '';
        if (contentType.includes('text/event-stream')) {
            return {
                success: true,
                message: `⚠️ Server is reachable via SSE but tool discovery failed: ${toolsResult.error}. Basic connectivity works.`,
                tools: []
            };
        }

        return {
            success: true,
            message: `⚠️ Server is reachable but not using SSE protocol. Tool discovery failed: ${toolsResult.error}`,
            tools: []
        };

    } catch (error) {
        console.error("Connection error:", error);

        if (error instanceof Error) {
            if (error.message.includes('fetch failed')) {
                return {
                    success: true,
                    message: `⚠️ Cannot test from local dev environment due to network restrictions. If server works in Cloudflare playground, it should work in production.`,
                    tools: []
                };
            } else if (error.message.includes('timeout')) {
                return {
                    success: false,
                    message: `Connection timeout - server took too long to respond`,
                    tools: []
                };
            }
        }

        return {
            success: false,
            message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            tools: []
        };
    }
}

// Helper function to discover MCP tools using the full protocol
async function discoverMCPTools(serverUrl: string): Promise<{ success: boolean; tools: string[]; error?: string }> {
    try {
        console.log(`=== Starting MCP Tool Discovery ===`);
        console.log(`Server URL: ${serverUrl}`);

        // Step 1: Initial handshake to get session endpoint
        console.log(`Step 1: Initial handshake request...`);
        const handshakeResponse = await Promise.race([
            fetch(serverUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/event-stream',
                    'Accept-Encoding': 'identity',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'User-Agent': 'MCP-Agent/1.0'
                }
            }),
            new Promise<Response>((_, reject) =>
                setTimeout(() => reject(new Error("Handshake timeout after 8 seconds")), 8000)
            )
        ]);

        if (!handshakeResponse.ok) {
            return {
                success: false,
                tools: [],
                error: `Handshake failed with status ${handshakeResponse.status}`
            };
        }

        console.log(`Step 1 completed: ${handshakeResponse.status} ${handshakeResponse.statusText}`);

        // Step 2: Read initial SSE response to get session endpoint
        const reader = handshakeResponse.body?.getReader();
        if (!reader) {
            return {
                success: false,
                tools: [],
                error: "No response body available"
            };
        }

        const decoder = new TextDecoder();
        let sessionEndpoint = '';
        let attempts = 0;
        const maxAttempts = 10;

        console.log(`Step 2: Reading SSE stream for session endpoint...`);

        try {
            while (attempts < maxAttempts) {
                try {
                    const readPromise = reader.read();
                    const timeoutPromise = new Promise<{ done: boolean; value?: Uint8Array }>((_, reject) =>
                        setTimeout(() => reject(new Error("Read timeout")), 2000)
                    );

                    const result = await Promise.race([readPromise, timeoutPromise]);

                    if (result.done) break;

                    const chunk = decoder.decode(result.value, { stream: true });
                    console.log(`Received chunk (${chunk.length} chars):`, chunk);

                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        console.log(`Processing SSE line: "${line}"`);
                        if (line.startsWith('data: ')) {
                            const data = line.substring(6).trim();
                            console.log(`Found data line: "${data}"`);

                            // Try to parse as JSON to see if it contains session info
                            try {
                                const jsonData = JSON.parse(data);
                                console.log(`Parsed JSON data:`, jsonData);

                                // Check various possible session endpoint locations
                                const possibleEndpoints = [
                                    jsonData.session,
                                    jsonData.sessionUrl,
                                    jsonData.endpoint,
                                    jsonData.url,
                                    jsonData.path,
                                    data // fallback to raw data
                                ];

                                for (const endpoint of possibleEndpoints) {
                                    if (endpoint && typeof endpoint === 'string' &&
                                        (endpoint.includes('/session') || endpoint.includes('/api') || endpoint.match(/\/[a-f0-9-]{36}$/))) {
                                        sessionEndpoint = endpoint;
                                        console.log(`Found session endpoint from JSON: ${sessionEndpoint}`);
                                        break;
                                    }
                                }
                            } catch (jsonError) {
                                console.log(`Data is not JSON, treating as plain text`);
                            }

                            // Original session endpoint detection
                            if (!sessionEndpoint && (data.includes('/sessions/') || data.includes('/session/') || data.match(/\/[a-f0-9-]{36}$/))) {
                                sessionEndpoint = data;
                                console.log(`Found session endpoint from plain text: ${sessionEndpoint}`);
                            }
                        } else if (line.startsWith('event: ')) {
                            console.log(`Found event line: "${line}"`);
                        } else if (line.trim()) {
                            console.log(`Found other line: "${line}"`);
                        }
                    }

                    if (sessionEndpoint) break;
                    attempts++;
                } catch (readError) {
                    console.log(`Read attempt ${attempts + 1} failed: ${readError}`);
                    attempts++;
                    // Small delay before retry
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (outerError) {
            console.log(`Outer read error: ${outerError}`);
        } finally {
            // Safely release the reader lock
            try {
                reader.releaseLock();
            } catch (lockError) {
                console.log(`Reader already released or error releasing: ${lockError}`);
            }
        }

        if (!sessionEndpoint) {
            return {
                success: false,
                tools: [],
                error: "No session endpoint found in SSE response"
            };
        }

        // Step 3: Connect to session endpoint and perform MCP initialization
        const fullSessionUrl = new URL(sessionEndpoint, serverUrl).toString();
        console.log(`Step 3: Connecting to session: ${fullSessionUrl}`);

        const sessionResponse = await Promise.race([
            fetch(fullSessionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {}
                        },
                        clientInfo: {
                            name: 'MCP-Agent',
                            version: '1.0.0'
                        }
                    }
                })
            }),
            new Promise<Response>((_, reject) =>
                setTimeout(() => reject(new Error("Session timeout after 10 seconds")), 10000)
            )
        ]);

        if (!sessionResponse.ok) {
            return {
                success: false,
                tools: [],
                error: `Session request failed with status ${sessionResponse.status}`
            };
        }

        const initResponse = await sessionResponse.json() as any;
        console.log(`Initialization response:`, JSON.stringify(initResponse, null, 2));

        // Step 4: Request tools list
        console.log(`Step 4: Requesting tools list...`);

        const toolsResponse = await Promise.race([
            fetch(fullSessionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 2,
                    method: 'tools/list',
                    params: {}
                })
            }),
            new Promise<Response>((_, reject) =>
                setTimeout(() => reject(new Error("Tools request timeout after 10 seconds")), 10000)
            )
        ]);

        console.log(`Tools response status: ${toolsResponse.status} ${toolsResponse.statusText}`);

        if (!toolsResponse.ok) {
            // Try alternative tools request format
            console.log(`Standard tools request failed, trying alternative format...`);

            const altToolsResponse = await Promise.race([
                fetch(fullSessionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 2,
                        method: 'list_tools',
                        params: {}
                    })
                }),
                new Promise<Response>((_, reject) =>
                    setTimeout(() => reject(new Error("Alternative tools request timeout after 5 seconds")), 5000)
                )
            ]);

            if (!altToolsResponse.ok) {
                return {
                    success: false,
                    tools: [],
                    error: `Both tools requests failed: ${toolsResponse.status} and ${altToolsResponse.status}`
                };
            }

            const altToolsResult = await altToolsResponse.json() as any;
            console.log(`Alternative tools response:`, JSON.stringify(altToolsResult, null, 2));

            const altTools = altToolsResult.result?.tools || altToolsResult.tools || [];
            const altToolNames = altTools.map((tool: any) => tool.name || tool.tool || 'unnamed-tool');

            return {
                success: true,
                tools: altToolNames
            };
        }

        const toolsResult = await toolsResponse.json() as any;
        console.log(`Tools response:`, JSON.stringify(toolsResult, null, 2));

        if (toolsResult.error) {
            return {
                success: false,
                tools: [],
                error: `MCP error: ${toolsResult.error.message || JSON.stringify(toolsResult.error)}`
            };
        }

        // Try multiple possible locations for tools in the response
        const tools = toolsResult.result?.tools || toolsResult.tools || toolsResult.result || [];
        console.log(`Raw tools data:`, tools);

        const toolNames = Array.isArray(tools)
            ? tools.map((tool: any) => {
                if (typeof tool === 'string') return tool;
                return tool.name || tool.tool || tool.id || 'unnamed-tool';
            })
            : [];

        console.log(`=== Tool Discovery Complete ===`);
        console.log(`Found ${toolNames.length} tools: ${toolNames.join(', ')}`);

        return {
            success: true,
            tools: toolNames
        };

    } catch (error) {
        console.error('Tool discovery error:', error);
        return {
            success: false,
            tools: [],
            error: error instanceof Error ? error.message : 'Unknown error during tool discovery'
        };
    }
}

// Alternative MCP SDK testing approach
async function testWithMCPSDK(serverUrl: string): Promise<{ success: boolean; tools: string[] }> {
    try {
        console.log(`=== Testing with MCP SDK ===`);
        console.log(`Server URL: ${serverUrl}`);

        // Dynamic import to handle potential server environment issues
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');

        const transport = new SSEClientTransport(new URL(serverUrl));
        const client = new Client(
            { name: "mcp-test-agent", version: "1.0.0" },
            { capabilities: { tools: {} } }
        );

        console.log(`Connecting with MCP SDK...`);
        await Promise.race([
            client.connect(transport),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("SDK connection timeout after 8 seconds")), 8000)
            )
        ]);

        console.log(`Connected! Listing tools...`);
        const toolsResult = await client.listTools();
        const toolNames = toolsResult.tools.map(tool => tool.name);

        console.log(`SDK found ${toolNames.length} tools:`, toolNames);

        await client.close();

        return {
            success: true,
            tools: toolNames
        };
    } catch (error) {
        console.error('MCP SDK test error:', error);
        return {
            success: false,
            tools: []
        };
    }
}

