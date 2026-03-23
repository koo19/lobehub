// @vitest-environment node
import { CURRENT_ONBOARDING_VERSION } from '@lobechat/const';
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
        persistedUserState = merge(persistedUserState, patch);
      }),
    };

    vi.mocked(UserModel).mockImplementation(() => mockUserModel as any);
    vi.mocked(MessageModel).mockImplementation(() => ({ create: vi.fn(), query: vi.fn() }) as any);
    vi.mocked(TopicModel).mockImplementation(() => ({ create: vi.fn(), findById: vi.fn() }) as any);
    vi.mocked(AgentService).mockImplementation(() => ({ getBuiltinAgent: vi.fn() }) as any);
  });

  it('resets legacy onboarding nodes to the new conversational flow', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: ['telemetry', 'fullName'],
      currentNode: 'fullName',
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const context = await service.getContext();

    expect(context.currentNode).toBe('agentIdentity');
    expect(context.completedNodes).toEqual([]);
    expect(context.committed.agentIdentity).toBeUndefined();
  });

  it('commits agent identity and advances to user identity', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      currentNode: 'agentIdentity',
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.proposePatch({
      node: 'agentIdentity',
      patch: {
        agentIdentity: {
          emoji: '🫖',
          name: '小七',
          nature: 'an odd little AI housemate',
          vibe: 'warm and sharp',
        },
      },
    });

    expect(result.success).toBe(true);
    expect(persistedUserState.agentOnboarding.agentIdentity).toEqual({
      emoji: '🫖',
      name: '小七',
      nature: 'an odd little AI housemate',
      vibe: 'warm and sharp',
    });
    expect(persistedUserState.agentOnboarding.currentNode).toBe('userIdentity');
    expect(persistedUserState.agentOnboarding.completedNodes).toEqual(['agentIdentity']);
  });

  it('preserves later-step drafts when the model calls userIdentity too early', async () => {
    persistedUserState.agentOnboarding = {
      completedNodes: [],
      currentNode: 'agentIdentity',
      draft: {},
      version: CURRENT_ONBOARDING_VERSION,
    };

    const service = new OnboardingService(mockDb, userId);
    const result = await service.proposePatch({
      node: 'userIdentity',
      patch: {
        userIdentity: {
          domainExpertise: 'AI application development',
          name: 'Ada',
          professionalRole: 'Engineer',
          summary: 'Ada builds AI application features and infra.',
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.content).toContain('saved the later-step draft');
    expect(result.content).toContain('Stay on agentIdentity');
    expect(result.currentNode).toBe('agentIdentity');
    expect(result.requestedNode).toBe('userIdentity');
    expect(result.instruction).toContain('Do not call userIdentity yet');
    expect(result.mismatch).toBe(true);
    expect(result.savedDraftFields).toEqual(['userIdentity']);
    expect(persistedUserState.agentOnboarding.currentNode).toBe('agentIdentity');
    expect(persistedUserState.agentOnboarding.draft.userIdentity).toEqual({
      domainExpertise: 'AI application development',
      name: 'Ada',
      professionalRole: 'Engineer',
      summary: 'Ada builds AI application features and infra.',
    });
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
      currentNode: 'responseLanguage',
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
    expect(context.committed.profile?.identity?.professionalRole).toBe('Product Manager');
    expect(context.committed.profile?.workStyle?.decisionMaking).toBe('data-informed but fast');
    expect(context.committed.profile?.workContext?.tools).toEqual(['Notion', 'Figma', 'SQL']);
    expect(context.committed.profile?.painPoints?.blockedBy).toEqual(['cross-team alignment']);
  });
});
