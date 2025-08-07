# Thread Switching Message Persistence Issue Analysis

## Root Cause Identified

The issue occurs due to a **race condition between component re-mounting and agent connection establishment** when switching threads.

## Problem Flow

1. **User switches threads** → `currentThreadId` changes
2. **ChatInterface re-mounts** due to key prop: `key={currentUser.userId}-${currentThreadId}`
3. **New component instance** starts with:
   - `historyMessages = undefined`
   - `canUseAgentChat = false`
   - `isLoadingHistory = true`
4. **useAgent hook called** with new connection name: `${currentUser.userId}-${currentThreadId}`
5. **useAgentChat hook called** with `initialMessages: undefined`
6. **Parallel execution**:
   - useEffect fetches thread history (async)
   - Agent connection establishes (async)
   - User may send message before both complete
7. **First message sent** before agent is fully ready
8. **Message persistence fails** or saves to wrong location

## Key Issues

### Issue 1: Component Re-mounting

The `key` prop forces complete re-mount:

```tsx
<ChatInterface
  key={`${currentUser.userId}-${currentThreadId}`} // Forces re-mount
  currentThreadId={currentThreadId}
  // ...
/>
```

### Issue 2: Race Condition in Agent Setup

```tsx
// Agent connection name set immediately
const agent = useAgent({
  agent: "chat",
  name: `${currentUser?.userId}-${currentThreadId}`, // ✅ Correct
});

// But canUseAgentChat depends on agent.agent being ready
useEffect(() => {
  setCanUseAgentChat(
    enabled && !!currentUser?.userId && !!currentThreadId && !!agent.agent // ⚠️ May not be ready
  );
}, [enabled, currentUser?.userId, currentThreadId, agent.agent]);
```

### Issue 3: Message History Loading Race

```tsx
// History starts as undefined
const [historyMessages, setHistoryMessages] = useState<Message[] | undefined>(undefined);

// useAgentChat called immediately with undefined initialMessages
const agentChatResult = useAgentChat({
  agent: agent,
  initialMessages: historyMessages,  // ⚠️ undefined on first render
  // ...
});

// History loaded asynchronously in parallel
useEffect(() => {
  // Fetch thread history...
  .then((data) => {
    setHistoryMessages(Array.isArray(data) ? data : []);  // ⚠️ After useAgentChat already called
  });
}, [enabled, currentUser?.userId, currentThreadId, setCurrentUser]);
```

### Issue 4: Server-Side Thread ID Extraction Timing

```typescript
// In Chat.onChatMessage()
let threadId = "default";

if (this.name) {
  // ⚠️ this.name might not be set yet
  const parts = this.name.split("-");
  if (parts.length >= 2) {
    const extractedThreadId = parts.slice(1).join("-").trim();
    threadId = extractedThreadId || "default";
  }
}
```

## Evidence

### 1. Thread ID Extraction Logic is Correct

✅ Tested extraction logic - works perfectly for all cases:

- `"user123-default"` → `"default"`
- `"user123-thread_abc123"` → `"thread_abc123"`
- `"user123-thread_2024-01-15-session-abc"` → `"thread_2024-01-15-session-abc"`

### 2. Component Lifecycle Issues

❌ ChatInterface re-mounts on every thread switch
❌ Agent connection and history loading happen in parallel
❌ User can send message before setup completes

## Potential Solutions

### Solution 1: Remove Component Re-mounting

Remove the `key` prop and handle thread switching within the same component instance:

```tsx
// Instead of:
<ChatInterface key={`${currentUser.userId}-${currentThreadId}`} ... />

// Use:
<ChatInterface currentThreadId={currentThreadId} ... />
```

### Solution 2: Proper Loading States

Wait for both agent connection and history loading before enabling chat:

```tsx
const isReady =
  canUseAgentChat && !isLoadingHistory && historyMessages !== undefined;
```

### Solution 3: Agent Connection Verification

Add logging to verify agent.name is set correctly before first message:

```tsx
// Add debug logging in onChatMessage
console.log("Chat agent name:", this.name);
console.log("Extracted thread ID:", threadId);
```

### Solution 4: Prevent Premature Message Sending

Disable input until agent and history are fully loaded:

```tsx
const canSendMessage = isReady && !isAgentLoading && agentInput.trim();
```

## Recommended Fix Priority

1. **High**: Remove component re-mounting (Solution 1)
2. **High**: Wait for both agent and history ready (Solution 2)
3. **Medium**: Add proper loading states and disable input (Solution 4)
4. **Low**: Add debug logging for verification (Solution 3)

## Testing Strategy

1. Switch to a new thread
2. Immediately try to send a message
3. Verify message is saved to correct thread storage
4. Check that subsequent messages work correctly

The issue is most likely to occur when users quickly switch threads and immediately send messages before the agent connection is fully established.
