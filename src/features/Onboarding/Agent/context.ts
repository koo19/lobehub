import type { UserAgentOnboardingNode } from '@lobechat/types';
import { AGENT_ONBOARDING_NODES } from '@lobechat/types';

import type { UserAgentOnboarding } from '@/types/user';

export interface AgentOnboardingBootstrapContext {
  agentOnboarding: UserAgentOnboarding;
  context: {
    activeNode?: UserAgentOnboardingNode;
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

export const resolveAgentOnboardingContext = ({
  bootstrapContext,
  storedAgentOnboarding,
}: ResolveAgentOnboardingContextParams) => {
  const activeNode =
    getActiveNodeFromState(storedAgentOnboarding) ||
    bootstrapContext?.context.activeNode ||
    getActiveNodeFromState(bootstrapContext?.agentOnboarding);

  return {
    activeNode,
    topicId: bootstrapContext?.topicId ?? storedAgentOnboarding?.activeTopicId,
  };
};
