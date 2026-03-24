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
        'Define the current question for the active onboarding step. Use this to ask one focused question and attach the best answer surface, such as choices, a form, a select, or a composer prefill.',
      name: WebOnboardingApiName.askUserQuestion,
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
          question: {
            properties: {
              choices: {
                items: {
                  properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                    payload: {
                      properties: {
                        kind: {
                          enum: ['message', 'patch'],
                          type: 'string',
                        },
                        message: { type: 'string' },
                        patch: {
                          additionalProperties: true,
                          type: 'object',
                        },
                        targetNode: {
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
                      required: ['kind'],
                      type: 'object',
                    },
                    style: {
                      enum: ['danger', 'default', 'primary'],
                      type: 'string',
                    },
                  },
                  required: ['id', 'label'],
                  type: 'object',
                },
                type: 'array',
              },
              description: { type: 'string' },
              fields: {
                items: {
                  properties: {
                    key: { type: 'string' },
                    kind: {
                      enum: ['emoji', 'multiselect', 'select', 'text', 'textarea'],
                      type: 'string',
                    },
                    label: { type: 'string' },
                    options: {
                      items: {
                        properties: {
                          label: { type: 'string' },
                          value: { type: 'string' },
                        },
                        required: ['label', 'value'],
                        type: 'object',
                      },
                      type: 'array',
                    },
                    placeholder: { type: 'string' },
                    required: { type: 'boolean' },
                    value: {
                      oneOf: [
                        { type: 'string' },
                        {
                          items: { type: 'string' },
                          type: 'array',
                        },
                      ],
                    },
                  },
                  required: ['key', 'kind', 'label'],
                  type: 'object',
                },
                type: 'array',
              },
              id: { type: 'string' },
              metadata: {
                additionalProperties: true,
                type: 'object',
              },
              mode: {
                enum: ['button_group', 'composer_prefill', 'form', 'info', 'select'],
                type: 'string',
              },
              priority: {
                enum: ['primary', 'secondary'],
                type: 'string',
              },
              prompt: { type: 'string' },
              submitMode: {
                enum: ['message', 'tool'],
                type: 'string',
              },
            },
            required: ['id', 'mode', 'prompt'],
            type: 'object',
          },
        },
        required: ['node', 'question'],
        type: 'object',
      },
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
