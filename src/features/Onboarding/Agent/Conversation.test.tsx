import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('AgentOnboardingConversation', () => {
  beforeEach(() => {
    chatInputSpy.mockClear();
    finishOnboardingSpy.mockReset();
    mockState.displayMessages = [];
    navigateSpy.mockReset();
    refreshUserStateSpy.mockReset();
  });

  it('renders a read-only transcript when viewing a historical topic', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(<AgentOnboardingConversation readOnly activeNode="agentIdentity" />);

    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-list')).toBeInTheDocument();
  });

  it('renders the completion CTA on the summary step', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(<AgentOnboardingConversation activeNode="summary" />);

    expect(screen.getByText('finish')).toBeInTheDocument();
    expect(screen.getByText('agent.summaryHint')).toBeInTheDocument();
  });

  it('finishes onboarding and navigates to inbox when the completion CTA is clicked', async () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];
    finishOnboardingSpy.mockResolvedValue({ success: true });
    refreshUserStateSpy.mockResolvedValue(undefined);

    render(<AgentOnboardingConversation activeNode="summary" />);

    fireEvent.click(screen.getByText('finish'));

    await waitFor(() => {
      expect(finishOnboardingSpy).toHaveBeenCalledTimes(1);
      expect(refreshUserStateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('/');
    });
  });

  it('disables expand and runtime config in chat input', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(<AgentOnboardingConversation activeNode="agentIdentity" />);

    expect(chatInputSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowExpand: false,
        leftActions: [],
        showRuntimeConfig: false,
      }),
    );
  });

  it('does not show completion CTA when not on summary step', () => {
    mockState.displayMessages = [{ id: 'assistant-1', role: 'assistant' }];

    render(<AgentOnboardingConversation activeNode="agentIdentity" />);

    expect(screen.queryByText('finish')).not.toBeInTheDocument();
  });
});
