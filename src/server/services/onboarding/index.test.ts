// @vitest-environment node
import { CURRENT_ONBOARDING_VERSION } from '@lobechat/const';
import { UserAgentOnboardingUpdateSchema } from '@lobechat/types';
import { merge } from '@lobechat/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageModel } from '@/database/models/message';
import { TopicModel } from '@/database/models/topic';
import { UserModel } from '@/database/models/user';
import { AgentService } from '@/server/services/agent';

import { OnboardingService } from './index';

vi.mock('@/database/models/message', () => ({
  MessageModel: vi.fn(),
}));

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
  let mockMessageModel: {
    create: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  let mockTopicModel: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
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
    mockMessageModel = {
      create: vi.fn(async () => ({ id: 'message-1' })),
      query: vi.fn(async () => []),
    };
    mockTopicModel = {
      create: vi.fn(async () => ({ id: 'topic-1' })),
      delete: vi.fn(async () => undefined),
      findById: vi.fn(async () => undefined),
    };
    mockAgentService = {
      getBuiltinAgent: vi.fn(async () => ({ id: 'builtin-agent-1' })),
    };

    vi.mocked(MessageModel).mockImplementation(() => mockMessageModel as any);
    vi.mocked(UserModel).mockImplementation(() => mockUserModel as any);
    vi.mocked(TopicModel).mockImplementation(() => mockTopicModel as any);
    vi.mocked(AgentService).mockImplementation(() => mockAgentService as any);
  });

  it('resets legacy onboarding nodes to the conversational flow', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: ['telemetry', 'fullName'],
      currentNode: 'fullName',
      executionGuard: {
        issuedAt: '2026-03-24T00:00:00.000Z',
        readToken: 'legacy-token',
      },
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getState();

    expect(context.activeNode).toBe('agentIdentity');
    expect(context.completedNodes).toEqual([]);
    expect(context.committed.agentIdentity).toBeUndefined();
  });

  it('preserves progress when migrating away from the removed proSettings node', async () => {
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
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getState();

    expect(context.activeNode).toBe('summary');
    expect(context.completedNodes).toEqual([
      'agentIdentity',
      'userIdentity',
      'workStyle',
      'workContext',
      'painPoints',
      'responseLanguage',
    ]);
  });

  it('returns lightweight control metadata without read tokens', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getState();

    expect(context.control.allowedTools).toContain('getOnboardingState');
    expect(context.control.allowedTools).toContain('askUserQuestion');
    expect(context.control.allowedTools).toContain('saveAnswer');
    expect('readToken' in context.control).toBe(false);
    expect('readTokenRequired' in context.control).toBe(false);
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
    expect(result.activeNode).toBe('userIdentity');
    expect(persistedUserState.agentOnboarding.agentIdentity).toEqual({
      emoji: '🫖',
      name: '小七',
      nature: 'an odd little AI housemate',
      vibe: 'warm and sharp',
    });
    expect(persistedUserState.agentOnboarding.completedNodes).toEqual(['agentIdentity']);
  });

  it('stores partial drafts and reports missing required fields', async () => {
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
    expect(persistedUserState.agentOnboarding.draft.agentIdentity).toEqual({
      vibe: '活泼',
    });
    expect(persistedUserState.agentOnboarding.completedNodes).toEqual([]);
  });

  it('rejects writes to a non-active node and does not preserve later drafts', async () => {
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
    expect(result.error?.code).toBe('NODE_MISMATCH');
    expect(result.activeNode).toBe('agentIdentity');
    expect(result.requestedNode).toBe('userIdentity');
    expect(result.mismatch).toBe(true);
    expect(persistedUserState.agentOnboarding.draft.userIdentity).toBeUndefined();
  });

  it('supports sequential batch updates across consecutive nodes', async () => {
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
            emoji: '🦊',
            name: '小七',
            nature: 'a fox-like AI collaborator',
            vibe: 'sharp and warm',
          },
        },
        {
          node: 'userIdentity',
          patch: {
            summary: 'Ada builds AI application features and infra.',
            professionalRole: 'Engineer',
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.processedNodes).toEqual(['agentIdentity', 'userIdentity']);
    expect(result.activeNode).toBe('workStyle');
    expect(persistedUserState.agentOnboarding.profile?.identity).toEqual({
      professionalRole: 'Engineer',
      summary: 'Ada builds AI application features and infra.',
    });
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
  });

  it('clears the current question after the active node advances', async () => {
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
            emoji: '🫖',
            name: '小七',
            nature: 'an odd little AI housemate',
            vibe: 'warm and sharp',
          },
        },
      ],
    });

    const context = await service.getState();

    expect(context.activeNode).toBe('userIdentity');
    expect(context.currentQuestion).toBeUndefined();
    expect(persistedUserState.agentOnboarding.questionSurface).toBeUndefined();
  });

  it('commits an already complete draft through completeCurrentStep', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: ['agentIdentity', 'userIdentity'],
      draft: {
        workStyle: {
          summary: 'Prefers direct communication and quick synthesis.',
        },
      },
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.completeCurrentStep('workStyle');

    expect(result.success).toBe(true);
    expect(persistedUserState.agentOnboarding.completedNodes).toEqual([
      'agentIdentity',
      'userIdentity',
      'workStyle',
    ]);
    expect(persistedUserState.agentOnboarding.profile?.workStyle).toEqual({
      summary: 'Prefers direct communication and quick synthesis.',
    });
  });

  it('rejects saveAnswer on summary and only finishes from summary', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [
        'agentIdentity',
        'userIdentity',
        'workStyle',
        'workContext',
        'painPoints',
        'responseLanguage',
      ],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const saveResult = await service.saveAnswer({
      updates: [
        {
          node: 'summary',
          patch: {},
        },
      ],
    });
    const finishResult = await service.finishOnboarding();

    expect(saveResult.success).toBe(false);
    expect(saveResult.error?.code).toBe('INCOMPLETE_NODE_DATA');
    expect(finishResult.success).toBe(true);
    expect(persistedUserState.agentOnboarding.finishedAt).toBeTruthy();
    expect(persistedUserState.agentOnboarding.completedNodes).toContain('summary');
  });

  it('preserves flat node-scoped patch fields in the update schema', () => {
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

  it('creates a persisted welcome message for a new onboarding topic', async () => {
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
    expect(mockMessageModel.create).toHaveBeenCalledWith({
      agentId: 'builtin-agent-1',
      content: expect.stringContaining('Onboarding'),
      role: 'assistant',
      topicId: 'topic-1',
    });
  });

  it('reset preserves the previous onboarding topic while clearing state', async () => {
    persistedUserState.agentOnboarding = {
      activeTopicId: 'topic-old',
      completedNodes: ['agentIdentity'],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.reset();

    expect(result).toEqual({
      completedNodes: [],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    });
    expect(mockTopicModel.delete).not.toHaveBeenCalled();
    expect(persistedUserState.agentOnboarding).toEqual(result);
  });

  it('creates a new onboarding topic after reset clears the active topic pointer', async () => {
    persistedUserState.agentOnboarding = {
      activeTopicId: 'topic-old',
      completedNodes: ['agentIdentity'],
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };
    mockTopicModel.create.mockResolvedValueOnce({ id: 'topic-2' });

    const service = new OnboardingService(mockDb, userId);

    await service.reset();
    const result = await service.getOrCreateState();

    expect(result.topicId).toBe('topic-2');
    expect(persistedUserState.agentOnboarding.activeTopicId).toBe('topic-2');
  });
});
