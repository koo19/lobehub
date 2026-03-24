import type { UserAgentOnboarding, UserAgentOnboardingQuestion } from '@/types/user';

export interface AgentOnboardingBootstrapContext {
  agentOnboarding: UserAgentOnboarding;
  context: {
    currentQuestion?: UserAgentOnboardingQuestion;
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
  currentQuestion: bootstrapContext?.context.currentQuestion,
  topicId: storedAgentOnboarding?.activeTopicId ?? bootstrapContext?.topicId,
});
