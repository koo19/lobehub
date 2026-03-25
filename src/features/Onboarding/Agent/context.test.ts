import { describe, expect, it } from 'vitest';

import { resolveAgentOnboardingContext } from './context';

describe('resolveAgentOnboardingContext', () => {
  it('prefers bootstrap onboarding topic over stored onboarding state', () => {
    const result = resolveAgentOnboardingContext({
      bootstrapContext: {
        agentOnboarding: {
          activeTopicId: 'topic-bootstrap',
          completedNodes: ['agentIdentity'],
          version: 1,
        },
        context: {},
        topicId: 'topic-bootstrap',
      },
      storedAgentOnboarding: {
        activeTopicId: 'topic-store',
        completedNodes: ['agentIdentity'],
        version: 1,
      },
    });

    expect(result).toEqual({
      activeNode: 'userIdentity',
      topicId: 'topic-bootstrap',
    });
  });

  it('falls back per field when stored onboarding state is partial', () => {
    const result = resolveAgentOnboardingContext({
      bootstrapContext: {
        agentOnboarding: {
          activeTopicId: 'topic-bootstrap',
          completedNodes: ['agentIdentity', 'userIdentity'],
          version: 1,
        },
        context: {},
        topicId: 'topic-bootstrap',
      },
      storedAgentOnboarding: {
        completedNodes: ['agentIdentity', 'userIdentity'],
        version: 1,
      },
    });

    expect(result).toEqual({
      activeNode: 'workStyle',
      topicId: 'topic-bootstrap',
    });
  });

  it('resolves activeNode from stored state', () => {
    const result = resolveAgentOnboardingContext({
      storedAgentOnboarding: {
        completedNodes: ['agentIdentity'],
        version: 1,
      },
    });

    expect(result).toEqual({
      activeNode: 'userIdentity',
      topicId: undefined,
    });
  });
});
