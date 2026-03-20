import type { UserAgentOnboarding } from '@/types/user';

export interface AgentOnboardingBootstrapContext {
  agentOnboarding: UserAgentOnboarding;
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
  currentNode: storedAgentOnboarding?.currentNode ?? bootstrapContext?.agentOnboarding.currentNode,
  topicId: storedAgentOnboarding?.activeTopicId ?? bootstrapContext?.topicId,
});
