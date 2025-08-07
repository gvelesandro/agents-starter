# MCP Agent System - Product Requirements Document

## Executive Summary

This PRD outlines the integration of Model Context Protocol (MCP) servers with the existing Cloudflare Chat Agents system to enable dynamic, composable AI agents with external tool capabilities.

## Current System Analysis

### Existing Architecture

- **Tools System**: Well-defined tool pattern with confirmation/auto-execute modes
- **Notification System**: Thread-aware notifications with localStorage persistence
- **Scheduling System**: Built-in task scheduling with agent context
- **UI Components**: Sidebar, thread management, notification display

### Current Tools

- `getWeatherInformation` (confirmation required)
- `getLocalTime` (auto-execute)
- `scheduleTask` (auto-execute, uses agent context)
- `getScheduledTasks` (auto-execute, uses agent context)
- `cancelScheduledTask` (auto-execute, uses agent context)

## Problem Statement

Users need specialized AI agents that can access external services and tools beyond the built-in capabilities. Current system is limited to 5 built-in tools and cannot be extended without code changes.

## Solution Overview

### Core Concept: Agents as Specialists

- **Agents** = Curated collections of MCP server tools + persona
- **Thread-scoped**: Different agents can be active in different conversations
- **Dynamic**: Agents can be added/removed from threads like "specialists on a job"
- **Composable**: Users can create, share, and remix agent definitions

## Key Features

### 1. MCP Server Management

- **Server Connection**: WebSocket (primary) + SSE (fallback) transport
- **Authentication**: API keys, Basic auth, OAuth2 flows with popup/redirect
- **Reliability**: Retry logic, fallback handling, graceful degradation
- **Storage**: Server-side (Cloudflare D1) for cross-device persistence

### 2. Agent System

- **Agent Definition**: Name, description, MCP groups, persona, color
- **Thread Management**: Per-thread agent selection with history
- **Tool Integration**: MCP tools follow existing confirmation patterns
- **Agent Context**: MCP tools can access `getCurrentAgent<Chat>()` like built-in tools

### 3. Group Management

- **MCP Groups**: Logical collections of related MCP servers
- **Agent Composition**: Agents combine multiple MCP groups
- **Multi-select**: Users can activate multiple groups per agent
- **Visual Organization**: Color coding and categorization

### 4. UI Integration

- **Quick Selection**: In-chat agent dropdown (like ChatGPT's GPT selector)
- **Agent Management**: Collapsible sidebar panel for agent CRUD
- **Configuration**: Modal for complex agent setup and MCP server auth
- **Mobile Support**: Bottom sheet interface for mobile users

### 5. Notification Enhancement

- **Agent Events**: Agent added/removed, tools updated, auth required
- **MCP Events**: Server connection issues, OAuth flows, tool failures
- **Thread Context**: Enhanced notifications with agent and thread awareness

## Success Metrics

### User Experience

- Users can create and use custom agents within 5 minutes
- Tool failures don't interrupt conversations (graceful fallback)
- Cross-device agent access works seamlessly

### Technical

- Built-in tools remain 100% reliable regardless of MCP status
- MCP server failures isolated (don't affect other servers/agents)
- Tool confirmation UX consistent between built-in and MCP tools

## Non-Goals (Phase 1)

- Multi-agent collaboration within single thread
- Real-time MCP server discovery/marketplace
- Agent template marketplace with ratings/reviews
- Advanced MCP server version management

## Technical Requirements

### Performance

- MCP tool loading: <2s for server connection + tool discovery
- Agent switching: <500ms for UI update
- Fallback activation: <100ms when MCP server fails

### Reliability

- 99%+ uptime for built-in tools (unaffected by MCP issues)
- Graceful degradation when MCP servers unavailable
- Auto-retry with exponential backoff for MCP operations

### Security

- OAuth flows handled securely (popup + mobile fallback)
- MCP credentials encrypted at rest
- Per-user isolation of agent configurations

## Implementation Phases

### Phase 1: Foundation (Current)

- [ ] MCP server connection management
- [ ] Basic agent CRUD operations
- [ ] Tool integration with reliability layer
- [ ] Enhanced notification system

### Phase 2: UI Polish

- [ ] Agent management UI components
- [ ] OAuth flow implementation
- [ ] Mobile-responsive design
- [ ] Notification flow improvements

### Phase 3: Advanced Features

- [ ] Agent sharing/templates
- [ ] Multi-agent thread support
- [ ] Advanced MCP server management
- [ ] Performance optimizations

## Risks & Mitigations

### Risk: MCP Server Reliability

**Mitigation**: Comprehensive fallback system, retry logic, user notifications

### Risk: OAuth Flow Complexity

**Mitigation**: Popup primary, mobile redirect fallback, clear error messages

### Risk: UI Complexity

**Mitigation**: Progressive disclosure, follow existing notification patterns

### Risk: Performance Impact

**Mitigation**: Tool loading optimization, connection caching, graceful timeouts

## Dependencies

### External

- MCP SDK (@modelcontextprotocol/sdk)
- Cloudflare D1 database setup
- OAuth providers (Google, GitHub, etc.)

### Internal

- Current notification system enhancement
- Sidebar component extension
- Tools system integration

## Questions for Resolution

1. Should agent sharing be included in Phase 1 or Phase 2?
2. Default MCP server timeout duration?
3. Maximum number of agents per user?
4. Agent template storage limits?

---

**Document Status**: Draft v1.0  
**Last Updated**: August 5, 2025  
**Next Review**: Implementation kickoff
