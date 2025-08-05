import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import type {
    MCPServerConfig,
    MCPTool,
    MCPConnection,
    MCPToolExecution,
} from "../types/mcp";

const MCP_RELIABILITY_CONFIG = {
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 10000,
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
                transport = new WebSocketClientTransport(new URL(serverConfig.url));
                // Note: WebSocket auth typically handled via query params or subprotocols
            } else {
                transport = new SSEClientTransport(new URL(serverConfig.url));
                // SSE can use headers for auth
                if (Object.keys(headers).length > 0) {
                    (transport as any).headers = headers;
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

            await client.connect(transport);

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
                `Failed to connect to MCP server ${serverConfig.name}:`,
                error
            );
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
    threadId: string
): Promise<Record<string, any>> {
    // This will be implemented when we have thread-agent associations
    // For now, return empty object
    return {};
}

export async function getMCPExecutionsForThread(
    threadId: string
): Promise<Record<string, any>> {
    // This will be implemented when we have thread-agent associations
    // For now, return empty object
    return {};
}
