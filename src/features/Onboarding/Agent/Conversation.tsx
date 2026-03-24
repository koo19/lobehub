'use client';

import type { UserAgentOnboardingNode, UserAgentOnboardingQuestion } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ActionKeys } from '@/features/ChatInput';
import {
  ChatInput,
  ChatList,
  conversationSelectors,
  MessageItem,
  useConversationStore,
} from '@/features/Conversation';
import { isDev } from '@/utils/env';

import QuestionRenderer from './QuestionRenderer';

const assistantLikeRoles = new Set(['assistant', 'assistantGroup', 'supervisor']);

const useStyles = createStyles(({ css, token }) => ({
  composerZone: css`
    gap: 8px;
  `,
  inlineQuestion: css`
    margin-block-start: 4px;
    padding-block-start: 12px;
    border-block-start: 1px solid ${token.colorBorderSecondary};
  `,
}));

interface AgentOnboardingConversationProps {
  currentQuestion?: UserAgentOnboardingQuestion;
  readOnly?: boolean;
}

const chatInputLeftActions: ActionKeys[] = isDev ? ['model'] : [];

const AgentOnboardingConversation = memo<AgentOnboardingConversationProps>(
  ({ currentQuestion, readOnly }) => {
    const { styles } = useStyles();
    const [dismissedNodes, setDismissedNodes] = useState<string[]>([]);
    const displayMessages = useConversationStore(conversationSelectors.displayMessages);
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
      if (readOnly || !currentQuestion) return undefined;

      const dismissedNodeSet = new Set(dismissedNodes);

      return dismissedNodeSet.has(currentQuestion.node) ? undefined : currentQuestion;
    }, [currentQuestion, dismissedNodes, readOnly]);

    const lastAssistantMessageId = useMemo(() => {
      for (const message of [...displayMessages].reverse()) {
        if (assistantLikeRoles.has(message.role)) return message.id;
      }

      return undefined;
    }, [displayMessages]);

    const handleDismissNode = useCallback((node: UserAgentOnboardingNode) => {
      setDismissedNodes((state) => (state.includes(node) ? state : [...state, node]));
    }, []);

    const itemContent = useCallback(
      (index: number, id: string) => {
        const isLatestItem = displayMessages.length === index + 1;
        const endRender =
          id === lastAssistantMessageId && visibleQuestion ? (
            <div className={styles.inlineQuestion}>
              <QuestionRenderer
                currentQuestion={visibleQuestion}
                onDismissNode={handleDismissNode}
              />
            </div>
          ) : undefined;

        return (
          <MessageItem endRender={endRender} id={id} index={index} isLatestItem={isLatestItem} />
        );
      },
      [
        displayMessages.length,
        handleDismissNode,
        lastAssistantMessageId,
        styles.inlineQuestion,
        visibleQuestion,
      ],
    );

    return (
      <Flexbox flex={1} gap={16} style={{ minHeight: 0 }} width={'100%'}>
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
          <ChatList itemContent={itemContent} />
        </Flexbox>

        {!readOnly && (
          <Flexbox className={styles.composerZone} paddingInline={8}>
            <ChatInput
              allowExpand={false}
              leftActions={chatInputLeftActions}
              showRuntimeConfig={false}
            />
          </Flexbox>
        )}
      </Flexbox>
    );
  },
);

AgentOnboardingConversation.displayName = 'AgentOnboardingConversation';

export default AgentOnboardingConversation;
