import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as EnvModule from '@/utils/env';

import AgentOnboardingConversation from './Conversation';

const { chatInputSpy, finishOnboardingSpy, mockState, navigateSpy, refreshUserStateSpy } =
  vi.hoisted(() => ({
    chatInputSpy: vi.fn(),
    finishOnboardingSpy: vi.fn(),
    mockState: {
      displayMessages: [] as Array<{ content?: string; id: string; role: string }>,
    },
    navigateSpy: vi.fn(),
    refreshUserStateSpy: vi.fn(),
  }));

vi.mock('@/utils/env', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();

  return {
    ...actual,
    isDev: false,
  };
});

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

vi.mock('@/features/Conversation/hooks/useAgentMeta', () => ({
  useAgentMeta: () => ({
    avatar: 'assistant-avatar',
    backgroundColor: '#000',
    title: 'Onboarding Agent',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
}));

vi.mock('@/services/user', () => ({
  userService: {
    finishOnboarding: finishOnboardingSpy,
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: { refreshUserState: typeof refreshUserStateSpy }) => unknown) =>
    selector({
      refreshUserState: refreshUserStateSpy,
    }),
}));

vi.mock('./QuestionRenderer', () => ({
  default: ({
    currentQuestion,
  }: {
    currentQuestion?: { id: string; node?: string; prompt?: string };
  }) => (
    <div data-testid="structured-actions">
      <div>{currentQuestion?.id}</div>
      <div>{currentQuestion?.node}</div>
      <div>{currentQuestion?.prompt}</div>
    </div>
  ),
}));

vi.mock('./questionRendererRuntime', () => ({
  useQuestionRendererRuntime: () => ({
    fallbackQuestionDescription: 'agent.summaryHint',
    fallbackTextFieldLabel: 'agent.summaryHint',
    fallbackTextFieldPlaceholder: 'agent.summaryHint',
    loading: false,
    nextLabel: 'next',
    onChangeResponseLanguage: vi.fn(),
    onSendMessage: vi.fn(),
    renderEmojiPicker: vi.fn(),
    responseLanguageOptions: [],
    submitLabel: 'next',
  }),
}));

vi.mock('./QuestionRendererView', () => ({
  default: ({
    currentQuestion,
    onSendMessage,
  }: {
    currentQuestion?: { id: string; prompt?: string };
    onSendMessage?: (message: string) => Promise<void> | void;
  }) => (
    <div data-testid="completion-actions">
      <div>{currentQuestion?.id}</div>
      <div>{currentQuestion?.prompt}</div>
      <button onClick={() => onSendMessage?.('finish-onboarding')}>complete</button>
    </div>
  ),
}));

vi.mock('./ResponseLanguageInlineStep', () => ({
  default: () => <div data-testid="response-language-inline-step" />,
}));

describe('AgentOnboardingConversation', () => {
  beforeEach(() => {
    chatInputSpy.mockClear();
    finishOnboardingSpy.mockReset();
    mockState.displayMessages = [];
    navigateSpy.mockReset();
    refreshUserStateSpy.mockReset();
  });

  it('renders structured actions inside the assistant message and disables expand + runtime config in chat input', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(
      <AgentOnboardingConversation
        activeNode="responseLanguage"
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
    expect(screen.getByTestId('response-language-inline-step')).toBeInTheDocument();
    expect(screen.queryByTestId('structured-actions')).not.toBeInTheDocument();
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
        activeNode="agentIdentity"
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
        activeNode="agentIdentity"
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
        activeNode="responseLanguage"
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

  it('hides the current question after a new message is submitted', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    const { rerender } = render(
      <AgentOnboardingConversation
        activeNode="agentIdentity"
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

    expect(screen.getByTestId('structured-actions')).toBeInTheDocument();

    mockState.displayMessages = [
      { id: 'assistant-1', role: 'assistant' },
      { id: 'user-1', role: 'user' },
    ];

    rerender(
      <AgentOnboardingConversation
        activeNode="agentIdentity"
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

    expect(screen.queryByTestId('structured-actions')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-list')).toBeInTheDocument();
  });

  it('renders a read-only transcript when viewing a historical topic', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(
      <AgentOnboardingConversation
        readOnly
        activeNode="agentIdentity"
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

    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('structured-actions')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-list')).toBeInTheDocument();
  });

  it('renders the built-in response language step even without an AI question surface', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(<AgentOnboardingConversation activeNode="responseLanguage" />);

    expect(screen.getByTestId('response-language-inline-step')).toBeInTheDocument();
    expect(screen.queryByTestId('structured-actions')).not.toBeInTheDocument();
  });

  it('hides the built-in response language step after a new message is submitted', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    const { rerender } = render(<AgentOnboardingConversation activeNode="responseLanguage" />);

    expect(screen.getByTestId('response-language-inline-step')).toBeInTheDocument();

    mockState.displayMessages = [
      { id: 'assistant-1', role: 'assistant' },
      { id: 'user-1', role: 'user' },
    ];

    // Pass readOnly={false} (same behavioral effect as omitting it) to bypass memo's
    // shallow-equal check, since the mock store has no subscription mechanism.
    rerender(<AgentOnboardingConversation activeNode="responseLanguage" readOnly={false} />);

    expect(screen.queryByTestId('response-language-inline-step')).not.toBeInTheDocument();
  });

  it('renders the completion CTA on the summary step', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(<AgentOnboardingConversation activeNode="summary" />);

    expect(screen.getByTestId('completion-actions')).toHaveTextContent('finish-onboarding');
    expect(screen.getByTestId('completion-actions')).toHaveTextContent('finish');
  });

  it('finishes onboarding and navigates to inbox when the completion CTA is clicked', async () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];
    finishOnboardingSpy.mockResolvedValue({ success: true });
    refreshUserStateSpy.mockResolvedValue(undefined);

    render(<AgentOnboardingConversation activeNode="summary" />);

    fireEvent.click(screen.getByRole('button', { name: 'complete' }));

    await waitFor(() => {
      expect(finishOnboardingSpy).toHaveBeenCalledTimes(1);
      expect(refreshUserStateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('/');
    });
  });
});
