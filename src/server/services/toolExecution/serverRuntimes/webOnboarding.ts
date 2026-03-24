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
          case 'getOnboardingState': {
            const result = await service.getState();

            return { content: JSON.stringify(result, null, 2), state: result, success: true };
          }
          case 'saveAnswer': {
            const result = await service.saveAnswer(args as any);

            return createWebOnboardingToolResult(result);
          }
          case 'askUserQuestion': {
            const result = await service.askQuestion(args as any);

            return createWebOnboardingToolResult(result);
          }
          case 'completeCurrentStep': {
            const result = await service.completeCurrentStep(args.node as any);

            return createWebOnboardingToolResult(result);
          }
          case 'returnToOnboarding': {
            const result = await service.returnToOnboarding(args.reason as string | undefined);

            return createWebOnboardingToolResult(result);
          }
          case 'finishOnboarding': {
            const result = await service.finishOnboarding();

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
