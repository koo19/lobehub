import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import QuestionRendererView from './QuestionRendererView';

const sendMessage = vi.fn();

const baseProps = {
  fallbackQuestionDescription: 'agent.telemetryHint',
  fallbackTextFieldLabel: 'agent.telemetryHint',
  fallbackTextFieldPlaceholder: 'agent.telemetryHint',
  nextLabel: 'next',
  onSendMessage: sendMessage,
  submitLabel: 'next',
} as const;

describe('QuestionRendererView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders button group questions and forwards message choices', async () => {
    render(
      <QuestionRendererView
        {...baseProps}
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
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Warm + curious' }));

    expect(sendMessage).toHaveBeenCalledWith('hello from hint');
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  it('falls back to sending the action label when a message button has no payload', async () => {
    render(
      <QuestionRendererView
        {...baseProps}
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

    expect(sendMessage).toHaveBeenCalledWith('AI 产品开发者');
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
  });

  it('falls back to the action label for patch-style actions', async () => {
    render(
      <QuestionRendererView
        {...baseProps}
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

    expect(sendMessage).toHaveBeenCalledWith('Use Chinese');
  });

  it('falls back to a text form when a button group has no choices', async () => {
    render(
      <QuestionRendererView
        {...baseProps}
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

    expect(sendMessage).toHaveBeenCalledWith(
      ['Q: agent.telemetryHint', 'A: 叫 shishi，风格偏直接。'].join('\n'),
    );
  });

  it('formats form submissions as question-answer text', async () => {
    render(
      <QuestionRendererView
        {...baseProps}
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
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Your role'), {
      target: { value: 'Independent developer' },
    });
    fireEvent.change(screen.getByPlaceholderText('Your name'), {
      target: { value: 'Ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(sendMessage).toHaveBeenCalledWith(
      ['Q: Role', 'A: Independent developer', '', 'Q: Name', 'A: Ada'].join('\n'),
    );
  });

  it('submits the form when pressing Enter in a text input', async () => {
    render(
      <QuestionRendererView
        {...baseProps}
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

    expect(sendMessage).toHaveBeenCalledWith(['Q: Role', 'A: Independent developer'].join('\n'));
  });

  it('formats select submissions as question-answer text', async () => {
    render(
      <QuestionRendererView
        {...baseProps}
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

    expect(sendMessage).toHaveBeenCalledWith(['Q: Response language', 'A: English'].join('\n'));
  });

  it('normalizes select questions with choices into button groups', async () => {
    render(
      <QuestionRendererView
        {...baseProps}
        responseLanguageOptions={[{ label: '简体中文', value: 'zh-CN' }]}
        currentQuestion={{
          choices: [
            {
              id: 'emoji_lightning',
              label: '⚡ 闪电 — 快速、高效',
              payload: {
                kind: 'patch',
                patch: {
                  emoji: '⚡',
                },
              },
            },
          ],
          id: 'agent_emoji_select',
          mode: 'select',
          node: 'agentIdentity',
          prompt: '最后一步——选个 emoji 作为我的标志。',
        }}
      />,
    );

    expect(screen.getByRole('button', { name: '⚡ 闪电 — 快速、高效' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '⚡ 闪电 — 快速、高效' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('⚡ 闪电 — 快速、高效');
    });
  });
});
