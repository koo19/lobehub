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
      renderDisplayControl: 'collapsed',
    },
    {
      description:
        'Propose a structured onboarding patch for the current node. Use this after interpreting the user reply.',
      name: WebOnboardingApiName.proposeOnboardingPatch,
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
              'proSettings',
              'summary',
            ],
            type: 'string',
          },
          patch: {
            properties: {
              agentIdentity: {
                properties: {
                  emoji: { type: 'string' },
                  name: { type: 'string' },
                  nature: { type: 'string' },
                  vibe: { type: 'string' },
                },
                type: 'object',
              },
              defaultModel: {
                properties: {
                  model: { type: 'string' },
                  provider: { type: 'string' },
                },
                type: 'object',
              },
              painPoints: {
                properties: {
                  blockedBy: {
                    items: { type: 'string' },
                    type: 'array',
                  },
                  frustrations: {
                    items: { type: 'string' },
                    type: 'array',
                  },
                  noTimeFor: {
                    items: { type: 'string' },
                    type: 'array',
                  },
                  summary: { type: 'string' },
                },
                type: 'object',
              },
              responseLanguage: { type: 'string' },
              userIdentity: {
                properties: {
                  domainExpertise: { type: 'string' },
                  name: { type: 'string' },
                  professionalRole: { type: 'string' },
                  summary: { type: 'string' },
                },
                type: 'object',
              },
              workContext: {
                properties: {
                  activeProjects: {
                    items: { type: 'string' },
                    type: 'array',
                  },
                  currentFocus: { type: 'string' },
                  interests: {
                    items: { type: 'string' },
                    type: 'array',
                  },
                  summary: { type: 'string' },
                  thisQuarter: { type: 'string' },
                  thisWeek: { type: 'string' },
                  tools: {
                    items: { type: 'string' },
                    type: 'array',
                  },
                },
                type: 'object',
              },
              workStyle: {
                properties: {
                  communicationStyle: { type: 'string' },
                  decisionMaking: { type: 'string' },
                  socialMode: { type: 'string' },
                  summary: { type: 'string' },
                  thinkingPreferences: { type: 'string' },
                  workStyle: { type: 'string' },
                },
                type: 'object',
              },
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
              'agentIdentity',
              'userIdentity',
              'workStyle',
              'workContext',
              'painPoints',
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
