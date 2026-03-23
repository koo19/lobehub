import { z } from 'zod';

export const AGENT_ONBOARDING_NODES = [
  'agentIdentity',
  'userIdentity',
  'workStyle',
  'workContext',
  'painPoints',
  'responseLanguage',
  'proSettings',
  'summary',
] as const;

export type UserAgentOnboardingNode = (typeof AGENT_ONBOARDING_NODES)[number];

export interface UserOnboardingAgentIdentity {
  emoji: string;
  name: string;
  nature: string;
  vibe: string;
}

export interface UserOnboardingDimensionIdentity {
  domainExpertise?: string;
  name?: string;
  professionalRole?: string;
  summary: string;
}

export interface UserOnboardingDimensionWorkStyle {
  communicationStyle?: string;
  decisionMaking?: string;
  socialMode?: string;
  summary: string;
  thinkingPreferences?: string;
  workStyle?: string;
}

export interface UserOnboardingDimensionWorkContext {
  activeProjects?: string[];
  currentFocus?: string;
  interests?: string[];
  summary: string;
  thisQuarter?: string;
  thisWeek?: string;
  tools?: string[];
}

export interface UserOnboardingDimensionPainPoints {
  blockedBy?: string[];
  frustrations?: string[];
  noTimeFor?: string[];
  summary: string;
}

export interface UserOnboardingProfile {
  currentFocus?: string;
  identity?: UserOnboardingDimensionIdentity;
  interests?: string[];
  painPoints?: UserOnboardingDimensionPainPoints;
  workContext?: UserOnboardingDimensionWorkContext;
  workStyle?: UserOnboardingDimensionWorkStyle;
}

export interface UserAgentOnboardingDraft {
  agentIdentity?: UserOnboardingAgentIdentity;
  defaultModel?: {
    model: string;
    provider: string;
  };
  painPoints?: UserOnboardingDimensionPainPoints;
  responseLanguage?: string;
  userIdentity?: UserOnboardingDimensionIdentity;
  workContext?: UserOnboardingDimensionWorkContext;
  workStyle?: UserOnboardingDimensionWorkStyle;
}

export interface UserAgentOnboarding {
  activeTopicId?: string;
  agentIdentity?: UserOnboardingAgentIdentity;
  completedNodes?: UserAgentOnboardingNode[];
  currentNode?: UserAgentOnboardingNode;
  draft?: UserAgentOnboardingDraft;
  finishedAt?: string;
  profile?: UserOnboardingProfile;
  version: number;
}

export const UserAgentOnboardingNodeSchema = z.enum(AGENT_ONBOARDING_NODES);

const UserOnboardingAgentIdentitySchema = z.object({
  emoji: z.string(),
  name: z.string(),
  nature: z.string(),
  vibe: z.string(),
});

const UserOnboardingDimensionIdentitySchema = z.object({
  domainExpertise: z.string().optional(),
  name: z.string().optional(),
  professionalRole: z.string().optional(),
  summary: z.string(),
});

const UserOnboardingDimensionWorkStyleSchema = z.object({
  communicationStyle: z.string().optional(),
  decisionMaking: z.string().optional(),
  socialMode: z.string().optional(),
  summary: z.string(),
  thinkingPreferences: z.string().optional(),
  workStyle: z.string().optional(),
});

const UserOnboardingDimensionWorkContextSchema = z.object({
  activeProjects: z.array(z.string()).optional(),
  currentFocus: z.string().optional(),
  interests: z.array(z.string()).optional(),
  summary: z.string(),
  thisQuarter: z.string().optional(),
  thisWeek: z.string().optional(),
  tools: z.array(z.string()).optional(),
});

const UserOnboardingDimensionPainPointsSchema = z.object({
  blockedBy: z.array(z.string()).optional(),
  frustrations: z.array(z.string()).optional(),
  noTimeFor: z.array(z.string()).optional(),
  summary: z.string(),
});

export const UserAgentOnboardingDraftSchema = z.object({
  agentIdentity: UserOnboardingAgentIdentitySchema.optional(),
  defaultModel: z
    .object({
      model: z.string(),
      provider: z.string(),
    })
    .optional(),
  painPoints: UserOnboardingDimensionPainPointsSchema.optional(),
  responseLanguage: z.string().optional(),
  userIdentity: UserOnboardingDimensionIdentitySchema.optional(),
  workContext: UserOnboardingDimensionWorkContextSchema.optional(),
  workStyle: UserOnboardingDimensionWorkStyleSchema.optional(),
});

export const UserAgentOnboardingSchema = z.object({
  activeTopicId: z.string().optional(),
  agentIdentity: UserOnboardingAgentIdentitySchema.optional(),
  completedNodes: z.array(UserAgentOnboardingNodeSchema).optional(),
  currentNode: UserAgentOnboardingNodeSchema.optional(),
  draft: UserAgentOnboardingDraftSchema.optional(),
  finishedAt: z.string().optional(),
  profile: z
    .object({
      currentFocus: z.string().optional(),
      identity: UserOnboardingDimensionIdentitySchema.optional(),
      interests: z.array(z.string()).optional(),
      painPoints: UserOnboardingDimensionPainPointsSchema.optional(),
      workContext: UserOnboardingDimensionWorkContextSchema.optional(),
      workStyle: UserOnboardingDimensionWorkStyleSchema.optional(),
    })
    .optional(),
  version: z.number(),
});
