-- Migration: Add agent-MCP server direct assignments table
-- This allows agents to use existing independent MCP servers directly
-- Agent-MCP Server Assignments
-- Direct association between agents and independent MCP servers
CREATE TABLE IF NOT EXISTS agent_mcp_servers (
    agent_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agent_id, server_id),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES mcp_servers_independent(id) ON DELETE CASCADE
);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_mcp_servers_agent_id ON agent_mcp_servers(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_mcp_servers_server_id ON agent_mcp_servers(server_id);
CREATE INDEX IF NOT EXISTS idx_agent_mcp_servers_user_id ON agent_mcp_servers(user_id);
-- Update triggers to maintain updated_at timestamp for agents table
CREATE TRIGGER IF NOT EXISTS update_agents_updated_at
AFTER
UPDATE ON agents FOR EACH ROW BEGIN
UPDATE agents
SET updated_at = CURRENT_TIMESTAMP
WHERE id = NEW.id;
END;