'use client';

import { AGENT_ONBOARDING_NODES, type UserAgentOnboardingNode } from '@lobechat/types';
import { Flexbox, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { type ActionKeys } from '@/features/ChatInput';
import { ChatInput, ChatList } from '@/features/Conversation';
import { isDev } from '@/utils/env';

import StructuredActions from './StructuredActions';

const useStyles = createStyles(({ css, token }) => ({
  banner: css`
    padding-block: 8px;
    padding-inline: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 999px;

    background: ${token.colorFillQuaternary};
  `,
  bannerLabel: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  `,
  bannerProgress: css`
    padding-block: 2px;
    padding-inline: 8px;
    border-radius: 999px;

    font-size: 12px;
    color: ${token.colorTextSecondary};

    background: ${token.colorBgElevated};
  `,
  bannerStage: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
  `,
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
  currentNode?: UserAgentOnboardingNode;
}

const STRUCTURED_ACTION_NODES: UserAgentOnboardingNode[] = [
  'proSettings',
  'responseLanguage',
  'summary',
];

const chatInputLeftActions: ActionKeys[] = isDev ? ['model'] : [];

type AgentStageTranslationKey =
  | 'agent.stage.agentIdentity'
  | 'agent.stage.painPoints'
  | 'agent.stage.proSettings'
  | 'agent.stage.responseLanguage'
  | 'agent.stage.summary'
  | 'agent.stage.userIdentity'
  | 'agent.stage.workContext'
  | 'agent.stage.workStyle';

const stageTranslationKeys = {
  agentIdentity: 'agent.stage.agentIdentity',
  painPoints: 'agent.stage.painPoints',
  proSettings: 'agent.stage.proSettings',
  responseLanguage: 'agent.stage.responseLanguage',
  summary: 'agent.stage.summary',
  userIdentity: 'agent.stage.userIdentity',
  workContext: 'agent.stage.workContext',
  workStyle: 'agent.stage.workStyle',
} as const satisfies Record<UserAgentOnboardingNode, AgentStageTranslationKey>;

const AgentOnboardingConversation = memo<AgentOnboardingConversationProps>(({ currentNode }) => {
  const { t } = useTranslation('onboarding');
  const { styles } = useStyles();

  const currentStep = currentNode ? AGENT_ONBOARDING_NODES.indexOf(currentNode) + 1 : undefined;
  const showStructuredActions = currentNode ? STRUCTURED_ACTION_NODES.includes(currentNode) : false;
  const stageLabel = currentNode ? t(stageTranslationKeys[currentNode]) : undefined;

  return (
    <Flexbox flex={1} gap={16} style={{ minHeight: 0, marginTop: -70 }} width={'100%'}>
      <Flexbox
        horizontal
        align={'center'}
        className={styles.banner}
        gap={12}
        justify={'space-between'}
      >
        <Flexbox horizontal align={'center'} gap={8} style={{ minWidth: 0 }}>
          <Text className={styles.bannerLabel}>{t('agent.banner.label')}</Text>
          {stageLabel && <Text className={styles.bannerStage}>{stageLabel}</Text>}
        </Flexbox>
        {currentStep && (
          <Text className={styles.bannerProgress}>
            {t('agent.progress', {
              currentStep,
              totalSteps: AGENT_ONBOARDING_NODES.length,
            })}
          </Text>
        )}
      </Flexbox>

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
        <ChatList />
      </Flexbox>

      <Flexbox className={styles.composerZone} paddingInline={8}>
        {showStructuredActions && (
          <Flexbox className={styles.structuredActions}>
            <StructuredActions currentNode={currentNode} />
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
});

AgentOnboardingConversation.displayName = 'AgentOnboardingConversation';

export default AgentOnboardingConversation;
