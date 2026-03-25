import { toolSystemPrompt } from '@lobechat/builtin-agent-onboarding';
import type { BuiltinToolManifest } from '@lobechat/types';

import { WebOnboardingApiName, WebOnboardingIdentifier } from './types';

export const WebOnboardingManifest: BuiltinToolManifest = {
  api: [
    {
      description:
        'Read the current onboarding state, including the active step, committed values, saved draft, any currently stored question surface, and lightweight control metadata.',
      name: WebOnboardingApiName.getOnboardingState,
      parameters: {
        properties: {},
        type: 'object',
      },
      renderDisplayControl: 'collapsed',
    },
    {
      description:
        'Save one or more structured answers from the user. patch is node-scoped and may be partial: because node is already provided, send only that node’s fields. Use batch updates when the user clearly answered multiple consecutive onboarding steps in one turn.',
      name: WebOnboardingApiName.saveAnswer,
      parameters: {
        properties: {
          updates: {
            items: {
              properties: {
                node: {
                  enum: [
                    'agentIdentity',
                    'userIdentity',
                    'workStyle',
                    'workContext',
                    'painPoints',
                    'responseLanguage',
                    'summary',
                  ],
                  type: 'string',
                },
                patch: {
                  additionalProperties: true,
                  type: 'object',
                },
              },
              required: ['node', 'patch'],
              type: 'object',
            },
            type: 'array',
          },
        },
        required: ['updates'],
        type: 'object',
      },
    },
    {
      description:
        'Complete the active onboarding step after the user has provided a reliable or confirmed answer.',
      name: WebOnboardingApiName.completeCurrentStep,
      parameters: {
        properties: {
          node: {
            enum: [
              'agentIdentity',
              'userIdentity',
              'workStyle',
              'workContext',
              'painPoints',
              'responseLanguage',
              'summary',
            ],
            type: 'string',
          },
        },
        required: ['node'],
        type: 'object',
      },
    },
    {
      description:
        'Record an off-topic turn and bring the conversation back to the active onboarding question.',
      name: WebOnboardingApiName.returnToOnboarding,
      parameters: {
        properties: {
          reason: { type: 'string' },
        },
        type: 'object',
      },
    },
    {
      description:
        'Finish the onboarding flow from the summary step and mirror the legacy onboarding completion flag.',
      name: WebOnboardingApiName.finishOnboarding,
      parameters: {
        properties: {},
        type: 'object',
      },
    },
  ],
  identifier: WebOnboardingIdentifier,
  meta: {
    avatar: '🧭',
    description: 'Drive the web onboarding flow with a controlled agent runtime',
    title: 'Web Onboarding',
  },
  systemRole: toolSystemPrompt,
  type: 'builtin',
};
