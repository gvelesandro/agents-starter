# 🤖 Chat Agent Starter Kit

![agents-header](https://github.com/user-attachments/assets/f6d99eeb-1803-4495-9c5e-3cf07a37b402)

<a href="https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/agents-starter"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"/></a>

A starter template for building AI-powered chat agents using Cloudflare's Agent platform, powered by [`agents`](https://www.npmjs.com/package/agents). This project provides a foundation for creating interactive chat experiences with AI, complete with a modern UI and tool integration capabilities.

## Features

- 💬 Interactive chat interface with AI
- 🛠️ Built-in tool system with human-in-the-loop confirmation
- � **Model Context Protocol (MCP) integration** for external tool servers
- 🤖 **Dynamic AI agent system** with thread-specific specialization
- �📅 Advanced task scheduling (one-time, delayed, and recurring via cron)
- 🌓 Dark/Light theme support
- ⚡️ Real-time streaming responses
- 🔄 State management and chat history
- 🎨 Modern, responsive UI

## Prerequisites

- Cloudflare account
- OpenAI API key

## Quick Start

1. Create a new project:

```bash
npx create-cloudflare@latest --template cloudflare/agents-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up your environment:

Create a `.dev.vars` file:

```env
OPENAI_API_KEY=your_openai_api_key
```

4. Run locally:

```bash
npm start
```

5. Deploy:

```bash
npm run deploy
```

## Project Structure

```
├── src/
│   ├── app.tsx               # Chat UI implementation
│   ├── server.ts             # Chat agent logic with MCP integration
│   ├── tools.ts              # Tool definitions (built-in + MCP)
│   ├── lib/
│   │   └── mcp-connection.ts # MCP server connection manager
│   ├── api/
│   │   └── agents.ts         # Agent and MCP server management API
│   ├── types/
│   │   └── mcp.ts            # MCP and agent type definitions
│   ├── components/           # UI components for agent management
│   ├── utils.ts              # Helper functions
│   └── styles.css            # UI styling
```

## Customization Guide

### MCP Server Integration

This starter includes a full **Model Context Protocol (MCP)** integration system that allows you to connect external tool servers:

```typescript
// MCP servers are configured via database and connect automatically
// The system supports:
// - WebSocket and SSE transports
// - Authentication (API key, Basic Auth, OAuth2)
// - Automatic tool discovery
// - Reliability with retry logic
// - Thread-specific tool loading based on active agents

// Tools from MCP servers are automatically available alongside built-in tools
// No additional configuration needed - just configure servers in the UI
```

### Adding New Built-in Tools

Add new tools in `tools.ts` using the tool builder:

```typescript
// Example of a tool that requires confirmation
const searchDatabase = tool({
  description: "Search the database for user records",
  parameters: z.object({
    query: z.string(),
    limit: z.number().optional(),
  }),
  // No execute function = requires confirmation
});

// Example of an auto-executing tool
const getCurrentTime = tool({
  description: "Get current server time",
  parameters: z.object({}),
  execute: async () => new Date().toISOString(),
});

// Scheduling tool implementation
const scheduleTask = tool({
  description:
    "schedule a task to be executed at a later time. 'when' can be a date, a delay in seconds, or a cron pattern.",
  parameters: z.object({
    type: z.enum(["scheduled", "delayed", "cron"]),
    when: z.union([z.number(), z.string()]),
    payload: z.string(),
  }),
  execute: async ({ type, when, payload }) => {
    // ... see the implementation in tools.ts
  },
});
```

To handle tool confirmations, add execution functions to the `executions` object:

```typescript
export const executions = {
  searchDatabase: async ({
    query,
    limit,
  }: {
    query: string;
    limit?: number;
  }) => {
    // Implementation for when the tool is confirmed
    const results = await db.search(query, limit);
    return results;
  },
  // Add more execution handlers for other tools that require confirmation
};
```

Tools can be configured in two ways:

1. With an `execute` function for automatic execution
2. Without an `execute` function, requiring confirmation and using the `executions` object to handle the confirmed action

### Use a different AI model provider

The starting [`server.ts`](https://github.com/cloudflare/agents-starter/blob/main/src/server.ts) implementation uses the [`ai-sdk`](https://sdk.vercel.ai/docs/introduction) and the [OpenAI provider](https://sdk.vercel.ai/providers/ai-sdk-providers/openai), but you can use any AI model provider by:

1. Installing an alternative AI provider for the `ai-sdk`, such as the [`workers-ai-provider`](https://sdk.vercel.ai/providers/community-providers/cloudflare-workers-ai) or [`anthropic`](https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic) provider:
2. Replacing the AI SDK with the [OpenAI SDK](https://github.com/openai/openai-node)
3. Using the Cloudflare [Workers AI + AI Gateway](https://developers.cloudflare.com/ai-gateway/providers/workersai/#workers-binding) binding API directly

For example, to use the [`workers-ai-provider`](https://sdk.vercel.ai/providers/community-providers/cloudflare-workers-ai), install the package:

```sh
npm install workers-ai-provider
```

Add an `ai` binding to `wrangler.jsonc`:

```jsonc
// rest of file
  "ai": {
    "binding": "AI"
  }
// rest of file
```

Replace the `@ai-sdk/openai` import and usage with the `workers-ai-provider`:

```diff
// server.ts
// Change the imports
- import { openai } from "@ai-sdk/openai";
+ import { createWorkersAI } from 'workers-ai-provider';

// Create a Workers AI instance
+ const workersai = createWorkersAI({ binding: env.AI });

// Use it when calling the streamText method (or other methods)
// from the ai-sdk
- const model = openai("gpt-4o-2024-11-20");
+ const model = workersai("@cf/deepseek-ai/deepseek-r1-distill-qwen-32b")
```

Commit your changes and then run the `agents-starter` as per the rest of this README.

### Modifying the UI

The chat interface is built with React and can be customized in `app.tsx`:

- Modify the theme colors in `styles.css`
- Add new UI components in the chat container
- Customize message rendering and tool confirmation dialogs
- Add new controls to the header

### Example Use Cases

1. **Customer Support Agent with MCP Integration**

   - Add built-in tools for:
     - Ticket creation/lookup
     - Order status checking
     - Product recommendations
     - FAQ database search
   - Connect MCP servers for:
     - CRM system integration
     - Live chat transcription
     - Knowledge base search

2. **Development Assistant with GitHub MCP**

   - Integrate tools for:
     - Code linting
     - Git operations
     - Documentation search
     - Dependency checking
   - Connect GitHub MCP server for:
     - Repository management
     - Pull request automation
     - Issue tracking
     - GitHub Actions workflow management

3. **Data Analysis Assistant**

   - Build tools for:
     - Database querying
     - Data visualization
     - Statistical analysis
     - Report generation
   - Connect database MCP servers for:
     - Live data access
     - Query optimization
     - Real-time analytics

4. **Personal Productivity Assistant**

   - Implement tools for:
     - Task scheduling with flexible timing options
     - One-time, delayed, and recurring task management
     - Task tracking with reminders
     - Email drafting
     - Note taking

5. **Scheduling Assistant with MCP Math Server**
   - Build tools for:
     - One-time event scheduling using specific dates
     - Delayed task execution (e.g., "remind me in 30 minutes")
     - Recurring tasks using cron patterns
     - Task payload management
   - Connect MCP servers for:
     - Advanced mathematical calculations
     - Calendar system integration
     - Time zone conversions
     - Complex scheduling algorithms

Each use case can be implemented by:

1. Adding relevant built-in tools in `tools.ts`
2. **Configuring MCP servers** via the agent management UI
3. **Creating specialized agents** with specific tool combinations
4. Customizing the UI for specific interactions
5. Extending the agent's capabilities in `server.ts`
6. Adding any necessary external API integrations

### MCP Server Examples

The system is designed to work with any MCP-compliant server:

- **Math Server**: Advanced calculations and mathematical operations
- **GitHub Server**: Repository management, Actions, and code analysis  
- **Database Server**: SQL queries and data analysis
- **Calendar Server**: Scheduling and time management
- **Custom Servers**: Build your own MCP servers for specific needs

## Learn More

- [`agents`](https://github.com/cloudflare/agents/blob/main/packages/agents/README.md)
- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## License

MIT
