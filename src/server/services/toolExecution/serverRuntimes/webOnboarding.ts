import {
  WebOnboardingIdentifier,
  WebOnboardingManifest,
} from '@lobechat/builtin-tool-web-onboarding';

import { UserPersonaModel } from '@/database/models/userMemory/persona';
import { AgentDocumentsService } from '@/server/services/agentDocuments';
import { OnboardingService } from '@/server/services/onboarding';
import { createWebOnboardingToolResult } from '@/utils/webOnboardingToolResult';

import type { ServerRuntimeRegistration } from './types';

export const webOnboardingRuntime: ServerRuntimeRegistration = {
  factory: (context) => {
    if (!context.serverDB || !context.userId) {
      throw new Error('serverDB and userId are required for web onboarding tool execution');
    }

    const service = new OnboardingService(context.serverDB, context.userId);
    const docService = new AgentDocumentsService(context.serverDB, context.userId);
    const personaModel = new UserPersonaModel(context.serverDB, context.userId);
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
          case 'readDocument': {
            const docType = args.type as 'soul' | 'persona';

            if (docType === 'soul') {
              const inboxAgentId = await service.getInboxAgentId();
              const doc = await docService.getDocumentByFilename(inboxAgentId, 'SOUL.md');

              if (!doc) return { content: 'SOUL.md not found.', success: false };

              return {
                content: doc.content || '',
                state: { content: doc.content, id: doc.id, type: 'soul' },
                success: true,
              };
            }

            const persona = await personaModel.getLatestPersonaDocument();

            return {
              content: persona?.persona || '',
              state: { content: persona?.persona, id: persona?.id, type: 'persona' },
              success: true,
            };
          }
          case 'updateDocument': {
            const updateType = args.type as 'soul' | 'persona';
            const content = args.content as string;

            if (updateType === 'soul') {
              const inboxAgentId = await service.getInboxAgentId();
              const doc = await docService.upsertDocumentByFilename({
                agentId: inboxAgentId,
                content,
                filename: 'SOUL.md',
              });

              if (!doc) return { content: 'Failed to update SOUL.md.', success: false };

              return {
                content: `Updated SOUL.md (${doc.id}).`,
                state: { id: doc.id, type: 'soul' },
                success: true,
              };
            }

            const result = await personaModel.upsertPersona({
              editedBy: 'agent_tool',
              persona: content,
              profile: 'default',
            });

            return {
              content: `Updated user persona (${result.document.id}).`,
              state: { id: result.document.id, type: 'persona' },
              success: true,
            };
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
