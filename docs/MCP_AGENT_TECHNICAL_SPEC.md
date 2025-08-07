# MCP Agent System - Technical Specification

> **🎉 IMPLEMENTATION STATUS: PRODUCTION-READY**  
> Real MCP tool integration completed August 7, 2025. System now connects to live MCP servers and provides dynamic tool capabilities based on thread-agent-server associations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│ Agent UI │ MCP Management │ Chat Interface │ Notifications  │
├─────────────────────────────────────────────────────────────┤
│                   Enhanced Tools System                     │
│  Built-in Tools  │  MCP Tools (Dynamic)  │  Reliability    │
├─────────────────────────────────────────────────────────────┤
│                  Cloudflare Worker (Backend)                │
│    Agent API    │    MCP API    │    Auth API    │ D1 DB   │
├─────────────────────────────────────────────────────────────┤
│                    External MCP Servers                     │
│   GitHub MCP    │   Database MCP  │   Custom MCPs          │
└─────────────────────────────────────────────────────────────┘
```

## Data Models

### Core Entities

```typescript
// Agent Definition
interface Agent {
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

// MCP Group
interface MCPGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  serverIds: string[];
  userId: string;
  createdAt: Date;
}

// MCP Server Configuration
interface MCPServerConfig {
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

// Thread-Agent State
interface ThreadAgentState {
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

// Enhanced Notification
interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: Date;
  taskId?: string;
  threadId?: string;
  read?: boolean;
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
```

## Database Schema (Cloudflare D1)

```sql
-- MCP Groups
CREATE TABLE mcp_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'blue',
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MCP Servers
CREATE TABLE mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  transport TEXT CHECK(transport IN ('websocket', 'sse')) NOT NULL,
  user_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  auth_type TEXT CHECK(auth_type IN ('none', 'apikey', 'basic', 'oauth2', 'custom')) NOT NULL,
  encrypted_credentials TEXT, -- JSON blob, encrypted
  status TEXT CHECK(status IN ('connected', 'disconnected', 'error', 'authenticating', 'pending_auth')) DEFAULT 'disconnected',
  is_enabled BOOLEAN DEFAULT TRUE,
  last_connected DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES mcp_groups(id) ON DELETE CASCADE
);

-- Agent Definitions
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  persona TEXT,
  user_id TEXT NOT NULL,
  color TEXT DEFAULT 'blue',
  is_active BOOLEAN DEFAULT FALSE,
  last_used DATETIME,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent-MCP Group Mappings
CREATE TABLE agent_mcp_groups (
  agent_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (agent_id, group_id),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES mcp_groups(id) ON DELETE CASCADE
);

-- Thread-Agent Assignments
CREATE TABLE thread_agents (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('primary', 'specialist')) DEFAULT 'primary',
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  removed_at DATETIME,
  added_reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- OAuth Flow Tracking
CREATE TABLE mcp_oauth_flows (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  state TEXT NOT NULL UNIQUE,
  step TEXT CHECK(step IN ('initiated', 'callback_received', 'token_exchange', 'completed', 'failed')) NOT NULL,
  auth_url TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_mcp_groups_user_id ON mcp_groups(user_id);
CREATE INDEX idx_mcp_servers_user_id ON mcp_servers(user_id);
CREATE INDEX idx_mcp_servers_group_id ON mcp_servers(group_id);
CREATE INDEX idx_mcp_servers_status ON mcp_servers(status, user_id);
CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_thread_agents_thread_id ON thread_agents(thread_id);
CREATE INDEX idx_thread_agents_user_id ON thread_agents(user_id);
CREATE INDEX idx_oauth_flows_state ON mcp_oauth_flows(state);
```

## API Specifications

### MCP Management Endpoints

```typescript
// MCP Groups
GET    /api/mcp-groups              // Get user's MCP groups
POST   /api/mcp-groups              // Create new MCP group
PUT    /api/mcp-groups/:id          // Update MCP group
DELETE /api/mcp-groups/:id          // Delete MCP group

// MCP Servers
GET    /api/mcp-servers                    // Get all user's MCP servers
GET    /api/mcp-groups/:groupId/servers    // Get servers in specific group
POST   /api/mcp-groups/:groupId/servers    // Add server to specific group
PUT    /api/mcp-servers/:id               // Update MCP server config
DELETE /api/mcp-servers/:id               // Remove MCP server config
POST   /api/mcp-servers/:id/test          // Test MCP server connection

// OAuth Flows
POST   /api/mcp-servers/:id/auth/oauth/initiate  // Start OAuth flow
GET    /api/mcp-auth/callback                    // OAuth callback handler
POST   /api/mcp-servers/:id/auth/oauth/refresh   // Refresh expired tokens
DELETE /api/mcp-servers/:id/auth/oauth/revoke    // Revoke OAuth tokens
```

### Agent Management Endpoints

```typescript
// Agents
GET    /api/agents                    // Get user's agents
POST   /api/agents                    // Create new agent
PUT    /api/agents/:id                // Update agent
DELETE /api/agents/:id                // Delete agent
POST   /api/agents/:id/duplicate      // Duplicate agent

// Thread-Agent Management
GET    /api/threads/:threadId/agents     // Get active agents for thread
PUT    /api/threads/:threadId/agents     // Update active agents for thread
POST   /api/threads/:threadId/agents     // Add agent to thread
DELETE /api/threads/:threadId/agents/:agentId // Remove agent from thread

// Agent Tools
GET    /api/threads/:threadId/tools      // Get available tools for thread
GET    /api/threads/:threadId/executions // Get executions for thread
```

## Tool System Integration

### ✅ IMPLEMENTED: Real MCP Tool Architecture

```typescript
// tools.ts - Production implementation
export const tools = {
  // Existing built-in tools (unchanged)
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
};

export const executions = {
  // Existing built-in executions (unchanged)
  getWeatherInformation: async ({ city }) => { ... },
};

// ✅ IMPLEMENTED: Real MCP integration functions with database support
export const getCombinedToolsForThread = async (threadId: string, db?: any) => {
  const combinedTools = { ...tools };
  
  try {
    let mcpTools: Record<string, any> = {};
    
    if (db) {
      // ✅ Use database-aware version from mcp-connection.ts
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

  return combinedTools;
};

// ✅ IMPLEMENTED: Database-driven MCP tool discovery
async function getMCPToolsForThread(threadId: string): Promise<Record<string, any>> {
  // Real implementation connects to actual MCP servers
  // Queries database for thread-agent-server associations
  // Establishes live connections via mcpConnectionManager
  // Returns real tools from connected servers
  // Gracefully handles unavailable servers
}
```

### ✅ IMPLEMENTED: Database-Aware MCP Connection Manager

```typescript
// lib/mcp-connection.ts - Production implementation
export async function getMCPToolsForThread(
    threadId: string,
    db?: any // D1Database instance
): Promise<Record<string, any>> {
    // ✅ Query thread-agent associations
    const threadAgents = await db.prepare(`
        SELECT DISTINCT a.id, a.name, amg.group_id, a.user_id
        FROM thread_agents ta
        JOIN agents a ON ta.agent_id = a.id  
        JOIN agent_mcp_groups amg ON a.id = amg.agent_id
        WHERE ta.thread_id = ? AND ta.is_active = TRUE
    `).bind(threadId).all();

    // ✅ Query directly assigned MCP servers
    const threadMCPServers = await db.prepare(`
        SELECT mis.* FROM thread_mcp_servers tms
        JOIN mcp_servers_independent mis ON tms.server_id = mis.id
        WHERE tms.thread_id = ? AND tms.is_active = TRUE
    `).bind(threadId).all();

    // ✅ Connect to servers and collect tools
    for (const serverConfig of allServerConfigs) {
        const connection = await mcpConnectionManager.connectToServer(serverConfig);
        if (connection.status === "connected") {
            // ✅ Create real tools from MCP server responses
            for (const mcpTool of connection.tools) {
                const toolName = `mcp_${mcpTool.serverId}_${mcpTool.name}`;
                mcpTools[toolName] = tool({
                    description: mcpTool.description,
                    parameters: zodSchema,
                    execute: async (parameters: any) => {
                        // ✅ Real MCP server execution
                        return await mcpConnectionManager.executeTool(
                            mcpTool.serverId,
                            mcpTool.name,
                            parameters
                        );
                    },
                });
            }
        }
    }
}
```

### MCP Tool Reliability Layer

```typescript
const MCP_RELIABILITY_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 10000,
  fallbackMessage: "MCP server temporarily unavailable",
};

async function withMCPRetry<T>(
  operation: () => Promise<T>,
  serverName: string,
  toolName: string,
  maxRetries: number = MCP_RELIABILITY_CONFIG.maxRetries
): Promise<T> {
  // Exponential backoff retry logic
  // Timeout protection
  // Error logging and fallback
}
```

## UI Component Specifications

### Agent Quick Selector

```typescript
const AgentQuickSelector = ({ threadId, currentAgents, onAgentChange }) => {
  // Dropdown showing current agents
  // Quick switch between agent configurations
  // "Manage Agents" link to full management
};
```

### Agent Management Panel

```typescript
const AgentManagementPanel = () => {
  // Collapsible sidebar section
  // Agent CRUD operations
  // Quick actions (create, duplicate, share)
  // Visual agent cards with status
};
```

### MCP Server Configuration Modal

```typescript
const MCPServerModal = ({ serverId, groupId, onSave, onClose }) => {
  // Server connection details
  // Authentication configuration
  // OAuth flow handling
  // Connection testing
};
```

## Notification System Enhancement

### Enhanced useNotifications Hook

```typescript
export const useNotifications = () => {
  // Existing notification functionality (unchanged)

  // New agent-specific notification methods
  const addAgentToThread = useCallback(
    (threadId, agentName, reason, toolsAdded) => {
      return addNotification({
        title: "Specialist Added",
        message: `${agentName} joined the conversation: ${reason}`,
        type: "info",
        threadId,
        agentEventType: "agent_added",
        specialistChange: { action: "added", agentName, reason, toolsAdded },
      });
    },
    [addNotification]
  );

  // Additional MCP-specific notification methods
  // OAuth flow notifications
  // Server connection status notifications
  // Tool availability notifications
};
```

## Security Considerations

### OAuth Flow Security

- CSRF protection via state parameter
- Secure token storage (encrypted at rest)
- Token refresh handling
- Scope validation

### MCP Server Authentication

- Credential encryption using Cloudflare's encryption APIs
- Per-user credential isolation
- Secure credential transmission
- Authentication failure handling

### User Data Protection

- Per-user data isolation in D1
- Agent configuration privacy
- Audit logging for sensitive operations

## Performance Requirements

### MCP Operations

- Tool discovery: <2s per server
- Tool execution: <10s with timeout
- Agent switching: <500ms UI response
- Fallback activation: <100ms

### Database Operations

- Agent list loading: <200ms
- MCP server status check: <1s
- Thread agent assignment: <100ms

### UI Responsiveness

- Agent selector rendering: <100ms
- Notification display: <50ms
- Modal opening: <200ms

## Error Handling Patterns

### MCP Server Failures

```typescript
// Graceful degradation
try {
  const result = await mcpServer.callTool(toolName, params);
  return result;
} catch (error) {
  console.error(`MCP tool ${toolName} failed:`, error);

  // Notify user
  addNotification({
    title: "Tool Temporarily Unavailable",
    message: `${serverName}.${toolName} is experiencing issues`,
    type: "warning",
  });

  // Return fallback response
  return `${toolName} is temporarily unavailable. Please try again later.`;
}
```

### OAuth Flow Failures

```typescript
// Clear error messages and recovery options
if (oauthError) {
  addNotification({
    title: "Authentication Failed",
    message: `Could not connect to ${serverName}. Check your permissions.`,
    type: "error",
    mcpActionRequired: true,
  });
}
```

## Testing Strategy

### Unit Tests

- MCP server connection logic
- Tool reliability layer
- Agent CRUD operations
- Notification system enhancements

### Integration Tests

- OAuth flow end-to-end
- Agent-thread assignment
- Tool execution with fallbacks
- Cross-browser compatibility

### Performance Tests

- MCP server response times
- Agent switching latency
- Database query performance
- UI rendering benchmarks

## Deployment Considerations

### Environment Variables

```
OPENAI_API_KEY=xxx
MCP_ENCRYPTION_KEY=xxx
OAUTH_CLIENT_IDS={"github":"xxx","google":"xxx"}
D1_DATABASE_ID=xxx
```

### Database Migrations

- D1 schema creation scripts
- Data migration for existing users
- Index creation for performance

### Feature Flags

- MCP system enable/disable
- OAuth provider toggles
- Advanced agent features

---

**Document Status**: Draft v1.0  
**Last Updated**: August 5, 2025  
**Dependencies**: MCP_AGENT_PRD.md
