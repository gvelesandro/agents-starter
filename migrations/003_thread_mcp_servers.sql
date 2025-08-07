-- Migration: Add thread-MCP server assignments table
-- This allows independent MCP servers to be assigned to specific threads
-- Thread-MCP Server Assignments
CREATE TABLE IF NOT EXISTS thread_mcp_servers (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    removed_at DATETIME,
    added_reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (server_id) REFERENCES mcp_servers_independent(id) ON DELETE CASCADE
);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_thread_mcp_servers_thread_id ON thread_mcp_servers(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_mcp_servers_server_id ON thread_mcp_servers(server_id);
CREATE INDEX IF NOT EXISTS idx_thread_mcp_servers_user_id ON thread_mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_mcp_servers_is_active ON thread_mcp_servers(is_active);
-- Ensure unique active assignments (one server can only be assigned once per thread)
CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_mcp_servers_unique_active ON thread_mcp_servers(thread_id, server_id)
WHERE is_active = TRUE;