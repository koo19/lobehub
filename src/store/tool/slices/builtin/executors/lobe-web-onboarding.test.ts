import { beforeEach, describe, expect, it, vi } from 'vitest';

import { userService } from '@/services/user';
import { useUserStore } from '@/store/user';

import { webOnboardingExecutor } from './lobe-web-onboarding';

vi.mock('@/services/user', () => ({
  userService: {
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

  it('refreshes user onboarding state after saveAnswer', async () => {
    const refreshUserState = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useUserStore.getState).mockReturnValue({
      refreshUserState,
    } as any);
    vi.mocked(userService.saveOnboardingAnswer).mockResolvedValue({
      content: 'Saved.',
      success: true,
    } as any);

    await webOnboardingExecutor.saveAnswer(
      {
        updates: [
          {
            node: 'agentIdentity',
            patch: { emoji: '🫖', name: '小七', nature: 'an AI housemate', vibe: 'warm' },
          },
        ],
      },
      {} as any,
    );

    expect(refreshUserState).toHaveBeenCalled();
  });
});
