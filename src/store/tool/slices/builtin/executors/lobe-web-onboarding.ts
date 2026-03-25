import {
  WebOnboardingApiName,
  WebOnboardingIdentifier,
} from '@lobechat/builtin-tool-web-onboarding';
import { type BuiltinToolContext, type BuiltinToolResult } from '@lobechat/types';
import { BaseExecutor } from '@lobechat/types';

import { userService } from '@/services/user';
import { useUserStore } from '@/store/user';

import { createWebOnboardingToolResult } from '../../../../../utils/webOnboardingToolResult';

const syncUserOnboardingState = async () => {
  try {
    await useUserStore.getState().refreshUserState();
  } catch (error) {
    console.error(error);
  }
};

class WebOnboardingExecutor extends BaseExecutor<typeof WebOnboardingApiName> {
  readonly identifier = WebOnboardingIdentifier;
  protected readonly apiEnum = WebOnboardingApiName;

  getOnboardingState = async (): Promise<BuiltinToolResult> => {
    const result = await userService.getOnboardingState();

    return {
      content: JSON.stringify(result, null, 2),
      state: result,
      success: true,
    };
  };

  saveAnswer = async (
    params: {
      updates: Parameters<typeof userService.saveOnboardingAnswer>[0]['updates'];
    },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.saveOnboardingAnswer(params);
    await syncUserOnboardingState();

    return createWebOnboardingToolResult(result);
  };

  completeCurrentStep = async (
    params: {
      node: Parameters<typeof userService.completeOnboardingStep>[0];
    },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.completeOnboardingStep(params.node);
    await syncUserOnboardingState();

    return createWebOnboardingToolResult(result);
  };

  returnToOnboarding = async (
    params: { reason?: string },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.returnToOnboarding(params.reason);
    await syncUserOnboardingState();

    return createWebOnboardingToolResult(result);
  };

  finishOnboarding = async (_params: Record<string, never>, _ctx: BuiltinToolContext) => {
    const result = await userService.finishOnboarding();
    await syncUserOnboardingState();

    return createWebOnboardingToolResult(result);
  };
}

export const webOnboardingExecutor = new WebOnboardingExecutor();
