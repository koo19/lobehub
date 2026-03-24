import type { BuiltinToolManifest } from '@lobechat/types';

import { systemPrompt } from './systemRole';
import { WebOnboardingApiName, WebOnboardingIdentifier } from './types';

export const WebOnboardingManifest: BuiltinToolManifest = {
  api: [
    {
      description:
        'Read the current web onboarding state, including the active step, committed values, saved draft, and interaction hints for the next UI surface.',
      name: WebOnboardingApiName.getOnboardingContext,
      parameters: {
        properties: {},
        type: 'object',
      },
      renderDisplayControl: 'collapsed',
    },
    {
      description:
        'Propose interaction hints for the current onboarding step. Use this to generate button groups, forms, selects, info cards, or composer prefills that help the user respond faster.',
      name: WebOnboardingApiName.proposeOnboardingInteractions,
      parameters: {
        properties: {
          hints: {
            items: {
              properties: {
                actions: {
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
                          targetNode: {
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
                kind: {
                  enum: ['button_group', 'composer_prefill', 'form', 'info', 'select'],
                  type: 'string',
                },
                metadata: {
                  additionalProperties: true,
                  type: 'object',
                },
                priority: {
                  enum: ['primary', 'secondary'],
                  type: 'string',
                },
                submitMode: {
                  enum: ['message', 'tool'],
                  type: 'string',
                },
                title: { type: 'string' },
              },
              required: ['id', 'kind'],
              type: 'object',
            },
            type: 'array',
          },
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
        required: ['node', 'hints'],
        type: 'object',
      },
    },
    {
      description:
        'Propose one or more structured onboarding updates. Use batch updates when the user provided information for multiple nodes in the same turn.',
      name: WebOnboardingApiName.proposeOnboardingPatch,
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
            type: 'array',
          },
        },
        required: ['updates'],
        type: 'object',
      },
    },
    {
      description:
        'Commit the active onboarding step after the user has provided a reliable or confirmed answer.',
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
        'Record an off-topic turn and return the flow back to the active onboarding question.',
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
