import { type PartialDeep } from 'type-fest';

import { lambdaClient } from '@/libs/trpc/client';
import {
  type SSOProvider,
  type UserAgentOnboarding,
  type UserAgentOnboardingDraft,
  type UserAgentOnboardingInteractionHint,
  type UserAgentOnboardingInteractionHintDraft,
  type UserAgentOnboardingNode,
  type UserAgentOnboardingUpdate,
  type UserGuide,
  type UserInitializationState,
  type UserOnboarding,
  type UserPreference,
} from '@/types/user';
import { type UserSettings } from '@/types/user/settings';

export class UserService {
  getUserRegistrationDuration = async (): Promise<{
    createdAt: string;
    duration: number;
    updatedAt: string;
  }> => {
    return lambdaClient.user.getUserRegistrationDuration.query();
  };

  getUserState = async (): Promise<UserInitializationState> => {
    return lambdaClient.user.getUserState.query();
  };

  getUserSSOProviders = async (): Promise<SSOProvider[]> => {
    return lambdaClient.user.getUserSSOProviders.query();
  };

  getOrCreateAgentOnboardingContext = async (): Promise<{
    agentId: string;
    agentOnboarding: UserAgentOnboarding;
    context: {
      activeNode?: UserAgentOnboardingNode;
      committed: Record<string, unknown>;
      completedNodes: UserAgentOnboardingNode[];
      draft: UserAgentOnboardingDraft;
      finishedAt?: string;
      interactionHints: UserAgentOnboardingInteractionHint[];
      interactionPolicy: {
        needsRefresh: boolean;
        reason?: string;
      };
      topicId?: string;
      version: number;
    };
    topicId: string;
  }> => {
    return lambdaClient.user.getOrCreateAgentOnboardingContext.query();
  };

  getAgentOnboardingContext = async () => {
    return lambdaClient.user.getAgentOnboardingContext.query();
  };

  proposeAgentOnboardingPatch = async (params: { updates: UserAgentOnboardingUpdate[] }) => {
    return lambdaClient.user.proposeAgentOnboardingPatch.mutate(
      params as Parameters<typeof lambdaClient.user.proposeAgentOnboardingPatch.mutate>[0],
    );
  };

  proposeAgentOnboardingInteractions = async (params: {
    hints: UserAgentOnboardingInteractionHintDraft[];
    node: UserAgentOnboardingNode;
  }) => {
    return lambdaClient.user.proposeAgentOnboardingInteractions.mutate(params);
  };

  commitAgentOnboardingNode = async (node: UserAgentOnboardingNode) => {
    return lambdaClient.user.commitAgentOnboardingNode.mutate({ node });
  };

  redirectAgentOnboardingOfftopic = async (reason?: string) => {
    return lambdaClient.user.redirectAgentOnboardingOfftopic.mutate({ reason });
  };

  finishAgentOnboarding = async () => {
    return lambdaClient.user.finishAgentOnboarding.mutate();
  };

  makeUserOnboarded = async () => {
    return lambdaClient.user.makeUserOnboarded.mutate();
  };

  resetAgentOnboarding = async () => {
    return lambdaClient.user.resetAgentOnboarding.mutate();
  };

  updateAgentOnboarding = async (agentOnboarding: UserAgentOnboarding) => {
    return lambdaClient.user.updateAgentOnboarding.mutate(agentOnboarding);
  };

  updateOnboarding = async (onboarding: UserOnboarding) => {
    return lambdaClient.user.updateOnboarding.mutate(onboarding);
  };

  updateAvatar = async (avatar: string) => {
    return lambdaClient.user.updateAvatar.mutate(avatar);
  };

  updateInterests = async (interests: string[]) => {
    return lambdaClient.user.updateInterests.mutate(interests);
  };

  updateFullName = async (fullName: string) => {
    return lambdaClient.user.updateFullName.mutate(fullName);
  };

  updateUsername = async (username: string) => {
    return lambdaClient.user.updateUsername.mutate(username);
  };

  updatePreference = async (preference: Partial<UserPreference>) => {
    return lambdaClient.user.updatePreference.mutate(preference);
  };

  updateGuide = async (guide: Partial<UserGuide>) => {
    return lambdaClient.user.updateGuide.mutate(guide);
  };

  updateUserSettings = async (value: PartialDeep<UserSettings>, signal?: AbortSignal) => {
    return lambdaClient.user.updateSettings.mutate(value, { signal });
  };

  resetUserSettings = async () => {
    return lambdaClient.user.resetSettings.mutate();
  };
}

export const userService = new UserService();
