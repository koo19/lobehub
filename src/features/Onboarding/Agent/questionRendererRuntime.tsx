'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import EmojiPicker from '@/components/EmojiPicker';
import { useConversationStore } from '@/features/Conversation';
import { messageStateSelectors } from '@/features/Conversation/store';
import { localeOptions } from '@/locales/resources';
import { useGlobalStore } from '@/store/global';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';
import { type LocaleMode } from '@/types/locale';

import type { QuestionRendererViewProps } from './QuestionRendererView';

export interface QuestionRendererRuntimeProps extends Omit<
  QuestionRendererViewProps,
  'currentQuestion'
> {}

export const useQuestionRendererRuntime = (): QuestionRendererRuntimeProps => {
  const { t } = useTranslation('onboarding');
  const loading = useConversationStore(messageStateSelectors.isInputLoading);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const switchLocale = useGlobalStore((s) => s.switchLocale);
  const currentResponseLanguage = useUserStore(
    userGeneralSettingsSelectors.currentResponseLanguage,
  );
  const updateGeneralConfig = useUserStore((s) => s.updateGeneralConfig);
  const telemetryHint = t('agent.telemetryHint');
  const nextLabel = t('next');

  return useMemo(
    () => ({
      currentResponseLanguage,
      fallbackQuestionDescription: telemetryHint,
      fallbackTextFieldLabel: telemetryHint,
      fallbackTextFieldPlaceholder: telemetryHint,
      loading,
      nextLabel,
      onChangeResponseLanguage: (value: string) => {
        switchLocale(value as LocaleMode);
        void updateGeneralConfig({ responseLanguage: value });
      },
      onSendMessage: async (message: string) => {
        // Dismiss the inline onboarding widget immediately after dispatch.
        // The full chat send lifecycle also awaits runtime streaming, which is too late
        // for this UI pattern because the question should disappear once submitted.
        void sendMessage({ message }).catch(console.error);
      },
      renderEmojiPicker: ({ onChange, value }) => <EmojiPicker value={value} onChange={onChange} />,
      responseLanguageOptions: localeOptions,
      submitLabel: nextLabel,
    }),
    [
      currentResponseLanguage,
      loading,
      nextLabel,
      sendMessage,
      switchLocale,
      telemetryHint,
      updateGeneralConfig,
    ],
  );
};
