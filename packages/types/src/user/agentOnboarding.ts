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
  patch: UserAgentOnboardingDraft;
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

export interface UserAgentOnboardingInteractionFieldOption {
  label: string;
  value: string;
}

export interface UserAgentOnboardingInteractionField {
  key: string;
  kind: 'emoji' | 'multiselect' | 'select' | 'text' | 'textarea';
  label: string;
  options?: UserAgentOnboardingInteractionFieldOption[];
  placeholder?: string;
  required?: boolean;
  value?: string | string[];
}

export interface UserAgentOnboardingInteractionActionPayload {
  kind: 'message' | 'patch';
  message?: string;
  patch?: UserAgentOnboardingDraft;
  targetNode?: UserAgentOnboardingNode;
}

export interface UserAgentOnboardingInteractionAction {
  id: string;
  label: string;
  payload?: UserAgentOnboardingInteractionActionPayload;
  style?: 'danger' | 'default' | 'primary';
}

export interface UserAgentOnboardingInteractionHintDraft {
  actions?: UserAgentOnboardingInteractionAction[];
  description?: string;
  fields?: UserAgentOnboardingInteractionField[];
  id: string;
  kind: 'button_group' | 'composer_prefill' | 'form' | 'info' | 'select';
  metadata?: Record<string, unknown>;
  priority?: 'primary' | 'secondary';
  submitMode?: 'message' | 'tool';
  title?: string;
}

export interface UserAgentOnboardingInteractionHint {
  actions?: UserAgentOnboardingInteractionAction[];
  description?: string;
  fields?: UserAgentOnboardingInteractionField[];
  id: string;
  kind: 'button_group' | 'composer_prefill' | 'form' | 'info' | 'select';
  metadata?: Record<string, unknown>;
  node: UserAgentOnboardingNode;
  priority?: 'primary' | 'secondary';
  submitMode?: 'message' | 'tool';
  title?: string;
}

export interface UserAgentOnboardingInteractionSurface {
  hints: UserAgentOnboardingInteractionHint[];
  node: UserAgentOnboardingNode;
  updatedAt: string;
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
  draft?: UserAgentOnboardingDraft;
  finishedAt?: string;
  interactionSurface?: UserAgentOnboardingInteractionSurface;
  profile?: UserOnboardingProfile;
  version: number;
}

export const UserAgentOnboardingNodeSchema = z.enum(AGENT_ONBOARDING_NODES);

export const UserAgentOnboardingUpdateSchema = z.object({
  node: UserAgentOnboardingNodeSchema,
  // Keep unknown keys so the service can detect malformed node-scoped payloads
  // and return a structured error instead of silently receiving an empty patch.
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

const UserAgentOnboardingInteractionFieldOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const UserAgentOnboardingInteractionFieldSchema = z.object({
  key: z.string(),
  kind: z.enum(['emoji', 'multiselect', 'select', 'text', 'textarea']),
  label: z.string(),
  options: z.array(UserAgentOnboardingInteractionFieldOptionSchema).optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  value: z.union([z.string(), z.array(z.string())]).optional(),
});

const UserAgentOnboardingInteractionActionPayloadSchema = z.object({
  kind: z.enum(['message', 'patch']),
  message: z.string().optional(),
  patch: z.lazy(() => UserAgentOnboardingDraftSchema).optional(),
  targetNode: UserAgentOnboardingNodeSchema.optional(),
});

const UserAgentOnboardingInteractionActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  payload: UserAgentOnboardingInteractionActionPayloadSchema.optional(),
  style: z.enum(['danger', 'default', 'primary']).optional(),
});

export const UserAgentOnboardingInteractionHintDraftSchema = z.object({
  actions: z.array(UserAgentOnboardingInteractionActionSchema).optional(),
  description: z.string().optional(),
  fields: z.array(UserAgentOnboardingInteractionFieldSchema).optional(),
  id: z.string(),
  kind: z.enum(['button_group', 'composer_prefill', 'form', 'info', 'select']),
  metadata: z.record(z.string(), z.unknown()).optional(),
  priority: z.enum(['primary', 'secondary']).optional(),
  submitMode: z.enum(['message', 'tool']).optional(),
  title: z.string().optional(),
});

const UserAgentOnboardingInteractionHintSchema =
  UserAgentOnboardingInteractionHintDraftSchema.extend({
    node: UserAgentOnboardingNodeSchema,
  });

const UserAgentOnboardingInteractionSurfaceSchema = z.object({
  hints: z.array(UserAgentOnboardingInteractionHintSchema),
  node: UserAgentOnboardingNodeSchema,
  updatedAt: z.string(),
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
  draft: UserAgentOnboardingDraftSchema.optional(),
  finishedAt: z.string().optional(),
  interactionSurface: UserAgentOnboardingInteractionSurfaceSchema.optional(),
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
