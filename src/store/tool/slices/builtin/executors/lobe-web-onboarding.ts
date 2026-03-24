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

  getOnboardingContext = async (): Promise<BuiltinToolResult> => {
    const result = await userService.getAgentOnboardingContext();

    return {
      content: JSON.stringify(result, null, 2),
      state: result,
      success: true,
    };
  };

  proposeOnboardingPatch = async (
    params: {
      updates: Parameters<typeof userService.proposeAgentOnboardingPatch>[0]['updates'];
    },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.proposeAgentOnboardingPatch(params);

    return createWebOnboardingToolResult(result);
  };

  proposeOnboardingInteractions = async (
    params: {
      hints: Parameters<typeof userService.proposeAgentOnboardingInteractions>[0]['hints'];
      node: Parameters<typeof userService.proposeAgentOnboardingInteractions>[0]['node'];
    },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.proposeAgentOnboardingInteractions(params);

    return {
      content: result.content,
      state: result,
      success: result.success,
    };
  };

  commitOnboardingNode = async (
    params: {
      node: Parameters<typeof userService.commitAgentOnboardingNode>[0];
    },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.commitAgentOnboardingNode(params.node);

    return createWebOnboardingToolResult(result);
  };

  redirectOfftopic = async (
    params: { reason?: string },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.redirectAgentOnboardingOfftopic(params.reason);

    return createWebOnboardingToolResult(result);
  };

  finishAgentOnboarding = async (
    _params: Record<string, never>,
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.finishAgentOnboarding();

    return createWebOnboardingToolResult(result);
  };
}

export const webOnboardingExecutor = new WebOnboardingExecutor();
