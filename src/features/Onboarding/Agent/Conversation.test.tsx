import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AgentOnboardingConversation from './Conversation';

const chatInputSpy = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { currentStep?: number; totalSteps?: number }) => {
      if (key === 'agent.progress') return `${options?.currentStep}/${options?.totalSteps}`;

      return (
        {
          'agent.banner.label': 'Agent Onboarding',
          'agent.stage.responseLanguage': 'Response Language',
          'agent.subtitle': 'Complete setup in a dedicated onboarding conversation.',
          'agent.title': 'Conversation Onboarding',
        }[key] || key
      );
    },
  }),
}));

vi.mock('@/utils/env', () => ({ isDev: false }));

vi.mock('@/features/Conversation', () => ({
  ChatInput: (props: Record<string, unknown>) => {
    chatInputSpy(props);

    return <div data-testid="chat-input" />;
  },
  ChatList: () => <div data-testid="chat-list" />,
}));

vi.mock('./StructuredActions', () => ({
  default: ({ currentNode }: { currentNode?: string }) => (
    <div data-testid="structured-actions">{currentNode}</div>
  ),
}));

describe('AgentOnboardingConversation', () => {
  it('renders onboarding banner and disables expand + runtime config in chat input', () => {
    render(<AgentOnboardingConversation currentNode="responseLanguage" />);

    expect(screen.getByText('Agent Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Response Language')).toBeInTheDocument();
    expect(screen.getByText('6/8')).toBeInTheDocument();
    expect(screen.getByTestId('structured-actions')).toHaveTextContent('responseLanguage');
    expect(chatInputSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowExpand: false,
        leftActions: [],
        showRuntimeConfig: false,
      }),
    );
  });
});
