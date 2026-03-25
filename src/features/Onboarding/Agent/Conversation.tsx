'use client';

import type { UserAgentOnboardingNode, UserAgentOnboardingQuestion } from '@lobechat/types';
import { Avatar, Flexbox, Markdown, Text } from '@lobehub/ui';
import { Divider } from 'antd';
import type { CSSProperties } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { ActionKeys } from '@/features/ChatInput';
import {
  ChatInput,
  ChatList,
  conversationSelectors,
  MessageItem,
  useConversationStore,
} from '@/features/Conversation';
import { useAgentMeta } from '@/features/Conversation/hooks/useAgentMeta';
import { userService } from '@/services/user';
import { useUserStore } from '@/store/user';
import { isDev } from '@/utils/env';

import QuestionRenderer from './QuestionRenderer';
import { useQuestionRendererRuntime } from './questionRendererRuntime';
import QuestionRendererView from './QuestionRendererView';
import ResponseLanguageInlineStep from './ResponseLanguageInlineStep';
import { staticStyle } from './staticStyle';

const assistantLikeRoles = new Set(['assistant', 'assistantGroup', 'supervisor']);

interface AgentOnboardingConversationProps {
  activeNode?: UserAgentOnboardingNode;
  currentQuestion?: UserAgentOnboardingQuestion;
  readOnly?: boolean;
}

const chatInputLeftActions: ActionKeys[] = isDev ? ['model'] : [];

const greetingCenterStyle: CSSProperties = { flex: 1, minHeight: '100%' };
const agentTitleStyle: CSSProperties = { fontSize: 12, fontWeight: 500 };
const outerContainerStyle: CSSProperties = { minHeight: 0 };
const scrollContainerStyle: CSSProperties = {
  minHeight: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  position: 'relative',
};

const AgentOnboardingConversation = memo<AgentOnboardingConversationProps>(
  ({ activeNode, currentQuestion, readOnly }) => {
    const { t } = useTranslation('onboarding');
    const agentMeta = useAgentMeta();
    const navigate = useNavigate();
    const refreshUserState = useUserStore((s) => s.refreshUserState);
    const questionRendererRuntime = useQuestionRendererRuntime();
    const [isFinishing, setIsFinishing] = useState(false);
    const isFinishingRef = useRef(false);
    const displayMessages = useConversationStore(conversationSelectors.displayMessages);
    const questionSignature = useMemo(
      () => JSON.stringify({ activeNode, currentQuestion: currentQuestion || null }),
      [activeNode, currentQuestion],
    );
    const lastQuestionSignatureRef = useRef(questionSignature);
    const messageCountAtQuestionRef = useRef(displayMessages.length);

    useEffect(() => {
      if (lastQuestionSignatureRef.current === questionSignature) return;

      lastQuestionSignatureRef.current = questionSignature;
      messageCountAtQuestionRef.current = displayMessages.length;
    }, [questionSignature, displayMessages.length]);

    const dismissedBySubmit = displayMessages.length > messageCountAtQuestionRef.current;

    const visibleQuestion =
      readOnly || !currentQuestion || dismissedBySubmit ? undefined : currentQuestion;
    const shouldRenderResponseLanguageStep = !readOnly && activeNode === 'responseLanguage';

    const lastAssistantMessageId = useMemo(() => {
      for (let i = displayMessages.length - 1; i >= 0; i--) {
        if (assistantLikeRoles.has(displayMessages[i].role)) return displayMessages[i].id;
      }

      return undefined;
    }, [displayMessages]);

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

    const completionQuestion = useMemo<UserAgentOnboardingQuestion>(
      () => ({
        choices: [
          {
            id: 'finish-onboarding',
            label: t('finish'),
            payload: {
              kind: 'message',
              message: 'finish-onboarding',
            },
            style: 'primary',
          },
        ],
        description: t('agent.summaryHint'),
        id: 'finish-onboarding',
        mode: 'button_group',
        node: 'summary',
        prompt: t('finish'),
        submitMode: 'message',
      }),
      [t],
    );

    const handleFinishOnboarding = useCallback(async () => {
      if (isFinishingRef.current) return;

      isFinishingRef.current = true;
      setIsFinishing(true);

      try {
        await userService.finishOnboarding();
        await refreshUserState();
        navigate('/');
      } catch (error) {
        console.error('[AgentOnboardingConversation] Failed to finish onboarding:', error);
      } finally {
        isFinishingRef.current = false;
        setIsFinishing(false);
      }
    }, [navigate, refreshUserState]);

    const itemContent = useCallback(
      (index: number, id: string) => {
        const isLatestItem = displayMessages.length === index + 1;

        const effectiveQuestion =
          !readOnly && isGreetingState && !currentQuestion
            ? presetGreetingQuestion
            : visibleQuestion;
        const effectiveStep =
          shouldRenderResponseLanguageStep && !dismissedBySubmit ? 'responseLanguage' : undefined;
        const showCompletionCTA = !readOnly && activeNode === 'summary';
        const completionRender = !showCompletionCTA ? undefined : (
          <div className={staticStyle.inlineQuestion}>
            <QuestionRendererView
              {...questionRendererRuntime}
              currentQuestion={completionQuestion}
              loading={questionRendererRuntime.loading || isFinishing}
              onSendMessage={handleFinishOnboarding}
            />
          </div>
        );

        const endRender =
          id !== lastAssistantMessageId ? undefined : effectiveStep ? (
            <div className={staticStyle.inlineQuestion}>
              <ResponseLanguageInlineStep />
            </div>
          ) : showCompletionCTA ? (
            completionRender
          ) : effectiveQuestion ? (
            <div className={staticStyle.inlineQuestion}>
              <QuestionRenderer currentQuestion={effectiveQuestion} />
            </div>
          ) : (
            completionRender
          );

        if (isGreetingState && index === 0) {
          const message = displayMessages[0];
          return (
            <Flexbox align={'center'} justify={'center'} style={greetingCenterStyle}>
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
                    <Text style={agentTitleStyle} type={'secondary'}>
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
        dismissedBySubmit,
        displayMessages,
        isGreetingState,
        lastAssistantMessageId,
        presetGreetingQuestion,
        readOnly,
        currentQuestion,
        activeNode,
        completionQuestion,
        handleFinishOnboarding,
        isFinishing,
        questionRendererRuntime,
        shouldRenderResponseLanguageStep,
        visibleQuestion,
      ],
    );

    return (
      <Flexbox flex={1} gap={16} style={outerContainerStyle} width={'100%'}>
        <Flexbox flex={1} style={scrollContainerStyle} width={'100%'}>
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
