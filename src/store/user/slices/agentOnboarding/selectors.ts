import { CURRENT_ONBOARDING_VERSION } from '@lobechat/const';

import type { UserStore } from '../../store';

const currentNode = (s: UserStore) => s.agentOnboarding?.currentNode;

const finishedAt = (s: UserStore) => s.agentOnboarding?.finishedAt;

const isFinished = (s: Pick<UserStore, 'agentOnboarding'>) => !!s.agentOnboarding?.finishedAt;

const needsOnboarding = (s: Pick<UserStore, 'agentOnboarding'>) =>
  !s.agentOnboarding?.finishedAt ||
  (s.agentOnboarding?.version && s.agentOnboarding.version < CURRENT_ONBOARDING_VERSION);

export const agentOnboardingSelectors = {
  currentNode,
  finishedAt,
  isFinished,
  needsOnboarding,
};
