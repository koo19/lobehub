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

const resolveQuestionFromSurface = (state?: UserAgentOnboarding) => {
  const questionSurface = state?.questionSurface;

  if (!questionSurface) return undefined;
  if (state?.completedNodes?.includes(questionSurface.node)) return undefined;

  return questionSurface.question;
};

export const resolveAgentOnboardingContext = ({
  bootstrapContext,
  storedAgentOnboarding,
}: ResolveAgentOnboardingContextParams) => ({
  currentQuestion:
    bootstrapContext?.context.currentQuestion ||
    resolveQuestionFromSurface(storedAgentOnboarding) ||
    resolveQuestionFromSurface(bootstrapContext?.agentOnboarding),
  topicId: bootstrapContext?.topicId ?? storedAgentOnboarding?.activeTopicId,
});
