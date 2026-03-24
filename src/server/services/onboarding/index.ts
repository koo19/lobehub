import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { CURRENT_ONBOARDING_VERSION } from '@lobechat/const';
import type {
  UserAgentOnboarding,
  UserAgentOnboardingDraft,
  UserAgentOnboardingInteractionHint,
  UserAgentOnboardingInteractionHintDraft,
  UserAgentOnboardingNode,
  UserAgentOnboardingUpdate,
} from '@lobechat/types';
import { AGENT_ONBOARDING_NODES, MAX_ONBOARDING_STEPS } from '@lobechat/types';
import { merge } from '@lobechat/utils';

import { ONBOARDING_PRODUCTION_DEFAULT_MODEL } from '@/const/onboarding';
import { TopicModel } from '@/database/models/topic';
import { UserModel } from '@/database/models/user';
import type { LobeChatDatabase } from '@/database/type';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { AgentService } from '@/server/services/agent';
import { isDev } from '@/utils/env';

type OnboardingAgentIdentity = NonNullable<UserAgentOnboarding['agentIdentity']>;
type OnboardingPatchInput = Record<string, unknown>;
type OnboardingPainPoints = NonNullable<UserAgentOnboardingDraft['painPoints']>;
type OnboardingUserIdentity = NonNullable<UserAgentOnboardingDraft['userIdentity']>;
type OnboardingWorkContext = NonNullable<UserAgentOnboardingDraft['workContext']>;
type OnboardingWorkStyle = NonNullable<UserAgentOnboardingDraft['workStyle']>;

const defaultAgentOnboardingState = (): UserAgentOnboarding => ({
  completedNodes: [],
  draft: {},
  version: CURRENT_ONBOARDING_VERSION,
});

const isValidNode = (node?: string): node is UserAgentOnboardingNode =>
  !!node && AGENT_ONBOARDING_NODES.includes(node as UserAgentOnboardingNode);

const getNextNode = (node?: UserAgentOnboardingNode) => {
  if (!node) return undefined;

  const currentIndex = AGENT_ONBOARDING_NODES.indexOf(node);
  if (currentIndex === -1) return undefined;

  return AGENT_ONBOARDING_NODES[currentIndex + 1];
};

const getFirstIncompleteNode = (completedNodes: UserAgentOnboardingNode[] = []) => {
  const completedNodeSet = new Set(completedNodes);

  return AGENT_ONBOARDING_NODES.find((node) => !completedNodeSet.has(node));
};

const dedupeNodes = (nodes: UserAgentOnboardingNode[] = []) => Array.from(new Set(nodes));

const sanitizeText = (value?: string) => value?.trim() || undefined;

const sanitizeTextList = (items?: string[], max = 8) =>
  (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);

const getNodeIndex = (node?: UserAgentOnboardingNode) =>
  node ? AGENT_ONBOARDING_NODES.indexOf(node) : -1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined);

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const getNestedPatch = (patch: OnboardingPatchInput, key: keyof UserAgentOnboardingDraft) => {
  const value = patch[key];

  return isRecord(value) ? value : undefined;
};

const getDefaultModelPatch = (patch: OnboardingPatchInput) => {
  const value = patch.defaultModel;

  if (!isRecord(value)) return undefined;

  const model = asString(value.model);
  const provider = asString(value.provider);

  if (!model || !provider) return undefined;

  return { model, provider };
};

const FLAT_PATCH_SHAPE_BY_NODE = {
  agentIdentity: {
    expectedPath: 'patch.agentIdentity',
    keys: ['emoji', 'name', 'nature', 'vibe'],
  },
  painPoints: {
    expectedPath: 'patch.painPoints',
    keys: ['blockedBy', 'frustrations', 'noTimeFor', 'summary'],
  },
  proSettings: {
    expectedPath: 'patch.defaultModel',
    keys: ['model', 'provider'],
  },
  userIdentity: {
    expectedPath: 'patch.userIdentity',
    keys: ['domainExpertise', 'name', 'professionalRole', 'summary'],
  },
  workContext: {
    expectedPath: 'patch.workContext',
    keys: [
      'activeProjects',
      'currentFocus',
      'interests',
      'summary',
      'thisQuarter',
      'thisWeek',
      'tools',
    ],
  },
  workStyle: {
    expectedPath: 'patch.workStyle',
    keys: [
      'communicationStyle',
      'decisionMaking',
      'socialMode',
      'summary',
      'thinkingPreferences',
      'workStyle',
    ],
  },
} as const satisfies Partial<
  Record<UserAgentOnboardingNode, { expectedPath: string; keys: string[] }>
>;

const detectInvalidPatchShape = (node: UserAgentOnboardingNode, patch: OnboardingPatchInput) => {
  const config = FLAT_PATCH_SHAPE_BY_NODE[node as keyof typeof FLAT_PATCH_SHAPE_BY_NODE];

  if (!config) return undefined;
  if (config.expectedPath === `patch.${node}` && patch[node] !== undefined) return undefined;
  if (node === 'proSettings' && patch.defaultModel !== undefined) return undefined;

  const receivedPatchKeys = config.keys.filter((key: string) => patch[key] !== undefined);

  if (receivedPatchKeys.length === 0) return undefined;

  return {
    expectedPatchPath: config.expectedPath,
    receivedPatch: Object.fromEntries(
      receivedPatchKeys.map((key: string) => [key, patch[key]]),
    ) as Record<string, unknown>,
    receivedPatchKeys,
  };
};

const normalizeAgentIdentity = (value?: unknown): OnboardingAgentIdentity | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const emoji = sanitizeText(asString(patch?.emoji));
  const name = sanitizeText(asString(patch?.name));
  const nature = sanitizeText(asString(patch?.nature));
  const vibe = sanitizeText(asString(patch?.vibe));

  if (!emoji || !name || !nature || !vibe) return undefined;

  return { emoji, name, nature, vibe };
};

const normalizeUserIdentity = (value?: unknown): OnboardingUserIdentity | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const summary = sanitizeText(asString(patch?.summary));

  if (!summary) return undefined;

  return {
    ...(sanitizeText(asString(patch?.domainExpertise))
      ? { domainExpertise: sanitizeText(asString(patch?.domainExpertise)) }
      : {}),
    ...(sanitizeText(asString(patch?.name)) ? { name: sanitizeText(asString(patch?.name)) } : {}),
    ...(sanitizeText(asString(patch?.professionalRole))
      ? { professionalRole: sanitizeText(asString(patch?.professionalRole)) }
      : {}),
    summary,
  };
};

const normalizeWorkStyle = (value?: unknown): OnboardingWorkStyle | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const summary = sanitizeText(asString(patch?.summary));

  if (!summary) return undefined;

  return {
    ...(sanitizeText(asString(patch?.communicationStyle))
      ? { communicationStyle: sanitizeText(asString(patch?.communicationStyle)) }
      : {}),
    ...(sanitizeText(asString(patch?.decisionMaking))
      ? { decisionMaking: sanitizeText(asString(patch?.decisionMaking)) }
      : {}),
    ...(sanitizeText(asString(patch?.socialMode))
      ? { socialMode: sanitizeText(asString(patch?.socialMode)) }
      : {}),
    summary,
    ...(sanitizeText(asString(patch?.thinkingPreferences))
      ? { thinkingPreferences: sanitizeText(asString(patch?.thinkingPreferences)) }
      : {}),
    ...(sanitizeText(asString(patch?.workStyle))
      ? { workStyle: sanitizeText(asString(patch?.workStyle)) }
      : {}),
  };
};

const normalizeWorkContext = (value?: unknown): OnboardingWorkContext | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const summary = sanitizeText(asString(patch?.summary));

  if (!summary) return undefined;

  const activeProjects = sanitizeTextList(asStringArray(patch?.activeProjects));
  const interests = sanitizeTextList(asStringArray(patch?.interests));
  const tools = sanitizeTextList(asStringArray(patch?.tools));

  return {
    ...(activeProjects.length > 0 ? { activeProjects } : {}),
    ...(sanitizeText(asString(patch?.currentFocus))
      ? { currentFocus: sanitizeText(asString(patch?.currentFocus)) }
      : {}),
    ...(interests.length > 0 ? { interests } : {}),
    summary,
    ...(sanitizeText(asString(patch?.thisQuarter))
      ? { thisQuarter: sanitizeText(asString(patch?.thisQuarter)) }
      : {}),
    ...(sanitizeText(asString(patch?.thisWeek))
      ? { thisWeek: sanitizeText(asString(patch?.thisWeek)) }
      : {}),
    ...(tools.length > 0 ? { tools } : {}),
  };
};

const normalizePainPoints = (value?: unknown): OnboardingPainPoints | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const summary = sanitizeText(asString(patch?.summary));

  if (!summary) return undefined;

  const blockedBy = sanitizeTextList(asStringArray(patch?.blockedBy));
  const frustrations = sanitizeTextList(asStringArray(patch?.frustrations));
  const noTimeFor = sanitizeTextList(asStringArray(patch?.noTimeFor));

  return {
    ...(blockedBy.length > 0 ? { blockedBy } : {}),
    ...(frustrations.length > 0 ? { frustrations } : {}),
    ...(noTimeFor.length > 0 ? { noTimeFor } : {}),
    summary,
  };
};

const extractDraftForNode = (
  node: UserAgentOnboardingNode,
  patch: OnboardingPatchInput,
): Partial<UserAgentOnboardingDraft> | undefined => {
  switch (node) {
    case 'agentIdentity': {
      const agentIdentity = normalizeAgentIdentity(getNestedPatch(patch, 'agentIdentity'));
      return agentIdentity ? { agentIdentity } : undefined;
    }
    case 'userIdentity': {
      const userIdentity = normalizeUserIdentity(getNestedPatch(patch, 'userIdentity'));
      return userIdentity ? { userIdentity } : undefined;
    }
    case 'workStyle': {
      const workStyle = normalizeWorkStyle(getNestedPatch(patch, 'workStyle'));
      return workStyle ? { workStyle } : undefined;
    }
    case 'workContext': {
      const workContext = normalizeWorkContext(getNestedPatch(patch, 'workContext'));
      return workContext ? { workContext } : undefined;
    }
    case 'painPoints': {
      const painPoints = normalizePainPoints(getNestedPatch(patch, 'painPoints'));
      return painPoints ? { painPoints } : undefined;
    }
    case 'responseLanguage': {
      const responseLanguage = sanitizeText(asString(patch.responseLanguage));
      return responseLanguage ? { responseLanguage } : undefined;
    }
    case 'proSettings': {
      const defaultModel = getDefaultModelPatch(patch);
      return defaultModel ? { defaultModel } : undefined;
    }
    case 'summary': {
      return undefined;
    }
  }
};

const getNodeRecoveryInstruction = (node: UserAgentOnboardingNode) => {
  switch (node) {
    case 'agentIdentity': {
      return 'Stay on agentIdentity. Do not call userIdentity yet. Ask the user to define your name, nature, vibe, and emoji, or offer concrete defaults and confirm one.';
    }
    case 'userIdentity': {
      return 'Stay on userIdentity. Ask who the user is, what they do, and what domain they work in. Capture a concise summary plus any available name, role, or domain expertise.';
    }
    case 'workStyle': {
      return 'Stay on workStyle. Ask how the user thinks, decides, communicates, and works with others. Capture a concise summary of their style.';
    }
    case 'workContext': {
      return 'Stay on workContext. Ask about current focus, active projects, interests, tools, and near-term priorities. Capture a concise summary plus any concrete details.';
    }
    case 'painPoints': {
      return 'Stay on painPoints. Ask what is blocked, frustrating, repetitive, or never gets enough time. Capture the actual friction, not generic preferences.';
    }
    case 'responseLanguage': {
      return 'Stay on responseLanguage. Ask which language the user wants as the default reply language.';
    }
    case 'proSettings': {
      return 'Stay on proSettings. Capture a default model/provider only if the user gives one or says they are ready to continue.';
    }
    case 'summary': {
      return 'Stay on summary. Summarize the committed setup and ask for final confirmation before calling finishAgentOnboarding.';
    }
  }
};

interface InteractionHintCommittedState {
  agentIdentity?: UserAgentOnboarding['agentIdentity'];
  defaultModel?: {
    model?: string;
    provider?: string;
  };
  profile?: UserAgentOnboarding['profile'];
  responseLanguage?: string;
}

interface BuildInteractionHintsParams {
  committed: InteractionHintCommittedState;
  completedNodes: UserAgentOnboardingNode[];
  draft: UserAgentOnboardingDraft;
  finishedAt?: string;
}

const WEAK_INTERACTION_KINDS = new Set<UserAgentOnboardingInteractionHint['kind']>([
  'composer_prefill',
  'info',
]);

const getActiveNode = (state: Pick<UserAgentOnboarding, 'completedNodes' | 'finishedAt'>) => {
  if (state.finishedAt) return undefined;

  return getFirstIncompleteNode(state.completedNodes ?? []);
};

const buildInteractionHints = ({
  committed,
  completedNodes,
  draft,
  finishedAt,
}: BuildInteractionHintsParams): UserAgentOnboardingInteractionHint[] => {
  if (finishedAt) return [];

  const interactionNode = getFirstIncompleteNode(completedNodes);

  switch (interactionNode) {
    case 'agentIdentity': {
      return [
        {
          description: 'Use this shape if you want a structured identity instead of free text.',
          fields: [
            {
              key: 'name',
              kind: 'text',
              label: 'Name',
              placeholder: 'e.g. Xiao Qi',
              required: true,
              value: draft.agentIdentity?.name ?? '',
            },
            {
              key: 'nature',
              kind: 'text',
              label: 'Nature',
              placeholder: 'What kind of being am I?',
              required: true,
              value: draft.agentIdentity?.nature ?? '',
            },
            {
              key: 'vibe',
              kind: 'text',
              label: 'Vibe',
              placeholder: 'warm, sharp, playful...',
              required: true,
              value: draft.agentIdentity?.vibe ?? '',
            },
            {
              key: 'emoji',
              kind: 'emoji',
              label: 'Emoji',
              required: true,
              value: draft.agentIdentity?.emoji ?? '',
            },
          ],
          id: 'agent-identity-form',
          kind: 'form',
          node: 'agentIdentity',
          priority: 'primary',
          submitMode: 'tool',
          title: 'Shape my identity',
        },
        {
          actions: [
            {
              id: 'identity-preset-sparrow',
              label: 'Warm + curious',
              payload: {
                kind: 'message',
                message:
                  'You feel like Xiao Qi to me: a warm, curious AI with a sparrow-like energy. Emoji: 🐦',
              },
              style: 'default',
            },
            {
              id: 'identity-preset-fox',
              label: 'Sharp + playful',
              payload: {
                kind: 'message',
                message:
                  'You feel like Xiao Qi to me: a sharp, playful AI sidekick with a fox-like vibe. Emoji: 🦊',
              },
              style: 'default',
            },
          ],
          description: 'Fallback presets when the user does not want to invent one from scratch.',
          id: 'agent-identity-presets',
          kind: 'button_group',
          node: 'agentIdentity',
          priority: 'secondary',
          submitMode: 'message',
          title: 'Quick presets',
        },
      ];
    }
    case 'userIdentity':
    case 'workStyle':
    case 'workContext':
    case 'painPoints': {
      return [
        {
          description: 'Use this to steer the next reply or render a richer form later.',
          id: `${interactionNode}-prefill`,
          kind: 'composer_prefill',
          metadata: {
            committed,
            draft,
          },
          node: interactionNode,
          priority: 'primary',
          submitMode: 'message',
          title: `Next turn helper for ${interactionNode}`,
        },
      ];
    }
    case 'responseLanguage': {
      return [
        {
          description:
            'Client can render its own locale picker and submit the result as a tool update.',
          fields: [
            {
              key: 'responseLanguage',
              kind: 'select',
              label: 'Response language',
              placeholder: 'Choose a default reply language',
              value: draft.responseLanguage ?? '',
            },
          ],
          id: 'response-language-select',
          kind: 'select',
          metadata: {
            optionsSource: 'clientLocaleOptions',
          },
          node: 'responseLanguage',
          priority: 'primary',
          submitMode: 'tool',
          title: 'Choose reply language',
        },
      ];
    }
    case 'proSettings': {
      return [
        {
          description: 'Client can swap this to a model picker or other advanced setup surface.',
          id: 'pro-settings-surface',
          kind: 'info',
          metadata: {
            currentDefaultModel: draft.defaultModel ?? committed.defaultModel,
            recommendedSurface: 'modelPicker',
          },
          node: 'proSettings',
          priority: 'primary',
          submitMode: 'tool',
          title: 'Advanced setup surface',
        },
      ];
    }
    case 'summary': {
      return [
        {
          actions: [
            {
              id: 'summary-finish',
              label: 'Finish onboarding',
              payload: {
                kind: 'message',
                message: 'Looks good. Finish onboarding.',
              },
              style: 'primary',
            },
          ],
          description: 'Primary completion action once the summary lands.',
          id: 'summary-actions',
          kind: 'button_group',
          node: 'summary',
          priority: 'primary',
          submitMode: 'message',
          title: 'Complete setup',
        },
      ];
    }
    default: {
      return [];
    }
  }
};

const attachNodeToInteractionHints = (
  node: UserAgentOnboardingNode,
  hints: UserAgentOnboardingInteractionHintDraft[],
): UserAgentOnboardingInteractionHint[] => hints.map((hint) => ({ ...hint, node }));

const resolveInteractionHints = ({
  committed,
  draft,
  state,
}: {
  committed: InteractionHintCommittedState;
  draft: UserAgentOnboardingDraft;
  state: UserAgentOnboarding;
}) => {
  const activeNode = getActiveNode(state);

  if (state.finishedAt || !activeNode) return [];

  const interactionSurface = state.interactionSurface;

  if (interactionSurface?.node === activeNode && interactionSurface.hints.length > 0) {
    return interactionSurface.hints;
  }

  return buildInteractionHints({
    committed,
    completedNodes: state.completedNodes ?? [],
    draft,
    finishedAt: state.finishedAt,
  });
};

const getInteractionPolicy = ({
  activeNode,
  interactionHints,
  state,
}: {
  activeNode?: UserAgentOnboardingNode;
  interactionHints: UserAgentOnboardingInteractionHint[];
  state: UserAgentOnboarding;
}) => {
  if (!activeNode || state.finishedAt) {
    return {
      needsRefresh: false,
      reason: undefined,
    };
  }

  const hasCustomSurface =
    state.interactionSurface?.node === activeNode && state.interactionSurface.hints.length > 0;

  if (hasCustomSurface) {
    return {
      needsRefresh: false,
      reason: undefined,
    };
  }

  const hasStrongHint = interactionHints.some((hint) => !WEAK_INTERACTION_KINDS.has(hint.kind));

  if (hasStrongHint) {
    return {
      needsRefresh: false,
      reason: undefined,
    };
  }

  return {
    needsRefresh: true,
    reason: `Current node "${activeNode}" only has weak fallback interaction hints. Generate a better interaction surface before your next visible reply.`,
  };
};

interface ProposePatchResult {
  activeNode?: UserAgentOnboardingNode;
  committedValue?: unknown;
  content: string;
  draft: UserAgentOnboardingDraft;
  error?: {
    code: 'INCOMPLETE_NODE_DATA' | 'INVALID_PATCH_SHAPE' | 'NODE_MISMATCH' | 'ONBOARDING_COMPLETE';
    expectedPatchPath?: string;
    message: string;
    receivedPatch?: Record<string, unknown>;
    receivedPatchKeys?: string[];
  };
  instruction?: string;
  interactionHints?: UserAgentOnboardingInteractionHint[];
  mismatch?: boolean;
  nextAction: 'ask' | 'commit' | 'confirm';
  processedNodes?: UserAgentOnboardingNode[];
  requestedNode?: UserAgentOnboardingNode;
  savedDraftFields?: (keyof UserAgentOnboardingDraft)[];
  success: boolean;
}

interface ProposeInteractionsResult {
  activeNode?: UserAgentOnboardingNode;
  content: string;
  instruction?: string;
  interactionHints: UserAgentOnboardingInteractionHint[];
  mismatch?: boolean;
  requestedNode?: UserAgentOnboardingNode;
  storedHintIds?: string[];
  success: boolean;
}

export class OnboardingService {
  private readonly agentService: AgentService;
  private readonly topicModel: TopicModel;
  private readonly userId: string;
  private readonly userModel: UserModel;

  constructor(
    private readonly db: LobeChatDatabase,
    userId: string,
  ) {
    this.userId = userId;
    this.agentService = new AgentService(db, userId);
    this.topicModel = new TopicModel(db, userId);
    this.userModel = new UserModel(db, userId);
  }

  private ensureState = (state?: UserAgentOnboarding): UserAgentOnboarding => {
    if (
      !state ||
      (state.completedNodes ?? []).some((node) => !isValidNode(node)) ||
      (state.version ?? 0) < CURRENT_ONBOARDING_VERSION
    ) {
      return defaultAgentOnboardingState();
    }

    const mergedState = merge(defaultAgentOnboardingState(), state ?? {}) as UserAgentOnboarding & {
      currentNode?: UserAgentOnboardingNode;
    };
    const { currentNode: legacyCurrentNode, ...nextState } = mergedState;
    void legacyCurrentNode;

    return {
      ...nextState,
      completedNodes: dedupeNodes((nextState.completedNodes ?? []).filter(isValidNode)),
      draft: nextState.draft ?? {},
      interactionSurface:
        nextState.interactionSurface?.node &&
        getActiveNode(nextState) === nextState.interactionSurface.node
          ? nextState.interactionSurface
          : undefined,
      profile: nextState.profile ?? {},
      version: nextState.version ?? CURRENT_ONBOARDING_VERSION,
    };
  };

  private saveState = async (state: UserAgentOnboarding) => {
    const normalizedState = this.ensureState(state);

    await this.userModel.updateUser({ agentOnboarding: normalizedState });

    return normalizedState;
  };

  private getUserState = async () => {
    return this.userModel.getUserState(KeyVaultsGateKeeper.getUserKeyVaults);
  };

  private ensureTopic = async (state: UserAgentOnboarding, agentId: string) => {
    const existingTopicId = state.activeTopicId;

    if (existingTopicId) {
      const topic = await this.topicModel.findById(existingTopicId);

      if (topic) return existingTopicId;
    }

    const topic = await this.topicModel.create({
      agentId,
      title: 'Onboarding',
      trigger: 'chat',
    });

    return topic.id;
  };

  getOrCreateContext = async () => {
    const builtinAgent = await this.agentService.getBuiltinAgent(BUILTIN_AGENT_SLUGS.webOnboarding);

    if (!builtinAgent?.id) {
      throw new Error('Failed to initialize onboarding agent');
    }

    const userState = await this.getUserState();
    const state = this.ensureState(userState.agentOnboarding);
    const topicId = await this.ensureTopic(state, builtinAgent.id);
    const nextState =
      topicId === state.activeTopicId
        ? state
        : await this.saveState({ ...state, activeTopicId: topicId });

    return {
      agentId: builtinAgent.id,
      agentOnboarding: nextState,
      context: await this.getContext(),
      topicId,
    };
  };

  getContext = async () => {
    const userState = await this.getUserState();
    const state = this.ensureState(userState.agentOnboarding);
    const committed = {
      agentIdentity: state.agentIdentity,
      defaultModel: userState.settings.defaultAgent?.config
        ? {
            model: userState.settings.defaultAgent.config.model,
            provider: userState.settings.defaultAgent.config.provider,
          }
        : undefined,
      profile: {
        ...state.profile,
        ...(userState.fullName && !state.profile?.identity?.name
          ? {
              identity: {
                ...state.profile?.identity,
                name: userState.fullName,
                summary: state.profile?.identity?.summary ?? userState.fullName,
              },
            }
          : {}),
        ...(userState.interests?.length && !(state.profile?.workContext?.interests?.length ?? 0)
          ? {
              interests: userState.interests,
            }
          : {}),
      },
      responseLanguage: userState.settings.general?.responseLanguage,
    };
    const activeNode = getActiveNode(state);
    const draft = state.draft ?? {};
    const interactionHints = resolveInteractionHints({
      committed,
      draft,
      state,
    });

    return {
      activeNode,
      committed,
      completedNodes: state.completedNodes ?? [],
      draft,
      finishedAt: state.finishedAt,
      interactionHints,
      interactionPolicy: getInteractionPolicy({
        activeNode,
        interactionHints,
        state,
      }),
      topicId: state.activeTopicId,
      version: state.version,
    };
  };

  proposeInteractions = async (params: {
    hints: UserAgentOnboardingInteractionHintDraft[];
    node: UserAgentOnboardingNode;
  }): Promise<ProposeInteractionsResult> => {
    const context = await this.getContext();
    const activeNode = context.activeNode;

    if (!activeNode) {
      return {
        content: 'Onboarding is already complete.',
        interactionHints: context.interactionHints,
        success: false,
      };
    }

    if (params.node !== activeNode) {
      const instruction = getNodeRecoveryInstruction(activeNode);

      return {
        activeNode,
        content: `Node mismatch: active onboarding step is "${activeNode}", but you called "${params.node}". ${instruction}`,
        instruction,
        interactionHints: context.interactionHints,
        mismatch: true,
        requestedNode: params.node,
        success: false,
      };
    }

    const persistedState = await this.ensurePersistedState();
    const interactionHints = attachNodeToInteractionHints(params.node, params.hints);

    await this.saveState({
      ...persistedState,
      interactionSurface:
        interactionHints.length > 0
          ? {
              hints: interactionHints,
              node: params.node,
              updatedAt: new Date().toISOString(),
            }
          : undefined,
    });

    const nextContext = await this.getContext();

    return {
      activeNode: nextContext.activeNode,
      content:
        interactionHints.length > 0
          ? `Saved ${interactionHints.length} interaction hint(s) for "${params.node}". Use them as the current UI surface while you continue the conversation.`
          : `Cleared custom interaction hints for "${params.node}". The fallback interaction surface is active again.`,
      interactionHints: nextContext.interactionHints,
      storedHintIds: interactionHints.map((hint) => hint.id),
      success: true,
    };
  };

  proposePatch = async (params: {
    updates: Array<Pick<UserAgentOnboardingUpdate, 'node'> & { patch: OnboardingPatchInput }>;
  }): Promise<ProposePatchResult> => {
    const updates = [...params.updates].sort((left, right) => {
      return getNodeIndex(left.node) - getNodeIndex(right.node);
    });

    let latestResult: ProposePatchResult | undefined;
    const processedNodes: UserAgentOnboardingNode[] = [];
    const contentParts: string[] = [];

    for (const update of updates) {
      const result = await this.proposeSinglePatch(update);

      latestResult = result;
      contentParts.push(result.content);

      if (result.success) {
        processedNodes.push(update.node);
        continue;
      }

      if (result.mismatch) continue;

      const nextContext = await this.getContext();

      return {
        ...result,
        content: contentParts.join('\n'),
        activeNode: nextContext.activeNode,
        draft: nextContext.draft,
        interactionHints: nextContext.interactionHints,
        processedNodes,
      };
    }

    const nextContext = await this.getContext();

    return {
      ...(latestResult ?? {
        content: 'No onboarding updates were provided.',
        draft: nextContext.draft,
        nextAction: 'ask' as const,
        success: false,
      }),
      content: contentParts.join('\n'),
      activeNode: nextContext.activeNode,
      draft: nextContext.draft,
      interactionHints: nextContext.interactionHints,
      processedNodes,
    };
  };

  private proposeSinglePatch = async (
    params: Pick<UserAgentOnboardingUpdate, 'node'> & { patch: OnboardingPatchInput },
  ): Promise<ProposePatchResult> => {
    const context = await this.getContext();
    const activeNode = context.activeNode;

    if (!activeNode) {
      return {
        content: 'Onboarding is already complete.',
        draft: context.draft,
        error: {
          code: 'ONBOARDING_COMPLETE',
          message: 'Onboarding is already complete.',
        },
        nextAction: 'ask',
        success: false,
      };
    }

    if (params.node !== activeNode) {
      const activeNodeIndex = getNodeIndex(activeNode);
      const requestedNodeIndex = getNodeIndex(params.node);
      const recoverableDraft =
        requestedNodeIndex > activeNodeIndex
          ? extractDraftForNode(params.node, params.patch)
          : undefined;

      if (recoverableDraft) {
        const draft = { ...context.draft, ...recoverableDraft };
        const instruction = getNodeRecoveryInstruction(activeNode);

        await this.saveState({ ...(await this.ensurePersistedState()), draft });

        return {
          activeNode,
          content: `Node mismatch: active onboarding step is "${activeNode}", but you called "${params.node}". I saved the later-step draft for "${params.node}", but do not advance yet. ${instruction}`,
          draft,
          error: {
            code: 'NODE_MISMATCH',
            message: `Node mismatch: active onboarding step is "${activeNode}", but you called "${params.node}".`,
          },
          instruction,
          mismatch: true,
          nextAction: 'ask',
          requestedNode: params.node,
          savedDraftFields: Object.keys(recoverableDraft) as (keyof UserAgentOnboardingDraft)[],
          success: false,
        };
      }

      const instruction = getNodeRecoveryInstruction(activeNode);

      return {
        activeNode,
        content: `Node mismatch: active onboarding step is "${activeNode}", but you called "${params.node}". ${instruction}`,
        draft: context.draft,
        error: {
          code: 'NODE_MISMATCH',
          message: `Node mismatch: active onboarding step is "${activeNode}", but you called "${params.node}".`,
        },
        instruction,
        mismatch: true,
        nextAction: 'ask',
        requestedNode: params.node,
        success: false,
      };
    }

    const patch = params.patch;
    const invalidPatchShape = detectInvalidPatchShape(activeNode, patch);

    switch (activeNode) {
      case 'agentIdentity': {
        const agentIdentity = normalizeAgentIdentity(getNestedPatch(patch, 'agentIdentity'));

        if (!agentIdentity) {
          const content = invalidPatchShape
            ? `Invalid patch shape for "${activeNode}". Put these fields under ${invalidPatchShape.expectedPatchPath} instead of sending them at the top level of patch.`
            : 'Agent identity is incomplete. Capture a name, nature, vibe, and emoji before moving on.';

          return {
            content,
            draft: context.draft,
            error: invalidPatchShape
              ? {
                  code: 'INVALID_PATCH_SHAPE',
                  expectedPatchPath: invalidPatchShape.expectedPatchPath,
                  message: content,
                  receivedPatch: invalidPatchShape.receivedPatch,
                  receivedPatchKeys: invalidPatchShape.receivedPatchKeys,
                }
              : {
                  code: 'INCOMPLETE_NODE_DATA',
                  message: content,
                },
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, agentIdentity };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(activeNode);

        return {
          committedValue: agentIdentity,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'userIdentity': {
        const userIdentity = normalizeUserIdentity(getNestedPatch(patch, 'userIdentity'));

        if (!userIdentity) {
          const content = invalidPatchShape
            ? `Invalid patch shape for "${activeNode}". Put these fields under ${invalidPatchShape.expectedPatchPath} instead of sending them at the top level of patch.`
            : 'User identity is still too thin. Capture at least a concise summary plus any available name, role, or domain expertise.';

          return {
            content,
            draft: context.draft,
            error: invalidPatchShape
              ? {
                  code: 'INVALID_PATCH_SHAPE',
                  expectedPatchPath: invalidPatchShape.expectedPatchPath,
                  message: content,
                  receivedPatch: invalidPatchShape.receivedPatch,
                  receivedPatchKeys: invalidPatchShape.receivedPatchKeys,
                }
              : {
                  code: 'INCOMPLETE_NODE_DATA',
                  message: content,
                },
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, userIdentity };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(activeNode);

        return {
          committedValue: userIdentity,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'workStyle': {
        const workStyle = normalizeWorkStyle(getNestedPatch(patch, 'workStyle'));

        if (!workStyle) {
          const content = invalidPatchShape
            ? `Invalid patch shape for "${activeNode}". Put these fields under ${invalidPatchShape.expectedPatchPath} instead of sending them at the top level of patch.`
            : 'Work style is still unclear. Capture a concise summary of how the user thinks, decides, and likes to communicate.';

          return {
            content,
            draft: context.draft,
            error: invalidPatchShape
              ? {
                  code: 'INVALID_PATCH_SHAPE',
                  expectedPatchPath: invalidPatchShape.expectedPatchPath,
                  message: content,
                  receivedPatch: invalidPatchShape.receivedPatch,
                  receivedPatchKeys: invalidPatchShape.receivedPatchKeys,
                }
              : {
                  code: 'INCOMPLETE_NODE_DATA',
                  message: content,
                },
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, workStyle };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(activeNode);

        return {
          committedValue: workStyle,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'workContext': {
        const workContext = normalizeWorkContext(getNestedPatch(patch, 'workContext'));

        if (!workContext) {
          const content = invalidPatchShape
            ? `Invalid patch shape for "${activeNode}". Put these fields under ${invalidPatchShape.expectedPatchPath} instead of sending them at the top level of patch.`
            : 'Current work context is missing. Capture a concise summary plus the user’s current focus, projects, interests, or tools.';

          return {
            content,
            draft: context.draft,
            error: invalidPatchShape
              ? {
                  code: 'INVALID_PATCH_SHAPE',
                  expectedPatchPath: invalidPatchShape.expectedPatchPath,
                  message: content,
                  receivedPatch: invalidPatchShape.receivedPatch,
                  receivedPatchKeys: invalidPatchShape.receivedPatchKeys,
                }
              : {
                  code: 'INCOMPLETE_NODE_DATA',
                  message: content,
                },
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, workContext };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(activeNode);

        return {
          committedValue: workContext,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'painPoints': {
        const painPoints = normalizePainPoints(getNestedPatch(patch, 'painPoints'));

        if (!painPoints) {
          const content = invalidPatchShape
            ? `Invalid patch shape for "${activeNode}". Put these fields under ${invalidPatchShape.expectedPatchPath} instead of sending them at the top level of patch.`
            : 'Pain points are still missing. Capture a concise summary of what frustrates the user or keeps getting blocked.';

          return {
            content,
            draft: context.draft,
            error: invalidPatchShape
              ? {
                  code: 'INVALID_PATCH_SHAPE',
                  expectedPatchPath: invalidPatchShape.expectedPatchPath,
                  message: content,
                  receivedPatch: invalidPatchShape.receivedPatch,
                  receivedPatchKeys: invalidPatchShape.receivedPatchKeys,
                }
              : {
                  code: 'INCOMPLETE_NODE_DATA',
                  message: content,
                },
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, painPoints };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(activeNode);

        return {
          committedValue: painPoints,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'responseLanguage': {
        const responseLanguage = sanitizeText(asString(patch.responseLanguage));

        if (responseLanguage === undefined) {
          const content =
            'Response language is missing. Ask the user to choose a default language.';

          return {
            content,
            draft: context.draft,
            error: {
              code: 'INCOMPLETE_NODE_DATA',
              message: content,
            },
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, responseLanguage };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(activeNode);

        return {
          committedValue: responseLanguage,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'proSettings': {
        const defaultModel =
          getDefaultModelPatch(patch) || (!isDev ? ONBOARDING_PRODUCTION_DEFAULT_MODEL : undefined);
        const draft = {
          ...context.draft,
          ...(defaultModel ? { defaultModel } : {}),
        };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(activeNode);

        return {
          committedValue: defaultModel,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'summary': {
        const content = 'Summary is handled after all previous onboarding nodes are complete.';

        return {
          content,
          draft: context.draft,
          error: {
            code: 'INCOMPLETE_NODE_DATA',
            message: content,
          },
          nextAction: 'ask',
          success: false,
        };
      }
    }
  };

  private ensurePersistedState = async () => {
    const userState = await this.getUserState();

    return this.ensureState(userState.agentOnboarding);
  };

  commitNode = async (node: UserAgentOnboardingNode) => {
    const state = await this.ensurePersistedState();
    const activeNode = getActiveNode(state);

    if (!activeNode) {
      return {
        content: 'Onboarding is already complete.',
        success: false,
      };
    }

    if (node !== activeNode) {
      return {
        content: `Active onboarding step is "${activeNode}", not "${node}".`,
        nextNode: activeNode,
        success: false,
      };
    }

    const draft = state.draft ?? {};

    switch (activeNode) {
      case 'agentIdentity': {
        if (!draft.agentIdentity) {
          return {
            content: 'Agent identity has not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        state.agentIdentity = draft.agentIdentity;
        break;
      }
      case 'userIdentity': {
        if (!draft.userIdentity) {
          return {
            content: 'User identity has not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        state.profile = {
          ...state.profile,
          identity: draft.userIdentity,
        };

        if (draft.userIdentity.name) {
          await this.userModel.updateUser({ fullName: draft.userIdentity.name });
        }

        break;
      }
      case 'workStyle': {
        if (!draft.workStyle) {
          return {
            content: 'Work style has not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        state.profile = {
          ...state.profile,
          workStyle: draft.workStyle,
        };
        break;
      }
      case 'workContext': {
        if (!draft.workContext) {
          return {
            content: 'Work context has not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        state.profile = {
          ...state.profile,
          currentFocus:
            draft.workContext.currentFocus ||
            draft.workContext.thisWeek ||
            draft.workContext.thisQuarter ||
            draft.workContext.summary,
          interests: draft.workContext.interests,
          workContext: draft.workContext,
        };

        if (draft.workContext.interests?.length) {
          await this.userModel.updateUser({ interests: draft.workContext.interests });
        }

        break;
      }
      case 'painPoints': {
        if (!draft.painPoints) {
          return {
            content: 'Pain points have not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        state.profile = {
          ...state.profile,
          painPoints: draft.painPoints,
        };
        break;
      }
      case 'responseLanguage': {
        if (draft.responseLanguage === undefined) {
          return {
            content: 'Response language has not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        const currentSettings = await this.userModel.getUserSettings();
        await this.userModel.updateSetting({
          general: merge(currentSettings?.general || {}, {
            responseLanguage: draft.responseLanguage,
          }),
        });
        break;
      }
      case 'proSettings': {
        if (draft.defaultModel?.model && draft.defaultModel.provider) {
          const currentSettings = await this.userModel.getUserSettings();
          await this.userModel.updateSetting({
            defaultAgent: merge(currentSettings?.defaultAgent || {}, {
              config: {
                model: draft.defaultModel.model,
                provider: draft.defaultModel.provider,
              },
            }),
          });
        }
        break;
      }
      case 'summary': {
        return {
          content: 'Use finishAgentOnboarding from the summary step.',
          nextNode: activeNode,
          success: false,
        };
      }
    }

    const nextNode = getNextNode(activeNode);
    const completedNodes = dedupeNodes([...(state.completedNodes ?? []), activeNode]);
    const nextDraft = { ...draft };

    if (activeNode === 'agentIdentity') delete nextDraft.agentIdentity;
    if (activeNode === 'userIdentity') delete nextDraft.userIdentity;
    if (activeNode === 'workStyle') delete nextDraft.workStyle;
    if (activeNode === 'workContext') delete nextDraft.workContext;
    if (activeNode === 'painPoints') delete nextDraft.painPoints;
    if (activeNode === 'responseLanguage') delete nextDraft.responseLanguage;
    if (activeNode === 'proSettings') delete nextDraft.defaultModel;

    await this.saveState({
      ...state,
      completedNodes,
      draft: nextDraft,
    });

    return {
      content: nextNode
        ? `Committed step "${activeNode}". Continue with "${nextNode}".`
        : `Committed step "${activeNode}".`,
      nextNode: nextNode ?? activeNode,
      success: true,
    };
  };

  redirectOfftopic = async (reason?: string) => {
    const state = await this.ensurePersistedState();

    return {
      content: reason
        ? `Stay on onboarding. Off-topic reason: ${reason}`
        : 'Stay on onboarding and continue with the current question.',
      activeNode: getActiveNode(state),
      success: true,
    };
  };

  finish = async () => {
    const state = await this.ensurePersistedState();
    const activeNode = getActiveNode(state);

    if (activeNode !== 'summary') {
      return {
        content: `Active onboarding step is "${activeNode ?? 'completed'}". Finish is only allowed in "summary".`,
        success: false,
      };
    }

    const finishedAt = new Date().toISOString();

    await this.userModel.updateUser({
      agentOnboarding: {
        ...state,
        completedNodes: dedupeNodes([...(state.completedNodes ?? []), 'summary']),
        draft: {},
        finishedAt,
        version: CURRENT_ONBOARDING_VERSION,
      },
      onboarding: {
        currentStep: MAX_ONBOARDING_STEPS,
        finishedAt,
        version: CURRENT_ONBOARDING_VERSION,
      },
    });

    return {
      content: 'Agent onboarding completed successfully.',
      finishedAt,
      success: true,
    };
  };

  reset = async () => {
    const state = defaultAgentOnboardingState();

    await this.userModel.updateUser({ agentOnboarding: state });

    return state;
  };
}
