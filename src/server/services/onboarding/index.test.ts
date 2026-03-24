// @vitest-environment node
import { CURRENT_ONBOARDING_VERSION } from '@lobechat/const';
import { UserAgentOnboardingUpdateSchema } from '@lobechat/types';
import { merge } from '@lobechat/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TopicModel } from '@/database/models/topic';
import { UserModel } from '@/database/models/user';
import { AgentService } from '@/server/services/agent';

import { OnboardingService } from './index';

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn(),
}));

vi.mock('@/database/models/user', () => ({
  UserModel: vi.fn(),
}));

vi.mock('@/const/onboarding', () => ({
  ONBOARDING_PRODUCTION_DEFAULT_MODEL: {
    model: 'gpt-4.1-mini',
    provider: 'openai',
  },
}));

vi.mock('@/server/services/agent', () => ({
  AgentService: vi.fn(),
}));

describe('OnboardingService', () => {
  const mockDb = {} as any;
  const userId = 'user-1';

  let mockAgentService: {
    getBuiltinAgent: ReturnType<typeof vi.fn>;
  };
  let mockTopicModel: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let persistedUserState: any;
  let mockUserModel: {
    getUserSettings: ReturnType<typeof vi.fn>;
    getUserState: ReturnType<typeof vi.fn>;
    updateSetting: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    persistedUserState = {
      agentOnboarding: undefined,
      fullName: undefined,
      interests: undefined,
      settings: {},
    };

    mockUserModel = {
      getUserSettings: vi.fn(async () => persistedUserState.settings),
      getUserState: vi.fn(async () => persistedUserState),
      updateSetting: vi.fn(async (patch) => {
        persistedUserState.settings = merge(persistedUserState.settings ?? {}, patch);
      }),
      updateUser: vi.fn(async (patch) => {
        if ('agentOnboarding' in patch) {
          persistedUserState = {
            ...persistedUserState,
            ...patch,
            agentOnboarding: patch.agentOnboarding,
          };

          return;
        }

        persistedUserState = merge(persistedUserState, patch);
      }),
    };
    mockTopicModel = {
      create: vi.fn(async () => ({ id: 'topic-1' })),
      findById: vi.fn(async () => undefined),
    };
    mockAgentService = {
      getBuiltinAgent: vi.fn(async () => ({ id: 'builtin-agent-1' })),
    };

    vi.mocked(UserModel).mockImplementation(() => mockUserModel as any);
    vi.mocked(TopicModel).mockImplementation(() => mockTopicModel as any);
    vi.mocked(AgentService).mockImplementation(() => mockAgentService as any);
  });

  it('resets legacy onboarding nodes to the new conversational flow', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: ['telemetry', 'fullName'],
      currentNode: 'fullName',
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getState();

    expect(context.activeNode).toBe('agentIdentity');
    expect(context.completedNodes).toEqual([]);
    expect(context.committed.agentIdentity).toBeUndefined();
  });

  it('commits agent identity and advances to user identity', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.saveAnswer({
      updates: [
        {
          node: 'agentIdentity',
          patch: {
            agentIdentity: {
              emoji: '🫖',
              name: '小七',
              nature: 'an odd little AI housemate',
              vibe: 'warm and sharp',
            },
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(persistedUserState.agentOnboarding.agentIdentity).toEqual({
      emoji: '🫖',
      name: '小七',
      nature: 'an odd little AI housemate',
      vibe: 'warm and sharp',
    });
    expect(persistedUserState.agentOnboarding.completedNodes).toEqual(['agentIdentity']);
  });

  it('preserves node-scoped flat patch fields in the update schema', () => {
    const parsed = UserAgentOnboardingUpdateSchema.parse({
      node: 'agentIdentity',
      patch: {
        emoji: '🐍',
        name: '小齐',
        nature: 'Sharp, playful AI sidekick with insights',
        vibe: 'Serpent-like: sharp, witty, and insightful',
      },
    });

    expect(parsed.patch).toEqual({
      emoji: '🐍',
      name: '小齐',
      nature: 'Sharp, playful AI sidekick with insights',
      vibe: 'Serpent-like: sharp, witty, and insightful',
    });
  });

  it('accepts flat agent identity payloads scoped by node', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.saveAnswer({
      updates: [
        {
          node: 'agentIdentity',
          patch: {
            emoji: '🐍',
            name: '小齐',
            nature: 'Sharp, playful AI sidekick with insights',
            vibe: 'Serpent-like: sharp, witty, and insightful',
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(persistedUserState.agentOnboarding.agentIdentity).toEqual({
      emoji: '🐍',
      name: '小齐',
      nature: 'Sharp, playful AI sidekick with insights',
      vibe: 'Serpent-like: sharp, witty, and insightful',
    });
    expect(persistedUserState.agentOnboarding.completedNodes).toEqual(['agentIdentity']);
  });

  it('stores partial agent identity drafts without committing the node', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.saveAnswer({
      updates: [
        {
          node: 'agentIdentity',
          patch: {
            vibe: '活泼',
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.activeNode).toBe('agentIdentity');
    expect(result.activeNodeDraftState).toEqual({
      missingFields: ['emoji', 'name', 'nature'],
      status: 'partial',
    });
    expect(result.content).toContain('Saved a partial draft');
    expect(persistedUserState.agentOnboarding.draft.agentIdentity).toEqual({
      vibe: '活泼',
    });
    expect(persistedUserState.agentOnboarding.completedNodes).toEqual([]);
  });

  it('preserves later-step drafts when the model calls userIdentity too early', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.saveAnswer({
      updates: [
        {
          node: 'userIdentity',
          patch: {
            userIdentity: {
              domainExpertise: 'AI application development',
              name: 'Ada',
              professionalRole: 'Engineer',
              summary: 'Ada builds AI application features and infra.',
            },
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.content).toContain('saved the later-step draft');
    expect(result.content).toContain('Stay on agentIdentity');
    expect(result.activeNode).toBe('agentIdentity');
    expect(result.requestedNode).toBe('userIdentity');
    expect(result.instruction).toContain('Do not call userIdentity yet');
    expect(result.currentQuestion).toBeUndefined();
    expect(result.mismatch).toBe(true);
    expect(result.savedDraftFields).toEqual(['userIdentity']);
    expect(persistedUserState.agentOnboarding.draft.userIdentity).toEqual({
      domainExpertise: 'AI application development',
      name: 'Ada',
      professionalRole: 'Engineer',
      summary: 'Ada builds AI application features and infra.',
    });
  });

  it('does not derive a current question from onboarding state without a stored question surface', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      currentNode: 'agentIdentity',
      draft: {
        responseLanguage: 'zh-CN',
      },
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getState();

    expect(context.activeNode).toBe('agentIdentity');
    expect(context.currentQuestion).toBeUndefined();
  });

  it('does not derive later questions from completed nodes without a stored question surface', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: ['agentIdentity', 'userIdentity', 'workStyle', 'workContext', 'painPoints'],
      currentNode: 'agentIdentity',
      draft: {
        responseLanguage: 'zh-CN',
      },
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getState();

    expect(context.activeNode).toBe('responseLanguage');
    expect(context.currentQuestion).toBeUndefined();
  });

  it('returns no current question when the active node has no stored question surface', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: ['agentIdentity'],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getState();

    expect(context.activeNode).toBe('userIdentity');
    expect(context.currentQuestion).toBeUndefined();
  });

  it('supports batch updates across consecutive onboarding nodes', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.saveAnswer({
      updates: [
        {
          node: 'agentIdentity',
          patch: {
            agentIdentity: {
              emoji: '🦊',
              name: '小七',
              nature: 'a fox-like AI collaborator',
              vibe: 'sharp and warm',
            },
          },
        },
        {
          node: 'userIdentity',
          patch: {
            userIdentity: {
              domainExpertise: 'AI application development',
              name: 'Ada',
              professionalRole: 'Engineer',
              summary: 'Ada builds AI application features and infra.',
            },
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.processedNodes).toEqual(['agentIdentity', 'userIdentity']);
    expect(result.activeNode).toBe('workStyle');
    expect(result.currentQuestion).toBeUndefined();
    expect(persistedUserState.agentOnboarding.agentIdentity?.name).toBe('小七');
    expect(persistedUserState.agentOnboarding.profile?.identity?.name).toBe('Ada');
  });

  it('stores the current question for the active onboarding node', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.askQuestion({
      node: 'agentIdentity',
      question: {
        choices: [
          {
            id: 'identity-default',
            label: 'Use a warm default',
            payload: {
              kind: 'message',
              message: 'Call yourself Xiao Qi, warm and curious, emoji 🐦.',
            },
          },
        ],
        description: 'A tighter preset generated by the model.',
        id: 'agent-identity-ai-preset',
        mode: 'button_group',
        prompt: 'AI-generated preset',
      },
    });

    expect(result.success).toBe(true);
    expect(result.storedQuestionId).toBe('agent-identity-ai-preset');
    expect(result.currentQuestion).toEqual(
      expect.objectContaining({
        id: 'agent-identity-ai-preset',
        mode: 'button_group',
        node: 'agentIdentity',
      }),
    );
    expect(persistedUserState.agentOnboarding.questionSurface).toEqual({
      node: 'agentIdentity',
      question: expect.objectContaining({
        id: 'agent-identity-ai-preset',
        node: 'agentIdentity',
      }),
      updatedAt: expect.any(String),
    });
  });

  it('clears the current question after the onboarding node advances', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      questionSurface: {
        node: 'agentIdentity',
        question: {
          id: 'agent-identity-ai-preset',
          mode: 'button_group',
          node: 'agentIdentity',
          prompt: 'Preset',
        },
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    await service.saveAnswer({
      updates: [
        {
          node: 'agentIdentity',
          patch: {
            agentIdentity: {
              emoji: '🫖',
              name: '小七',
              nature: 'an odd little AI housemate',
              vibe: 'warm and sharp',
            },
          },
        },
      ],
    });

    const context = await service.getState();

    expect(context.activeNode).toBe('userIdentity');
    expect(persistedUserState.agentOnboarding.questionSurface).toBeUndefined();
    expect(context.currentQuestion).toBeUndefined();
  });

  it('surfaces a committed profile across the new onboarding dimensions', async () => {
    persistedUserState.agentOnboarding = {
      agentIdentity: {
        emoji: '🫖',
        name: '小七',
        nature: 'an odd little AI housemate',
        vibe: 'warm and sharp',
      },
      completedNodes: ['agentIdentity', 'userIdentity', 'workStyle', 'workContext', 'painPoints'],
      draft: {},
      profile: {
        currentFocus: 'shipping a 0-1 B2B data platform this quarter',
        identity: {
          domainExpertise: 'B2B SaaS',
          name: 'Ada',
          professionalRole: 'Product Manager',
          summary: 'Ada is a B2B SaaS PM building a data platform from 0 to 1.',
        },
        interests: ['product strategy', 'data platforms'],
        painPoints: {
          blockedBy: ['cross-team alignment'],
          frustrations: ['spec churn'],
          noTimeFor: ['user research synthesis'],
          summary:
            'Execution gets dragged down by alignment overhead and constant requirement churn.',
        },
        workContext: {
          activeProjects: ['data platform 0-1'],
          currentFocus: 'define the MVP and prove adoption',
          interests: ['product strategy', 'data platforms'],
          summary:
            'She is focused on MVP definition, adoption, and the operating rhythm around the launch.',
          thisQuarter: 'launch the first usable version',
          thisWeek: 'close scope and unblock engineering',
          tools: ['Notion', 'Figma', 'SQL'],
        },
        workStyle: {
          communicationStyle: 'direct',
          decisionMaking: 'data-informed but fast',
          socialMode: 'collaborative',
          summary: 'She likes clear trade-offs, quick synthesis, and direct communication.',
          thinkingPreferences: 'structured',
          workStyle: 'fast-moving',
        },
      },
      version: CURRENT_ONBOARDING_VERSION,
    };
    persistedUserState.fullName = 'Ada';
    persistedUserState.interests = ['product strategy', 'data platforms'];

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getState();

    expect(context.committed.agentIdentity?.name).toBe('小七');
    expect(context.currentQuestion).toBeUndefined();
    expect(context.committed.profile?.identity?.professionalRole).toBe('Product Manager');
    expect(context.committed.profile?.workStyle?.decisionMaking).toBe('data-informed but fast');
    expect(context.committed.profile?.workContext?.tools).toEqual(['Notion', 'Figma', 'SQL']);
    expect(context.committed.profile?.painPoints?.blockedBy).toEqual(['cross-team alignment']);
  });

  it('allows finish when summary is the derived active step even if legacy currentNode is stale', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [
        'agentIdentity',
        'userIdentity',
        'workStyle',
        'workContext',
        'painPoints',
        'responseLanguage',
        'proSettings',
      ],
      currentNode: 'agentIdentity',
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.finishOnboarding();

    expect(result.success).toBe(true);
    expect(persistedUserState.agentOnboarding.finishedAt).toBeTruthy();
    expect(persistedUserState.agentOnboarding.completedNodes).toContain('summary');
  });

  it('does not create a persisted welcome message for a new onboarding topic', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: ['agentIdentity', 'userIdentity'],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.getOrCreateState();

    expect(result.topicId).toBe('topic-1');
    expect(mockTopicModel.create).toHaveBeenCalledWith({
      agentId: 'builtin-agent-1',
      title: 'Onboarding',
      trigger: 'chat',
    });
  });
});
