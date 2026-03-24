import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import InteractionHintRenderer from './InteractionHintRenderer';

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

describe('InteractionHintRenderer', () => {
  it('renders button group hints and forwards message actions', async () => {
    const onDismissNode = vi.fn();

    render(
      <InteractionHintRenderer
        interactionHints={[
          {
            actions: [
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
            id: 'hint-1',
            kind: 'button_group',
            node: 'agentIdentity',
            title: 'Quick presets',
          },
        ]}
        onDismissNode={onDismissNode}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Warm + curious' }));

    expect(sendMessage).toHaveBeenCalledWith({ message: 'hello from hint' });
    await waitFor(() => {
      expect(onDismissNode).toHaveBeenCalledWith('agentIdentity');
    });
  });

  it('falls back to sending the action label when a message button has no payload', async () => {
    const onDismissNode = vi.fn();

    render(
      <InteractionHintRenderer
        interactionHints={[
          {
            actions: [
              {
                id: 'identity-ai-builder',
                label: 'AI 产品开发者',
                style: 'default',
              },
            ],
            id: 'identity-quick-pick',
            kind: 'button_group',
            node: 'userIdentity',
            submitMode: 'message',
            title: '选一个最贴切的身份标签',
          },
        ]}
        onDismissNode={onDismissNode}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI 产品开发者' }));

    expect(sendMessage).toHaveBeenCalledWith({ message: 'AI 产品开发者' });
    await waitFor(() => {
      expect(onDismissNode).toHaveBeenCalledWith('userIdentity');
    });
  });

  it('routes patch actions to the clicked hint node instead of the first hint node', async () => {
    const onSubmitUpdates = vi.fn();

    render(
      <InteractionHintRenderer
        interactionHints={[
          {
            actions: [
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
            id: 'hint-1',
            kind: 'button_group',
            node: 'agentIdentity',
            title: 'Quick presets',
          },
          {
            actions: [
              {
                id: 'set-language',
                label: 'Use Chinese',
                payload: {
                  kind: 'patch',
                  patch: {
                    responseLanguage: 'zh-CN',
                  },
                },
                style: 'default',
              },
            ],
            id: 'hint-2',
            kind: 'button_group',
            node: 'responseLanguage',
            title: 'Language',
          },
        ]}
        onSubmitUpdates={onSubmitUpdates}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use Chinese' }));

    expect(onSubmitUpdates).toHaveBeenCalledWith([
      {
        node: 'responseLanguage',
        patch: {
          responseLanguage: 'zh-CN',
        },
      },
    ]);
  });
});
