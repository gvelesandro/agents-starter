-- Migration: Add independent MCP servers table and update schema
-- This allows servers to exist independently of groups
-- Create independent MCP servers table
CREATE TABLE IF NOT EXISTS mcp_servers_independent (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    transport TEXT NOT NULL DEFAULT 'websocket',
    -- 'websocket' | 'sse'
    auth_type TEXT NOT NULL DEFAULT 'none',
    -- 'none' | 'apikey' | 'basic' | 'oauth2' | 'custom'
    auth_config TEXT,
    -- JSON string for credentials
    is_enabled BOOLEAN NOT NULL DEFAULT 1,
    status TEXT,
    -- 'connected' | 'disconnected' | 'error' | 'authenticating' | 'pending_auth'
    tools TEXT,
    -- JSON array of available tools
    last_tested DATETIME,
    user_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_servers_independent_user_id ON mcp_servers_independent(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_independent_status ON mcp_servers_independent(status);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_independent_is_enabled ON mcp_servers_independent(is_enabled);
-- Create junction table to link independent servers to groups
CREATE TABLE IF NOT EXISTS mcp_group_servers (
    group_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, server_id),
    FOREIGN KEY (group_id) REFERENCES mcp_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES mcp_servers_independent(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_group_servers_group_id ON mcp_group_servers(group_id);
CREATE INDEX IF NOT EXISTS idx_mcp_group_servers_server_id ON mcp_group_servers(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_group_servers_user_id ON mcp_group_servers(user_id);
-- Update triggers to maintain updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_mcp_servers_independent_updated_at
AFTER
UPDATE ON mcp_servers_independent FOR EACH ROW BEGIN
UPDATE mcp_servers_independent
SET updated_at = CURRENT_TIMESTAMP
WHERE id = NEW.id;
END;
-- Migrate existing servers from mcp_servers to mcp_servers_independent
-- (This would be part of the migration script)
/*
 INSERT INTO mcp_servers_independent (id, name, url, transport, auth_type, auth_config, is_enabled, status, user_id, created_at, updated_at)
 SELECT id, name, server_uri, transport, auth_type, auth_config, is_enabled, status, user_id, created_at, updated_at
 FROM mcp_servers;
 
 -- Link existing servers to their groups
 INSERT INTO mcp_group_servers (group_id, server_id, user_id)
 SELECT group_id, id, user_id
 FROM mcp_servers;
 */