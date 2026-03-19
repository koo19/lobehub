'use client';

import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { Button, Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import ModeSwitch from '@/features/Onboarding/components/ModeSwitch';
import { useOnlyFetchOnceSWR } from '@/libs/swr';
import OnboardingContainer from '@/routes/onboarding/_layout';
import { userService } from '@/services/user';
import { useAgentStore } from '@/store/agent';
import { builtinAgentSelectors } from '@/store/agent/selectors';
import { useUserStore } from '@/store/user';

import AgentOnboardingConversation from './Conversation';
import OnboardingConversationProvider from './OnboardingConversationProvider';

const AgentOnboardingPage = memo(() => {
  const useInitBuiltinAgent = useAgentStore((s) => s.useInitBuiltinAgent);
  const onboardingAgentId = useAgentStore(
    builtinAgentSelectors.getBuiltinAgentId(BUILTIN_AGENT_SLUGS.webOnboarding),
  );
  const refreshUserState = useUserStore((s) => s.refreshUserState);

  useInitBuiltinAgent(BUILTIN_AGENT_SLUGS.webOnboarding);

  const { data, error, isLoading, mutate } = useOnlyFetchOnceSWR(
    'agent-onboarding-bootstrap',
    () => userService.getOrCreateAgentOnboardingContext(),
    {
      onSuccess: async () => {
        await refreshUserState();
      },
    },
  );

  if (error) {
    return (
      <OnboardingContainer>
        <Flexbox gap={16} style={{ maxWidth: 720, width: '100%' }}>
          <ModeSwitch />
          <Flexbox gap={8}>
            <Text weight={'bold'}>Failed to initialize onboarding.</Text>
            <Button onClick={() => mutate()}>Retry</Button>
          </Flexbox>
        </Flexbox>
      </OnboardingContainer>
    );
  }

  if (isLoading || !data?.topicId || !onboardingAgentId) {
    return <Loading debugId="AgentOnboarding" />;
  }

  return (
    <OnboardingContainer>
      <Flexbox gap={24} style={{ height: '100%', maxWidth: 720, width: '100%' }}>
        <ModeSwitch />
        <Flexbox flex={1} gap={16} style={{ minHeight: 0 }}>
          <OnboardingConversationProvider
            agentId={onboardingAgentId}
            topicId={data.topicId}
            hooks={{
              onAfterSendMessage: async () => {
                await refreshUserState();
              },
            }}
          >
            <AgentOnboardingConversation fallbackCurrentNode={data.agentOnboarding.currentNode} />
          </OnboardingConversationProvider>
        </Flexbox>
      </Flexbox>
    </OnboardingContainer>
  );
});

AgentOnboardingPage.displayName = 'AgentOnboardingPage';

export default AgentOnboardingPage;
