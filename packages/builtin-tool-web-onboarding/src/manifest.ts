import type { BuiltinToolManifest } from '@lobechat/types';

import { systemPrompt } from './systemRole';
import { WebOnboardingApiName, WebOnboardingIdentifier } from './types';

export const WebOnboardingManifest: BuiltinToolManifest = {
  api: [
    {
      description:
        'Read the current web onboarding state, including the active node, committed values, and any saved draft.',
      name: WebOnboardingApiName.getOnboardingContext,
      parameters: {
        properties: {},
        type: 'object',
      },
      renderDisplayControl: 'alwaysExpand',
    },
    {
      description:
        'Propose a structured onboarding patch for the current node. Use this after interpreting the user reply.',
      name: WebOnboardingApiName.proposeOnboardingPatch,
      parameters: {
        properties: {
          node: {
            enum: [
              'telemetry',
              'fullName',
              'interests',
              'responseLanguage',
              'proSettings',
              'summary',
            ],
            type: 'string',
          },
          patch: {
            properties: {
              defaultModel: {
                properties: {
                  model: { type: 'string' },
                  provider: { type: 'string' },
                },
                type: 'object',
              },
              fullName: { type: 'string' },
              interests: {
                items: { type: 'string' },
                type: 'array',
              },
              responseLanguage: { type: 'string' },
              telemetry: { type: 'boolean' },
            },
            type: 'object',
          },
        },
        required: ['node', 'patch'],
        type: 'object',
      },
    },
    {
      description:
        'Commit the current onboarding node after the user has provided a reliable or confirmed answer.',
      name: WebOnboardingApiName.commitOnboardingNode,
      parameters: {
        properties: {
          node: {
            enum: [
              'telemetry',
              'fullName',
              'interests',
              'responseLanguage',
              'proSettings',
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
        'Record an off-topic turn and return the flow back to the current onboarding question.',
      name: WebOnboardingApiName.redirectOfftopic,
      parameters: {
        properties: {
          reason: { type: 'string' },
        },
        type: 'object',
      },
    },
    {
      description:
        'Finish the agent onboarding flow from the summary node and mirror the legacy onboarding completion flag.',
      name: WebOnboardingApiName.finishAgentOnboarding,
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
  systemRole: systemPrompt,
  type: 'builtin',
};
