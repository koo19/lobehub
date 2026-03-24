'use client';

import {
  type UserAgentOnboardingInteractionHint,
  type UserAgentOnboardingUpdate,
} from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { type ActionKeys } from '@/features/ChatInput';
import { ChatInput, ChatList } from '@/features/Conversation';
import { isDev } from '@/utils/env';

import InteractionHintRenderer from './InteractionHintRenderer';
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
  interactionHints?: UserAgentOnboardingInteractionHint[];
  onSubmitInteractionUpdates?: (updates: UserAgentOnboardingUpdate[]) => Promise<void>;
}

const chatInputLeftActions: ActionKeys[] = isDev ? ['model'] : [];

const AgentOnboardingConversation = memo<AgentOnboardingConversationProps>(
  ({ interactionHints, onSubmitInteractionUpdates }) => {
    const { styles } = useStyles();
    const [dismissedNodes, setDismissedNodes] = useState<string[]>([]);
    const interactionSignature = useMemo(
      () => JSON.stringify(interactionHints || []),
      [interactionHints],
    );
    const lastInteractionSignatureRef = useRef(interactionSignature);

    useEffect(() => {
      if (lastInteractionSignatureRef.current === interactionSignature) return;

      lastInteractionSignatureRef.current = interactionSignature;
      setDismissedNodes([]);
    }, [interactionSignature]);

    const visibleInteractionHints = useMemo(() => {
      if (!interactionHints?.length) return [];

      const dismissedNodeSet = new Set(dismissedNodes);

      return interactionHints.filter((hint) => !dismissedNodeSet.has(hint.node));
    }, [dismissedNodes, interactionHints]);
    const showStructuredActions = visibleInteractionHints.length > 0;

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
          {showStructuredActions && (
            <Flexbox className={styles.structuredActions}>
              <InteractionHintRenderer
                interactionHints={visibleInteractionHints}
                onDismissNode={handleDismissNode}
                onSubmitUpdates={onSubmitInteractionUpdates}
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
