import { describe, expect, it } from 'vitest';

import { resolveAgentOnboardingContext } from './context';

describe('resolveAgentOnboardingContext', () => {
  it('prefers stored onboarding state over bootstrap context', () => {
    const result = resolveAgentOnboardingContext({
      bootstrapContext: {
        agentOnboarding: {
          activeTopicId: 'topic-bootstrap',
          completedNodes: ['agentIdentity'],
          currentNode: 'agentIdentity',
          version: 1,
        },
        topicId: 'topic-bootstrap',
      },
      storedAgentOnboarding: {
        activeTopicId: 'topic-store',
        completedNodes: ['agentIdentity'],
        currentNode: 'userIdentity',
        version: 1,
      },
    });

    expect(result).toEqual({
      currentNode: 'userIdentity',
      topicId: 'topic-store',
    });
  });

  it('falls back per field when stored onboarding state is partial', () => {
    const result = resolveAgentOnboardingContext({
      bootstrapContext: {
        agentOnboarding: {
          activeTopicId: 'topic-bootstrap',
          completedNodes: ['agentIdentity', 'userIdentity'],
          currentNode: 'workStyle',
          version: 1,
        },
        topicId: 'topic-bootstrap',
      },
      storedAgentOnboarding: {
        completedNodes: ['agentIdentity', 'userIdentity'],
        currentNode: 'workStyle',
        version: 1,
      },
    });

    expect(result).toEqual({
      currentNode: 'workStyle',
      topicId: 'topic-bootstrap',
    });
  });
});
