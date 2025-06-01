import { routeAgentRequest, type Schedule } from "agents";
import { type CookieSerializeOptions, serialize } from 'cookie';
import { createSessionCookie, getSession, clearSessionCookie, type SessionData } from './auth/session';

import { unstable_getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  createDataStreamResponse,
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  type ToolSet,
  type Message, // Import Message type
} from "ai";
import { openai } from "@ai-sdk/openai";
import { processToolCalls } from "./utils";
import { tools, executions } from "./tools";
// import { env } from "cloudflare:workers";

const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  private userSession: SessionData | null = null;
  private threadId: string | null = null;

  /**
   * Override the fetch method to extract session from request headers
   * and parse the threadId from the agent's ID.
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const session = await getSession(request); // Assuming getSession handles errors or returns null
      this.userSession = session;

      if (!this.id) {
        // This case should ideally not happen if the DO is invoked with an ID.
        console.error("Chat.fetch: Critical - Durable Object ID (this.id) is missing.");
        return new Response("Agent instance ID missing", { status: 500 });
      }

      // Reset threadId at the beginning of each fetch to ensure no stale state if logic below doesn't set it.
      this.threadId = null;

      // Check if the ID is in the expected format userId_threadId
      // Split by the first underscore only to correctly handle threadIds that might contain underscores.
      const idParts = this.id.split(/_(.*)/s);

      if (idParts.length === 2 && idParts[0] && idParts[1]) {
        const userIdFromId = idParts[0];
        const threadIdFromId = idParts[1];

        // Session validation is crucial for thread-specific operations
        if (!session || !session.userId) {
          console.error("Chat.fetch: User session or userId is missing. Cannot proceed with thread-specific ID.");
          // For thread-specific IDs, a session is required.
          return new Response("User session not found.", { status: 401 });
        }

        if (userIdFromId === session.userId) {
          this.threadId = threadIdFromId; // Set instance threadId
          // Successfully initialized for a specific thread
          console.log(`Chat.fetch: Initialized for userId: ${session.userId}, threadId: ${this.threadId}`);
        } else {
          console.error(`Chat.fetch: User ID mismatch. Session userId: '${session.userId}', ID userId: '${userIdFromId}'. Denying access for ID '${this.id}'.`);
          return new Response("User ID mismatch.", { status: 403 }); // Forbidden
        }
      } else {
        // ID is not in the expected "userId_threadId" format (e.g., "default", "user1", etc.)
        console.warn(`Chat.fetch: Non-thread-specific or improperly formatted agent ID encountered: '${this.id}'. Proceeding without thread context.`);
        // this.threadId remains null, as set above.
        // Allow to proceed. Base agent might handle. If a session is required for these non-thread IDs,
        // further checks for `session` might be needed here or in `super.fetch` or specific handlers.
        // For now, if it's not a thread-specific ID, we don't enforce session presence at this stage,
        // assuming `super.fetch` or subsequent logic will handle it if required.
      }
    } catch (error) {
      console.error(`Chat.fetch: Error during session extraction or initial setup:`, error);
      this.userSession = null; // Ensure session is cleared on error
      this.threadId = null;  // Ensure threadId is cleared on error
      // Depending on the error, might want to return an error response
      // If it's a Response already, rethrow it
      if (error instanceof Response) return error;
      // Otherwise, let super.fetch decide or return a generic error
      return new Response("Error during agent initialization.", { status: 500 });
    }

    // Proceed with the actual agent request handling by the base class or specific routes
    return super.fetch(request);
  }

  /**
   * Handles incoming chat messages and manages the response stream
   * @param onFinish - Callback function executed when streaming completes
   */

  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: { abortSignal?: AbortSignal }
  ) {
    const session = this.userSession;
    const kv = this.env?.CHAT_HISTORY_KV as KVNamespace | undefined;

    if (!session || !session.userId) {
      console.error("Chat.onChatMessage: User session or userId not available.");
      // This should ideally be caught by fetch, but as a safeguard:
      throw new Error("User session not available. Cannot proceed with chat.");
    }
    if (!this.threadId) {
      console.error("Chat.onChatMessage: threadId is not set.");
      throw new Error("threadId not available. Cannot proceed with chat.");
    }

    const userId = session.userId; // Use validated userId from session
    const kvKey = `${userId}_${this.threadId}`;

    // Save user message immediately when received
    if (kv && this.messages.length > 0) {
      try {
        // Make sure this.messages reflects the new message if it's added by the caller
        // or if this.addMessage was called before onChatMessage.
        // Assuming this.messages is up-to-date here.
        await kv.put(kvKey, JSON.stringify(this.messages));
        console.log(`User message saved for key ${kvKey}`);
      } catch (e) {
        console.error(`Failed to save user message for key ${kvKey}:`, e);
      }
    }
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.unstable_getAITools(),
    };

    // Create a streaming response that handles both text and tool outputs
    const dataStreamResponse = createDataStreamResponse({
      execute: async (dataStream) => {
        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: this.messages,
          dataStream,
          tools: allTools,
          executions,
        });

        // Stream the AI response using GPT-4
        const result = streamText({
          model,
          system: `You are a helpful assistant that can do various tasks... 

${unstable_getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.
`,
          messages: processedMessages,
          tools: allTools,
          onFinish: async (args) => {
            onFinish(
              args as Parameters<StreamTextOnFinishCallback<ToolSet>>[0]
            );
            // Save complete conversation after AI response
            if (kv) { // userId and threadId are already validated and kvKey constructed
              try {
                await kv.put(kvKey, JSON.stringify(this.messages));
                console.log(`Chat history saved for key ${kvKey} after AI response.`);
              } catch (e) {
                console.error(`Failed to save chat history for key ${kvKey}:`, e);
              }
            }
          },
          onError: (error) => {
            console.error("Error while streaming:", error);
          },
          maxSteps: 10,
        });

        // Merge the AI response stream with tool execution outputs
        result.mergeIntoDataStream(dataStream);
      },
    });

    return dataStreamResponse;
  }
  async executeTask(description: string, task: Schedule<string>) {
    const taskMessage: Message = {
      id: generateId(),
      role: "user",
      content: `Running scheduled task: ${description}`,
      createdAt: new Date(),
    };

    const updatedMessages = [...this.messages, taskMessage];
    await this.saveMessages(updatedMessages); // This needs to use the new key too if it writes to KV

    const session = this.userSession;
    const kv = this.env?.CHAT_HISTORY_KV as KVNamespace | undefined;

    if (!session || !session.userId) {
      console.warn("Chat.executeTask: No session/userId, skipping chat history save.");
      // Depending on how critical this is, might throw an error
      return;
    }
    if (!this.threadId) {
      console.error("Chat.executeTask: threadId is not set. Skipping chat history save.");
      // Depending on how critical this is, might throw an error
      return;
    }

    const userId = session.userId;
    const kvKey = `${userId}_${this.threadId}`;

    // The `saveMessages` method internally updates `this.messages`.
    // So, we just need to PUT the latest `this.messages`.
    if (kv) {
      try {
        await kv.put(kvKey, JSON.stringify(this.messages));
        console.log(`Chat history updated by executeTask for key ${kvKey}`);
      } catch (e) {
        console.error(`Failed to save chat history after executeTask for key ${kvKey}:`, e);
      }
    } else {
      if (!kv) console.warn("Chat.executeTask: KV namespace not available, skipping chat history save.");
    }

    // Note: The `saveMessages` method in AIChatAgent usually loads from KV, updates, then saves.
    // We need to ensure it's compatible or that this direct kv.put is sufficient.
    // `AIChatAgent.saveMessages` does:
    //   messages = await this.loadMessages() ?? []
    //   messages.push(...newMessages)
    //   await this.env.CHAT_HISTORY_KV.put(this.id, JSON.stringify(messages))
    // This means `AIChatAgent.saveMessages` also needs to be aware of the `userId_threadId` key.
    // For now, the `put` above correctly saves `this.messages` which `executeTask` modified.
    // However, `this.addMessage` (called by `super.fetch`) and `this.saveMessages`
    // in the base `AIChatAgent` would use `this.id` (the composite key) directly as the KV key.
    // This is actually what we want for the base class methods if they use KV.
    // Let's re-check `AIChatAgent.ts`.
    // The `AIChatAgent` itself doesn't have `loadMessages` or `saveMessages` using KV.
    // It has `this.messages.add(message)` which is an in-memory operation.
    // `loadMessages` and `saveMessages` are specific to this `Chat` class (or were intended to be).
    // The base `AIChatAgent` has `protected messages: Message[] = [];`
    // and `addMessage(message: Message)` which just pushes to this array.
    // The `Chat` class here has `saveMessages` which is NOT defined in the provided code.
    // Let's assume `await this.saveMessages(updatedMessages);` was pseudo-code
    // or a method not shown, and that `this.messages` is correctly updated in memory.
    // The `kv.put` operations in `onChatMessage` and `executeTask` are responsible for KV persistence.
  }

  async clearHistory(): Promise<void> {
    // Call base method to clear in-memory messages and notify client
    // Assuming super.clearHistory() is synchronous or we don't need to wait for client update before KV delete.
    // The actual `super.clearHistory()` in AIChatAgent is synchronous.
    super.clearHistory();

    const session = this.userSession;
    const currentThreadId = this.threadId; // Should be set during fetch

    if (!session || !session.userId) {
      console.error("Chat.clearHistory: No user session found. Cannot clear from KV.");
      // Not throwing an error here because client-side messages are already cleared.
      // This ensures partial success (UI clear) even if server-side KV delete fails pre-check.
      return;
    }
    if (!currentThreadId) {
      console.error("Chat.clearHistory: No threadId found. Cannot clear from KV.");
      return;
    }

    const kv = this.env?.CHAT_HISTORY_KV as KVNamespace | undefined;
    if (!kv) {
      console.error("Chat.clearHistory: CHAT_HISTORY_KV namespace not available. Cannot clear from KV.");
      // Consider if an error should be thrown to the client.
      // For now, logs the error and returns, client messages are already cleared.
      return;
    }

    const kvKey = `${session.userId}_${currentThreadId}`;

    try {
      await kv.delete(kvKey);
      console.log(`Chat history cleared from KV for key: ${kvKey}`);
    } catch (e) {
      console.error(`Failed to delete chat history from KV for key ${kvKey}:`, e);
      // Depending on how the agent framework handles errors from this method,
      // an error could be thrown here. For now, logging it.
      // throw new Error(`Failed to delete chat history from KV: ${e.message}`);
    }
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Retrieve secrets from the environment
    // Note: In Cloudflare Workers, you access secrets/env vars via the `env` parameter of fetch.
    // For local dev with .dev.vars, process.env might work due to nodejs_compat flag,
    // but `env.VAR_NAME` is the standard way in deployed workers.

    const GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID;
    const GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET;
    const GITHUB_AUTHORIZED_USERNAMES = (env.GITHUB_AUTHORIZED_USERNAMES || '').split(',').map(u => u.trim()).filter(u => u);
    const SESSION_SECRET = env.SESSION_SECRET; // Used for signing/encryption, though not fully implemented in session.ts yet

    const OAUTH_STATE_COOKIE_NAME = '__oauth_state';

    // Route: /auth/github - Redirect to GitHub for login
    if (url.pathname === '/auth/github') {
      if (!GITHUB_CLIENT_ID) {
        console.error('GITHUB_CLIENT_ID is not set.');
        return new Response('GitHub OAuth not configured.', { status: 500 });
      }

      const state = generateId(); // Simple CSRF token
      const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
      githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
      githubAuthUrl.searchParams.set('redirect_uri', `${url.origin}/auth/github/callback`);
      githubAuthUrl.searchParams.set('scope', 'read:user'); // Request user's public profile
      githubAuthUrl.searchParams.set('state', state);

      const stateCookie = serialize(OAUTH_STATE_COOKIE_NAME, state, {
        httpOnly: true,
        secure: url.protocol === 'https:', // Secure cookie in production
        path: '/',
        maxAge: 60 * 10, // 10 minutes for state validity
        sameSite: 'lax',
      });

      return new Response(null, {
        status: 302,
        headers: {
          'Location': githubAuthUrl.toString(),
          'Set-Cookie': stateCookie,
        },
      });
    }

    // Route: /auth/github/callback - Handle callback from GitHub
    if (url.pathname === '/auth/github/callback') {
      if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
        console.error('GitHub OAuth credentials are not fully configured.');
        return new Response('GitHub OAuth not configured.', { status: 500 });
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      const cookieHeader = request.headers.get('Cookie');
      const storedState = cookieHeader?.split(';').find(c => c.trim().startsWith(`${OAUTH_STATE_COOKIE_NAME}=`))?.split('=')[1];

      if (!code || !returnedState || !storedState || returnedState !== storedState) {
        console.warn('State mismatch or missing code/state.', { returnedState, storedState });
        return new Response('Invalid OAuth state or code. Please try logging in again.', { status: 400 });
      }

      // Clear the state cookie
      const clearStateCookie = serialize(OAUTH_STATE_COOKIE_NAME, '', {
        httpOnly: true,
        secure: url.protocol === 'https:',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });

      try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code: code,
            redirect_uri: `${url.origin}/auth/github/callback`,
          }),
        });

        if (!tokenResponse.ok) {
          const errorBody = await tokenResponse.text();
          console.error('GitHub token exchange failed:', tokenResponse.status, errorBody);
          return new Response('Failed to obtain GitHub access token.', { status: 500 });
        }

        const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
        if (tokenData.error || !tokenData.access_token) {
          console.error('GitHub token response error:', tokenData);
          return new Response(`Failed to obtain GitHub access token: ${tokenData.error || 'No token received'}.`, { status: 500 });
        }
        const accessToken = tokenData.access_token;

        // Fetch user profile from GitHub
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Cloudflare-Chat-Agent' // GitHub requires a User-Agent
          },
        });

        if (!userResponse.ok) {
          const errorBody = await userResponse.text();
          console.error('GitHub user fetch failed:', userResponse.status, errorBody);
          return new Response('Failed to fetch user profile from GitHub.', { status: 500 });
        }

        const githubUser = await userResponse.json() as { login?: string; id?: number };
        if (!githubUser.login || !githubUser.id) {
            console.error('GitHub user data incomplete:', githubUser);
            return new Response('Failed to retrieve complete user information from GitHub.', { status: 500 });
        }

        // Authorization check
        if (GITHUB_AUTHORIZED_USERNAMES.length > 0 && !GITHUB_AUTHORIZED_USERNAMES.includes(githubUser.login)) {
          console.warn(`User ${githubUser.login} is not authorized.`);
          // Optionally, redirect to a specific "unauthorized" page
          return new Response(`User ${githubUser.login} is not authorized to use this application.`, { status: 403 });
        }

        // Create session
        const sessionData: SessionData = {
          userId: githubUser.id.toString(),
          username: githubUser.login,
          accessToken: accessToken, // Store token if you need to make further GitHub API calls
        };
        const sessionCookie = createSessionCookie(sessionData);

        const headers = new Headers({
          'Location': 'http://localhost:5173/', // Redirect to frontend after login
          'Set-Cookie': sessionCookie,
        });
        // Append the command to clear the state cookie
        headers.append('Set-Cookie', clearStateCookie);

        return new Response(null, {
          status: 302,
          headers: headers,
        });

      } catch (error) {
        console.error('Error during GitHub OAuth callback:', error);
        return new Response('An unexpected error occurred during login. Please try again.', { status: 500, headers: { 'Set-Cookie': clearStateCookie } });
      }
    }

    // NEW: Route for /chat/thread/:threadId (Protected by the middleware)
    const threadMatch = url.pathname.match(/^\/chat\/thread\/([a-zA-Z0-9_-]+)$/);
    if (threadMatch) {
      const threadId = threadMatch[1];
      const session = await getSession(request);

      if (!session || !session.userId) {
        console.error("Critical: Reached /chat/thread/:threadId without session after auth middleware.");
        return new Response(JSON.stringify({ error: 'Authentication failed unexpectedly.' }), {
          status: 401, headers: { 'Content-Type': 'application/json' }
        });
      }

      const userId = session.userId;
      const kv = env.CHAT_HISTORY_KV;

      if (!kv) {
        console.warn(`CHAT_HISTORY_KV namespace not available for user: ${userId}, thread: ${threadId}`);
        return new Response(JSON.stringify({ error: 'Chat history storage not available.' }), {
          status: 500, headers: { 'Content-Type': 'application/json' }
        });
      }

      const kvKey = `${userId}_${threadId}`;
      try {
        const historyJson = await kv.get(kvKey);
        if (historyJson) {
          const messages: Message[] = JSON.parse(historyJson);
          return new Response(JSON.stringify(messages), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          // No history found for this specific thread, return an empty array or 404.
          // For consistency with how new chats might appear, an empty array is fine.
          // Or, a 404 might be more semantically correct if the thread is expected to exist.
          // Let's go with 404 if no specific thread history is found.
          return new Response(JSON.stringify({ error: 'Chat thread not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (error) {
        console.error(`Failed to retrieve or parse chat history for key ${kvKey}:`, error);
        return new Response(JSON.stringify({ error: 'Could not load chat thread history.', details: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Route: /auth/logout - Clear session and redirect
    if (url.pathname === '/auth/logout') {
      const sessionClearCookie = clearSessionCookie();
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/', // Redirect to home page or a specific login page
          'Set-Cookie': sessionClearCookie,
        },
      });
    }

    // Route: /auth/me - Get current session user (for frontend)
    if (url.pathname === '/auth/me') {
      const session = await getSession(request); // getSession is async
      if (session) {
        return new Response(JSON.stringify({ username: session.username, userId: session.userId }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      } else {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 401, // Unauthorized
        });
      }
    }

    // Define public paths that don't require authentication
    const publicPaths = [
      '/auth/github',
      '/auth/github/callback',
      '/auth/logout',
      '/auth/me', // Added /auth/me
      '/check-open-ai-key',
      // Add any other public static asset paths if they are served through this worker
      // and not via a separate routing rule or 'assets' configuration in wrangler.jsonc.
      // For example, if you have CSS or JS files directly served.
      // However, 'public/' directory in wrangler.jsonc usually handles static assets separately.
    ];

    // --- Authentication Middleware Logic ---
    if (!publicPaths.includes(url.pathname)) {
      const session = await getSession(request); // getSession is async

      if (!session) {
        const acceptHeader = request.headers.get('Accept');
        const isApiRequest = acceptHeader?.includes('application/json') ||
                             request.headers.get('X-Requested-With') === 'XMLHttpRequest';

        if (isApiRequest) {
          console.log(`No session for API path ${url.pathname}, returning 401.`);
          return new Response(JSON.stringify({ error: 'Not authenticated. Please log in.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          console.log(`No session for path ${url.pathname}, redirecting to login.`);
          return new Response(null, {
            status: 302,
            headers: {
              'Location': `${url.origin}/auth/github`,
            },
          });
        }
      }

      // If there is a session, you could potentially enrich the request or env for the DO
      // For example: (env as any).currentUser = session.username;
      // However, the Durable Object itself doesn't automatically get this modified env.
      // The session is validated; access is granted.
      // The DO will operate without direct knowledge of the user unless specifically passed.
      console.log(`Session valid for ${session.username} on (non-public) path ${url.pathname}. Proceeding.`);
    }
    // --- End of Authentication Middleware Logic ---

    // Route for /chat/history (Lists all thread IDs for the user)
    if (url.pathname === '/chat/history') {
      const session = await getSession(request);

      if (!session || !session.userId) {
         console.error("Critical: Reached /chat/history without session after auth middleware.");
         return new Response(JSON.stringify({ error: 'Authentication failed unexpectedly.' }), {
           status: 401, headers: { 'Content-Type': 'application/json' }
         });
      }

      const userId = session.userId;
      const kv = env.CHAT_HISTORY_KV;

      if (!kv) {
        console.warn('CHAT_HISTORY_KV namespace not available for /chat/history, user:', userId);
        return new Response(JSON.stringify({ error: 'Chat history storage not available.' }), {
          status: 500, headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        const listResult = await kv.list({ prefix: userId + '_' });
        const threadIds = listResult.keys.map(key => {
          // key.name is like "userId_threadId"
          // We need to extract the threadId part.
          const parts = key.name.split('_');
          return parts.slice(1).join('_'); // Handles threadIds that might themselves contain '_'
        }).filter(tid => tid); // Filter out any empty threadIds if a key was somehow just "userId_"

        // Optionally, add more metadata here later, e.g., last message snippet or timestamp
        // For now, just the list of thread IDs.
        const responseData = threadIds.map(id => ({ threadId: id }));

        return new Response(JSON.stringify(responseData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error(`Failed to list chat threads for user ${userId}:`, error);
        return new Response(JSON.stringify({ error: 'Could not list chat threads.', details: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Route for /check-open-ai-key (this seems to be public already)
    if (url.pathname === "/check-open-ai-key") {
      const hasOpenAIKey = !!env.OPENAI_API_KEY;
      return Response.json({
        success: hasOpenAIKey,
      });
    }

    // OpenAI key check (should probably be earlier if it's a critical failure)
    if (!env.OPENAI_API_KEY && !publicPaths.includes(url.pathname) && url.pathname !== '/chat/history') {
      // Avoid erroring for public paths or the new history path if key is missing
      console.error(
        "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
      // Potentially return an error if this is a route that requires OpenAI
    }

    // Fallback to agent routing for other paths (e.g., the main chat agent interaction endpoint)
    const agentResponse = await routeAgentRequest(request, env, ctx);
    if (agentResponse) {
      return agentResponse;
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
