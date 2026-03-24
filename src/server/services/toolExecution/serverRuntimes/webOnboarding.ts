import {
  WebOnboardingIdentifier,
  WebOnboardingManifest,
} from '@lobechat/builtin-tool-web-onboarding';

import { OnboardingService } from '@/server/services/onboarding';
import { createWebOnboardingToolResult } from '@/utils/webOnboardingToolResult';

import type { ServerRuntimeRegistration } from './types';

export const webOnboardingRuntime: ServerRuntimeRegistration = {
  factory: (context) => {
    if (!context.serverDB || !context.userId) {
      throw new Error('serverDB and userId are required for web onboarding tool execution');
    }

    const service = new OnboardingService(context.serverDB, context.userId);
    const proxy: Record<string, (args: Record<string, unknown>) => Promise<any>> = {};

    for (const api of WebOnboardingManifest.api) {
      proxy[api.name] = async (args: Record<string, unknown>) => {
        switch (api.name) {
          case 'getOnboardingContext': {
            const result = await service.getContext();

            return { content: JSON.stringify(result, null, 2), state: result, success: true };
          }
          case 'proposeOnboardingPatch': {
            const result = await service.proposePatch(args as any);

            return createWebOnboardingToolResult(result);
          }
          case 'proposeOnboardingInteractions': {
            const result = await service.proposeInteractions(args as any);

            return createWebOnboardingToolResult(result);
          }
          case 'commitOnboardingNode': {
            const result = await service.commitNode(args.node as any);

            return createWebOnboardingToolResult(result);
          }
          case 'redirectOfftopic': {
            const result = await service.redirectOfftopic(args.reason as string | undefined);

            return createWebOnboardingToolResult(result);
          }
          case 'finishAgentOnboarding': {
            const result = await service.finish();

            return createWebOnboardingToolResult(result);
          }
          default: {
            throw new Error(`Unsupported web onboarding api: ${api.name}`);
          }
        }
      };
    }

    return proxy;
  },
  identifier: WebOnboardingIdentifier,
};
