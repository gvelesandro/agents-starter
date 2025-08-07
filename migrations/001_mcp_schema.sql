-- MCP Agent System Database Schema
-- Cloudflare D1 Migration Script
-- MCP Groups
CREATE TABLE IF NOT EXISTS mcp_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT 'blue',
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- MCP Servers
CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    transport TEXT CHECK(transport IN ('websocket', 'sse')) NOT NULL,
    user_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    auth_type TEXT CHECK(
        auth_type IN ('none', 'apikey', 'basic', 'oauth2', 'custom')
    ) NOT NULL,
    encrypted_credentials TEXT,
    -- JSON blob, encrypted
    status TEXT CHECK(
        status IN (
            'connected',
            'disconnected',
            'error',
            'authenticating',
            'pending_auth'
        )
    ) DEFAULT 'disconnected',
    is_enabled BOOLEAN DEFAULT TRUE,
    last_connected DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES mcp_groups(id) ON DELETE CASCADE
);
-- Agent Definitions
CREATE TABLE IF NOT EXISTS agents (
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
CREATE TABLE IF NOT EXISTS agent_mcp_groups (
    agent_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (agent_id, group_id),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES mcp_groups(id) ON DELETE CASCADE
);
-- Thread-Agent Assignments
CREATE TABLE IF NOT EXISTS thread_agents (
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
CREATE TABLE IF NOT EXISTS mcp_oauth_flows (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    state TEXT NOT NULL UNIQUE,
    step TEXT CHECK(
        step IN (
            'initiated',
            'callback_received',
            'token_exchange',
            'completed',
            'failed'
        )
    ) NOT NULL,
    auth_url TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_groups_user_id ON mcp_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_group_id ON mcp_servers(group_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_status ON mcp_servers(status, user_id);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_agents_thread_id ON thread_agents(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_agents_user_id ON thread_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_flows_state ON mcp_oauth_flows(state);