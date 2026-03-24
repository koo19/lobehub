'use client';

import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { Button, ErrorBoundary, Flexbox, Text } from '@lobehub/ui';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Loading from '@/components/Loading/BrandTextLoading';
import ModeSwitch from '@/features/Onboarding/components/ModeSwitch';
import { useOnlyFetchOnceSWR } from '@/libs/swr';
import OnboardingContainer from '@/routes/onboarding/_layout';
import { userService } from '@/services/user';
import { useAgentStore } from '@/store/agent';
import { builtinAgentSelectors } from '@/store/agent/selectors';
import { useUserStore } from '@/store/user';
import { isDev } from '@/utils/env';

import { resolveAgentOnboardingContext } from './context';
import AgentOnboardingConversation from './Conversation';
import OnboardingConversationProvider from './OnboardingConversationProvider';

const AgentOnboardingPage = memo(() => {
  const { t } = useTranslation('onboarding');
  const useInitBuiltinAgent = useAgentStore((s) => s.useInitBuiltinAgent);
  const onboardingAgentId = useAgentStore(
    builtinAgentSelectors.getBuiltinAgentId(BUILTIN_AGENT_SLUGS.webOnboarding),
  );
  const [agentOnboarding, refreshUserState, resetAgentOnboarding] = useUserStore((s) => [
    s.agentOnboarding,
    s.refreshUserState,
    s.resetAgentOnboarding,
  ]);
  const [isResetting, setIsResetting] = useState(false);

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

  const currentContext = useMemo(
    () =>
      resolveAgentOnboardingContext({
        bootstrapContext: data,
        storedAgentOnboarding: agentOnboarding,
      }),
    [agentOnboarding, data],
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

  const syncOnboardingContext = async () => {
    const nextContext = await userService.getOrCreateAgentOnboardingContext();
    await mutate(nextContext, { revalidate: false });

    return nextContext;
  };

  const handleReset = async () => {
    setIsResetting(true);

    try {
      await resetAgentOnboarding();
      await syncOnboardingContext();
    } finally {
      setIsResetting(false);
    }
  };

  const handleSubmitInteractionUpdates = async (
    updates: Parameters<typeof userService.proposeAgentOnboardingPatch>[0]['updates'],
  ) => {
    await userService.proposeAgentOnboardingPatch({ updates });
    await syncOnboardingContext();
    await refreshUserState();
  };

  return (
    <OnboardingContainer>
      <Flexbox
        gap={24}
        style={{ height: '100%', maxWidth: 720, position: 'relative', width: '100%' }}
      >
        <Flexbox flex={1} gap={16} style={{ minHeight: 0 }}>
          <OnboardingConversationProvider
            agentId={onboardingAgentId}
            topicId={currentContext.topicId || data.topicId}
            hooks={{
              onAfterSendMessage: async () => {
                await syncOnboardingContext();
                await refreshUserState();
              },
            }}
          >
            <ErrorBoundary FallbackComponent={() => null}>
              <AgentOnboardingConversation
                interactionHints={currentContext.interactionHints}
                onSubmitInteractionUpdates={handleSubmitInteractionUpdates}
              />
            </ErrorBoundary>
          </OnboardingConversationProvider>
        </Flexbox>
        <ModeSwitch
          actions={
            isDev ? (
              <Button danger loading={isResetting} size={'small'} onClick={handleReset}>
                {t('agent.modeSwitch.reset')}
              </Button>
            ) : undefined
          }
        />
      </Flexbox>
    </OnboardingContainer>
  );
});

AgentOnboardingPage.displayName = 'AgentOnboardingPage';

export default AgentOnboardingPage;
