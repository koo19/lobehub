import {
  WebOnboardingApiName,
  WebOnboardingIdentifier,
} from '@lobechat/builtin-tool-web-onboarding';
import { type BuiltinToolContext, type BuiltinToolResult } from '@lobechat/types';
import { BaseExecutor } from '@lobechat/types';

import { userService } from '@/services/user';

import { createWebOnboardingToolResult } from '../../../../../utils/webOnboardingToolResult';

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

    return createWebOnboardingToolResult(result);
  };

  askUserQuestion = async (
    params: {
      node: Parameters<typeof userService.askOnboardingQuestion>[0]['node'];
      question: Parameters<typeof userService.askOnboardingQuestion>[0]['question'];
    },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.askOnboardingQuestion(params);

    return {
      content: result.content,
      state: result,
      success: result.success,
    };
  };

  completeCurrentStep = async (
    params: {
      node: Parameters<typeof userService.completeOnboardingStep>[0];
    },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.completeOnboardingStep(params.node);

    return createWebOnboardingToolResult(result);
  };

  returnToOnboarding = async (
    params: { reason?: string },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.returnToOnboarding(params.reason);

    return createWebOnboardingToolResult(result);
  };

  finishOnboarding = async (
    _params: Record<string, never>,
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.finishOnboarding();

    return createWebOnboardingToolResult(result);
  };
}

export const webOnboardingExecutor = new WebOnboardingExecutor();
