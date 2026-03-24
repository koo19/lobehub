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
        context: {
          currentQuestion: undefined,
        },
        topicId: 'topic-bootstrap',
      },
      storedAgentOnboarding: {
        activeTopicId: 'topic-store',
        completedNodes: ['agentIdentity'],
        version: 1,
      },
    });

    expect(result).toEqual({
      currentQuestion: undefined,
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
        context: {
          currentQuestion: undefined,
        },
        topicId: 'topic-bootstrap',
      },
      storedAgentOnboarding: {
        completedNodes: ['agentIdentity', 'userIdentity'],
        version: 1,
      },
    });

    expect(result).toEqual({
      currentQuestion: undefined,
      topicId: 'topic-bootstrap',
    });
  });

  it('falls back to stored questionSurface when bootstrap currentQuestion is empty', () => {
    const result = resolveAgentOnboardingContext({
      bootstrapContext: {
        agentOnboarding: {
          activeTopicId: 'topic-bootstrap',
          completedNodes: [],
          version: 1,
        },
        context: {
          currentQuestion: undefined,
        },
        topicId: 'topic-bootstrap',
      },
      storedAgentOnboarding: {
        completedNodes: [],
        questionSurface: {
          node: 'agentIdentity',
          question: {
            id: 'agent_identity_001',
            mode: 'button_group',
            node: 'agentIdentity',
            prompt: '贾维斯的气质应该是什么样的？',
          },
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
        version: 1,
      },
    });

    expect(result).toEqual({
      currentQuestion: {
        id: 'agent_identity_001',
        mode: 'button_group',
        node: 'agentIdentity',
        prompt: '贾维斯的气质应该是什么样的？',
      },
      topicId: 'topic-bootstrap',
    });
  });

  it('does not surface questionSurface for completed nodes', () => {
    const result = resolveAgentOnboardingContext({
      storedAgentOnboarding: {
        completedNodes: ['agentIdentity'],
        questionSurface: {
          node: 'agentIdentity',
          question: {
            id: 'agent_identity_001',
            mode: 'button_group',
            node: 'agentIdentity',
            prompt: '贾维斯的气质应该是什么样的？',
          },
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
        version: 1,
      },
    });

    expect(result).toEqual({
      currentQuestion: undefined,
      topicId: undefined,
    });
  });
});
