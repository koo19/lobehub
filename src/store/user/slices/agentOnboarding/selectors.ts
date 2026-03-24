import { CURRENT_ONBOARDING_VERSION } from '@lobechat/const';
import { AGENT_ONBOARDING_NODES } from '@lobechat/types';

import type { UserStore } from '../../store';

const activeNode = (s: UserStore) => {
  if (s.agentOnboarding?.finishedAt) return undefined;

  const completedNodes = new Set(s.agentOnboarding?.completedNodes ?? []);

  return AGENT_ONBOARDING_NODES.find((node) => !completedNodes.has(node));
};

const finishedAt = (s: UserStore) => s.agentOnboarding?.finishedAt;

const isFinished = (s: Pick<UserStore, 'agentOnboarding'>) => !!s.agentOnboarding?.finishedAt;

const needsOnboarding = (s: Pick<UserStore, 'agentOnboarding'>) =>
  !s.agentOnboarding?.finishedAt ||
  (s.agentOnboarding?.version && s.agentOnboarding.version < CURRENT_ONBOARDING_VERSION);

export const agentOnboardingSelectors = {
  activeNode,
  finishedAt,
  isFinished,
  needsOnboarding,
};
