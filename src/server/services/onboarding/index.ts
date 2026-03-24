import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { CURRENT_ONBOARDING_VERSION } from '@lobechat/const';
import type {
  UserAgentOnboarding,
  UserAgentOnboardingDraft,
  UserAgentOnboardingNode,
  UserAgentOnboardingQuestion,
  UserAgentOnboardingQuestionDraft,
  UserAgentOnboardingUpdate,
  UserOnboardingDefaultModel,
} from '@lobechat/types';
import { AGENT_ONBOARDING_NODES, MAX_ONBOARDING_STEPS } from '@lobechat/types';
import { merge } from '@lobechat/utils';

import { TopicModel } from '@/database/models/topic';
import { UserModel } from '@/database/models/user';
import type { LobeChatDatabase } from '@/database/type';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { AgentService } from '@/server/services/agent';

type OnboardingAgentIdentity = NonNullable<UserAgentOnboarding['agentIdentity']>;
type OnboardingDefaultModel = UserOnboardingDefaultModel;
type OnboardingPatchInput = Record<string, unknown>;
type OnboardingDraftAgentIdentity = NonNullable<UserAgentOnboardingDraft['agentIdentity']>;
type OnboardingDraftPainPoints = NonNullable<UserAgentOnboardingDraft['painPoints']>;
type OnboardingDraftUserIdentity = NonNullable<UserAgentOnboardingDraft['userIdentity']>;
type OnboardingDraftWorkContext = NonNullable<UserAgentOnboardingDraft['workContext']>;
type OnboardingDraftWorkStyle = NonNullable<UserAgentOnboardingDraft['workStyle']>;
type OnboardingPainPoints = NonNullable<NonNullable<UserAgentOnboarding['profile']>['painPoints']>;
type OnboardingUserIdentity = NonNullable<NonNullable<UserAgentOnboarding['profile']>['identity']>;
type OnboardingWorkContext = NonNullable<
  NonNullable<UserAgentOnboarding['profile']>['workContext']
>;
type OnboardingWorkStyle = NonNullable<NonNullable<UserAgentOnboarding['profile']>['workStyle']>;

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

const NODE_FIELDS = {
  agentIdentity: ['emoji', 'name', 'nature', 'vibe'],
  painPoints: ['blockedBy', 'frustrations', 'noTimeFor', 'summary'],
  proSettings: ['model', 'provider'],
  userIdentity: ['domainExpertise', 'name', 'professionalRole', 'summary'],
  workContext: [
    'activeProjects',
    'currentFocus',
    'interests',
    'summary',
    'thisQuarter',
    'thisWeek',
    'tools',
  ],
  workStyle: [
    'communicationStyle',
    'decisionMaking',
    'socialMode',
    'summary',
    'thinkingPreferences',
    'workStyle',
  ],
} as const satisfies Partial<Record<UserAgentOnboardingNode, readonly string[]>>;

const REQUIRED_FIELDS_BY_NODE = {
  agentIdentity: ['emoji', 'name', 'nature', 'vibe'],
  painPoints: ['summary'],
  proSettings: ['model', 'provider'],
  responseLanguage: ['responseLanguage'],
  userIdentity: ['summary'],
  workContext: ['summary'],
  workStyle: ['summary'],
} as const satisfies Partial<Record<UserAgentOnboardingNode, readonly string[]>>;

interface OnboardingNodeDraftState {
  missingFields?: string[];
  status: 'complete' | 'empty' | 'partial';
}

const getScopedPatch = (node: UserAgentOnboardingNode, patch: OnboardingPatchInput) => {
  const nestedKey = node === 'proSettings' ? 'defaultModel' : node;
  const nestedPatch = isRecord(patch[nestedKey]) ? patch[nestedKey] : undefined;
  const scopedKeys = NODE_FIELDS[node as keyof typeof NODE_FIELDS] ?? [];
  const scopedPatch: OnboardingPatchInput = {};

  for (const key of scopedKeys) {
    const value = patch[key] ?? nestedPatch?.[key];

    if (value !== undefined) scopedPatch[key] = value;
  }

  return scopedPatch;
};

const getMissingFields = (node: UserAgentOnboardingNode, patch: OnboardingPatchInput) => {
  const requiredFields =
    REQUIRED_FIELDS_BY_NODE[node as keyof typeof REQUIRED_FIELDS_BY_NODE] ?? [];

  return requiredFields.filter((key) => {
    const value = patch[key];

    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return !value.trim();

    return value === undefined;
  });
};

const normalizeAgentIdentityDraft = (value?: unknown): OnboardingDraftAgentIdentity | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const emoji = sanitizeText(asString(patch?.emoji));
  const name = sanitizeText(asString(patch?.name));
  const nature = sanitizeText(asString(patch?.nature));
  const vibe = sanitizeText(asString(patch?.vibe));
  const nextDraft = {
    ...(emoji ? { emoji } : {}),
    ...(name ? { name } : {}),
    ...(nature ? { nature } : {}),
    ...(vibe ? { vibe } : {}),
  };

  return Object.keys(nextDraft).length > 0 ? nextDraft : undefined;
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

const normalizeUserIdentityDraft = (value?: unknown): OnboardingDraftUserIdentity | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const summary = sanitizeText(asString(patch?.summary));
  const nextDraft = {
    ...(sanitizeText(asString(patch?.domainExpertise))
      ? { domainExpertise: sanitizeText(asString(patch?.domainExpertise)) }
      : {}),
    ...(sanitizeText(asString(patch?.name)) ? { name: sanitizeText(asString(patch?.name)) } : {}),
    ...(sanitizeText(asString(patch?.professionalRole))
      ? { professionalRole: sanitizeText(asString(patch?.professionalRole)) }
      : {}),
    ...(summary ? { summary } : {}),
  };

  return Object.keys(nextDraft).length > 0 ? nextDraft : undefined;
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

const normalizeWorkStyleDraft = (value?: unknown): OnboardingDraftWorkStyle | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const summary = sanitizeText(asString(patch?.summary));
  const nextDraft = {
    ...(sanitizeText(asString(patch?.communicationStyle))
      ? { communicationStyle: sanitizeText(asString(patch?.communicationStyle)) }
      : {}),
    ...(sanitizeText(asString(patch?.decisionMaking))
      ? { decisionMaking: sanitizeText(asString(patch?.decisionMaking)) }
      : {}),
    ...(sanitizeText(asString(patch?.socialMode))
      ? { socialMode: sanitizeText(asString(patch?.socialMode)) }
      : {}),
    ...(summary ? { summary } : {}),
    ...(sanitizeText(asString(patch?.thinkingPreferences))
      ? { thinkingPreferences: sanitizeText(asString(patch?.thinkingPreferences)) }
      : {}),
    ...(sanitizeText(asString(patch?.workStyle))
      ? { workStyle: sanitizeText(asString(patch?.workStyle)) }
      : {}),
  };

  return Object.keys(nextDraft).length > 0 ? nextDraft : undefined;
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

const normalizeWorkContextDraft = (value?: unknown): OnboardingDraftWorkContext | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const summary = sanitizeText(asString(patch?.summary));
  const activeProjects = sanitizeTextList(asStringArray(patch?.activeProjects));
  const interests = sanitizeTextList(asStringArray(patch?.interests));
  const tools = sanitizeTextList(asStringArray(patch?.tools));
  const nextDraft = {
    ...(activeProjects.length > 0 ? { activeProjects } : {}),
    ...(sanitizeText(asString(patch?.currentFocus))
      ? { currentFocus: sanitizeText(asString(patch?.currentFocus)) }
      : {}),
    ...(interests.length > 0 ? { interests } : {}),
    ...(summary ? { summary } : {}),
    ...(sanitizeText(asString(patch?.thisQuarter))
      ? { thisQuarter: sanitizeText(asString(patch?.thisQuarter)) }
      : {}),
    ...(sanitizeText(asString(patch?.thisWeek))
      ? { thisWeek: sanitizeText(asString(patch?.thisWeek)) }
      : {}),
    ...(tools.length > 0 ? { tools } : {}),
  };

  return Object.keys(nextDraft).length > 0 ? nextDraft : undefined;
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

const normalizePainPointsDraft = (value?: unknown): OnboardingDraftPainPoints | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const summary = sanitizeText(asString(patch?.summary));
  const blockedBy = sanitizeTextList(asStringArray(patch?.blockedBy));
  const frustrations = sanitizeTextList(asStringArray(patch?.frustrations));
  const noTimeFor = sanitizeTextList(asStringArray(patch?.noTimeFor));
  const nextDraft = {
    ...(blockedBy.length > 0 ? { blockedBy } : {}),
    ...(frustrations.length > 0 ? { frustrations } : {}),
    ...(noTimeFor.length > 0 ? { noTimeFor } : {}),
    ...(summary ? { summary } : {}),
  };

  return Object.keys(nextDraft).length > 0 ? nextDraft : undefined;
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

const normalizeDefaultModelDraft = (
  value?: unknown,
): Partial<OnboardingDefaultModel> | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const model = sanitizeText(asString(patch?.model));
  const provider = sanitizeText(asString(patch?.provider));
  const nextDraft = {
    ...(model ? { model } : {}),
    ...(provider ? { provider } : {}),
  };

  return Object.keys(nextDraft).length > 0 ? nextDraft : undefined;
};

const normalizeDefaultModel = (value?: unknown): OnboardingDefaultModel | undefined => {
  const patch = isRecord(value) ? value : undefined;
  const model = sanitizeText(asString(patch?.model));
  const provider = sanitizeText(asString(patch?.provider));

  if (!model || !provider) return undefined;

  return { model, provider };
};

const mergeDraftForNode = (
  draft: UserAgentOnboardingDraft,
  node: UserAgentOnboardingNode,
  patch: unknown,
) => {
  const patchRecord = isRecord(patch) ? patch : {};

  switch (node) {
    case 'agentIdentity': {
      return { ...draft, agentIdentity: { ...draft.agentIdentity, ...patchRecord } };
    }
    case 'userIdentity': {
      return { ...draft, userIdentity: { ...draft.userIdentity, ...patchRecord } };
    }
    case 'workStyle': {
      return { ...draft, workStyle: { ...draft.workStyle, ...patchRecord } };
    }
    case 'workContext': {
      return { ...draft, workContext: { ...draft.workContext, ...patchRecord } };
    }
    case 'painPoints': {
      return { ...draft, painPoints: { ...draft.painPoints, ...patchRecord } };
    }
    case 'responseLanguage': {
      return { ...draft, responseLanguage: patch as string };
    }
    case 'proSettings': {
      return { ...draft, defaultModel: { ...draft.defaultModel, ...patchRecord } };
    }
    case 'summary': {
      return draft;
    }
  }
};

const getDraftValueForNode = (draft: UserAgentOnboardingDraft, node: UserAgentOnboardingNode) => {
  switch (node) {
    case 'agentIdentity': {
      return draft.agentIdentity;
    }
    case 'userIdentity': {
      return draft.userIdentity;
    }
    case 'workStyle': {
      return draft.workStyle;
    }
    case 'workContext': {
      return draft.workContext;
    }
    case 'painPoints': {
      return draft.painPoints;
    }
    case 'responseLanguage': {
      return draft.responseLanguage;
    }
    case 'proSettings': {
      return draft.defaultModel;
    }
    case 'summary': {
      return undefined;
    }
  }
};

const extractDraftForNode = (
  node: UserAgentOnboardingNode,
  patch: OnboardingPatchInput,
): Partial<UserAgentOnboardingDraft> | undefined => {
  const scopedPatch = getScopedPatch(node, patch);

  switch (node) {
    case 'agentIdentity': {
      const agentIdentity = normalizeAgentIdentityDraft(scopedPatch);
      return agentIdentity ? { agentIdentity } : undefined;
    }
    case 'userIdentity': {
      const userIdentity = normalizeUserIdentityDraft(scopedPatch);
      return userIdentity ? { userIdentity } : undefined;
    }
    case 'workStyle': {
      const workStyle = normalizeWorkStyleDraft(scopedPatch);
      return workStyle ? { workStyle } : undefined;
    }
    case 'workContext': {
      const workContext = normalizeWorkContextDraft(scopedPatch);
      return workContext ? { workContext } : undefined;
    }
    case 'painPoints': {
      const painPoints = normalizePainPointsDraft(scopedPatch);
      return painPoints ? { painPoints } : undefined;
    }
    case 'responseLanguage': {
      const responseLanguage = sanitizeText(asString(patch.responseLanguage));
      return responseLanguage ? { responseLanguage } : undefined;
    }
    case 'proSettings': {
      const defaultModel = normalizeDefaultModelDraft(scopedPatch);
      return defaultModel ? { defaultModel } : undefined;
    }
    case 'summary': {
      return undefined;
    }
  }
};

const getNodeDraftState = (
  node: UserAgentOnboardingNode | undefined,
  draft: UserAgentOnboardingDraft,
): OnboardingNodeDraftState | undefined => {
  if (!node || node === 'summary') return undefined;

  const currentDraft =
    node === 'proSettings'
      ? draft.defaultModel
      : node === 'responseLanguage'
        ? draft.responseLanguage
        : draft[node];

  if (typeof currentDraft === 'string') {
    return currentDraft
      ? { status: 'complete' }
      : { missingFields: ['responseLanguage'], status: 'empty' };
  }

  if (!currentDraft || Object.keys(currentDraft).length === 0) {
    return {
      missingFields: [
        ...(REQUIRED_FIELDS_BY_NODE[node as keyof typeof REQUIRED_FIELDS_BY_NODE] ?? []),
      ],
      status: 'empty',
    };
  }

  const missingFields = getMissingFields(node, currentDraft as OnboardingPatchInput);

  return {
    ...(missingFields.length > 0 ? { missingFields } : {}),
    status: missingFields.length === 0 ? 'complete' : 'partial',
  };
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
      return 'Stay on summary. Summarize the committed setup and ask for final confirmation before calling finishOnboarding.';
    }
  }
};

const getActiveNode = (state: Pick<UserAgentOnboarding, 'completedNodes' | 'finishedAt'>) => {
  if (state.finishedAt) return undefined;

  return getFirstIncompleteNode(state.completedNodes ?? []);
};

const attachNodeToQuestion = (
  node: UserAgentOnboardingNode,
  question: UserAgentOnboardingQuestionDraft,
): UserAgentOnboardingQuestion => ({ ...question, node });

interface ProposePatchResult {
  activeNode?: UserAgentOnboardingNode;
  activeNodeDraftState?: OnboardingNodeDraftState;
  committedValue?: unknown;
  content: string;
  currentQuestion?: UserAgentOnboardingQuestion;
  draft: UserAgentOnboardingDraft;
  error?: {
    code: 'INCOMPLETE_NODE_DATA' | 'INVALID_PATCH_SHAPE' | 'NODE_MISMATCH' | 'ONBOARDING_COMPLETE';
    message: string;
  };
  instruction?: string;
  mismatch?: boolean;
  nextAction: 'ask' | 'commit' | 'confirm';
  processedNodes?: UserAgentOnboardingNode[];
  requestedNode?: UserAgentOnboardingNode;
  savedDraftFields?: (keyof UserAgentOnboardingDraft)[];
  success: boolean;
}

interface AskQuestionResult {
  activeNode?: UserAgentOnboardingNode;
  content: string;
  currentQuestion?: UserAgentOnboardingQuestion;
  instruction?: string;
  mismatch?: boolean;
  requestedNode?: UserAgentOnboardingNode;
  storedQuestionId?: string;
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
      questionSurface:
        nextState.questionSurface?.node &&
        getActiveNode(nextState) === nextState.questionSurface.node
          ? nextState.questionSurface
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

  getOrCreateState = async () => {
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
      context: await this.getState(),
      topicId,
    };
  };

  getState = async () => {
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
    const questionSurface = state.questionSurface;
    const currentQuestion =
      questionSurface && questionSurface.node === activeNode ? questionSurface.question : undefined;

    return {
      activeNode,
      activeNodeDraftState: getNodeDraftState(activeNode, draft),
      committed,
      completedNodes: state.completedNodes ?? [],
      draft,
      finishedAt: state.finishedAt,
      currentQuestion,
      topicId: state.activeTopicId,
      version: state.version,
    };
  };

  askQuestion = async (params: {
    node: UserAgentOnboardingNode;
    question: UserAgentOnboardingQuestionDraft;
  }): Promise<AskQuestionResult> => {
    const context = await this.getState();
    const activeNode = context.activeNode;

    if (!activeNode) {
      return {
        content: 'Onboarding is already complete.',
        currentQuestion: context.currentQuestion,
        success: false,
      };
    }

    if (params.node !== activeNode) {
      const instruction = getNodeRecoveryInstruction(activeNode);

      return {
        activeNode,
        content: `Node mismatch: active onboarding step is "${activeNode}", but you called "${params.node}". ${instruction}`,
        currentQuestion: context.currentQuestion,
        instruction,
        mismatch: true,
        requestedNode: params.node,
        success: false,
      };
    }

    const persistedState = await this.ensurePersistedState();
    const currentQuestion = attachNodeToQuestion(params.node, params.question);

    await this.saveState({
      ...persistedState,
      questionSurface: {
        node: params.node,
        question: currentQuestion,
        updatedAt: new Date().toISOString(),
      },
    });

    const nextContext = await this.getState();

    return {
      activeNode: nextContext.activeNode,
      content: `Saved the current question for "${params.node}". Use it as the active question before replying to the user.`,
      currentQuestion: nextContext.currentQuestion,
      storedQuestionId: currentQuestion.id,
      success: true,
    };
  };

  saveAnswer = async (params: {
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

        if (result.activeNodeDraftState?.status === 'partial') {
          const nextContext = await this.getState();

          return {
            ...result,
            content: contentParts.join('\n'),
            activeNode: nextContext.activeNode,
            activeNodeDraftState: nextContext.activeNodeDraftState,
            currentQuestion: nextContext.currentQuestion,
            draft: nextContext.draft,
            processedNodes,
          };
        }

        continue;
      }

      if (result.mismatch) continue;

      const nextContext = await this.getState();

      return {
        ...result,
        content: contentParts.join('\n'),
        activeNode: nextContext.activeNode,
        activeNodeDraftState: nextContext.activeNodeDraftState,
        currentQuestion: nextContext.currentQuestion,
        draft: nextContext.draft,
        processedNodes,
      };
    }

    const nextContext = await this.getState();

    return {
      ...(latestResult ?? {
        content: 'No onboarding updates were provided.',
        draft: nextContext.draft,
        nextAction: 'ask' as const,
        success: false,
      }),
      content: contentParts.join('\n'),
      activeNode: nextContext.activeNode,
      activeNodeDraftState: nextContext.activeNodeDraftState,
      currentQuestion: nextContext.currentQuestion,
      draft: nextContext.draft,
      processedNodes,
    };
  };

  private proposeSinglePatch = async (
    params: Pick<UserAgentOnboardingUpdate, 'node'> & { patch: OnboardingPatchInput },
  ): Promise<ProposePatchResult> => {
    const context = await this.getState();
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
        const draft = mergeDraftForNode(
          context.draft,
          params.node,
          getDraftValueForNode(recoverableDraft, params.node),
        );
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

    if (activeNode === 'summary') {
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

    const extractedDraft = extractDraftForNode(activeNode, params.patch);

    if (!extractedDraft) {
      const content = `Patch for "${activeNode}" did not contain any valid node-scoped fields.`;

      return {
        activeNode,
        activeNodeDraftState: getNodeDraftState(activeNode, context.draft),
        content,
        draft: context.draft,
        error: {
          code: 'INVALID_PATCH_SHAPE',
          message: content,
        },
        nextAction: 'ask',
        success: false,
      };
    }

    const draftValue = getDraftValueForNode(extractedDraft, activeNode);
    const draft = mergeDraftForNode(context.draft, activeNode, draftValue);

    await this.saveState({ ...(await this.ensurePersistedState()), draft });

    const draftState = getNodeDraftState(activeNode, draft);

    if (draftState?.status === 'complete') {
      const commitResult = await this.completeCurrentStep(activeNode);

      return {
        activeNode,
        activeNodeDraftState: draftState,
        committedValue: getDraftValueForNode(draft, activeNode),
        content: commitResult.content,
        draft: {},
        nextAction: 'ask',
        success: commitResult.success,
      };
    }

    const missingFields = draftState?.missingFields?.join(', ');

    return {
      activeNode,
      activeNodeDraftState: draftState,
      content: missingFields
        ? `Saved a partial draft for "${activeNode}". Still missing: ${missingFields}.`
        : `Saved a partial draft for "${activeNode}".`,
      draft,
      nextAction: 'ask',
      success: true,
    };
  };

  private ensurePersistedState = async () => {
    const userState = await this.getUserState();

    return this.ensureState(userState.agentOnboarding);
  };

  completeCurrentStep = async (node: UserAgentOnboardingNode) => {
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
        const agentIdentity = normalizeAgentIdentity(draft.agentIdentity);

        if (!agentIdentity) {
          return {
            content: 'Agent identity has not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        state.agentIdentity = agentIdentity;
        break;
      }
      case 'userIdentity': {
        const userIdentity = normalizeUserIdentity(draft.userIdentity);

        if (!userIdentity) {
          return {
            content: 'User identity has not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        state.profile = {
          ...state.profile,
          identity: userIdentity,
        };

        if (userIdentity.name) {
          await this.userModel.updateUser({ fullName: userIdentity.name });
        }

        break;
      }
      case 'workStyle': {
        const workStyle = normalizeWorkStyle(draft.workStyle);

        if (!workStyle) {
          return {
            content: 'Work style has not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        state.profile = {
          ...state.profile,
          workStyle,
        };
        break;
      }
      case 'workContext': {
        const workContext = normalizeWorkContext(draft.workContext);

        if (!workContext) {
          return {
            content: 'Work context has not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        state.profile = {
          ...state.profile,
          currentFocus:
            workContext.currentFocus ||
            workContext.thisWeek ||
            workContext.thisQuarter ||
            workContext.summary,
          interests: workContext.interests,
          workContext,
        };

        if (workContext.interests?.length) {
          await this.userModel.updateUser({ interests: workContext.interests });
        }

        break;
      }
      case 'painPoints': {
        const painPoints = normalizePainPoints(draft.painPoints);

        if (!painPoints) {
          return {
            content: 'Pain points have not been captured yet.',
            nextNode: activeNode,
            success: false,
          };
        }

        state.profile = {
          ...state.profile,
          painPoints,
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
        const defaultModel = normalizeDefaultModel(draft.defaultModel);

        if (defaultModel) {
          const currentSettings = await this.userModel.getUserSettings();
          await this.userModel.updateSetting({
            defaultAgent: merge(currentSettings?.defaultAgent || {}, {
              config: {
                model: defaultModel.model,
                provider: defaultModel.provider,
              },
            }),
          });
        }
        break;
      }
      case 'summary': {
        return {
          content: 'Use finishOnboarding from the summary step.',
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

    const nextContext = await this.getState();

    return {
      content: nextNode
        ? `Committed step "${activeNode}". Continue with "${nextNode}".`
        : `Committed step "${activeNode}".`,
      activeNodeDraftState: nextContext.activeNodeDraftState,
      currentQuestion: nextContext.currentQuestion,
      nextNode: nextNode ?? activeNode,
      success: true,
    };
  };

  returnToOnboarding = async (reason?: string) => {
    const state = await this.ensurePersistedState();

    return {
      content: reason
        ? `Stay on onboarding. Off-topic reason: ${reason}`
        : 'Stay on onboarding and continue with the current question.',
      activeNode: getActiveNode(state),
      success: true,
    };
  };

  finishOnboarding = async () => {
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
