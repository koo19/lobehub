'use client';

import { type ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { type ConversationHooks, ConversationProvider } from '@/features/Conversation';
import { useOperationState } from '@/hooks/useOperationState';
import { useChatStore } from '@/store/chat';
import { type MessageMapKeyInput } from '@/store/chat/utils/messageMapKey';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';

interface OnboardingConversationProviderProps {
  agentId: string;
  children: ReactNode;
  hooks?: ConversationHooks;
  topicId: string;
}

const OnboardingConversationProvider = memo<OnboardingConversationProviderProps>(
  ({ agentId, children, hooks, topicId }) => {
    const context = useMemo<MessageMapKeyInput>(
      () => ({
        agentId,
        topicId,
      }),
      [agentId, topicId],
    );
    const chatKey = useMemo(() => messageMapKey(context), [context]);
    const replaceMessages = useChatStore((s) => s.replaceMessages);
    const messages = useChatStore((s) => s.dbMessagesMap[chatKey]);
    const operationState = useOperationState(context);

    return (
      <ConversationProvider
        context={context}
        hasInitMessages={!!messages}
        hooks={hooks}
        messages={messages}
        operationState={operationState}
        onMessagesChange={(msgs, ctx) => {
          replaceMessages(msgs, { context: ctx });
        }}
      >
        {children}
      </ConversationProvider>
    );
  },
);

OnboardingConversationProvider.displayName = 'OnboardingConversationProvider';

export default OnboardingConversationProvider;
