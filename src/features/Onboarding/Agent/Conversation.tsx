'use client';

import { type UserAgentOnboardingQuestion } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { type ActionKeys } from '@/features/ChatInput';
import { ChatInput, ChatList } from '@/features/Conversation';
import { isDev } from '@/utils/env';

import QuestionRenderer from './QuestionRenderer';
import Welcome from './Welcome';

const useStyles = createStyles(({ css, token }) => ({
  composerZone: css`
    gap: 8px;
  `,
  structuredActions: css`
    padding: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 16px;

    background: ${token.colorBgElevated};
    box-shadow: ${token.boxShadowTertiary};
  `,
}));

interface AgentOnboardingConversationProps {
  currentQuestion?: UserAgentOnboardingQuestion;
}

const chatInputLeftActions: ActionKeys[] = isDev ? ['model'] : [];

const AgentOnboardingConversation = memo<AgentOnboardingConversationProps>(
  ({ currentQuestion }) => {
    const { styles } = useStyles();
    const [dismissedNodes, setDismissedNodes] = useState<string[]>([]);
    const questionSignature = useMemo(
      () => JSON.stringify(currentQuestion || null),
      [currentQuestion],
    );
    const lastQuestionSignatureRef = useRef(questionSignature);

    useEffect(() => {
      if (lastQuestionSignatureRef.current === questionSignature) return;

      lastQuestionSignatureRef.current = questionSignature;
      setDismissedNodes([]);
    }, [questionSignature]);

    const visibleQuestion = useMemo(() => {
      if (!currentQuestion) return undefined;

      const dismissedNodeSet = new Set(dismissedNodes);

      return dismissedNodeSet.has(currentQuestion.node) ? undefined : currentQuestion;
    }, [currentQuestion, dismissedNodes]);

    const showQuestionSurface = !!visibleQuestion;

    const handleDismissNode = (node: string) => {
      setDismissedNodes((state) => (state.includes(node) ? state : [...state, node]));
    };

    return (
      <Flexbox flex={1} gap={16} style={{ minHeight: 0, marginTop: -70 }} width={'100%'}>
        <Flexbox
          flex={1}
          width={'100%'}
          style={{
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          <ChatList welcome={<Welcome />} />
        </Flexbox>

        <Flexbox className={styles.composerZone} paddingInline={8}>
          {showQuestionSurface && visibleQuestion && (
            <Flexbox className={styles.structuredActions}>
              <QuestionRenderer
                currentQuestion={visibleQuestion}
                onDismissNode={handleDismissNode}
              />
            </Flexbox>
          )}
          <ChatInput
            allowExpand={false}
            leftActions={chatInputLeftActions}
            showRuntimeConfig={false}
          />
        </Flexbox>
      </Flexbox>
    );
  },
);

AgentOnboardingConversation.displayName = 'AgentOnboardingConversation';

export default AgentOnboardingConversation;
