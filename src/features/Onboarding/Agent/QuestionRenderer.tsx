'use client';

import type { UserAgentOnboardingQuestion } from '@lobechat/types';
import { memo } from 'react';

import { useQuestionRendererRuntime } from './questionRendererRuntime';
import QuestionRendererView from './QuestionRendererView';

interface QuestionRendererProps {
  currentQuestion: UserAgentOnboardingQuestion;
}

const QuestionRenderer = memo<QuestionRendererProps>(({ currentQuestion }) => {
  const runtime = useQuestionRendererRuntime();

  return <QuestionRendererView currentQuestion={currentQuestion} {...runtime} />;
});

QuestionRenderer.displayName = 'QuestionRenderer';

export default QuestionRenderer;
