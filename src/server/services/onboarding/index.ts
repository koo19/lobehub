import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { CURRENT_ONBOARDING_VERSION } from '@lobechat/const';
import type {
  UserAgentOnboarding,
  UserAgentOnboardingContext,
  UserAgentOnboardingControl,
  UserAgentOnboardingDraft,
  UserAgentOnboardingNode,
  UserAgentOnboardingUpdate,
} from '@lobechat/types';
import { AGENT_ONBOARDING_NODES, MAX_ONBOARDING_STEPS } from '@lobechat/types';
import { merge } from '@lobechat/utils';
import { and, eq } from 'drizzle-orm';

import { AgentModel } from '@/database/models/agent';
import { getDocumentTemplate } from '@/database/models/agentDocuments/templates';
import { MessageModel } from '@/database/models/message';
import { TopicModel } from '@/database/models/topic';
import { UserModel } from '@/database/models/user';
import { messages, threads, topics } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { AgentService } from '@/server/services/agent';
import { AgentDocumentsService } from '@/server/services/agentDocuments';
import { translation } from '@/server/translation';

import { buildIdentityDocument, buildSoulDocument } from './documentHelpers';
import { NODE_HANDLERS, PROFILE_DOCUMENT_NODES } from './nodeHandlers';
import { getNodeDraftState } from './nodeSchema';

type OnboardingPatchInput = Record<string, unknown>;

const ONBOARDING_TOOL_NAMES = [
  'getOnboardingState',
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

const getNodeIndex = (node?: UserAgentOnboardingNode) =>
  node ? AGENT_ONBOARDING_NODES.indexOf(node) : -1;

interface OnboardingError {
  code: 'INCOMPLETE_NODE_DATA' | 'INVALID_PATCH_SHAPE' | 'NODE_MISMATCH' | 'ONBOARDING_COMPLETE';
  message: string;
}

interface CommitStepResult {
  content: string;
  control: UserAgentOnboardingControl;
  success: boolean;
}

interface ProposePatchResult {
  activeNode?: UserAgentOnboardingNode;
  activeNodeDraftState?: { missingFields?: string[]; status: 'complete' | 'empty' | 'partial' };
  committedValue?: unknown;
  content: string;
  control?: UserAgentOnboardingControl;
  draft: UserAgentOnboardingDraft;
  error?: OnboardingError;
  mismatch?: boolean;
  nextAction: 'ask' | 'commit' | 'confirm';
  processedNodes?: UserAgentOnboardingNode[];
  requestedNode?: UserAgentOnboardingNode;
  success: boolean;
}

const buildOnboardingControl = ({
  activeNode,
  activeNodeDraftState,
}: {
  activeNode?: UserAgentOnboardingNode;
  activeNodeDraftState?: { missingFields?: string[]; status: 'complete' | 'empty' | 'partial' };
}): UserAgentOnboardingControl => {
  const missingFields = activeNodeDraftState?.missingFields ?? [];
  const canCompleteCurrentStep =
    !!activeNode && activeNode !== 'summary' && activeNodeDraftState?.status === 'complete';
  const canFinish = activeNode === 'summary';
  const allowedTools = ['getOnboardingState', 'returnToOnboarding'];

  if (activeNode) {
    if (activeNode === 'summary') {
      allowedTools.push('finishOnboarding');
    } else {
      allowedTools.push('saveAnswer');
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

export class OnboardingService {
  private readonly agentDocumentsService: AgentDocumentsService;
  private readonly agentModel: AgentModel;
  private readonly agentService: AgentService;
  private cachedInboxAgentId?: string;
  private inboxDocumentsInitialized = false;
  private readonly messageModel: MessageModel;
  private readonly topicModel: TopicModel;
  private readonly userId: string;
  private readonly userModel: UserModel;

  constructor(
    private readonly db: LobeChatDatabase,
    userId: string,
  ) {
    this.userId = userId;
    this.agentDocumentsService = new AgentDocumentsService(db, userId);
    this.agentModel = new AgentModel(db, userId);
    this.agentService = new AgentService(db, userId);
    this.messageModel = new MessageModel(db, userId);
    this.topicModel = new TopicModel(db, userId);
    this.userModel = new UserModel(db, userId);
  }

  private getInboxAgentId = async (): Promise<string> => {
    if (this.cachedInboxAgentId) return this.cachedInboxAgentId;

    const inboxAgent = await this.agentModel.getBuiltinAgent(BUILTIN_AGENT_SLUGS.inbox);

    if (!inboxAgent?.id) {
      throw new Error('Inbox agent not found');
    }

    this.cachedInboxAgentId = inboxAgent.id;

    return inboxAgent.id;
  };

  private ensureInboxDocuments = async (inboxAgentId: string): Promise<void> => {
    if (this.inboxDocumentsInitialized) return;

    const existingDocuments = await this.agentDocumentsService.getAgentDocuments(inboxAgentId);
    const existingFilenames = new Set(existingDocuments.map((document) => document.filename));
    const templateSet = getDocumentTemplate('claw');

    const missingTemplates = templateSet.templates.filter(
      (template) => !existingFilenames.has(template.filename),
    );

    await Promise.all(
      missingTemplates.map((template) =>
        this.agentDocumentsService.upsertDocument({
          agentId: inboxAgentId,
          content: template.content,
          filename: template.filename,
          loadPosition: template.loadPosition,
          loadRules: template.loadRules,
          policy: template.policyLoadFormat
            ? {
                context: {
                  policyLoadFormat: template.policyLoadFormat,
                },
              }
            : undefined,
          templateId: templateSet.id,
        }),
      ),
    );

    this.inboxDocumentsInitialized = true;
  };

  private upsertInboxDocuments = async (
    state: UserAgentOnboarding,
    writeIdentity: boolean,
  ): Promise<void> => {
    const inboxAgentId = await this.getInboxAgentId();

    await this.ensureInboxDocuments(inboxAgentId);

    const upserts = [
      this.agentDocumentsService.upsertDocument({
        agentId: inboxAgentId,
        content: buildSoulDocument(state),
        filename: 'SOUL.md',
      }),
    ];

    if (writeIdentity && state.agentIdentity) {
      upserts.push(
        this.agentDocumentsService.upsertDocument({
          agentId: inboxAgentId,
          content: buildIdentityDocument(state.agentIdentity),
          filename: 'IDENTITY.md',
        }),
      );
    }

    await Promise.all(upserts);
  };

  private transferToInbox = async (topicId: string): Promise<void> => {
    const inboxAgentId = await this.getInboxAgentId();
    const topic = await this.topicModel.findById(topicId);

    if (!topic || topic.agentId === inboxAgentId) return;

    await this.db.transaction(async (tx) => {
      await tx
        .update(topics)
        .set({ agentId: inboxAgentId, updatedAt: topics.updatedAt })
        .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)));

      await tx
        .update(messages)
        .set({ agentId: inboxAgentId, updatedAt: messages.updatedAt })
        .where(and(eq(messages.topicId, topicId), eq(messages.userId, this.userId)));

      await tx
        .update(threads)
        .set({ agentId: inboxAgentId, updatedAt: threads.updatedAt })
        .where(and(eq(threads.topicId, topicId), eq(threads.userId, this.userId)));
    });
  };

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
    const activeNodeDraftState = getNodeDraftState(activeNode, draft);

    return {
      activeNode,
      activeNodeDraftState,
      committed,
      completedNodes: state.completedNodes ?? [],
      control: buildOnboardingControl({
        activeNode,
        activeNodeDraftState,
      }),
      draft,
      finishedAt: state.finishedAt,
      topicId: state.activeTopicId,
      version: state.version,
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

    const handler = NODE_HANDLERS[activeNode];

    if (!handler) {
      const content = `Unknown node "${activeNode}".`;

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

    const extractedDraft = handler.extractDraft(params.patch);

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

    const draftValue = handler.getDraftValue(extractedDraft as UserAgentOnboardingDraft);
    const draft = handler.mergeDraft(context.draft, draftValue);

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
        committedValue: handler.getDraftValue(draft),
        content: commitResult.content,
        control: commitResult.control,
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

    if (activeNode === 'summary') {
      return {
        content: 'Use finishOnboarding from the summary step.',
        control: buildOnboardingControl({ activeNode }),
        success: false,
      };
    }

    const handler = NODE_HANDLERS[activeNode];

    if (!handler) {
      return {
        content: `Unknown node "${activeNode}".`,
        control: buildOnboardingControl({ activeNode }),
        success: false,
      };
    }

    const commitResult = handler.commitToState(state, draft);

    if (!commitResult.success) {
      return {
        content: commitResult.errorMessage ?? `${activeNode} has not been captured yet.`,
        control: buildOnboardingControl({
          activeNode,
          activeNodeDraftState: getNodeDraftState(activeNode, draft),
        }),
        success: false,
      };
    }

    if (commitResult.sideEffects?.updateUserName) {
      await this.userModel.updateUser({ fullName: commitResult.sideEffects.updateUserName });
    }
    if (commitResult.sideEffects?.updateInterests) {
      await this.userModel.updateUser({ interests: commitResult.sideEffects.updateInterests });
    }
    if (commitResult.sideEffects?.updateResponseLanguage) {
      const currentSettings = await this.userModel.getUserSettings();
      await this.userModel.updateSetting({
        general: merge(currentSettings?.general || {}, {
          responseLanguage: commitResult.sideEffects.updateResponseLanguage,
        }),
      });
    }

    const nextNode = getNextNode(activeNode);
    const completedNodes = dedupeNodes([...(state.completedNodes ?? []), activeNode]);
    const nextDraft = { ...draft };
    delete nextDraft[handler.draftKey as keyof typeof nextDraft];

    await this.saveState({
      ...state,
      completedNodes,
      draft: nextDraft,
    });

    if (PROFILE_DOCUMENT_NODES.has(activeNode)) {
      try {
        await this.upsertInboxDocuments(state, activeNode === 'agentIdentity');
      } catch (error) {
        console.error('[OnboardingService] Failed to upsert inbox documents:', error);
      }
    }

    const nextContext = await this.getState();

    return {
      content: nextNode
        ? `Committed step "${activeNode}". Continue with "${nextNode}".`
        : `Committed step "${activeNode}".`,
      control: nextContext.control,
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

    return {
      activeNode,
      content: reason
        ? `Stay on onboarding. Off-topic reason: ${reason}`
        : 'Stay on onboarding and continue with the current question.',
      control: buildOnboardingControl({
        activeNode,
        activeNodeDraftState: getNodeDraftState(activeNode, draft),
      }),
      success: true,
    };
  };

  private safeTransferToInbox = async (topicId?: string): Promise<void> => {
    if (!topicId) return;

    try {
      await this.transferToInbox(topicId);
    } catch (error) {
      console.error('[OnboardingService] Failed to transfer topic to inbox:', error);
    }
  };

  finishOnboarding = async () => {
    const state = await this.ensurePersistedState();

    if (state.finishedAt) {
      await this.safeTransferToInbox(state.activeTopicId);

      return {
        content: 'Agent onboarding already completed.',
        finishedAt: state.finishedAt,
        success: true,
      };
    }

    const activeNode = getActiveNode(state);

    if (activeNode !== 'summary') {
      return {
        content: `Active onboarding step is "${activeNode ?? 'completed'}". Finish is only allowed in "summary".`,
        control: buildOnboardingControl({
          activeNode,
          activeNodeDraftState: getNodeDraftState(activeNode, state.draft ?? {}),
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

    await this.safeTransferToInbox(state.activeTopicId);

    return {
      content: 'Agent onboarding completed successfully.',
      finishedAt,
      success: true,
    };
  };

  reset = async () => {
    const state = defaultAgentOnboardingState();

    await this.userModel.updateUser({ agentOnboarding: state });

    try {
      const inboxAgentId = await this.getInboxAgentId();

      await this.agentDocumentsService.deleteTemplateDocuments(inboxAgentId, 'claw');
      this.inboxDocumentsInitialized = false;
      await this.ensureInboxDocuments(inboxAgentId);
    } catch (error) {
      console.error('[OnboardingService] Failed to reset inbox documents:', error);
    }

    return state;
  };
}
