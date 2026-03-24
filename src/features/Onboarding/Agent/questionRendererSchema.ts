import type { UserAgentOnboardingQuestion } from '@lobechat/types';

interface QuestionRendererFallbackCopy {
  description: string;
  label: string;
  placeholder: string;
}

export const normalizeQuestionRendererQuestion = (
  question: UserAgentOnboardingQuestion,
  fallbackCopy: QuestionRendererFallbackCopy,
): UserAgentOnboardingQuestion => {
  if (
    question.mode === 'select' &&
    (!question.fields || question.fields.length === 0) &&
    question.choices &&
    question.choices.length > 0
  ) {
    return {
      ...question,
      mode: 'button_group',
    };
  }

  if (question.mode !== 'button_group' || (question.choices && question.choices.length > 0)) {
    return question;
  }

  return {
    ...question,
    description: question.description ?? fallbackCopy.description,
    fields: [
      {
        key: 'answer',
        kind: 'text',
        label: fallbackCopy.label,
        placeholder: fallbackCopy.placeholder,
      },
    ],
    mode: 'form',
  };
};
