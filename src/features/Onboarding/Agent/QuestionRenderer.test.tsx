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

describe('QuestionRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders button group questions and forwards message choices', async () => {
    const onDismissNode = vi.fn();

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

    expect(sendMessage).toHaveBeenCalledWith({ message: 'hello from hint' });
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(onDismissNode).toHaveBeenCalledWith('agentIdentity');
    });
  });

  it('falls back to sending the action label when a message button has no payload', async () => {
    render(
      <QuestionRenderer
        currentQuestion={{
          choices: [
            {
              id: 'identity-ai-builder',
              label: 'AI 产品开发者',
              style: 'default',
            },
          ],
          id: 'identity-quick-pick',
          mode: 'button_group',
          node: 'userIdentity',
          prompt: '选一个最贴切的身份标签',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI 产品开发者' }));

    expect(sendMessage).toHaveBeenCalledWith({ message: 'AI 产品开发者' });
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
  });

  it('falls back to the action label for patch-style actions', async () => {
    render(
      <QuestionRenderer
        currentQuestion={{
          choices: [
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
          id: 'question-2',
          mode: 'button_group',
          node: 'responseLanguage',
          prompt: 'Language',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use Chinese' }));

    expect(sendMessage).toHaveBeenCalledWith({
      message: 'Use Chinese',
    });
  });

  it('falls back to a text form when a button group has no choices', async () => {
    render(
      <QuestionRenderer
        currentQuestion={{
          id: 'agent-identity-missing-choices',
          mode: 'button_group',
          node: 'agentIdentity',
          prompt: '帮我取个名字，再定个气质。',
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('agent.telemetryHint'), {
      target: { value: '叫 shishi，风格偏直接。' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(sendMessage).toHaveBeenCalledWith({
      message: ['Q: agent.telemetryHint', 'A: 叫 shishi，风格偏直接。'].join('\n'),
    });
  });

  it('formats form submissions as question-answer text', async () => {
    const onDismissNode = vi.fn();

    render(
      <QuestionRenderer
        currentQuestion={{
          fields: [
            {
              key: 'professionalRole',
              kind: 'text',
              label: 'Role',
              placeholder: 'Your role',
              value: '',
            },
            {
              key: 'name',
              kind: 'text',
              label: 'Name',
              placeholder: 'Your name',
              value: '',
            },
          ],
          id: 'user-identity-form',
          mode: 'form',
          node: 'userIdentity',
          prompt: 'About you',
        }}
        onDismissNode={onDismissNode}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Your role'), {
      target: { value: 'Independent developer' },
    });
    fireEvent.change(screen.getByPlaceholderText('Your name'), {
      target: { value: 'Ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(sendMessage).toHaveBeenCalledWith({
      message: ['Q: Role', 'A: Independent developer', '', 'Q: Name', 'A: Ada'].join('\n'),
    });
    await waitFor(() => {
      expect(onDismissNode).toHaveBeenCalledWith('userIdentity');
    });
  });

  it('submits the form when pressing Enter in a text input', async () => {
    render(
      <QuestionRenderer
        currentQuestion={{
          fields: [
            {
              key: 'professionalRole',
              kind: 'text',
              label: 'Role',
              placeholder: 'Your role',
              value: '',
            },
          ],
          id: 'user-identity-form',
          mode: 'form',
          node: 'userIdentity',
          prompt: 'About you',
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Your role'), {
      target: { value: 'Independent developer' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('Your role'), {
      code: 'Enter',
      key: 'Enter',
    });

    expect(sendMessage).toHaveBeenCalledWith({
      message: ['Q: Role', 'A: Independent developer'].join('\n'),
    });
  });

  it('formats select submissions as question-answer text', async () => {
    render(
      <QuestionRenderer
        currentQuestion={{
          fields: [
            {
              key: 'responseLanguage',
              kind: 'select',
              label: 'Response language',
              options: [
                { label: 'English', value: 'en-US' },
                { label: 'Chinese', value: 'zh-CN' },
              ],
              value: 'en-US',
            },
          ],
          id: 'response-language-select',
          mode: 'select',
          node: 'responseLanguage',
          prompt: 'Language',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(sendMessage).toHaveBeenCalledWith({
      message: ['Q: Response language', 'A: English'].join('\n'),
    });
  });
});
