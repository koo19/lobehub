import {
  WebOnboardingApiName,
  WebOnboardingIdentifier,
} from '@lobechat/builtin-tool-web-onboarding';
import { type BuiltinToolContext, type BuiltinToolResult } from '@lobechat/types';
import { BaseExecutor } from '@lobechat/types';

import { userService } from '@/services/user';

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
      node: Parameters<typeof userService.proposeAgentOnboardingPatch>[0]['node'];
      patch: Parameters<typeof userService.proposeAgentOnboardingPatch>[0]['patch'];
    },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.proposeAgentOnboardingPatch(params);

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

    return {
      content: result.content,
      state: result,
      success: result.success,
    };
  };

  redirectOfftopic = async (
    params: { reason?: string },
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.redirectAgentOnboardingOfftopic(params.reason);

    return {
      content: result.content,
      state: result,
      success: result.success,
    };
  };

  finishAgentOnboarding = async (
    _params: Record<string, never>,
    _ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    const result = await userService.finishAgentOnboarding();

    return {
      content: result.content,
      state: result,
      success: result.success,
    };
  };
}

export const webOnboardingExecutor = new WebOnboardingExecutor();
