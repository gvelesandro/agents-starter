import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { tool } from "ai";
import { z } from "zod";
import type {
    MCPServerConfig,
    MCPTool,
    MCPConnection,
    MCPToolExecution,
} from "../types/mcp";

const MCP_RELIABILITY_CONFIG = {
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 5000, // Reduced timeout to see errors faster
    fallbackMessage: "MCP server temporarily unavailable",
};

class MCPConnectionManager {
    private connections = new Map<string, MCPConnection>();
    private retryTimeouts = new Map<string, NodeJS.Timeout>();

    /**
     * Initialize connection to an MCP server
     */
    async connectToServer(serverConfig: MCPServerConfig): Promise<MCPConnection> {
        const existingConnection = this.connections.get(serverConfig.id);
        if (existingConnection?.status === "connected") {
            return existingConnection;
        }

        const connection: MCPConnection = {
            serverId: serverConfig.id,
            status: "connecting",
            tools: [],
            retryCount: 0,
            lastConnected: undefined,
        };

        this.connections.set(serverConfig.id, connection);

        try {
            console.log(`[MCP] Starting connection to ${serverConfig.name}...`);
            console.log(`[MCP] Browser environment:`, typeof window !== 'undefined');
            console.log(`[MCP] URL validation:`, serverConfig.url);

            // Validate URL
            try {
                new URL(serverConfig.url);
                console.log(`[MCP] URL is valid`);
            } catch (urlError) {
                console.error(`[MCP] Invalid URL:`, urlError);
                throw new Error(`Invalid server URL: ${serverConfig.url}`);
            }

            // Test basic connectivity first (browser only)
            if (typeof window !== 'undefined' && serverConfig.transport === 'sse') {
                console.log(`[MCP] Testing basic connectivity to ${serverConfig.url}...`);
                try {
                    // Create manual timeout for better browser compatibility
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => {
                        controller.abort();
                    }, 3000);

                    const testResponse = await fetch(serverConfig.url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'text/event-stream',
                            'Cache-Control': 'no-cache'
                        },
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);
                    console.log(`[MCP] Basic connectivity test result:`, testResponse.status, testResponse.statusText);

                    // Don't read the response body as it's an SSE stream
                } catch (fetchError) {
                    console.error(`[MCP] Basic connectivity test failed:`, fetchError);
                    const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
                    throw new Error(`Cannot reach server: ${errorMessage}`);
                }
            }

            // Create appropriate transport based on server config
            let transport: WebSocketClientTransport | SSEClientTransport;
            let headers: Record<string, string> = {};

            // Add authentication headers if needed
            if (serverConfig.auth.type === "apikey" && serverConfig.auth.apiKey) {
                headers = {
                    Authorization: `Bearer ${serverConfig.auth.apiKey}`,
                    ...serverConfig.auth.customHeaders,
                };
            } else if (
                serverConfig.auth.type === "basic" &&
                serverConfig.auth.username &&
                serverConfig.auth.password
            ) {
                const credentials = btoa(
                    `${serverConfig.auth.username}:${serverConfig.auth.password}`
                );
                headers = {
                    Authorization: `Basic ${credentials}`,
                    ...serverConfig.auth.customHeaders,
                };
            }

            if (serverConfig.transport === "websocket") {
                console.log(`[MCP] Creating WebSocket transport for ${serverConfig.url}`);
                transport = new WebSocketClientTransport(new URL(serverConfig.url));
                // Note: WebSocket auth typically handled via query params or subprotocols
            } else {
                console.log(`[MCP] Creating SSE transport for ${serverConfig.url}`);
                console.log(`[MCP] Headers:`, headers);

                try {
                    transport = new SSEClientTransport(new URL(serverConfig.url));
                    console.log(`[MCP] SSE transport created successfully`);

                    // SSE can use headers for auth
                    if (Object.keys(headers).length > 0) {
                        (transport as any).headers = headers;
                        console.log(`[MCP] Headers applied to SSE transport`);
                    }
                } catch (transportError) {
                    console.error(`[MCP] Failed to create SSE transport:`, transportError);
                    throw transportError;
                }
            }

            const client = new Client(
                {
                    name: "chat-agents-app",
                    version: "1.0.0",
                },
                {
                    capabilities: {
                        tools: {},
                    },
                }
            );

            console.log(`[MCP] Connecting to ${serverConfig.name} at ${serverConfig.url}...`);
            console.log(`[MCP] Transport type: ${serverConfig.transport}`);
            console.log(`[MCP] Auth type: ${serverConfig.auth.type}`);

            // Add timeout wrapper for the connection
            console.log(`[MCP] Starting MCP client connection...`);
            const connectPromise = client.connect(transport);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    console.error(`[MCP] Connection timeout after ${MCP_RELIABILITY_CONFIG.timeoutMs}ms for ${serverConfig.name}`);
                    reject(new Error(`Connection timeout after ${MCP_RELIABILITY_CONFIG.timeoutMs}ms`));
                }, MCP_RELIABILITY_CONFIG.timeoutMs);
            });

            // Add progress tracking
            connectPromise
                .then(() => {
                    console.log(`[MCP] Connect promise resolved successfully`);
                })
                .catch(error => {
                    console.error(`[MCP] Connect promise rejected:`, error);
                });

            console.log(`[MCP] Waiting for connection to complete...`);
            await Promise.race([connectPromise, timeoutPromise]);

            console.log(`[MCP] Connected to ${serverConfig.name}, discovering tools...`);

            // Discover available tools
            const toolsResult = await client.listTools();
            const tools: MCPTool[] = toolsResult.tools.map((tool) => ({
                name: tool.name,
                description: tool.description || "",
                serverId: serverConfig.id,
                serverName: serverConfig.name,
                schema: tool.inputSchema,
                requiresConfirmation: this.shouldRequireConfirmation(tool.name),
            }));

            connection.client = client;
            connection.tools = tools;
            connection.status = "connected";
            connection.lastConnected = new Date();
            connection.retryCount = 0;

            console.log(
                `Connected to MCP server: ${serverConfig.name} (${tools.length} tools)`
            );
            return connection;
        } catch (error) {
            console.error(
                `[MCP] Failed to connect to MCP server ${serverConfig.name} (${serverConfig.url}):`,
                error
            );

            // Log additional details for debugging
            if (error instanceof Error) {
                console.error(`[MCP] Error name: ${error.name}`);
                console.error(`[MCP] Error message: ${error.message}`);
                console.error(`[MCP] Error stack:`, error.stack);
            }

            connection.status = "error";
            connection.lastError =
                error instanceof Error ? error.message : String(error);

            // Schedule retry if enabled
            if (
                serverConfig.isEnabled &&
                connection.retryCount < MCP_RELIABILITY_CONFIG.maxRetries
            ) {
                this.scheduleRetry(serverConfig);
            }

            return connection;
        }
    }

    /**
     * Execute a tool with reliability layer
     */
    async executeTool(
        serverId: string,
        toolName: string,
        parameters: any
    ): Promise<MCPToolExecution> {
        const execution: MCPToolExecution = {
            toolName,
            serverId,
            parameters,
            timestamp: new Date(),
        };

        const startTime = Date.now();

        try {
            const result = await this.withMCPRetry(
                async () => {
                    const connection = this.connections.get(serverId);
                    if (
                        !connection ||
                        connection.status !== "connected" ||
                        !connection.client
                    ) {
                        throw new Error(`MCP server ${serverId} not connected`);
                    }

                    const response = await connection.client.callTool({
                        name: toolName,
                        arguments: parameters,
                    });

                    return response;
                },
                serverId,
                toolName
            );

            execution.result = result;
            execution.executionTime = Date.now() - startTime;

            return execution;
        } catch (error) {
            execution.error = error instanceof Error ? error.message : String(error);
            execution.executionTime = Date.now() - startTime;

            console.error(
                `MCP tool execution failed: ${serverId}.${toolName}`,
                error
            );
            return execution;
        }
    }

    /**
     * Get available tools for a list of MCP groups
     */
    getToolsForGroups(
        groupIds: string[],
        serverConfigs: MCPServerConfig[]
    ): MCPTool[] {
        const tools: MCPTool[] = [];

        for (const config of serverConfigs) {
            if (groupIds.includes(config.groupId) && config.isEnabled) {
                const connection = this.connections.get(config.id);
                if (connection?.status === "connected") {
                    tools.push(...connection.tools);
                }
            }
        }

        return tools;
    }

    /**
     * Disconnect from a server
     */
    async disconnectServer(serverId: string): Promise<void> {
        const connection = this.connections.get(serverId);
        if (connection?.client) {
            try {
                await connection.client.close();
            } catch (error) {
                console.error(
                    `Error disconnecting from MCP server ${serverId}:`,
                    error
                );
            }
        }

        // Clear retry timeout
        const timeout = this.retryTimeouts.get(serverId);
        if (timeout) {
            clearTimeout(timeout);
            this.retryTimeouts.delete(serverId);
        }

        this.connections.delete(serverId);
    }

    /**
     * Get connection status for a server
     */
    getConnectionStatus(serverId: string): MCPConnection | undefined {
        return this.connections.get(serverId);
    }

    /**
     * Reliability wrapper with exponential backoff
     */
    private async withMCPRetry<T>(
        operation: () => Promise<T>,
        serverId: string,
        toolName: string,
        maxRetries: number = MCP_RELIABILITY_CONFIG.maxRetries
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Add timeout protection
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(
                        () => reject(new Error("Operation timeout")),
                        MCP_RELIABILITY_CONFIG.timeoutMs
                    );
                });

                const result = await Promise.race([operation(), timeoutPromise]);
                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < maxRetries) {
                    const delay =
                        MCP_RELIABILITY_CONFIG.retryDelayMs * Math.pow(2, attempt);
                    console.log(
                        `MCP tool ${toolName} failed (attempt ${attempt + 1}), retrying in ${delay}ms...`
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError!;
    }

    /**
     * Schedule retry connection attempt
     */
    private scheduleRetry(serverConfig: MCPServerConfig): void {
        const connection = this.connections.get(serverConfig.id);
        if (!connection) return;

        connection.retryCount++;
        const delay =
            MCP_RELIABILITY_CONFIG.retryDelayMs *
            Math.pow(2, connection.retryCount - 1);

        const timeout = setTimeout(() => {
            console.log(
                `Retrying connection to MCP server: ${serverConfig.name} (attempt ${connection.retryCount})`
            );
            this.connectToServer(serverConfig);
        }, delay);

        this.retryTimeouts.set(serverConfig.id, timeout);
    }

    /**
     * Determine if a tool should require confirmation based on its name/description
     */
    private shouldRequireConfirmation(toolName: string): boolean {
        const dangerousPatterns = [
            "delete",
            "remove",
            "destroy",
            "drop",
            "truncate",
            "execute",
            "run",
            "eval",
            "exec",
            "write",
            "create",
            "update",
            "modify",
            "send",
            "post",
            "put",
            "patch",
        ];

        const toolLower = toolName.toLowerCase();
        return dangerousPatterns.some((pattern) => toolLower.includes(pattern));
    }
}

// Global instance
export const mcpConnectionManager = new MCPConnectionManager();

// Helper functions for server-side usage
export async function getMCPToolsForThread(
    threadId: string,
    db?: any // D1Database instance
): Promise<Record<string, any>> {
    const mcpTools: Record<string, any> = {};
    
    if (!db) {
        console.warn("[MCP] Database not available, cannot load thread-specific MCP tools");
        return mcpTools;
    }

    try {
        console.log(`[MCP] Loading database-driven MCP tools for thread: ${threadId}`);
        
        // Get active agents for this thread and their MCP groups
        const threadAgents = await db.prepare(`
            SELECT DISTINCT a.id, a.name, amg.group_id, a.user_id
            FROM thread_agents ta
            JOIN agents a ON ta.agent_id = a.id  
            JOIN agent_mcp_groups amg ON a.id = amg.agent_id
            WHERE ta.thread_id = ? AND ta.is_active = TRUE
        `).bind(threadId).all();

        // Get directly assigned MCP servers for this thread
        const threadMCPServers = await db.prepare(`
            SELECT mis.* FROM thread_mcp_servers tms
            JOIN mcp_servers_independent mis ON tms.server_id = mis.id
            WHERE tms.thread_id = ? AND tms.is_active = TRUE AND mis.is_enabled = TRUE
        `).bind(threadId).all();

        // Get MCP servers from agent groups
        const allServerConfigs = [...threadMCPServers.results];
        
        if (threadAgents.results.length > 0) {
            const groupIds = Array.from(new Set(threadAgents.results.map((agent: any) => agent.group_id)));
            
            if (groupIds.length > 0) {
                const groupServers = await db.prepare(`
                    SELECT ms.*, ms.id as server_id, ms.name as server_name, 
                           ms.url as server_url, ms.transport, ms.auth_type,
                           ms.user_id, ms.group_id, ms.is_enabled, ms.status
                    FROM mcp_servers ms
                    WHERE ms.group_id IN (${groupIds.map(() => '?').join(',')}) AND ms.is_enabled = TRUE
                `).bind(...groupIds).all();
                
                allServerConfigs.push(...groupServers.results);
            }
        }

        console.log(`[MCP] Found ${allServerConfigs.length} MCP servers for thread ${threadId}`);

        // Connect to all servers and collect their tools
        for (const serverRow of allServerConfigs) {
            try {
                // Convert database row to MCPServerConfig format
                const serverConfig = {
                    id: serverRow.id || serverRow.server_id,
                    name: serverRow.name || serverRow.server_name,
                    url: serverRow.url || serverRow.server_url,
                    transport: serverRow.transport,
                    userId: serverRow.user_id,
                    groupId: serverRow.group_id || 'independent',
                    auth: {
                        type: serverRow.auth_type || 'none',
                        // TODO: Load auth details from database if needed
                    },
                    status: serverRow.status || 'disconnected',
                    isEnabled: serverRow.is_enabled,
                    createdAt: new Date(serverRow.created_at),
                    updatedAt: new Date(serverRow.updated_at || serverRow.created_at)
                };

                console.log(`[MCP] Attempting to connect to server: ${serverConfig.name} (${serverConfig.url})`);
                
                const connection = await mcpConnectionManager.connectToServer(serverConfig);
                
                if (connection.status === "connected" && connection.tools.length > 0) {
                    console.log(`[MCP] Connected to ${serverConfig.name}, found ${connection.tools.length} tools`);
                    
                    // Convert MCP tools to the format expected by the AI system
                    for (const mcpTool of connection.tools) {
                        const toolName = `mcp_${mcpTool.serverId}_${mcpTool.name}`;
                        
                        // Convert JSON schema to Zod schema safely
                        let zodSchema = z.object({});
                        try {
                            if (mcpTool.schema && mcpTool.schema.properties) {
                                const properties: Record<string, any> = {};
                                for (const [key, prop] of Object.entries(mcpTool.schema.properties)) {
                                    const propDef = prop as any;
                                    let zodType: any = z.string(); // default to string
                                    
                                    switch (propDef.type) {
                                        case 'string':
                                            zodType = z.string();
                                            break;
                                        case 'number':
                                            zodType = z.number();
                                            break;
                                        case 'boolean':
                                            zodType = z.boolean();
                                            break;
                                        case 'array':
                                            zodType = z.array(z.any());
                                            break;
                                        case 'object':
                                            zodType = z.object({});
                                            break;
                                        default:
                                            zodType = z.any();
                                    }
                                    
                                    // Add description if available
                                    if (propDef.description) {
                                        zodType = zodType.describe(propDef.description);
                                    }
                                    
                                    properties[key] = zodType;
                                }
                                zodSchema = z.object(properties);
                            }
                        } catch (schemaError) {
                            console.warn(`[MCP] Could not convert schema for tool ${toolName}:`, schemaError);
                            zodSchema = z.object({}); // fallback to empty schema
                        }
                        
                        // Create proper tool objects using the AI tool function
                        if (mcpTool.requiresConfirmation) {
                            // Tool requires confirmation (no execute function)
                            mcpTools[toolName] = tool({
                                description: mcpTool.description,
                                parameters: zodSchema,
                                // No execute function = requires confirmation
                            });
                        } else {
                            // Auto-executing tool
                            mcpTools[toolName] = tool({
                                description: mcpTool.description,
                                parameters: zodSchema,
                                execute: async (parameters: any) => {
                                    try {
                                        const execution = await mcpConnectionManager.executeTool(
                                            mcpTool.serverId,
                                            mcpTool.name,
                                            parameters
                                        );

                                        if (execution.error) {
                                            console.error(`MCP tool ${mcpTool.name} failed:`, execution.error);
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
                        
                        console.log(`[MCP] Added tool: ${toolName} - ${mcpTool.description}`);
                    }
                } else {
                    console.warn(`[MCP] Could not connect to server ${serverConfig.name}: ${connection.status}`);
                    if (connection.lastError) {
                        console.warn(`[MCP] Error details: ${connection.lastError}`);
                    }
                }
            } catch (error) {
                console.error(`[MCP] Failed to connect to MCP server ${serverRow.name}:`, error);
            }
        }

    } catch (error) {
        console.error("[MCP] Error loading database-driven MCP tools:", error);
    }

    console.log(`[MCP] Loaded ${Object.keys(mcpTools).length} database-driven MCP tools for thread ${threadId}`);
    return mcpTools;
}

export async function getMCPExecutionsForThread(
    threadId: string,
    db?: any // D1Database instance
): Promise<Record<string, any>> {
    const mcpExecutions: Record<string, any> = {};
    
    if (!db) {
        console.warn("[MCP] Database not available, cannot load thread-specific MCP executions");
        return mcpExecutions;
    }

    try {
        console.log(`[MCP] Loading database-driven MCP executions for thread: ${threadId}`);
        
        // Similar query logic as above, but focus on confirmation-required tools
        const threadAgents = await db.prepare(`
            SELECT DISTINCT a.id, a.name, amg.group_id, a.user_id
            FROM thread_agents ta
            JOIN agents a ON ta.agent_id = a.id  
            JOIN agent_mcp_groups amg ON a.id = amg.agent_id
            WHERE ta.thread_id = ? AND ta.is_active = TRUE
        `).bind(threadId).all();

        const threadMCPServers = await db.prepare(`
            SELECT mis.* FROM thread_mcp_servers tms
            JOIN mcp_servers_independent mis ON tms.server_id = mis.id
            WHERE tms.thread_id = ? AND tms.is_active = TRUE AND mis.is_enabled = TRUE
        `).bind(threadId).all();

        const allServerConfigs = [...threadMCPServers.results];
        
        if (threadAgents.results.length > 0) {
            const groupIds = Array.from(new Set(threadAgents.results.map((agent: any) => agent.group_id)));
            
            if (groupIds.length > 0) {
                const groupServers = await db.prepare(`
                    SELECT ms.* FROM mcp_servers ms
                    WHERE ms.group_id IN (${groupIds.map(() => '?').join(',')}) AND ms.is_enabled = TRUE
                `).bind(...groupIds).all();
                
                allServerConfigs.push(...groupServers.results);
            }
        }

        // Check each connected server for confirmation-required tools
        for (const serverRow of allServerConfigs) {
            try {
                const serverId = serverRow.id || serverRow.server_id;
                const connection = mcpConnectionManager.getConnectionStatus(serverId);
                
                if (connection?.status === "connected") {
                    for (const tool of connection.tools) {
                        if (tool.requiresConfirmation) {
                            const executionName = `mcp_${tool.serverId}_${tool.name}`;
                            
                            mcpExecutions[executionName] = async (parameters: any) => {
                                try {
                                    const execution = await mcpConnectionManager.executeTool(
                                        tool.serverId,
                                        tool.name,
                                        parameters
                                    );

                                    if (execution.error) {
                                        console.error(`MCP tool ${tool.name} failed:`, execution.error);
                                        throw new Error(`Tool failed: ${execution.error}`);
                                    }

                                    return execution.result;
                                } catch (error) {
                                    console.error(`MCP execution error:`, error);
                                    throw error;
                                }
                            };
                            
                            console.log(`[MCP] Added execution handler: ${executionName}`);
                        }
                    }
                }
            } catch (error) {
                console.error(`[MCP] Error setting up executions for server ${serverRow.name}:`, error);
            }
        }

    } catch (error) {
        console.error("[MCP] Error loading database-driven MCP executions:", error);
    }

    console.log(`[MCP] Loaded ${Object.keys(mcpExecutions).length} database-driven MCP execution handlers for thread ${threadId}`);
    return mcpExecutions;
}
