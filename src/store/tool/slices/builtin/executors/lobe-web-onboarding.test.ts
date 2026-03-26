import { WebOnboardingApiName, WebOnboardingManifest } from '@lobechat/builtin-tool-web-onboarding';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { finishOnboardingSpy, refreshUserStateSpy } = vi.hoisted(() => ({
  finishOnboardingSpy: vi.fn(),
  refreshUserStateSpy: vi.fn(),
}));

vi.mock('@/services/user', () => ({
  userService: {
    finishOnboarding: finishOnboardingSpy,
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: {
    getState: () => ({
      refreshUserState: refreshUserStateSpy,
    }),
  },
}));

describe('webOnboardingExecutor', () => {
  beforeEach(() => {
    finishOnboardingSpy.mockReset();
    refreshUserStateSpy.mockReset();
    vi.resetModules();
  });

  it('publishes the renamed saveUserQuestion API', async () => {
    const { webOnboardingExecutor } = await import('./lobe-web-onboarding');

    expect(WebOnboardingApiName.saveUserQuestion).toBe('saveUserQuestion');
    expect('saveAnswer' in WebOnboardingApiName).toBe(false);
    expect(webOnboardingExecutor.hasApi(WebOnboardingApiName.saveUserQuestion)).toBe(true);
    expect(webOnboardingExecutor.hasApi('saveAnswer')).toBe(false);
  });

  it('publishes the flat saveUserQuestion manifest contract', () => {
    const saveUserQuestionApi = WebOnboardingManifest.api.find(
      (api) => api.name === WebOnboardingApiName.saveUserQuestion,
    );

    expect(saveUserQuestionApi).toMatchObject({
      description: expect.stringContaining('agentName and agentEmoji'),
      parameters: {
        additionalProperties: false,
        properties: {
          agentEmoji: { description: expect.any(String), type: 'string' },
          agentName: { description: expect.any(String), type: 'string' },
          fullName: { type: 'string' },
          interests: {
            items: { type: 'string' },
            type: 'array',
          },
          responseLanguage: { type: 'string' },
        },
        type: 'object',
      },
    });
  });

  it('logs the transferred inbox topic in development instead of navigating', async () => {
    vi.doMock('@/utils/env', () => ({
      isDev: true,
    }));

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const assignSpy = vi.fn();
    const originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: assignSpy },
    });

    finishOnboardingSpy.mockResolvedValue({
      agentId: 'inbox-agent-1',
      success: true,
      topicId: 'topic-1',
    });

    const { webOnboardingExecutor } = await import('./lobe-web-onboarding');
    await webOnboardingExecutor.finishOnboarding({}, {} as any);

    expect(refreshUserStateSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      '[webOnboardingExecutor] finishOnboarding target:',
      '/agent/inbox-agent-1?topic=topic-1',
    );
    expect(assignSpy).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    infoSpy.mockRestore();
  });

  it('redirects to the transferred inbox topic outside development', async () => {
    vi.doMock('@/utils/env', () => ({
      isDev: false,
    }));

    const assignSpy = vi.fn();
    const originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: assignSpy },
    });

    finishOnboardingSpy.mockResolvedValue({
      agentId: 'inbox-agent-1',
      success: true,
      topicId: 'topic-1',
    });

    const { webOnboardingExecutor } = await import('./lobe-web-onboarding');
    await webOnboardingExecutor.finishOnboarding({}, {} as any);

    expect(refreshUserStateSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('/agent/inbox-agent-1?topic=topic-1');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
