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

export interface UserAgentOnboardingUpdate {
  node: UserAgentOnboardingNode;
  patch: Record<string, unknown>;
}

export interface UserOnboardingDefaultModel {
  model: string;
  provider: string;
}

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

export interface UserAgentOnboardingQuestionFieldOption {
  label: string;
  value: string;
}

export interface UserAgentOnboardingQuestionField {
  key: string;
  kind: 'emoji' | 'multiselect' | 'select' | 'text' | 'textarea';
  label: string;
  options?: UserAgentOnboardingQuestionFieldOption[];
  placeholder?: string;
  required?: boolean;
  value?: string | string[];
}

export interface UserAgentOnboardingQuestionChoicePayload {
  kind: 'message' | 'patch';
  message?: string;
  patch?: Record<string, unknown>;
  targetNode?: UserAgentOnboardingNode;
}

export interface UserAgentOnboardingQuestionChoice {
  id: string;
  label: string;
  payload?: UserAgentOnboardingQuestionChoicePayload;
  style?: 'danger' | 'default' | 'primary';
}

export interface UserAgentOnboardingQuestionDraft {
  choices?: UserAgentOnboardingQuestionChoice[];
  description?: string;
  fields?: UserAgentOnboardingQuestionField[];
  id: string;
  metadata?: Record<string, unknown>;
  mode: 'button_group' | 'composer_prefill' | 'form' | 'info' | 'select';
  priority?: 'primary' | 'secondary';
  prompt: string;
  submitMode?: 'message' | 'tool';
}

export interface UserAgentOnboardingQuestion extends UserAgentOnboardingQuestionDraft {
  node: UserAgentOnboardingNode;
}

export interface UserAgentOnboardingQuestionSurface {
  node: UserAgentOnboardingNode;
  question: UserAgentOnboardingQuestion;
  updatedAt: string;
}

export interface UserAgentOnboardingDraft {
  agentIdentity?: Partial<UserOnboardingAgentIdentity>;
  defaultModel?: Partial<UserOnboardingDefaultModel>;
  painPoints?: Partial<UserOnboardingDimensionPainPoints>;
  responseLanguage?: string;
  userIdentity?: Partial<UserOnboardingDimensionIdentity>;
  workContext?: Partial<UserOnboardingDimensionWorkContext>;
  workStyle?: Partial<UserOnboardingDimensionWorkStyle>;
}

export interface UserAgentOnboarding {
  activeTopicId?: string;
  agentIdentity?: UserOnboardingAgentIdentity;
  completedNodes?: UserAgentOnboardingNode[];
  draft?: UserAgentOnboardingDraft;
  finishedAt?: string;
  profile?: UserOnboardingProfile;
  questionSurface?: UserAgentOnboardingQuestionSurface;
  version: number;
}

export const UserAgentOnboardingNodeSchema = z.enum(AGENT_ONBOARDING_NODES);

export const UserAgentOnboardingUpdateSchema = z.object({
  node: UserAgentOnboardingNodeSchema,
  patch: z.object({}).passthrough(),
});

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

const UserAgentOnboardingQuestionFieldOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const UserAgentOnboardingQuestionFieldSchema = z.object({
  key: z.string(),
  kind: z.enum(['emoji', 'multiselect', 'select', 'text', 'textarea']),
  label: z.string(),
  options: z.array(UserAgentOnboardingQuestionFieldOptionSchema).optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  value: z.union([z.string(), z.array(z.string())]).optional(),
});

const UserAgentOnboardingQuestionChoicePayloadSchema = z.object({
  kind: z.enum(['message', 'patch']),
  message: z.string().optional(),
  patch: z.record(z.string(), z.unknown()).optional(),
  targetNode: UserAgentOnboardingNodeSchema.optional(),
});

const UserAgentOnboardingQuestionChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  payload: UserAgentOnboardingQuestionChoicePayloadSchema.optional(),
  style: z.enum(['danger', 'default', 'primary']).optional(),
});

export const UserAgentOnboardingQuestionDraftSchema = z.object({
  choices: z.array(UserAgentOnboardingQuestionChoiceSchema).optional(),
  description: z.string().optional(),
  fields: z.array(UserAgentOnboardingQuestionFieldSchema).optional(),
  id: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  mode: z.enum(['button_group', 'composer_prefill', 'form', 'info', 'select']),
  priority: z.enum(['primary', 'secondary']).optional(),
  prompt: z.string(),
  submitMode: z.enum(['message', 'tool']).optional(),
});

const UserAgentOnboardingQuestionSchema = UserAgentOnboardingQuestionDraftSchema.extend({
  node: UserAgentOnboardingNodeSchema,
});

export const UserAgentOnboardingDraftSchema = z.object({
  agentIdentity: UserOnboardingAgentIdentitySchema.partial().optional(),
  defaultModel: z
    .object({
      model: z.string(),
      provider: z.string(),
    })
    .partial()
    .optional(),
  painPoints: UserOnboardingDimensionPainPointsSchema.partial().optional(),
  responseLanguage: z.string().optional(),
  userIdentity: UserOnboardingDimensionIdentitySchema.partial().optional(),
  workContext: UserOnboardingDimensionWorkContextSchema.partial().optional(),
  workStyle: UserOnboardingDimensionWorkStyleSchema.partial().optional(),
});

const UserAgentOnboardingQuestionSurfaceSchema = z.object({
  node: UserAgentOnboardingNodeSchema,
  question: UserAgentOnboardingQuestionSchema,
  updatedAt: z.string(),
});

export const UserAgentOnboardingSchema = z.object({
  activeTopicId: z.string().optional(),
  agentIdentity: UserOnboardingAgentIdentitySchema.optional(),
  completedNodes: z.array(UserAgentOnboardingNodeSchema).optional(),
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
  questionSurface: UserAgentOnboardingQuestionSurfaceSchema.optional(),
  version: z.number(),
});
