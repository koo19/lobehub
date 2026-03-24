'use client';

import type { UserAgentOnboardingNode, UserAgentOnboardingQuestion } from '@lobechat/types';
import { memo } from 'react';

import { useQuestionRendererRuntime } from './questionRendererRuntime';
import QuestionRendererView from './QuestionRendererView';

interface QuestionRendererProps {
  currentQuestion: UserAgentOnboardingQuestion;
  onDismissNode?: (node: UserAgentOnboardingNode) => void;
}

const QuestionRenderer = memo<QuestionRendererProps>(({ currentQuestion, onDismissNode }) => {
  const runtime = useQuestionRendererRuntime();

  return (
    <QuestionRendererView
      currentQuestion={currentQuestion}
      onDismissNode={onDismissNode}
      {...runtime}
    />
  );
});

QuestionRenderer.displayName = 'QuestionRenderer';

export default QuestionRenderer;
