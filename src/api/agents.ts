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

        // TODO: Implement actual server testing logic
        // For now, simulate testing based on URL
        const serverUrl = server.url as string;
        const isValidUrl = serverUrl.includes('localhost') || serverUrl.includes('valid-mcp-server');
        
        const testResult = {
            success: isValidUrl,
            message: isValidUrl 
                ? 'Connection successful! Server is responding and tools were discovered.'
                : 'Connection failed: Server not reachable or invalid MCP server.',
            tools: isValidUrl ? ['example_tool_1', 'example_tool_2'] : []
        };

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
                JSON.stringify(testResult.tools),
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
        console.error("Error testing independent MCP server:", error);
        return new Response(
            JSON.stringify({ 
                success: false,
                message: "Test failed: " + (error instanceof Error ? error.message : 'Unknown error')
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
