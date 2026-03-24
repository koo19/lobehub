import type { UserAgentOnboarding, UserAgentOnboardingInteractionHint } from '@/types/user';

export interface AgentOnboardingBootstrapContext {
  agentOnboarding: UserAgentOnboarding;
  context: {
    interactionHints: UserAgentOnboardingInteractionHint[];
  };
  topicId: string;
}

interface ResolveAgentOnboardingContextParams {
  bootstrapContext?: AgentOnboardingBootstrapContext;
  storedAgentOnboarding?: UserAgentOnboarding;
}

export const resolveAgentOnboardingContext = ({
  bootstrapContext,
  storedAgentOnboarding,
}: ResolveAgentOnboardingContextParams) => ({
  interactionHints: bootstrapContext?.context.interactionHints ?? [],
  topicId: storedAgentOnboarding?.activeTopicId ?? bootstrapContext?.topicId,
});
