import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import QuestionRenderer from './QuestionRenderer';

const sendMessage = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/utils/env', () => ({ isDev: false }));

vi.mock('@/const/onboarding', () => ({
  ONBOARDING_PRODUCTION_DEFAULT_MODEL: {
    model: 'gpt-4.1-mini',
    provider: 'openai',
  },
}));

vi.mock('@/features/Conversation', () => ({
  useConversationStore: (selector: (state: any) => unknown) =>
    selector({
      sendMessage,
    }),
}));

vi.mock('@/features/Conversation/store', () => ({
  messageStateSelectors: {
    isInputLoading: () => false,
  },
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: (state: any) => unknown) =>
    selector({
      switchLocale: vi.fn(),
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  serverConfigSelectors: {
    enableKlavis: () => false,
  },
  useServerConfigStore: (selector: (state: any) => unknown) => selector({}),
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: any) => unknown) =>
    selector({
      updateGeneralConfig: vi.fn(),
      updateDefaultModel: vi.fn(),
    }),
}));

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentSettings: () => ({
      defaultAgent: {},
      general: {},
    }),
  },
  userGeneralSettingsSelectors: {
    currentResponseLanguage: () => 'en-US',
  },
}));

vi.mock('@/components/EmojiPicker', () => ({
  default: () => <div data-testid="emoji-picker" />,
}));

vi.mock('@/features/ModelSelect', () => ({
  default: () => <div data-testid="model-select" />,
}));

vi.mock('@/routes/onboarding/components/KlavisServerList', () => ({
  default: () => <div data-testid="klavis-list" />,
}));

describe('QuestionRenderer runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dismisses the inline question without waiting for the full send lifecycle', async () => {
    const onDismissNode = vi.fn();

    sendMessage.mockImplementation(
      () =>
        new Promise(() => {
          // Intentionally unresolved to simulate a long-running streaming lifecycle.
        }),
    );

    render(
      <QuestionRenderer
        currentQuestion={{
          choices: [
            {
              id: 'preset',
              label: 'Warm + curious',
              payload: {
                kind: 'message',
                message: 'hello from hint',
              },
              style: 'primary',
            },
          ],
          id: 'question-1',
          mode: 'button_group',
          node: 'agentIdentity',
          prompt: 'Pick one',
        }}
        onDismissNode={onDismissNode}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Warm + curious' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ message: 'hello from hint' });
      expect(onDismissNode).toHaveBeenCalledWith('agentIdentity');
    });
  });
});
