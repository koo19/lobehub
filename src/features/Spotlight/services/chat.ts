import { lambdaClient } from '@/libs/trpc/client';
import { chatService } from '@/services/chat';

interface SendSpotlightMessageParams {
  abortController: AbortController;
  agentId: string;
  content: string;
  groupId?: string;
  model: string;
  onContentUpdate: (content: string) => void;
  onError: (error: Error) => void;
  onFinish: () => void;
  provider: string;
  topicId?: string;
}

interface SendSpotlightMessageResult {
  assistantMessageId: string;
  topicId: string;
  userMessageId: string;
}

export const sendSpotlightMessage = async (
  params: SendSpotlightMessageParams,
): Promise<SendSpotlightMessageResult | null> => {
  const {
    content,
    agentId,
    groupId,
    topicId,
    model,
    provider,
    abortController,
    onContentUpdate,
    onError,
    onFinish,
  } = params;

  try {
    // Step 1: Create topic + messages atomically via TRPC
    const serverResult = await lambdaClient.aiChat.sendMessageInServer.mutate(
      {
        agentId,
        groupId,
        newAssistantMessage: { model, provider },
        newTopic: topicId ? undefined : { title: content.slice(0, 50), topicMessageIds: [] },
        newUserMessage: { content },
        topicId,
      },
      {
        context: { showNotification: false },
        signal: abortController.signal,
      },
    );

    if (!serverResult) {
      onError(new Error('Failed to create messages'));
      return null;
    }

    const resolvedTopicId = serverResult.topicId || topicId || '';

    // Step 2: Stream AI response
    let accumulatedContent = '';

    await chatService.createAssistantMessageStream({
      abortController,
      onErrorHandle: (error: any) => {
        onError(new Error(typeof error === 'string' ? error : error?.message || 'Stream error'));
      },
      onFinish: async () => {
        onFinish();
      },
      onMessageHandle: (chunk: any) => {
        if (chunk.type === 'text') {
          accumulatedContent += chunk.text;
          onContentUpdate(accumulatedContent);
        }
      },
      params: {
        agentId,
        groupId,
        messages: [{ content, role: 'user' }] as any,
        model,
        provider,
        resolvedAgentConfig: { model, params: {}, provider } as any,
        topicId: resolvedTopicId,
      },
    });

    return {
      assistantMessageId: serverResult.assistantMessageId,
      topicId: resolvedTopicId,
      userMessageId: serverResult.userMessageId,
    };
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return null;
  }
};
