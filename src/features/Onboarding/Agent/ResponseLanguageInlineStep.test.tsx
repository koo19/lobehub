import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResponseLanguageInlineStep from './ResponseLanguageInlineStep';

const questionRendererViewSpy = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('./questionRendererRuntime', () => ({
  useQuestionRendererRuntime: () => ({
    fallbackQuestionDescription: 'fallback-description',
    fallbackTextFieldLabel: 'fallback-label',
    fallbackTextFieldPlaceholder: 'fallback-placeholder',
    loading: false,
    nextLabel: 'next',
    onChangeResponseLanguage: vi.fn(),
    onSendMessage: vi.fn(),
    responseLanguageOptions: [{ label: 'English', value: 'en-US' }],
    submitLabel: 'submit',
  }),
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: (state: Record<string, never>) => unknown) => selector({}),
}));

vi.mock('@/store/user/selectors', () => ({
  userGeneralSettingsSelectors: {
    currentResponseLanguage: () => 'en-US',
  },
}));

vi.mock('./QuestionRendererView', () => ({
  default: (props: Record<string, unknown>) => {
    questionRendererViewSpy(props);

    return <div data-testid="question-renderer-view" />;
  },
}));

describe('ResponseLanguageInlineStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the built-in response-language node through the shared question UI', () => {
    render(<ResponseLanguageInlineStep />);

    expect(screen.getByTestId('question-renderer-view')).toBeInTheDocument();
    const [props] = questionRendererViewSpy.mock.calls[0];

    expect(props).toEqual(
      expect.objectContaining({
        currentQuestion: {
          description: 'responseLanguage.desc',
          fields: [
            {
              key: 'responseLanguage',
              kind: 'select',
              label: 'agent.stage.responseLanguage',
              value: 'en-US',
            },
          ],
          id: 'builtin-response-language',
          mode: 'select',
          node: 'responseLanguage',
          prompt: 'responseLanguage.title',
          submitMode: 'message',
        },
      }),
    );
  });
});
