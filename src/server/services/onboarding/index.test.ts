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
    const context = await service.getContext();

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
    const result = await service.proposePatch({
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

  it('preserves malformed flat patch fields so the service can return a structured failure', () => {
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

  it('returns a structured invalid patch shape error for flat agent identity payloads', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.proposePatch({
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

    expect(result.success).toBe(false);
    expect(result.error).toEqual({
      code: 'INVALID_PATCH_SHAPE',
      expectedPatchPath: 'patch.agentIdentity',
      message:
        'Invalid patch shape for "agentIdentity". Put these fields under patch.agentIdentity instead of sending them at the top level of patch.',
      receivedPatch: {
        emoji: '🐍',
        name: '小齐',
        nature: 'Sharp, playful AI sidekick with insights',
        vibe: 'Serpent-like: sharp, witty, and insightful',
      },
      receivedPatchKeys: ['emoji', 'name', 'nature', 'vibe'],
    });
    expect(result.content).toContain('patch.agentIdentity');
    expect(persistedUserState.agentOnboarding.agentIdentity).toBeUndefined();
    expect(persistedUserState.agentOnboarding.completedNodes).toEqual([]);
  });

  it('preserves later-step drafts when the model calls userIdentity too early', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.proposePatch({
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
    expect(result.interactionHints?.[0]?.node).toBe('agentIdentity');
    expect(result.mismatch).toBe(true);
    expect(result.savedDraftFields).toEqual(['userIdentity']);
    expect(persistedUserState.agentOnboarding.draft.userIdentity).toEqual({
      domainExpertise: 'AI application development',
      name: 'Ada',
      professionalRole: 'Engineer',
      summary: 'Ada builds AI application features and infra.',
    });
  });

  it('builds interaction hints from onboarding state instead of the legacy currentNode field', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      currentNode: 'agentIdentity',
      draft: {
        responseLanguage: 'zh-CN',
      },
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getContext();

    expect(context.activeNode).toBe('agentIdentity');
    expect(context.interactionHints?.map((hint) => hint.node)).toEqual([
      'agentIdentity',
      'agentIdentity',
    ]);
  });

  it('derives later structured hints from completed nodes without reading legacy currentNode', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: ['agentIdentity', 'userIdentity', 'workStyle', 'workContext', 'painPoints'],
      currentNode: 'agentIdentity',
      draft: {
        responseLanguage: 'zh-CN',
      },
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getContext();

    expect(context.activeNode).toBe('responseLanguage');
    expect(context.interactionHints?.map((hint) => hint.node)).toEqual(['responseLanguage']);
    expect(context.interactionHints?.[0]?.fields?.[0]?.value).toBe('zh-CN');
  });

  it('marks weak fallback interaction hints as needing refresh', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: ['agentIdentity'],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getContext();

    expect(context.activeNode).toBe('userIdentity');
    expect(context.interactionHints?.[0]?.kind).toBe('composer_prefill');
    expect(context.interactionPolicy).toEqual({
      needsRefresh: true,
      reason:
        'Current node "userIdentity" only has weak fallback interaction hints. Generate a better interaction surface before your next visible reply.',
    });
  });

  it('supports batch updates across consecutive onboarding nodes', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.proposePatch({
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
    expect(persistedUserState.agentOnboarding.agentIdentity?.name).toBe('小七');
    expect(persistedUserState.agentOnboarding.profile?.identity?.name).toBe('Ada');
  });

  it('stores AI-generated interaction hints for the active onboarding node', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.proposeInteractions({
      hints: [
        {
          actions: [
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
          kind: 'button_group',
          submitMode: 'message',
          title: 'AI-generated preset',
        },
      ],
      node: 'agentIdentity',
    });

    expect(result.success).toBe(true);
    expect(result.storedHintIds).toEqual(['agent-identity-ai-preset']);
    expect(result.interactionHints).toEqual([
      expect.objectContaining({
        id: 'agent-identity-ai-preset',
        kind: 'button_group',
        node: 'agentIdentity',
      }),
    ]);
    expect(persistedUserState.agentOnboarding.interactionSurface).toEqual({
      hints: [
        expect.objectContaining({
          id: 'agent-identity-ai-preset',
          node: 'agentIdentity',
        }),
      ],
      node: 'agentIdentity',
      updatedAt: expect.any(String),
    });
  });

  it('clears AI-generated interaction hints after the onboarding node advances', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      interactionSurface: {
        hints: [
          {
            id: 'agent-identity-ai-preset',
            kind: 'button_group',
            node: 'agentIdentity',
          },
        ],
        node: 'agentIdentity',
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    await service.proposePatch({
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

    const context = await service.getContext();

    expect(context.activeNode).toBe('userIdentity');
    expect(persistedUserState.agentOnboarding.interactionSurface).toBeUndefined();
    expect(context.interactionHints?.[0]?.node).toBe('userIdentity');
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
    const context = await service.getContext();

    expect(context.committed.agentIdentity?.name).toBe('小七');
    expect(context.interactionHints?.[0]?.kind).toBe('select');
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
    const result = await service.finish();

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
    const result = await service.getOrCreateContext();

    expect(result.topicId).toBe('topic-1');
    expect(mockTopicModel.create).toHaveBeenCalledWith({
      agentId: 'builtin-agent-1',
      title: 'Onboarding',
      trigger: 'chat',
    });
  });
});
