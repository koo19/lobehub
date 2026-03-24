import { beforeEach, describe, expect, it, vi } from 'vitest';

import { userService } from '@/services/user';
import { useUserStore } from '@/store/user';

import { webOnboardingExecutor } from './lobe-web-onboarding';

vi.mock('@/services/user', () => ({
  userService: {
    askOnboardingQuestion: vi.fn(),
    completeOnboardingStep: vi.fn(),
    finishOnboarding: vi.fn(),
    getOnboardingState: vi.fn(),
    returnToOnboarding: vi.fn(),
    saveOnboardingAnswer: vi.fn(),
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: {
    getState: vi.fn(),
  },
}));

describe('webOnboardingExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserStore.getState).mockReturnValue({
      refreshUserState: vi.fn().mockResolvedValue(undefined),
    } as any);
  });

  it('refreshes user onboarding state after askUserQuestion', async () => {
    const refreshUserState = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useUserStore.getState).mockReturnValue({
      refreshUserState,
    } as any);
    vi.mocked(userService.askOnboardingQuestion).mockResolvedValue({
      content: 'Saved the current question for "agentIdentity".',
      currentQuestion: {
        id: 'agent_identity_001',
        mode: 'button_group',
        node: 'agentIdentity',
        prompt: '贾维斯的气质应该是什么样的？',
      },
      success: true,
    });

    await webOnboardingExecutor.askUserQuestion(
      {
        node: 'agentIdentity',
        question: {
          id: 'agent_identity_001',
          mode: 'button_group',
          prompt: '贾维斯的气质应该是什么样的？',
        },
      },
      {} as any,
    );

    expect(refreshUserState).toHaveBeenCalled();
  });
});
