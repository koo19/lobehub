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

vi.mock('./InteractionHintRenderer', () => ({
  default: ({
    interactionHints,
    onDismissNode,
  }: {
    interactionHints?: Array<{ id: string; node?: string }>;
    onDismissNode?: (node: string) => void;
  }) => (
    <div data-testid="structured-actions">
      <div>{interactionHints?.map((hint) => hint.id).join(',')}</div>
      <div>{interactionHints?.[0]?.node}</div>
      {interactionHints?.[0] && (
        <button onClick={() => onDismissNode?.(interactionHints[0].node!)}>dismiss</button>
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
        interactionHints={[
          {
            id: 'response-language-select',
            kind: 'select',
            node: 'responseLanguage',
          } as any,
        ]}
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

  it('hides the current interaction hint after it is dismissed locally', () => {
    render(
      <AgentOnboardingConversation
        interactionHints={[
          {
            id: 'agent-identity-form',
            kind: 'form',
            node: 'agentIdentity',
          } as any,
          {
            id: 'agent-identity-presets',
            kind: 'button_group',
            node: 'agentIdentity',
          } as any,
        ]}
      />,
    );

    expect(screen.getByTestId('structured-actions')).toHaveTextContent(
      'agent-identity-form,agent-identity-presets',
    );

    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));

    expect(screen.queryByTestId('structured-actions')).not.toBeInTheDocument();
  });
});
