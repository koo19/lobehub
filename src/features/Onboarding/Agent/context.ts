import type { UserAgentOnboardingNode } from '@lobechat/types';
import { AGENT_ONBOARDING_NODES } from '@lobechat/types';

import type { UserAgentOnboarding, UserAgentOnboardingQuestion } from '@/types/user';

export interface AgentOnboardingBootstrapContext {
  agentOnboarding: UserAgentOnboarding;
  context: {
    activeNode?: UserAgentOnboardingNode;
    currentQuestion?: UserAgentOnboardingQuestion;
  };
  topicId: string;
}

interface ResolveAgentOnboardingContextParams {
  bootstrapContext?: AgentOnboardingBootstrapContext;
  storedAgentOnboarding?: UserAgentOnboarding;
}

const getActiveNodeFromState = (state?: UserAgentOnboarding) => {
  if (state?.finishedAt) return undefined;

  const completedNodeSet = new Set(state?.completedNodes ?? []);

  return AGENT_ONBOARDING_NODES.find((node) => !completedNodeSet.has(node));
};

const resolveQuestionFromSurface = (
  state: UserAgentOnboarding | undefined,
  activeNode: UserAgentOnboardingNode | undefined,
) => {
  const questionSurface = state?.questionSurface;

  if (!questionSurface) return undefined;
  if (questionSurface.node !== activeNode) return undefined;
  if (state?.completedNodes?.includes(questionSurface.node)) return undefined;

  return questionSurface.question;
};

export const resolveAgentOnboardingContext = ({
  bootstrapContext,
  storedAgentOnboarding,
}: ResolveAgentOnboardingContextParams) => {
  const activeNode =
    getActiveNodeFromState(storedAgentOnboarding) ||
    bootstrapContext?.context.activeNode ||
    getActiveNodeFromState(bootstrapContext?.agentOnboarding);

  const bootstrapCurrentQuestion =
    bootstrapContext?.context.currentQuestion?.node === activeNode
      ? bootstrapContext?.context.currentQuestion
      : undefined;

  return {
    activeNode,
    currentQuestion:
      bootstrapCurrentQuestion ||
      resolveQuestionFromSurface(storedAgentOnboarding, activeNode) ||
      resolveQuestionFromSurface(bootstrapContext?.agentOnboarding, activeNode),
    topicId: bootstrapContext?.topicId ?? storedAgentOnboarding?.activeTopicId,
  };
};
