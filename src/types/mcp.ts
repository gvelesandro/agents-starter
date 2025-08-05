// MCP Agent System Types
export interface Agent {
    id: string;
    name: string;
    description?: string;
    persona?: string;
    mcpGroupIds: string[];
    userId: string;
    color: string;
    isActive: boolean;
    lastUsed?: Date;
    usageCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface MCPGroup {
    id: string;
    name: string;
    description?: string;
    color: string;
    serverIds: string[];
    servers?: {
        id: string;
        name: string;
        url: string;
        transport: "websocket" | "sse";
        status: "connected" | "disconnected" | "error" | "authenticating" | "pending_auth";
        isEnabled: boolean;
    }[];
    userId: string;
    createdAt: Date;
}

export interface MCPServerConfig {
    id: string;
    name: string;
    url: string;
    transport: "websocket" | "sse";
    userId: string;
    groupId: string;
    auth: {
        type: "none" | "apikey" | "basic" | "oauth2" | "custom";
        apiKey?: string;
        username?: string;
        password?: string;
        oauth2?: {
            clientId: string;
            authUrl: string;
            tokenUrl: string;
            scopes: string[];
            accessToken?: string; // Encrypted
            refreshToken?: string; // Encrypted
            expiresAt?: Date;
        };
        customHeaders?: Record<string, string>;
    };
    status:
    | "connected"
    | "disconnected"
    | "error"
    | "authenticating"
    | "pending_auth";
    isEnabled: boolean;
    lastConnected?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ThreadAgentState {
    threadId: string;
    activeAgents: {
        agentId: string;
        agentName: string;
        role: "primary" | "specialist";
        addedAt: Date;
        addedReason?: string;
        toolGroups: string[];
    }[];
    agentHistory: {
        agentId: string;
        agentName: string;
        action: "added" | "removed";
        timestamp: Date;
        reason?: string;
        messageRange?: { start: number; end?: number };
    }[];
}

// Enhanced Notification interface extending the existing one
export interface MCPNotificationExtension {
    // Agent-specific fields
    agentId?: string;
    agentIds?: string[];
    mcpServerId?: string;
    mcpGroupId?: string;
    mcpEventType?:
    | "agent_added"
    | "agent_removed"
    | "mcp_auth_required"
    | "tools_updated"
    | "mcp_connection_failed"
    | "agent_switched";
    mcpActionRequired?: boolean;
    toolSource?: "builtin" | "mcp";
    toolName?: string;
    specialistChange?: {
        action: "added" | "removed";
        agentName: string;
        reason?: string;
        toolsAdded?: string[];
        toolsRemoved?: string[];
    };
}

export interface MCPTool {
    name: string;
    description: string;
    serverId: string;
    serverName: string;
    schema: any; // JSON schema for the tool's parameters
    requiresConfirmation?: boolean;
}

export interface MCPToolExecution {
    toolName: string;
    serverId: string;
    parameters: any;
    result?: any;
    error?: string;
    timestamp: Date;
    executionTime?: number;
}

export interface OAuthFlowState {
    id: string;
    serverId: string;
    userId: string;
    state: string;
    step:
    | "initiated"
    | "callback_received"
    | "token_exchange"
    | "completed"
    | "failed";
    authUrl?: string;
    expiresAt: Date;
    createdAt: Date;
}

// MCP Client connection management
export interface MCPConnection {
    serverId: string;
    status: "connecting" | "connected" | "disconnected" | "error";
    client?: any; // MCP client instance
    tools: MCPTool[];
    lastError?: string;
    retryCount: number;
    lastConnected?: Date;
}

// Agent management UI state
export interface AgentUIState {
    selectedAgentId?: string;
    isManagementPanelOpen: boolean;
    isCreatingAgent: boolean;
    editingAgentId?: string;
    selectedGroupIds: string[];
}
