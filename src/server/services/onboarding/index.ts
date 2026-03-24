import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { CURRENT_ONBOARDING_VERSION } from '@lobechat/const';
import type {
  UserAgentOnboarding,
  UserAgentOnboardingContext,
  UserAgentOnboardingControl,
  UserAgentOnboardingDraft,
  UserAgentOnboardingNode,
  UserAgentOnboardingQuestion,
  UserAgentOnboardingQuestionDraft,
  UserAgentOnboardingUpdate,
} from '@lobechat/types';
import { AGENT_ONBOARDING_NODES, MAX_ONBOARDING_STEPS } from '@lobechat/types';
import { merge } from '@lobechat/utils';

import { MessageModel } from '@/database/models/message';
import { TopicModel } from '@/database/models/topic';
import { UserModel } from '@/database/models/user';
import type { LobeChatDatabase } from '@/database/type';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { AgentService } from '@/server/services/agent';
import { translation } from '@/server/translation';

type OnboardingAgentIdentity = NonNullable<UserAgentOnboarding['agentIdentity']>;
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

const ONBOARDING_TOOL_NAMES = [
  'getOnboardingState',
  'askUserQuestion',
  'saveAnswer',
  'completeCurrentStep',
  'returnToOnboarding',
  'finishOnboarding',
] as const;
const REMOVED_ONBOARDING_NODES = ['proSettings'] as const;

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
  responseLanguage: ['responseLanguage'],
  userIdentity: ['summary'],
  workContext: ['summary'],
  workStyle: ['summary'],
} as const satisfies Partial<Record<UserAgentOnboardingNode, readonly string[]>>;

interface OnboardingNodeDraftState {
  missingFields?: string[];
  status: 'complete' | 'empty' | 'partial';
}

interface OnboardingError {
  code: 'INCOMPLETE_NODE_DATA' | 'INVALID_PATCH_SHAPE' | 'NODE_MISMATCH' | 'ONBOARDING_COMPLETE';
  message: string;
}

interface CommitStepResult {
  content: string;
  control: UserAgentOnboardingControl;
  currentQuestion?: UserAgentOnboardingQuestion;
  success: boolean;
}

interface ProposePatchResult {
  activeNode?: UserAgentOnboardingNode;
  activeNodeDraftState?: OnboardingNodeDraftState;
  committedValue?: unknown;
  content: string;
  control?: UserAgentOnboardingControl;
  currentQuestion?: UserAgentOnboardingQuestion;
  draft: UserAgentOnboardingDraft;
  error?: OnboardingError;
  mismatch?: boolean;
  nextAction: 'ask' | 'commit' | 'confirm';
  processedNodes?: UserAgentOnboardingNode[];
  requestedNode?: UserAgentOnboardingNode;
  success: boolean;
}

interface AskQuestionResult {
  activeNode?: UserAgentOnboardingNode;
  content: string;
  control?: UserAgentOnboardingControl;
  currentQuestion?: UserAgentOnboardingQuestion;
  mismatch?: boolean;
  requestedNode?: UserAgentOnboardingNode;
  storedQuestionId?: string;
  success: boolean;
}

const getScopedPatch = (node: UserAgentOnboardingNode, patch: OnboardingPatchInput) => {
  const nestedPatch = isRecord(patch[node]) ? patch[node] : undefined;
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

  const currentDraft = node === 'responseLanguage' ? draft.responseLanguage : draft[node];

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

const buildOnboardingControl = ({
  activeNode,
  activeNodeDraftState,
  currentQuestion,
}: {
  activeNode?: UserAgentOnboardingNode;
  activeNodeDraftState?: OnboardingNodeDraftState;
  currentQuestion?: UserAgentOnboardingQuestion;
}): UserAgentOnboardingControl => {
  const missingFields = activeNodeDraftState?.missingFields ?? [];
  const canCompleteCurrentStep =
    !!activeNode && activeNode !== 'summary' && activeNodeDraftState?.status === 'complete';
  const canFinish = activeNode === 'summary';
  const allowedTools = ['getOnboardingState', 'returnToOnboarding'];

  if (activeNode) {
    if (activeNode === 'summary') {
      allowedTools.push('askUserQuestion');
      if (currentQuestion) allowedTools.push('finishOnboarding');
    } else {
      allowedTools.push('saveAnswer', 'askUserQuestion');
      if (canCompleteCurrentStep) allowedTools.push('completeCurrentStep');
    }
  }

  return {
    allowedTools: allowedTools.filter(
      (toolName, index, list) =>
        ONBOARDING_TOOL_NAMES.includes(toolName as (typeof ONBOARDING_TOOL_NAMES)[number]) &&
        list.indexOf(toolName) === index,
    ),
    canCompleteCurrentStep,
    canFinish,
    missingFields,
  };
};

const getActiveNode = (state: Pick<UserAgentOnboarding, 'completedNodes' | 'finishedAt'>) => {
  if (state.finishedAt) return undefined;

  return getFirstIncompleteNode(state.completedNodes ?? []);
};

const attachNodeToQuestion = (
  node: UserAgentOnboardingNode,
  question: UserAgentOnboardingQuestionDraft,
): UserAgentOnboardingQuestion => ({ ...question, node });

export class OnboardingService {
  private readonly agentService: AgentService;
  private readonly messageModel: MessageModel;
  private readonly topicModel: TopicModel;
  private readonly userId: string;
  private readonly userModel: UserModel;

  constructor(
    private readonly db: LobeChatDatabase,
    userId: string,
  ) {
    this.userId = userId;
    this.agentService = new AgentService(db, userId);
    this.messageModel = new MessageModel(db, userId);
    this.topicModel = new TopicModel(db, userId);
    this.userModel = new UserModel(db, userId);
  }

  private ensureState = (state?: UserAgentOnboarding): UserAgentOnboarding => {
    const invalidCompletedNodes = (state?.completedNodes ?? []).filter(
      (node) => !isValidNode(node),
    );

    if (
      !state ||
      invalidCompletedNodes.some(
        (node) =>
          !REMOVED_ONBOARDING_NODES.includes(node as (typeof REMOVED_ONBOARDING_NODES)[number]),
      ) ||
      (state.version ?? 0) < CURRENT_ONBOARDING_VERSION
    ) {
      return defaultAgentOnboardingState();
    }

    const mergedState = merge(defaultAgentOnboardingState(), state ?? {}) as UserAgentOnboarding & {
      currentNode?: UserAgentOnboardingNode;
      executionGuard?: unknown;
    };
    const {
      currentNode: legacyCurrentNode,
      executionGuard: legacyExecutionGuard,
      ...nextState
    } = mergedState;
    void legacyCurrentNode;
    void legacyExecutionGuard;

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

  private getUserLocale = async () => {
    const userState = await this.getUserState();

    return userState.settings?.general?.responseLanguage || 'en-US';
  };

  private getWelcomeMessageContent = async () => {
    const { t } = await translation('onboarding', await this.getUserLocale());

    return `${t('agent.title')}\n\n${t('agent.welcome')}`;
  };

  private ensureWelcomeMessage = async (topicId: string, agentId: string) => {
    const existingMessages = await this.messageModel.query({ agentId, pageSize: 1, topicId });

    if (existingMessages.length > 0) return;

    await this.messageModel.create({
      agentId,
      content: await this.getWelcomeMessageContent(),
      role: 'assistant',
      topicId,
    });
  };

  private ensureTopic = async (state: UserAgentOnboarding, agentId: string) => {
    const existingTopicId = state.activeTopicId;

    if (existingTopicId) {
      const topic = await this.topicModel.findById(existingTopicId);

      if (topic) return { created: false, topicId: existingTopicId };
    }

    const topic = await this.topicModel.create({
      agentId,
      title: 'Onboarding',
      trigger: 'chat',
    });

    return { created: true, topicId: topic.id };
  };

  getOrCreateState = async () => {
    const builtinAgent = await this.agentService.getBuiltinAgent(BUILTIN_AGENT_SLUGS.webOnboarding);

    if (!builtinAgent?.id) {
      throw new Error('Failed to initialize onboarding agent');
    }

    const userState = await this.getUserState();
    const state = this.ensureState(userState.agentOnboarding);
    const { topicId } = await this.ensureTopic(state, builtinAgent.id);
    const nextState =
      topicId === state.activeTopicId
        ? state
        : await this.saveState({ ...state, activeTopicId: topicId });

    await this.ensureWelcomeMessage(topicId, builtinAgent.id);

    return {
      agentId: builtinAgent.id,
      agentOnboarding: nextState,
      context: await this.getState(),
      topicId,
    };
  };

  getState = async (): Promise<UserAgentOnboardingContext> => {
    const userState = await this.getUserState();
    const state = this.ensureState(userState.agentOnboarding);
    const committed = {
      agentIdentity: state.agentIdentity,
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
    const activeNodeDraftState = getNodeDraftState(activeNode, draft);

    return {
      activeNode,
      activeNodeDraftState,
      committed,
      completedNodes: state.completedNodes ?? [],
      control: buildOnboardingControl({
        activeNode,
        activeNodeDraftState,
        currentQuestion,
      }),
      currentQuestion,
      draft,
      finishedAt: state.finishedAt,
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
      return {
        activeNode,
        content: `Node mismatch: active onboarding step is "${activeNode}", but you called "${params.node}".`,
        control: context.control,
        currentQuestion: context.currentQuestion,
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
      control: nextContext.control,
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

      if (!result.success) {
        const nextContext = await this.getState();

        return {
          ...result,
          activeNode: nextContext.activeNode,
          activeNodeDraftState: nextContext.activeNodeDraftState,
          content: contentParts.join('\n'),
          control: nextContext.control,
          currentQuestion: nextContext.currentQuestion,
          draft: nextContext.draft,
          processedNodes,
        };
      }

      processedNodes.push(update.node);

      if (result.activeNodeDraftState?.status === 'partial') {
        const nextContext = await this.getState();

        return {
          ...result,
          activeNode: nextContext.activeNode,
          activeNodeDraftState: nextContext.activeNodeDraftState,
          content: contentParts.join('\n'),
          control: nextContext.control,
          currentQuestion: nextContext.currentQuestion,
          draft: nextContext.draft,
          processedNodes,
        };
      }
    }

    const nextContext = await this.getState();

    return {
      ...(latestResult ?? {
        content: 'No onboarding updates were provided.',
        draft: nextContext.draft,
        nextAction: 'ask' as const,
        success: false,
      }),
      activeNode: nextContext.activeNode,
      activeNodeDraftState: nextContext.activeNodeDraftState,
      content: contentParts.join('\n'),
      control: nextContext.control,
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
      return {
        activeNode,
        content: `Node mismatch: active onboarding step is "${activeNode}", but you called "${params.node}".`,
        draft: context.draft,
        error: {
          code: 'NODE_MISMATCH',
          message: `Node mismatch: active onboarding step is "${activeNode}", but you called "${params.node}".`,
        },
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
      const commitResult = await this.commitActiveStep(
        await this.ensurePersistedState(),
        activeNode,
      );

      return {
        activeNode,
        activeNodeDraftState: draftState,
        committedValue: getDraftValueForNode(draft, activeNode),
        content: commitResult.content,
        control: commitResult.control,
        currentQuestion: commitResult.currentQuestion,
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

  private commitActiveStep = async (
    state: UserAgentOnboarding,
    activeNode: UserAgentOnboardingNode,
  ): Promise<CommitStepResult> => {
    const draft = state.draft ?? {};

    switch (activeNode) {
      case 'agentIdentity': {
        const agentIdentity = normalizeAgentIdentity(draft.agentIdentity);

        if (!agentIdentity) {
          return {
            content: 'Agent identity has not been captured yet.',
            control: buildOnboardingControl({
              activeNode,
              activeNodeDraftState: getNodeDraftState(activeNode, draft),
              currentQuestion:
                state.questionSurface?.node === activeNode
                  ? state.questionSurface.question
                  : undefined,
            }),
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
            control: buildOnboardingControl({
              activeNode,
              activeNodeDraftState: getNodeDraftState(activeNode, draft),
              currentQuestion:
                state.questionSurface?.node === activeNode
                  ? state.questionSurface.question
                  : undefined,
            }),
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
            control: buildOnboardingControl({
              activeNode,
              activeNodeDraftState: getNodeDraftState(activeNode, draft),
              currentQuestion:
                state.questionSurface?.node === activeNode
                  ? state.questionSurface.question
                  : undefined,
            }),
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
            control: buildOnboardingControl({
              activeNode,
              activeNodeDraftState: getNodeDraftState(activeNode, draft),
              currentQuestion:
                state.questionSurface?.node === activeNode
                  ? state.questionSurface.question
                  : undefined,
            }),
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
            control: buildOnboardingControl({
              activeNode,
              activeNodeDraftState: getNodeDraftState(activeNode, draft),
              currentQuestion:
                state.questionSurface?.node === activeNode
                  ? state.questionSurface.question
                  : undefined,
            }),
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
            control: buildOnboardingControl({
              activeNode,
              activeNodeDraftState: getNodeDraftState(activeNode, draft),
              currentQuestion:
                state.questionSurface?.node === activeNode
                  ? state.questionSurface.question
                  : undefined,
            }),
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
      case 'summary': {
        return {
          content: 'Use finishOnboarding from the summary step.',
          control: buildOnboardingControl({
            activeNode,
            currentQuestion:
              state.questionSurface?.node === activeNode
                ? state.questionSurface.question
                : undefined,
          }),
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
      control: nextContext.control,
      currentQuestion: nextContext.currentQuestion,
      success: true,
    };
  };

  completeCurrentStep = async (node: UserAgentOnboardingNode) => {
    const state = await this.ensurePersistedState();
    const activeNode = getActiveNode(state);

    if (!activeNode) {
      return {
        content: 'Onboarding is already complete.',
        control: buildOnboardingControl({
          activeNode,
          activeNodeDraftState: undefined,
          currentQuestion: undefined,
        }),
        success: false,
      };
    }

    if (node !== activeNode) {
      return {
        activeNode,
        activeNodeDraftState: getNodeDraftState(activeNode, state.draft ?? {}),
        content: `Active onboarding step is "${activeNode}", not "${node}".`,
        control: buildOnboardingControl({
          activeNode,
          activeNodeDraftState: getNodeDraftState(activeNode, state.draft ?? {}),
          currentQuestion:
            state.questionSurface?.node === activeNode ? state.questionSurface.question : undefined,
        }),
        success: false,
      };
    }

    const draftState = getNodeDraftState(activeNode, state.draft ?? {});

    if (activeNode !== 'summary' && draftState?.status !== 'complete') {
      return {
        activeNode,
        activeNodeDraftState: draftState,
        content: `Active onboarding step "${activeNode}" is still incomplete.`,
        control: buildOnboardingControl({
          activeNode,
          activeNodeDraftState: draftState,
          currentQuestion:
            state.questionSurface?.node === activeNode ? state.questionSurface.question : undefined,
        }),
        success: false,
      };
    }

    return this.commitActiveStep(state, activeNode);
  };

  returnToOnboarding = async (reason?: string) => {
    const state = await this.ensurePersistedState();
    const activeNode = getActiveNode(state);
    const draft = state.draft ?? {};
    const questionSurface = state.questionSurface;
    const currentQuestion =
      questionSurface && questionSurface.node === activeNode ? questionSurface.question : undefined;

    return {
      activeNode,
      content: reason
        ? `Stay on onboarding. Off-topic reason: ${reason}`
        : 'Stay on onboarding and continue with the current question.',
      control: buildOnboardingControl({
        activeNode,
        activeNodeDraftState: getNodeDraftState(activeNode, draft),
        currentQuestion,
      }),
      currentQuestion,
      success: true,
    };
  };

  finishOnboarding = async () => {
    const state = await this.ensurePersistedState();
    const activeNode = getActiveNode(state);

    if (activeNode !== 'summary') {
      const questionSurface = state.questionSurface;

      return {
        content: `Active onboarding step is "${activeNode ?? 'completed'}". Finish is only allowed in "summary".`,
        control: buildOnboardingControl({
          activeNode,
          activeNodeDraftState: getNodeDraftState(activeNode, state.draft ?? {}),
          currentQuestion:
            questionSurface && questionSurface.node === activeNode
              ? questionSurface.question
              : undefined,
        }),
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
