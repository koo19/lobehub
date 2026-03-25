import type { BuiltinToolManifest } from '@lobechat/types';

import { systemPrompt } from './systemRole';
import { UserInteractionApiName, UserInteractionIdentifier } from './types';

export const UserInteractionManifest: BuiltinToolManifest = {
  api: [
    {
      description:
        'Present a question to the user with either structured form fields or freeform input. Returns the interaction request in pending state.',
      name: UserInteractionApiName.askUserQuestion,
      parameters: {
        properties: {
          question: {
            properties: {
              description: { type: 'string' },
              fields: {
                items: {
                  properties: {
                    key: { type: 'string' },
                    kind: {
                      enum: ['multiselect', 'select', 'text', 'textarea'],
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
                      oneOf: [{ type: 'string' }, { items: { type: 'string' }, type: 'array' }],
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
                enum: ['form', 'freeform'],
                type: 'string',
              },
              prompt: { type: 'string' },
            },
            required: ['id', 'mode', 'prompt'],
            type: 'object',
          },
        },
        required: ['question'],
        type: 'object',
      },
    },
    {
      description: "Record the user's submitted response for a pending interaction request.",
      name: UserInteractionApiName.submitUserResponse,
      parameters: {
        properties: {
          requestId: {
            description: 'The interaction request ID to submit a response for.',
            type: 'string',
          },
          response: {
            additionalProperties: true,
            description: "The user's response data.",
            type: 'object',
          },
        },
        required: ['requestId', 'response'],
        type: 'object',
      },
    },
    {
      description: 'Mark a pending interaction request as skipped with an optional reason.',
      name: UserInteractionApiName.skipUserResponse,
      parameters: {
        properties: {
          reason: {
            description: 'Optional reason for skipping.',
            type: 'string',
          },
          requestId: {
            description: 'The interaction request ID to skip.',
            type: 'string',
          },
        },
        required: ['requestId'],
        type: 'object',
      },
    },
    {
      description: 'Cancel a pending interaction request.',
      name: UserInteractionApiName.cancelUserResponse,
      parameters: {
        properties: {
          requestId: {
            description: 'The interaction request ID to cancel.',
            type: 'string',
          },
        },
        required: ['requestId'],
        type: 'object',
      },
    },
    {
      description: 'Get the current state of an interaction request.',
      name: UserInteractionApiName.getInteractionState,
      parameters: {
        properties: {
          requestId: {
            description: 'The interaction request ID to query.',
            type: 'string',
          },
        },
        required: ['requestId'],
        type: 'object',
      },
      renderDisplayControl: 'collapsed',
    },
  ],
  identifier: UserInteractionIdentifier,
  meta: {
    avatar: '💬',
    description:
      'Ask users questions and collect structured responses with submit/skip/cancel semantics',
    title: 'User Interaction',
  },
  systemRole: systemPrompt,
  type: 'builtin',
};
