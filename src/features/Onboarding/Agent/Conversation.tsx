'use client';

import type { UserAgentOnboardingNode, UserAgentOnboardingQuestion } from '@lobechat/types';
import { Avatar, Flexbox, Markdown, Text } from '@lobehub/ui';
import { Divider } from 'antd';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ActionKeys } from '@/features/ChatInput';
import {
  ChatInput,
  ChatList,
  conversationSelectors,
  MessageItem,
  useConversationStore,
} from '@/features/Conversation';
import { useAgentMeta } from '@/features/Conversation/hooks/useAgentMeta';
import { isDev } from '@/utils/env';

import QuestionRenderer from './QuestionRenderer';
import ResponseLanguageInlineStep from './ResponseLanguageInlineStep';
import { staticStyle } from './staticStyle';

const assistantLikeRoles = new Set(['assistant', 'assistantGroup', 'supervisor']);

interface AgentOnboardingConversationProps {
  activeNode?: UserAgentOnboardingNode;
  currentQuestion?: UserAgentOnboardingQuestion;
  readOnly?: boolean;
}

const chatInputLeftActions: ActionKeys[] = isDev ? ['model'] : [];

const AgentOnboardingConversation = memo<AgentOnboardingConversationProps>(
  ({ activeNode, currentQuestion, readOnly }) => {
    const { t } = useTranslation('onboarding');
    const agentMeta = useAgentMeta();
    const [dismissedNodes, setDismissedNodes] = useState<string[]>([]);
    const displayMessages = useConversationStore(conversationSelectors.displayMessages);
    const questionSignature = useMemo(
      () => JSON.stringify({ activeNode, currentQuestion: currentQuestion || null }),
      [activeNode, currentQuestion],
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
    const shouldRenderResponseLanguageStep = !readOnly && activeNode === 'responseLanguage';

    const lastAssistantMessageId = useMemo(() => {
      for (const message of [...displayMessages].reverse()) {
        if (assistantLikeRoles.has(message.role)) return message.id;
      }

      return undefined;
    }, [displayMessages]);

    const handleDismissNode = useCallback((node: UserAgentOnboardingNode) => {
      setDismissedNodes((state) => (state.includes(node) ? state : [...state, node]));
    }, []);

    const isGreetingState = useMemo(() => {
      if (displayMessages.length !== 1) return false;
      const first = displayMessages[0];
      return assistantLikeRoles.has(first.role);
    }, [displayMessages]);

    const presetGreetingQuestion = useMemo<UserAgentOnboardingQuestion>(
      () => ({
        fields: [
          {
            key: 'name',
            kind: 'text' as const,
            label: t('agent.greeting.nameLabel'),
            placeholder: t('agent.greeting.namePlaceholder'),
          },
          {
            key: 'vibe',
            kind: 'text' as const,
            label: t('agent.greeting.vibeLabel'),
            placeholder: t('agent.greeting.vibePlaceholder'),
          },
          {
            key: 'emoji',
            kind: 'emoji' as const,
            label: t('agent.greeting.emojiLabel'),
          },
        ],
        id: 'greeting-agent-identity',
        mode: 'form',
        node: 'agentIdentity',
        prompt: t('agent.greeting.prompt'),
        submitMode: 'message',
      }),
      [t],
    );

    const itemContent = useCallback(
      (index: number, id: string) => {
        const isLatestItem = displayMessages.length === index + 1;

        const effectiveQuestion =
          !readOnly && isGreetingState && !currentQuestion
            ? presetGreetingQuestion
            : visibleQuestion;
        const effectiveStep =
          shouldRenderResponseLanguageStep && !dismissedNodes.includes('responseLanguage')
            ? 'responseLanguage'
            : undefined;

        const endRender =
          id !== lastAssistantMessageId ? undefined : effectiveStep ? (
            <div className={staticStyle.inlineQuestion}>
              <ResponseLanguageInlineStep onDismissNode={handleDismissNode} />
            </div>
          ) : effectiveQuestion ? (
            <div className={staticStyle.inlineQuestion}>
              <QuestionRenderer
                currentQuestion={effectiveQuestion}
                onDismissNode={handleDismissNode}
              />
            </div>
          ) : undefined;

        if (isGreetingState && index === 0) {
          const message = displayMessages[0];
          return (
            <Flexbox align={'center'} justify={'center'} style={{ flex: 1, minHeight: '100%' }}>
              <Flexbox className={staticStyle.greetingWrap} gap={16}>
                <Flexbox horizontal align={'flex-start'} gap={12}>
                  <Avatar
                    avatar={agentMeta.avatar}
                    background={agentMeta.backgroundColor}
                    className={staticStyle.greetingAvatar}
                    shape={'square'}
                    size={36}
                  />
                  <Flexbox gap={4}>
                    <Text style={{ fontSize: 12, fontWeight: 500 }} type={'secondary'}>
                      {agentMeta.title}
                    </Text>
                    <Markdown className={staticStyle.greetingText} variant={'chat'}>
                      {message.content}
                    </Markdown>
                  </Flexbox>
                </Flexbox>
                {endRender && (
                  <>
                    <Divider className={staticStyle.greetingDivider} />
                    {endRender}
                  </>
                )}
              </Flexbox>
            </Flexbox>
          );
        }

        return (
          <MessageItem endRender={endRender} id={id} index={index} isLatestItem={isLatestItem} />
        );
      },
      [
        agentMeta,
        displayMessages,
        handleDismissNode,
        isGreetingState,
        lastAssistantMessageId,
        presetGreetingQuestion,
        readOnly,
        currentQuestion,
        dismissedNodes,
        shouldRenderResponseLanguageStep,
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
          <Flexbox className={staticStyle.composerZone} paddingInline={8}>
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
