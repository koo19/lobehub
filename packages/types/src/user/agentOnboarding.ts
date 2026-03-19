import { z } from 'zod';

export const AGENT_ONBOARDING_NODES = [
  'telemetry',
  'fullName',
  'interests',
  'responseLanguage',
  'proSettings',
  'summary',
] as const;

export type UserAgentOnboardingNode = (typeof AGENT_ONBOARDING_NODES)[number];

export interface UserAgentOnboardingDraft {
  defaultModel?: {
    model: string;
    provider: string;
  };
  fullName?: string;
  interests?: string[];
  responseLanguage?: string;
  telemetry?: boolean;
}

export interface UserAgentOnboarding {
  activeTopicId?: string;
  completedNodes?: UserAgentOnboardingNode[];
  currentNode?: UserAgentOnboardingNode;
  draft?: UserAgentOnboardingDraft;
  finishedAt?: string;
  version: number;
}

export const UserAgentOnboardingNodeSchema = z.enum(AGENT_ONBOARDING_NODES);

export const UserAgentOnboardingDraftSchema = z.object({
  defaultModel: z
    .object({
      model: z.string(),
      provider: z.string(),
    })
    .optional(),
  fullName: z.string().optional(),
  interests: z.array(z.string()).optional(),
  responseLanguage: z.string().optional(),
  telemetry: z.boolean().optional(),
});

export const UserAgentOnboardingSchema = z.object({
  activeTopicId: z.string().optional(),
  completedNodes: z.array(UserAgentOnboardingNodeSchema).optional(),
  currentNode: UserAgentOnboardingNodeSchema.optional(),
  draft: UserAgentOnboardingDraftSchema.optional(),
  finishedAt: z.string().optional(),
  version: z.number(),
});
