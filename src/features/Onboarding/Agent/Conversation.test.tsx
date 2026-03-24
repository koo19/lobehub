import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AgentOnboardingConversation from './Conversation';

const { chatInputSpy, mockState } = vi.hoisted(() => ({
  chatInputSpy: vi.fn(),
  mockState: {
    displayMessages: [] as Array<{ content?: string; id: string; role: string }>,
  },
}));

vi.mock('@/utils/env', () => ({ isDev: false }));

vi.mock('@/features/Conversation', () => ({
  ChatInput: (props: Record<string, unknown>) => {
    chatInputSpy(props);

    return <div data-testid="chat-input" />;
  },
  ChatList: ({ itemContent }: { itemContent?: (index: number, id: string) => ReactNode }) => (
    <div data-testid="chat-list">
      {mockState.displayMessages.map((message, index) => (
        <div key={message.id}>{itemContent?.(index, message.id)}</div>
      ))}
    </div>
  ),
  MessageItem: ({ endRender, id }: { endRender?: ReactNode; id: string }) => (
    <div data-testid={`message-item-${id}`}>
      <div>{id}</div>
      {endRender}
    </div>
  ),
  conversationSelectors: {
    displayMessages: (state: typeof mockState) => state.displayMessages,
  },
  dataSelectors: {
    displayMessages: (state: typeof mockState) => state.displayMessages,
  },
  useConversationStore: (
    selector: (state: { displayMessages: typeof mockState.displayMessages }) => unknown,
  ) =>
    selector({
      displayMessages: mockState.displayMessages,
    }),
}));

vi.mock('./QuestionRenderer', () => ({
  default: ({
    currentQuestion,
    onDismissNode,
  }: {
    currentQuestion?: { id: string; node?: string; prompt?: string };
    onDismissNode?: (node: string) => void;
  }) => (
    <div data-testid="structured-actions">
      <div>{currentQuestion?.id}</div>
      <div>{currentQuestion?.node}</div>
      <div>{currentQuestion?.prompt}</div>
      {currentQuestion && (
        <button onClick={() => onDismissNode?.(currentQuestion.node!)}>dismiss</button>
      )}
    </div>
  ),
}));

describe('AgentOnboardingConversation', () => {
  beforeEach(() => {
    chatInputSpy.mockClear();
    mockState.displayMessages = [];
  });

  it('renders structured actions inside the assistant message and disables expand + runtime config in chat input', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(
      <AgentOnboardingConversation
        currentQuestion={
          {
            id: 'response-language-question',
            mode: 'select',
            node: 'responseLanguage',
            prompt: '你希望我默认用什么语言回复你？',
          } as any
        }
      />,
    );

    expect(screen.getByTestId('chat-list')).toBeInTheDocument();
    expect(screen.getByTestId('message-item-assistant-1')).toContainElement(
      screen.getByTestId('structured-actions'),
    );
    expect(screen.getByTestId('structured-actions')).toHaveTextContent('responseLanguage');
    expect(chatInputSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowExpand: false,
        leftActions: [],
        showRuntimeConfig: false,
      }),
    );
  });

  it('passes the current question to the renderer', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(
      <AgentOnboardingConversation
        currentQuestion={
          {
            id: 'agent-identity-question',
            mode: 'form',
            node: 'agentIdentity',
            prompt: '先把我定下来吧。',
          } as any
        }
      />,
    );

    expect(screen.getByTestId('structured-actions')).toHaveTextContent('agent-identity-question');
    expect(screen.getByTestId('structured-actions')).toHaveTextContent('先把我定下来吧。');
  });

  it('renders the question under the last assistant-like message instead of the last message', () => {
    mockState.displayMessages = [
      { id: 'assistant-1', role: 'assistant' },
      { id: 'assistant-group-1', role: 'assistantGroup' },
      { id: 'user-1', role: 'user' },
    ];

    render(
      <AgentOnboardingConversation
        currentQuestion={
          {
            id: 'agent-identity-question',
            mode: 'form',
            node: 'agentIdentity',
            prompt: '先把我定下来吧。',
          } as any
        }
      />,
    );

    expect(
      within(screen.getByTestId('message-item-assistant-group-1')).getByTestId(
        'structured-actions',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('message-item-assistant-1')).queryByTestId('structured-actions'),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('message-item-user-1')).queryByTestId('structured-actions'),
    ).not.toBeInTheDocument();
  });

  it('does not inject a local assistant placeholder when the conversation has no messages', async () => {
    mockState.displayMessages = [];

    render(
      <AgentOnboardingConversation
        currentQuestion={
          {
            id: 'response-language-question',
            mode: 'select',
            node: 'responseLanguage',
            prompt: '你希望我默认用什么语言回复你？',
          } as any
        }
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-list')).toBeInTheDocument();
    });
  });

  it('hides the current question after it is dismissed locally', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(
      <AgentOnboardingConversation
        currentQuestion={
          {
            id: 'agent-identity-question',
            mode: 'form',
            node: 'agentIdentity',
            prompt: '先把我定下来吧。',
          } as any
        }
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));

    expect(screen.queryByTestId('structured-actions')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-list')).toBeInTheDocument();
  });
});
