'use client';

import { Avatar, Flexbox, Markdown, Text } from '@lobehub/ui';
import type { CSSProperties } from 'react';
import { memo, useMemo } from 'react';

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

import { staticStyle } from './staticStyle';

const assistantLikeRoles = new Set(['assistant', 'assistantGroup', 'supervisor']);

interface AgentOnboardingConversationProps {
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

const AgentOnboardingConversation = memo<AgentOnboardingConversationProps>(({ readOnly }) => {
  const agentMeta = useAgentMeta();
  const displayMessages = useConversationStore(conversationSelectors.displayMessages);

  const isGreetingState = useMemo(() => {
    if (displayMessages.length !== 1) return false;
    const first = displayMessages[0];
    return assistantLikeRoles.has(first.role);
  }, [displayMessages]);

  const itemContent = (index: number, id: string) => {
    const isLatestItem = displayMessages.length === index + 1;

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
          </Flexbox>
        </Flexbox>
      );
    }

    return <MessageItem id={id} index={index} isLatestItem={isLatestItem} />;
  };

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
});

AgentOnboardingConversation.displayName = 'AgentOnboardingConversation';

export default AgentOnboardingConversation;
