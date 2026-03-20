import { describe, expect, it } from 'vitest';

import { resolveAgentOnboardingContext } from './context';

describe('resolveAgentOnboardingContext', () => {
  it('prefers stored onboarding state over bootstrap context', () => {
    const result = resolveAgentOnboardingContext({
      bootstrapContext: {
        agentOnboarding: {
          activeTopicId: 'topic-bootstrap',
          completedNodes: ['telemetry'],
          currentNode: 'telemetry',
          version: 1,
        },
        topicId: 'topic-bootstrap',
      },
      storedAgentOnboarding: {
        activeTopicId: 'topic-store',
        completedNodes: ['telemetry'],
        currentNode: 'fullName',
        version: 1,
      },
    });

    expect(result).toEqual({
      currentNode: 'fullName',
      topicId: 'topic-store',
    });
  });

  it('falls back per field when stored onboarding state is partial', () => {
    const result = resolveAgentOnboardingContext({
      bootstrapContext: {
        agentOnboarding: {
          activeTopicId: 'topic-bootstrap',
          completedNodes: ['telemetry', 'fullName'],
          currentNode: 'interests',
          version: 1,
        },
        topicId: 'topic-bootstrap',
      },
      storedAgentOnboarding: {
        completedNodes: ['telemetry', 'fullName'],
        currentNode: 'interests',
        version: 1,
      },
    });

    expect(result).toEqual({
      currentNode: 'interests',
      topicId: 'topic-bootstrap',
    });
  });
});
