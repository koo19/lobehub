import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { CURRENT_ONBOARDING_VERSION } from '@lobechat/const';
import type {
  UserAgentOnboarding,
  UserAgentOnboardingDraft,
  UserAgentOnboardingNode,
} from '@lobechat/types';
import { AGENT_ONBOARDING_NODES, MAX_ONBOARDING_STEPS } from '@lobechat/types';
import { merge } from '@lobechat/utils';

import { ONBOARDING_PRODUCTION_DEFAULT_MODEL } from '@/const/onboarding';
import { MessageModel } from '@/database/models/message';
import { TopicModel } from '@/database/models/topic';
import { UserModel } from '@/database/models/user';
import type { LobeChatDatabase } from '@/database/type';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { AgentService } from '@/server/services/agent';
import { isDev } from '@/utils/env';

type OnboardingAgentIdentity = NonNullable<UserAgentOnboarding['agentIdentity']>;
type OnboardingPainPoints = NonNullable<UserAgentOnboardingDraft['painPoints']>;
type OnboardingUserIdentity = NonNullable<UserAgentOnboardingDraft['userIdentity']>;
type OnboardingWorkContext = NonNullable<UserAgentOnboardingDraft['workContext']>;
type OnboardingWorkStyle = NonNullable<UserAgentOnboardingDraft['workStyle']>;

const defaultAgentOnboardingState = (): UserAgentOnboarding => ({
  completedNodes: [],
  currentNode: AGENT_ONBOARDING_NODES[0],
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

const dedupeNodes = (nodes: UserAgentOnboardingNode[] = []) => Array.from(new Set(nodes));

const sanitizeText = (value?: string) => value?.trim() || undefined;

const sanitizeTextList = (items?: string[], max = 8) =>
  (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);

const getNodeIndex = (node?: UserAgentOnboardingNode) =>
  node ? AGENT_ONBOARDING_NODES.indexOf(node) : -1;

const normalizeAgentIdentity = (
  value?: UserAgentOnboardingDraft['agentIdentity'],
): OnboardingAgentIdentity | undefined => {
  const emoji = sanitizeText(value?.emoji);
  const name = sanitizeText(value?.name);
  const nature = sanitizeText(value?.nature);
  const vibe = sanitizeText(value?.vibe);

  if (!emoji || !name || !nature || !vibe) return undefined;

  return { emoji, name, nature, vibe };
};

const normalizeUserIdentity = (
  value?: UserAgentOnboardingDraft['userIdentity'],
): OnboardingUserIdentity | undefined => {
  const summary = sanitizeText(value?.summary);

  if (!summary) return undefined;

  return {
    ...(sanitizeText(value?.domainExpertise)
      ? { domainExpertise: sanitizeText(value?.domainExpertise) }
      : {}),
    ...(sanitizeText(value?.name) ? { name: sanitizeText(value?.name) } : {}),
    ...(sanitizeText(value?.professionalRole)
      ? { professionalRole: sanitizeText(value?.professionalRole) }
      : {}),
    summary,
  };
};

const normalizeWorkStyle = (
  value?: UserAgentOnboardingDraft['workStyle'],
): OnboardingWorkStyle | undefined => {
  const summary = sanitizeText(value?.summary);

  if (!summary) return undefined;

  return {
    ...(sanitizeText(value?.communicationStyle)
      ? { communicationStyle: sanitizeText(value?.communicationStyle) }
      : {}),
    ...(sanitizeText(value?.decisionMaking)
      ? { decisionMaking: sanitizeText(value?.decisionMaking) }
      : {}),
    ...(sanitizeText(value?.socialMode) ? { socialMode: sanitizeText(value?.socialMode) } : {}),
    summary,
    ...(sanitizeText(value?.thinkingPreferences)
      ? { thinkingPreferences: sanitizeText(value?.thinkingPreferences) }
      : {}),
    ...(sanitizeText(value?.workStyle) ? { workStyle: sanitizeText(value?.workStyle) } : {}),
  };
};

const normalizeWorkContext = (
  value?: UserAgentOnboardingDraft['workContext'],
): OnboardingWorkContext | undefined => {
  const summary = sanitizeText(value?.summary);

  if (!summary) return undefined;

  const activeProjects = sanitizeTextList(value?.activeProjects);
  const interests = sanitizeTextList(value?.interests);
  const tools = sanitizeTextList(value?.tools);

  return {
    ...(activeProjects.length > 0 ? { activeProjects } : {}),
    ...(sanitizeText(value?.currentFocus)
      ? { currentFocus: sanitizeText(value?.currentFocus) }
      : {}),
    ...(interests.length > 0 ? { interests } : {}),
    summary,
    ...(sanitizeText(value?.thisQuarter) ? { thisQuarter: sanitizeText(value?.thisQuarter) } : {}),
    ...(sanitizeText(value?.thisWeek) ? { thisWeek: sanitizeText(value?.thisWeek) } : {}),
    ...(tools.length > 0 ? { tools } : {}),
  };
};

const normalizePainPoints = (
  value?: UserAgentOnboardingDraft['painPoints'],
): OnboardingPainPoints | undefined => {
  const summary = sanitizeText(value?.summary);

  if (!summary) return undefined;

  const blockedBy = sanitizeTextList(value?.blockedBy);
  const frustrations = sanitizeTextList(value?.frustrations);
  const noTimeFor = sanitizeTextList(value?.noTimeFor);

  return {
    ...(blockedBy.length > 0 ? { blockedBy } : {}),
    ...(frustrations.length > 0 ? { frustrations } : {}),
    ...(noTimeFor.length > 0 ? { noTimeFor } : {}),
    summary,
  };
};

const extractDraftForNode = (
  node: UserAgentOnboardingNode,
  patch: UserAgentOnboardingDraft,
): Partial<UserAgentOnboardingDraft> | undefined => {
  switch (node) {
    case 'agentIdentity': {
      const agentIdentity = normalizeAgentIdentity(patch.agentIdentity);
      return agentIdentity ? { agentIdentity } : undefined;
    }
    case 'userIdentity': {
      const userIdentity = normalizeUserIdentity(patch.userIdentity);
      return userIdentity ? { userIdentity } : undefined;
    }
    case 'workStyle': {
      const workStyle = normalizeWorkStyle(patch.workStyle);
      return workStyle ? { workStyle } : undefined;
    }
    case 'workContext': {
      const workContext = normalizeWorkContext(patch.workContext);
      return workContext ? { workContext } : undefined;
    }
    case 'painPoints': {
      const painPoints = normalizePainPoints(patch.painPoints);
      return painPoints ? { painPoints } : undefined;
    }
    case 'responseLanguage': {
      const responseLanguage = sanitizeText(patch.responseLanguage);
      return responseLanguage ? { responseLanguage } : undefined;
    }
    case 'proSettings': {
      return patch.defaultModel ? { defaultModel: patch.defaultModel } : undefined;
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

const createWelcomeMessage = (node: UserAgentOnboardingNode) => {
  switch (node) {
    case 'agentIdentity': {
      return "I just came online, so I'm still figuring out who I am. Help me pick a name, a vibe, and an emoji for me.";
    }
    case 'userIdentity': {
      return "Your turn. What's your name or handle, and what kind of work do you actually do?";
    }
    case 'workStyle': {
      return 'How do you like to think and work? Fast and intuitive, methodical and data-heavy, solo deep work, fast collaboration, something else?';
    }
    case 'workContext': {
      return 'What are you working on right now, and what tools or domains do you keep reaching for?';
    }
    case 'painPoints': {
      return "Where's the friction right now? What's eating time, slowing you down, or staying half-done because you never get to it?";
    }
    case 'responseLanguage': {
      return 'Which language should I use by default when I reply to you?';
    }
    case 'proSettings': {
      return isDev
        ? 'You can set a default model or connect tools now. When you are ready, continue here.'
        : `The default model is preset to ${ONBOARDING_PRODUCTION_DEFAULT_MODEL.provider}/${ONBOARDING_PRODUCTION_DEFAULT_MODEL.model}. You can connect tools now, then continue here when you are ready.`;
    }
    case 'summary': {
      return "I have the shape of you now. I'll summarize what I learned and what I can help with next. Tell me if it lands.";
    }
  }
};

interface ProposePatchResult {
  committedValue?: unknown;
  content: string;
  currentNode?: UserAgentOnboardingNode;
  draft: UserAgentOnboardingDraft;
  instruction?: string;
  mismatch?: boolean;
  nextAction: 'ask' | 'commit' | 'confirm';
  requestedNode?: UserAgentOnboardingNode;
  savedDraftFields?: (keyof UserAgentOnboardingDraft)[];
  success: boolean;
}

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
    if (
      !state ||
      !isValidNode(state.currentNode) ||
      (state.completedNodes ?? []).some((node) => !isValidNode(node)) ||
      (state.version ?? 0) < CURRENT_ONBOARDING_VERSION
    ) {
      return defaultAgentOnboardingState();
    }

    const nextState = merge(defaultAgentOnboardingState(), state ?? {});

    return {
      ...nextState,
      completedNodes: dedupeNodes((nextState.completedNodes ?? []).filter(isValidNode)),
      currentNode: isValidNode(nextState.currentNode)
        ? nextState.currentNode
        : AGENT_ONBOARDING_NODES[0],
      draft: nextState.draft ?? {},
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

  private ensureWelcomeMessage = async (
    agentId: string,
    topicId: string,
    state: UserAgentOnboarding,
  ) => {
    const messages = await this.messageModel.query({ topicId });

    if (messages.length > 0) return;

    await this.messageModel.create({
      agentId,
      content: createWelcomeMessage(state.currentNode ?? AGENT_ONBOARDING_NODES[0]),
      role: 'assistant',
      topicId,
    });
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

    await this.ensureWelcomeMessage(builtinAgent.id, topicId, nextState);

    return {
      agentId: builtinAgent.id,
      agentOnboarding: nextState,
      topicId,
    };
  };

  getContext = async () => {
    const userState = await this.getUserState();
    const state = this.ensureState(userState.agentOnboarding);

    return {
      committed: {
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
      },
      completedNodes: state.completedNodes ?? [],
      currentNode: state.currentNode ?? AGENT_ONBOARDING_NODES[0],
      draft: state.draft ?? {},
      finishedAt: state.finishedAt,
      topicId: state.activeTopicId,
      version: state.version,
    };
  };

  proposePatch = async (params: {
    node: UserAgentOnboardingNode;
    patch: UserAgentOnboardingDraft;
  }): Promise<ProposePatchResult> => {
    const context = await this.getContext();
    const currentNode = context.currentNode;

    if (params.node !== currentNode) {
      const currentNodeIndex = getNodeIndex(currentNode);
      const requestedNodeIndex = getNodeIndex(params.node);
      const recoverableDraft =
        requestedNodeIndex > currentNodeIndex
          ? extractDraftForNode(params.node, params.patch)
          : undefined;

      if (recoverableDraft) {
        const draft = { ...context.draft, ...recoverableDraft };
        const instruction = getNodeRecoveryInstruction(currentNode);

        await this.saveState({ ...(await this.ensurePersistedState()), draft });

        return {
          content: `Node mismatch: current node is "${currentNode}", but you called "${params.node}". I saved the later-step draft for "${params.node}", but do not advance yet. ${instruction}`,
          currentNode,
          draft,
          instruction,
          mismatch: true,
          nextAction: 'ask',
          requestedNode: params.node,
          savedDraftFields: Object.keys(recoverableDraft) as (keyof UserAgentOnboardingDraft)[],
          success: false,
        };
      }

      const instruction = getNodeRecoveryInstruction(currentNode);

      return {
        content: `Node mismatch: current node is "${currentNode}", but you called "${params.node}". ${instruction}`,
        currentNode,
        draft: context.draft,
        instruction,
        mismatch: true,
        nextAction: 'ask',
        requestedNode: params.node,
        success: false,
      };
    }

    const patch = params.patch;

    switch (currentNode) {
      case 'agentIdentity': {
        const agentIdentity = normalizeAgentIdentity(patch.agentIdentity);

        if (!agentIdentity) {
          return {
            content:
              'Agent identity is incomplete. Capture a name, nature, vibe, and emoji before moving on.',
            draft: context.draft,
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, agentIdentity };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(currentNode);

        return {
          committedValue: agentIdentity,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'userIdentity': {
        const userIdentity = normalizeUserIdentity(patch.userIdentity);

        if (!userIdentity) {
          return {
            content:
              'User identity is still too thin. Capture at least a concise summary plus any available name, role, or domain expertise.',
            draft: context.draft,
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, userIdentity };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(currentNode);

        return {
          committedValue: userIdentity,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'workStyle': {
        const workStyle = normalizeWorkStyle(patch.workStyle);

        if (!workStyle) {
          return {
            content:
              'Work style is still unclear. Capture a concise summary of how the user thinks, decides, and likes to communicate.',
            draft: context.draft,
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, workStyle };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(currentNode);

        return {
          committedValue: workStyle,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'workContext': {
        const workContext = normalizeWorkContext(patch.workContext);

        if (!workContext) {
          return {
            content:
              'Current work context is missing. Capture a concise summary plus the user’s current focus, projects, interests, or tools.',
            draft: context.draft,
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, workContext };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(currentNode);

        return {
          committedValue: workContext,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'painPoints': {
        const painPoints = normalizePainPoints(patch.painPoints);

        if (!painPoints) {
          return {
            content:
              'Pain points are still missing. Capture a concise summary of what frustrates the user or keeps getting blocked.',
            draft: context.draft,
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, painPoints };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(currentNode);

        return {
          committedValue: painPoints,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'responseLanguage': {
        const responseLanguage = sanitizeText(patch.responseLanguage);

        if (responseLanguage === undefined) {
          return {
            content: 'Response language is missing. Ask the user to choose a default language.',
            draft: context.draft,
            nextAction: 'ask',
            success: false,
          };
        }

        const draft = { ...context.draft, responseLanguage };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(currentNode);

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
          patch.defaultModel || (!isDev ? ONBOARDING_PRODUCTION_DEFAULT_MODEL : undefined);
        const draft = {
          ...context.draft,
          ...(defaultModel ? { defaultModel } : {}),
        };

        await this.saveState({ ...(await this.ensurePersistedState()), draft });
        const commitResult = await this.commitNode(currentNode);

        return {
          committedValue: defaultModel,
          content: commitResult.content,
          draft: {},
          nextAction: 'ask',
          success: commitResult.success,
        };
      }
      case 'summary': {
        return {
          content: 'Summary is handled after all previous onboarding nodes are complete.',
          draft: context.draft,
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
    const currentNode = state.currentNode ?? AGENT_ONBOARDING_NODES[0];

    if (node !== currentNode) {
      return {
        content: `Current onboarding node is "${currentNode}", not "${node}".`,
        nextNode: currentNode,
        success: false,
      };
    }

    const draft = state.draft ?? {};

    switch (currentNode) {
      case 'agentIdentity': {
        if (!draft.agentIdentity) {
          return {
            content: 'Agent identity has not been captured yet.',
            nextNode: currentNode,
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
            nextNode: currentNode,
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
            nextNode: currentNode,
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
            nextNode: currentNode,
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
            nextNode: currentNode,
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
            nextNode: currentNode,
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
          nextNode: currentNode,
          success: false,
        };
      }
    }

    const nextNode = getNextNode(currentNode);
    const completedNodes = dedupeNodes([...(state.completedNodes ?? []), currentNode]);
    const nextDraft = { ...draft };

    if (currentNode === 'agentIdentity') delete nextDraft.agentIdentity;
    if (currentNode === 'userIdentity') delete nextDraft.userIdentity;
    if (currentNode === 'workStyle') delete nextDraft.workStyle;
    if (currentNode === 'workContext') delete nextDraft.workContext;
    if (currentNode === 'painPoints') delete nextDraft.painPoints;
    if (currentNode === 'responseLanguage') delete nextDraft.responseLanguage;
    if (currentNode === 'proSettings') delete nextDraft.defaultModel;

    await this.saveState({
      ...state,
      completedNodes,
      currentNode: nextNode ?? currentNode,
      draft: nextDraft,
    });

    return {
      content: nextNode
        ? `Committed node "${currentNode}". Continue with "${nextNode}".`
        : `Committed node "${currentNode}".`,
      nextNode: nextNode ?? currentNode,
      success: true,
    };
  };

  redirectOfftopic = async (reason?: string) => {
    const state = await this.ensurePersistedState();

    return {
      content: reason
        ? `Stay on onboarding. Off-topic reason: ${reason}`
        : 'Stay on onboarding and continue with the current question.',
      currentNode: state.currentNode ?? AGENT_ONBOARDING_NODES[0],
      success: true,
    };
  };

  finish = async () => {
    const state = await this.ensurePersistedState();
    const currentNode = state.currentNode ?? AGENT_ONBOARDING_NODES[0];

    if (currentNode !== 'summary') {
      return {
        content: `Current onboarding node is "${currentNode}". Finish is only allowed in "summary".`,
        success: false,
      };
    }

    const finishedAt = new Date().toISOString();

    await this.userModel.updateUser({
      agentOnboarding: {
        ...state,
        completedNodes: dedupeNodes([...(state.completedNodes ?? []), 'summary']),
        currentNode: 'summary',
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
