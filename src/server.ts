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

  /**
   * Override the fetch method to extract session from request headers
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const session = await getSession(request);
      this.userSession = session;
    } catch (error) {
      console.error(`Failed to extract session in Chat agent:`, error);
      this.userSession = null;
    }
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
    const userId = session?.userId;
    const kv = this.env?.CHAT_HISTORY_KV as KVNamespace | undefined;

    // Save user message immediately when received
    if (userId && kv && this.messages.length > 0) {
      try {
        await kv.put(userId, JSON.stringify(this.messages));
      } catch (e) {
        console.error(`Failed to save user message for user ${userId}:`, e);
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
            if (userId && kv) {
              try {
                await kv.put(userId, JSON.stringify(this.messages));
              } catch (e) {
                console.error(`Failed to save chat history for user ${userId}:`, e);
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
    await this.saveMessages(updatedMessages);

    const session = this.userSession;
    const userId = session?.userId;
    const kv = this.env?.CHAT_HISTORY_KV as KVNamespace | undefined;

    if (userId && kv) {
      try {
        await kv.put(userId, JSON.stringify(this.messages));
        console.log(`Chat history updated by executeTask for user ${userId}`);
      } catch (e) {
        console.error(`Failed to save chat history after executeTask for user ${userId}:`, e);
      }
    } else {
      if (!userId) console.warn("No userId, skipping chat history save (executeTask).");
      if (!kv) console.warn("KV namespace not available, skipping chat history save (executeTask).");
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
          'Location': '/', // Redirect to home page after login
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

    // NEW: Route for /chat/history (Protected by the middleware above)
    if (url.pathname === '/chat/history') {
      const session = await getSession(request);

      // This check is a safeguard. The middleware should have caught unauthenticated access.
      if (!session || !session.userId) {
         console.error("Critical: Reached /chat/history without session after auth middleware.");
         return new Response(JSON.stringify({ error: 'Authentication failed unexpectedly.' }), {
           status: 401, headers: { 'Content-Type': 'application/json' }
         });
      }

      const userId = session.userId;
      const kv = env.CHAT_HISTORY_KV;

      if (!kv) {
        console.warn('CHAT_HISTORY_KV namespace not available when trying to load history for user:', userId);
        // Return empty array instead of error for development mode
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const historyJson = await kv.get(userId);
        if (historyJson) {
          const messages: Message[] = JSON.parse(historyJson);
          return new Response(JSON.stringify(messages), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          // No history found, return an empty array. This is a valid state.
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (error) {
        console.error(`Failed to retrieve or parse chat history for user ${userId}:`, error);
        return new Response(JSON.stringify({ error: 'Could not load chat history.', details: error.message }), {
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
