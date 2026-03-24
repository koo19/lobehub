import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AgentOnboardingConversation from './Conversation';

const chatInputSpy = vi.fn();

vi.mock('@/utils/env', () => ({ isDev: false }));

vi.mock('@/features/Conversation', () => ({
  ChatInput: (props: Record<string, unknown>) => {
    chatInputSpy(props);

    return <div data-testid="chat-input" />;
  },
  ChatList: ({ welcome }: { welcome?: any }) => <div data-testid="chat-list">{welcome}</div>,
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

vi.mock('./Welcome', () => ({
  default: () => <div data-testid="onboarding-welcome" />,
}));

describe('AgentOnboardingConversation', () => {
  it('renders structured actions and disables expand + runtime config in chat input', () => {
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
    expect(screen.getByTestId('onboarding-welcome')).toBeInTheDocument();
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

  it('hides the current question after it is dismissed locally', () => {
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
  });
});
