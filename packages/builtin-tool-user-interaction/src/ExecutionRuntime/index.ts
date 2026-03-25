import type { BuiltinServerRuntimeOutput } from '@lobechat/types';

import type {
  AskUserQuestionArgs,
  CancelUserResponseArgs,
  GetInteractionStateArgs,
  InteractionState,
  SkipUserResponseArgs,
  SubmitUserResponseArgs,
} from '../types';

export class UserInteractionExecutionRuntime {
  private interactions: Map<string, InteractionState> = new Map();

  async askUserQuestion(args: AskUserQuestionArgs): Promise<BuiltinServerRuntimeOutput> {
    const { question } = args;
    const requestId = question.id;

    const state: InteractionState = {
      question,
      requestId,
      status: 'pending',
    };

    this.interactions.set(requestId, state);

    return {
      content: `Question "${question.prompt}" is now pending user response.`,
      state,
      success: true,
    };
  }

  async submitUserResponse(args: SubmitUserResponseArgs): Promise<BuiltinServerRuntimeOutput> {
    const { requestId, response } = args;
    const state = this.interactions.get(requestId);

    if (!state) {
      return { content: `Interaction not found: ${requestId}`, success: false };
    }

    if (state.status !== 'pending') {
      return {
        content: `Interaction ${requestId} is already ${state.status}, cannot submit.`,
        success: false,
      };
    }

    state.status = 'submitted';
    state.response = response;
    this.interactions.set(requestId, state);

    return {
      content: `User response submitted for interaction ${requestId}.`,
      state,
      success: true,
    };
  }

  async skipUserResponse(args: SkipUserResponseArgs): Promise<BuiltinServerRuntimeOutput> {
    const { requestId, reason } = args;
    const state = this.interactions.get(requestId);

    if (!state) {
      return { content: `Interaction not found: ${requestId}`, success: false };
    }

    if (state.status !== 'pending') {
      return {
        content: `Interaction ${requestId} is already ${state.status}, cannot skip.`,
        success: false,
      };
    }

    state.status = 'skipped';
    state.skipReason = reason;
    this.interactions.set(requestId, state);

    return {
      content: `Interaction ${requestId} skipped.${reason ? ` Reason: ${reason}` : ''}`,
      state,
      success: true,
    };
  }

  async cancelUserResponse(args: CancelUserResponseArgs): Promise<BuiltinServerRuntimeOutput> {
    const { requestId } = args;
    const state = this.interactions.get(requestId);

    if (!state) {
      return { content: `Interaction not found: ${requestId}`, success: false };
    }

    if (state.status !== 'pending') {
      return {
        content: `Interaction ${requestId} is already ${state.status}, cannot cancel.`,
        success: false,
      };
    }

    state.status = 'cancelled';
    this.interactions.set(requestId, state);

    return {
      content: `Interaction ${requestId} cancelled.`,
      state,
      success: true,
    };
  }

  async getInteractionState(args: GetInteractionStateArgs): Promise<BuiltinServerRuntimeOutput> {
    const { requestId } = args;
    const state = this.interactions.get(requestId);

    if (!state) {
      return { content: `Interaction not found: ${requestId}`, success: false };
    }

    return {
      content: `Interaction ${requestId} is ${state.status}.`,
      state,
      success: true,
    };
  }
}
