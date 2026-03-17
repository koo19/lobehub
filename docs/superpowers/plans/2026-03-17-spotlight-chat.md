# Spotlight Chat Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up real chat functionality in the Spotlight window: message rendering, atomic send flow via TRPC + streaming, cross-window sync, and "open in main window".

**Architecture:** Spotlight calls TRPC `aiChat.sendMessageInServer` for atomic message creation, then `chatService.createAssistantMessageStream()` for streaming. Messages rendered via existing `CustomMDX` component (react-markdown + @lobehub/ui code blocks). Cross-window sync via `syncData` IPC broadcast.

**Tech Stack:** TRPC, chatService, react-markdown (via CustomMDX), @lobehub/ui (Pre/code blocks), Zustand, `@lobechat/electron-client-ipc`

**Spec:** `docs/superpowers/specs/2026-03-17-spotlight-ui-design.md`

**Depends on:** Plan 1 (completed) — UI shell, store, IPC infrastructure

---

## File Structure

```
# New files
src/features/Spotlight/ChatView/SpotlightMessage.tsx   — single message bubble (reuses CustomMDX)
src/features/Spotlight/ChatView/MessageList.tsx         — scrollable message list
src/features/Spotlight/services/chat.ts                 — spotlight chat service (TRPC + streaming)
src/features/Spotlight/store/chatActions.ts             — send message action for spotlight store

# Modified files
src/features/Spotlight/store.ts                         — integrate chat actions, add reset-on-hide
src/features/Spotlight/ChatView/index.tsx               — replace skeleton with real components
src/features/Spotlight/index.tsx                        — wire send to chat action, handle hide reset
src/spa/entry.spotlight.tsx                             — add syncData listener for cross-window sync
apps/desktop/src/main/controllers/SpotlightCtr.ts      — add notifySync IPC handler
```

---

## Chunk 1: Message Rendering

### Task 1: Create SpotlightMessage component

**Files:**

- Create: `src/features/Spotlight/ChatView/SpotlightMessage.tsx`

- [ ] **Step 1: Create SpotlightMessage**

Reuses the existing `CustomMDX` component from `@/components/mdx` for markdown rendering. This component already integrates react-markdown + @lobehub/ui code blocks (which use shiki internally). No custom markdown renderer needed.

```typescript
import { createStyles } from 'antd-style';
import { memo } from 'react';

import { CustomMDX } from '@/components/mdx';

const useStyles = createStyles(({ css, token }) => ({
  assistant: css`
    color: ${token.colorText};
  `,
  container: css`
    padding: 8px 0;
    font-size: 13px;
    line-height: 1.6;
  `,
  cursor: css`
    display: inline-block;
    width: 2px;
    height: 1em;
    margin-left: 2px;
    vertical-align: text-bottom;
    background: ${token.colorPrimary};
    animation: blink 1s step-end infinite;

    @keyframes blink {
      50% {
        opacity: 0;
      }
    }
  `,
  user: css`
    padding: 8px 12px;
    color: ${token.colorText};
    background: ${token.colorFillTertiary};
    border-radius: 12px;
  `,
}));

interface SpotlightMessageProps {
  content: string;
  loading?: boolean;
  role: 'user' | 'assistant';
}

const SpotlightMessage = memo<SpotlightMessageProps>(({ content, loading, role }) => {
  const { styles } = useStyles();

  if (role === 'user') {
    return (
      <div className={styles.container}>
        <div className={styles.user}>{content}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.assistant}>
        <CustomMDX source={content} />
        {loading && <span className={styles.cursor} />}
      </div>
    </div>
  );
});

SpotlightMessage.displayName = 'SpotlightMessage';

export default SpotlightMessage;
```

- [ ] **Step 2: Commit**

```bash
git add src/features/Spotlight/ChatView/SpotlightMessage.tsx
git commit -m "feat(spotlight): create SpotlightMessage with CustomMDX rendering"
```

---

### Task 2: Create MessageList and update ChatView

**Files:**

- Create: `src/features/Spotlight/ChatView/MessageList.tsx`

- Modify: `src/features/Spotlight/ChatView/index.tsx`

- [ ] **Step 1: Create MessageList**

```typescript
import { createStyles } from 'antd-style';
import { memo, useEffect, useRef } from 'react';

import { useSpotlightStore } from '../store';
import SpotlightMessage from './SpotlightMessage';

const useStyles = createStyles(({ css }) => ({
  container: css`
    flex: 1;
    padding: 8px 16px;
    overflow-y: auto;
    scroll-behavior: smooth;
  `,
}));

const MessageList = memo(() => {
  const { styles } = useStyles();
  const messages = useSpotlightStore((s) => s.messages);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or content updates
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={containerRef} className={styles.container}>
      {messages.map((msg) => (
        <SpotlightMessage
          key={msg.id}
          content={msg.content}
          loading={msg.loading}
          role={msg.role}
        />
      ))}
    </div>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
```

- [ ] **Step 2: Update ChatView to use real components**

Replace `src/features/Spotlight/ChatView/index.tsx`:

```typescript
import { createStyles } from 'antd-style';
import { memo } from 'react';

import { useSpotlightStore } from '../store';
import MessageList from './MessageList';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  `,
  expandButton: css`
    display: flex;
    gap: 4px;
    align-items: center;
    align-self: flex-end;
    padding: 4px 8px;
    margin: 4px 12px;
    font-size: 11px;
    color: ${token.colorTextTertiary};
    cursor: pointer;
    background: none;
    border: none;
    border-radius: 4px;

    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
}));

const ChatView = memo(() => {
  const { styles } = useStyles();
  const topicId = useSpotlightStore((s) => s.topicId);

  const handleExpandToMain = async () => {
    const { agentId, groupId } = useSpotlightStore.getState();
    if (!topicId) return;
    await window.electronAPI?.invoke?.('spotlight.expandToMain', { agentId, groupId, topicId });
  };

  return (
    <div className={styles.container}>
      {topicId && (
        <button className={styles.expandButton} onClick={handleExpandToMain}>
          ↗ Open in main window
        </button>
      )}
      <MessageList />
    </div>
  );
});

ChatView.displayName = 'ChatView';

export default ChatView;
```

- [ ] **Step 3: Commit**

```bash
git add src/features/Spotlight/ChatView/MessageList.tsx src/features/Spotlight/ChatView/index.tsx
git commit -m "feat(spotlight): wire MessageList and ChatView with real SpotlightMessage rendering"
```

---

## Chunk 2: Send Message Flow

### Task 3: Create spotlight chat service

**Files:**

- Create: `src/features/Spotlight/services/chat.ts`

- [ ] **Step 1: Create the service**

This is a thin wrapper around the existing `chatService` and TRPC endpoint. It handles:

1. Atomic message creation via TRPC `aiChat.sendMessageInServer`
2. Streaming via `chatService.createAssistantMessageStream`

```typescript
import { chatService } from '@/services/chat';

interface SendSpotlightMessageParams {
  abortController: AbortController;
  agentId: string;
  content: string;
  groupId?: string;
  model: string;
  onContentUpdate: (content: string) => void;
  onError: (error: Error) => void;
  onFinish: () => void;
  provider: string;
  topicId?: string;
}

interface SendSpotlightMessageResult {
  assistantMessageId: string;
  topicId: string;
  userMessageId: string;
}

export const sendSpotlightMessage = async (
  params: SendSpotlightMessageParams,
): Promise<SendSpotlightMessageResult | null> => {
  const {
    content,
    agentId,
    groupId,
    topicId,
    model,
    provider,
    abortController,
    onContentUpdate,
    onError,
    onFinish,
  } = params;

  try {
    // Step 1: Create topic + messages atomically via TRPC
    const serverResult = await (
      window as any
    ).__SPOTLIGHT_TRPC__?.aiChat.sendMessageInServer.mutate({
      agentId,
      groupId,
      newAssistantMessage: { model, provider },
      newTopic: topicId ? undefined : { title: content.slice(0, 50), topicMessageIds: [] },
      newUserMessage: { content },
      topicId,
    });

    if (!serverResult) {
      onError(new Error('Failed to create messages'));
      return null;
    }

    const resolvedTopicId = serverResult.topicId || topicId || '';

    // Step 2: Stream AI response
    let accumulatedContent = '';

    await chatService.createAssistantMessageStream({
      abortController,
      onErrorHandle: (error) => {
        onError(new Error(typeof error === 'string' ? error : error.message || 'Stream error'));
      },
      onFinish: () => {
        onFinish();
      },
      onMessageHandle: (chunk: any) => {
        if (chunk.type === 'text') {
          accumulatedContent += chunk.text;
          onContentUpdate(accumulatedContent);
        }
      },
      params: {
        agentId,
        groupId,
        messages: [{ content, role: 'user' }] as any,
        model,
        provider,
        resolvedAgentConfig: { model, provider, params: {} } as any,
        topicId: resolvedTopicId,
      },
    });

    return {
      assistantMessageId: serverResult.assistantMessageId,
      topicId: resolvedTopicId,
      userMessageId: serverResult.userMessageId,
    };
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return null;
  }
};
```

**Important note for implementer:** The TRPC client setup in spotlight's minimal provider chain may not include the full TRPC client. The `chatService` works because it uses raw `fetch` internally. However, `aiChat.sendMessageInServer` requires TRPC. Check if `QueryProvider` in `entry.spotlight.tsx` already sets up TRPC (it uses the same `QueryProvider` as main app which includes TRPC). If not, this needs to be verified during integration testing.

- [ ] **Step 2: Commit**

```bash
git add src/features/Spotlight/services/chat.ts
git commit -m "feat(spotlight): create chat service for atomic send + streaming"
```

---

### Task 4: Create chat actions for spotlight store

**Files:**

- Create: `src/features/Spotlight/store/chatActions.ts`

- Modify: `src/features/Spotlight/store.ts`

- [ ] **Step 1: Create chatActions**

```typescript
import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import { sendSpotlightMessage } from '../services/chat';

export interface ChatMessage {
  content: string;
  id: string;
  loading?: boolean;
  role: 'user' | 'assistant';
}

export interface SpotlightChatActions {
  abortStreaming: () => void;
  resetChat: () => void;
  sendMessage: (content: string) => Promise<void>;
}

export interface SpotlightChatState {
  _abortController: AbortController | null;
  messages: ChatMessage[];
  streaming: boolean;
  topicId: string | null;
}

export const chatInitialState: SpotlightChatState = {
  _abortController: null,
  messages: [],
  streaming: false,
  topicId: null,
};

export const createChatActions: StateCreator<
  SpotlightChatState &
    SpotlightChatActions & {
      agentId: string;
      currentModel: { model: string; provider: string };
      groupId?: string;
    },
  [],
  [],
  SpotlightChatActions
> = (set, get) => ({
  abortStreaming: () => {
    const { _abortController } = get();
    _abortController?.abort();
    set({ _abortController: null, streaming: false });
    // Update loading state on last message
    set((state) => ({
      messages: state.messages.map((msg, i) =>
        i === state.messages.length - 1 && msg.role === 'assistant'
          ? { ...msg, loading: false }
          : msg,
      ),
    }));
  },

  resetChat: () => {
    const { _abortController } = get();
    _abortController?.abort();
    set(chatInitialState);
    // Notify main process
    window.electronAPI?.invoke?.('spotlight:setChatState', false);
  },

  sendMessage: async (content: string) => {
    const { agentId, currentModel, groupId, topicId } = get();
    const userMsgId = nanoid();
    const assistantMsgId = nanoid();
    const abortController = new AbortController();

    // Optimistic: add user message + loading assistant message
    set((state) => ({
      _abortController: abortController,
      messages: [
        ...state.messages,
        { content, id: userMsgId, role: 'user' as const },
        { content: '', id: assistantMsgId, loading: true, role: 'assistant' as const },
      ],
      streaming: true,
    }));

    const result = await sendSpotlightMessage({
      abortController,
      agentId,
      content,
      groupId,
      model: currentModel.model,
      onContentUpdate: (updatedContent) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: updatedContent } : msg,
          ),
        }));
      },
      onError: (error) => {
        set((state) => ({
          _abortController: null,
          messages: state.messages.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: `Error: ${error.message}`, loading: false }
              : msg,
          ),
          streaming: false,
        }));
      },
      onFinish: () => {
        set((state) => ({
          _abortController: null,
          messages: state.messages.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, loading: false } : msg,
          ),
          streaming: false,
        }));

        // Notify other windows to sync
        window.electronAPI?.invoke?.('spotlight.notifySync', {
          keys: ['chat/messages', 'chat/topics'],
        });
      },
      provider: currentModel.provider,
      topicId: topicId || undefined,
    });

    if (result) {
      set({ topicId: result.topicId });
    }
  },
});
```

- [ ] **Step 2: Update store.ts to integrate chat actions**

Read the current `src/features/Spotlight/store.ts`, then replace with:

```typescript
import { create } from 'zustand';

import {
  type ChatMessage,
  type SpotlightChatActions,
  type SpotlightChatState,
  chatInitialState,
  createChatActions,
} from './store/chatActions';

export type { ChatMessage };

interface SpotlightUIState {
  activePlugins: string[];
  agentId: string;
  currentModel: { model: string; provider: string };
  groupId?: string;
  inputValue: string;
  viewState: 'input' | 'chat';
}

interface SpotlightUIActions {
  reset: () => void;
  setCurrentModel: (model: { model: string; provider: string }) => void;
  setInputValue: (value: string) => void;
  setViewState: (state: 'input' | 'chat') => void;
  togglePlugin: (pluginId: string) => void;
}

type SpotlightStore = SpotlightUIState &
  SpotlightUIActions &
  SpotlightChatState &
  SpotlightChatActions;

const uiInitialState: SpotlightUIState = {
  activePlugins: [],
  agentId: 'default',
  currentModel: { model: '', provider: '' },
  inputValue: '',
  viewState: 'input',
};

export const useSpotlightStore = create<SpotlightStore>()((...args) => {
  const [set] = args;

  return {
    ...uiInitialState,
    ...chatInitialState,

    ...createChatActions(...args),

    reset: () => {
      const chatActions = createChatActions(...args);
      chatActions.resetChat();
      set(uiInitialState);
    },

    setCurrentModel: (model) => set({ currentModel: model }),

    setInputValue: (value) => set({ inputValue: value }),

    setViewState: (viewState) => {
      set({ viewState });
      window.electronAPI?.invoke?.('spotlight:setChatState', viewState === 'chat');
    },

    togglePlugin: (pluginId) =>
      set((state) => ({
        activePlugins: state.activePlugins.includes(pluginId)
          ? state.activePlugins.filter((id) => id !== pluginId)
          : [...state.activePlugins, pluginId],
      })),
  };
});
```

- [ ] **Step 3: Commit**

```bash
git add src/features/Spotlight/store/chatActions.ts src/features/Spotlight/store.ts
git commit -m "feat(spotlight): integrate chat actions with store — send, abort, reset"
```

---

### Task 5: Wire SpotlightWindow to real send flow

**Files:**

- Modify: `src/features/Spotlight/index.tsx`

- [ ] **Step 1: Update SpotlightWindow**

Read the current file, then update `handleSubmit` to call the real `sendMessage` action and handle hide → reset:

```typescript
import { lazy, memo, Suspense, useCallback } from 'react';

import InputArea from './InputArea';
import { useSpotlightStore } from './store';
import { useStyles } from './style';

const ChatView = lazy(() => import('./ChatView'));

const SpotlightWindow = memo(() => {
  const { styles } = useStyles();
  const viewState = useSpotlightStore((s) => s.viewState);
  const inputValue = useSpotlightStore((s) => s.inputValue);
  const setInputValue = useSpotlightStore((s) => s.setInputValue);
  const setViewState = useSpotlightStore((s) => s.setViewState);
  const sendMessage = useSpotlightStore((s) => s.sendMessage);

  const handleHide = useCallback(() => {
    // Reset to input state when hiding
    const { viewState: currentView, streaming } = useSpotlightStore.getState();
    if (currentView === 'chat' && !streaming) {
      // Reset chat state and resize back to input size
      useSpotlightStore.getState().resetChat();
      setViewState('input');
      window.electronAPI?.invoke?.('spotlight:resize', { height: 120, width: 680 });
    }
    window.electronAPI?.invoke?.('spotlight:hide');
  }, [setViewState]);

  const handleSubmit = useCallback(
    async (value: string) => {
      if (value.startsWith('>')) {
        handleHide();
        return;
      }

      if (value.startsWith('@')) {
        return;
      }

      // Chat mode: expand window and switch to chat view
      if (viewState === 'input') {
        window.electronAPI?.invoke?.('spotlight:resize', { height: 480, width: 680 });
        setViewState('chat');
      }

      setInputValue('');
      await sendMessage(value);
    },
    [handleHide, viewState, setViewState, setInputValue, sendMessage],
  );

  return (
    <div className={styles.container}>
      <div className={styles.dragHandle} />

      {viewState === 'chat' && (
        <Suspense fallback={null}>
          <ChatView />
        </Suspense>
      )}

      <InputArea
        value={inputValue}
        onEscape={handleHide}
        onSubmit={handleSubmit}
        onValueChange={setInputValue}
      />
    </div>
  );
});

SpotlightWindow.displayName = 'SpotlightWindow';

export default SpotlightWindow;
```

- [ ] **Step 2: Commit**

```bash
git add src/features/Spotlight/index.tsx
git commit -m "feat(spotlight): wire SpotlightWindow to real send flow with hide-reset"
```

---

## Chunk 3: Cross-Window Sync

### Task 6: Add notifySync IPC and syncData broadcast

**Files:**

- Modify: `apps/desktop/src/main/controllers/SpotlightCtr.ts`

- Modify: `src/spa/entry.spotlight.tsx`

- [ ] **Step 1: Add notifySync IPC handler to SpotlightCtr**

Read `SpotlightCtr.ts`, then add a new `@IpcMethod()` after `expandToMain`:

```typescript
  @IpcMethod()
  async notifySync(params: { keys: string[] }) {
    this.app.browserManager.broadcastToOtherWindows(
      'syncData',
      { keys: params.keys, source: 'spotlight' },
    );
  }
```

Also add a matching `ipcMain.handle` in `afterAppReady()` for the direct `spotlight.notifySync` channel (since chatActions calls it directly):

```typescript
ipcMain.handle('spotlight:notifySync', (_event, params: { keys: string[] }) => {
  this.app.browserManager.broadcastToOtherWindows('syncData', {
    keys: params.keys,
    source: 'spotlight',
  });
});
```

Wait — the chat actions in `store/chatActions.ts` calls `window.electronAPI?.invoke?.('spotlight.notifySync', ...)`. The `window.electronAPI.invoke` maps to `ipcRenderer.invoke`, which goes through the IPC proxy (`groupName.methodName` pattern). Since `SpotlightCtr.groupName = 'spotlight'` and the method is `notifySync`, the channel is `spotlight.notifySync`. The `@IpcMethod()` decorator auto-registers this. So the `ipcMain.handle` is NOT needed — the decorator handles it. Only add the `@IpcMethod()` method.

- [ ] **Step 2: Add syncData listener in entry.spotlight.tsx**

Read `src/spa/entry.spotlight.tsx`, then add a listener in the `App` component's useEffect for syncData from other windows (so spotlight can also receive sync notifications):

Actually, the main use case is spotlight → main window sync. The reverse (main window → spotlight) is less critical for now since spotlight manages its own state. Skip this for now — the main window needs the listener, and that belongs in the main app's code, not in spotlight's entry. The `useWatchBroadcast` hook in the main app will handle it.

For the main app to respond to `syncData`:

Create a small hook `src/hooks/useSyncDataBroadcast.ts`:

```typescript
import { useWatchBroadcast } from '@lobechat/electron-client-ipc';
import { useSWRConfig } from 'swr';

export const useSyncDataBroadcast = () => {
  const { mutate } = useSWRConfig();

  useWatchBroadcast('syncData', (data) => {
    if (data?.keys) {
      data.keys.forEach((key: string) => {
        mutate(key);
      });
    }
  });
};
```

Then add `useSyncDataBroadcast()` in `src/layout/SPAGlobalProvider/index.tsx` (inside the SPAGlobalProvider component, after the existing useLayoutEffect).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/main/controllers/SpotlightCtr.ts src/hooks/useSyncDataBroadcast.ts src/layout/SPAGlobalProvider/index.tsx
git commit -m "feat(spotlight): wire syncData cross-window broadcast for SWR revalidation"
```

---

### Task 7: Integration testing checklist

- [ ] **Step 1: Start dev environment**

```bash
cd apps/desktop && bun run dev
```

- [ ] **Step 2: Verify spotlight window behavior**

- Press `Cmd+Shift+Space` → spotlight appears at cursor

- Type text → textarea auto-grows

- Click model chip → native menu appears with models

- Press Enter → window expands to chat size

- User message appears, AI response streams in with markdown

- "Open in main window" → main window navigates to topic, spotlight hides

- Esc or hotkey → spotlight hides, resets to input state on next open

- [ ] **Step 3: Verify cross-window sync**

- Send message in spotlight

- Check main window sidebar shows new topic

- If not, check console for syncData broadcast errors

- [ ] **Step 4: Fix any issues found**

---

## Summary

| Task | Description                            | Files                                                                   |
| ---- | -------------------------------------- | ----------------------------------------------------------------------- |
| 1    | SpotlightMessage component (CustomMDX) | `ChatView/SpotlightMessage.tsx` (new)                                   |
| 2    | MessageList + ChatView update          | `ChatView/MessageList.tsx` (new), `ChatView/index.tsx`                  |
| 3    | Spotlight chat service (TRPC + stream) | `services/chat.ts` (new)                                                |
| 4    | Chat store actions + store integration | `store/chatActions.ts` (new), `store.ts`                                |
| 5    | SpotlightWindow send flow + hide reset | `index.tsx`                                                             |
| 6    | syncData broadcast wiring              | `SpotlightCtr.ts`, `useSyncDataBroadcast.ts` (new), `SPAGlobalProvider` |
| 7    | Integration testing                    | —                                                                       |
