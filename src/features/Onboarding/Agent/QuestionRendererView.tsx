'use client';

import {
  QuestionRenderer as BuiltinAgentQuestionRenderer,
  type QuestionRendererProps as BuiltinAgentQuestionRendererProps,
} from '@lobechat/builtin-agent-onboarding/client';
import { memo, useMemo } from 'react';

import { normalizeQuestionRendererQuestion } from './questionRendererSchema';

export interface QuestionRendererViewProps extends BuiltinAgentQuestionRendererProps {
  fallbackQuestionDescription: string;
  fallbackTextFieldLabel: string;
  fallbackTextFieldPlaceholder: string;
}

const QuestionRendererView = memo<QuestionRendererViewProps>(
  ({
    currentQuestion,
    fallbackQuestionDescription,
    fallbackTextFieldLabel,
    fallbackTextFieldPlaceholder,
    ...builtinProps
  }) => {
    const resolvedQuestion = useMemo(
      () =>
        normalizeQuestionRendererQuestion(currentQuestion, {
          description: fallbackQuestionDescription,
          label: fallbackTextFieldLabel,
          placeholder: fallbackTextFieldPlaceholder,
        }),
      [
        currentQuestion,
        fallbackQuestionDescription,
        fallbackTextFieldLabel,
        fallbackTextFieldPlaceholder,
      ],
    );

    return <BuiltinAgentQuestionRenderer currentQuestion={resolvedQuestion} {...builtinProps} />;
  },
);

QuestionRendererView.displayName = 'QuestionRendererView';

export default QuestionRendererView;
