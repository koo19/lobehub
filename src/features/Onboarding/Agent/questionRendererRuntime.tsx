'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import EmojiPicker from '@/components/EmojiPicker';
import { useConversationStore } from '@/features/Conversation';
import { messageStateSelectors } from '@/features/Conversation/store';
import ModelSelect from '@/features/ModelSelect';
import { localeOptions } from '@/locales/resources';
import KlavisServerList from '@/routes/onboarding/components/KlavisServerList';
import { useGlobalStore } from '@/store/global';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { settingsSelectors, userGeneralSettingsSelectors } from '@/store/user/selectors';
import { type LocaleMode } from '@/types/locale';
import { isDev } from '@/utils/env';

import { ONBOARDING_PRODUCTION_DEFAULT_MODEL } from '../../../const/onboarding';
import type { QuestionRendererViewProps } from './QuestionRendererView';

export interface QuestionRendererRuntimeProps extends Omit<
  QuestionRendererViewProps,
  'currentQuestion' | 'onDismissNode'
> {}

export const useQuestionRendererRuntime = (): QuestionRendererRuntimeProps => {
  const { t } = useTranslation('onboarding');
  const loading = useConversationStore(messageStateSelectors.isInputLoading);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const switchLocale = useGlobalStore((s) => s.switchLocale);
  const enableKlavis = useServerConfigStore(serverConfigSelectors.enableKlavis);
  const currentResponseLanguage = useUserStore(
    userGeneralSettingsSelectors.currentResponseLanguage,
  );
  const updateGeneralConfig = useUserStore((s) => s.updateGeneralConfig);
  const defaultAgentConfig = useUserStore(
    (s) => settingsSelectors.currentSettings(s).defaultAgent?.config,
  );
  const updateDefaultModel = useUserStore((s) => s.updateDefaultModel);

  const defaultModelConfig = isDev ? defaultAgentConfig : ONBOARDING_PRODUCTION_DEFAULT_MODEL;
  const telemetryHint = t('agent.telemetryHint');
  const nextLabel = t('next');

  return useMemo(
    () => ({
      currentResponseLanguage,
      defaultModelConfig,
      enableKlavis,
      fallbackQuestionDescription: telemetryHint,
      fallbackTextFieldLabel: telemetryHint,
      fallbackTextFieldPlaceholder: telemetryHint,
      fixedModelLabel: t('proSettings.model.fixed', {
        model: ONBOARDING_PRODUCTION_DEFAULT_MODEL.model,
        provider: ONBOARDING_PRODUCTION_DEFAULT_MODEL.provider,
      }),
      isDev,
      loading,
      nextLabel,
      onBeforeInfoContinue: async () => {
        if (!isDev) {
          await updateDefaultModel(
            ONBOARDING_PRODUCTION_DEFAULT_MODEL.model,
            ONBOARDING_PRODUCTION_DEFAULT_MODEL.provider,
          );
        }
      },
      onChangeDefaultModel: (model: string, provider: string) => {
        void updateDefaultModel(model, provider);
      },
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
      renderKlavisList: () => <KlavisServerList />,
      renderModelSelect: ({ onChange, value }) => (
        <ModelSelect
          showAbility={false}
          size={'large'}
          style={{ width: '100%' }}
          value={
            value?.model
              ? {
                  model: value.model,
                  ...(value.provider ? { provider: value.provider } : {}),
                }
              : undefined
          }
          onChange={onChange}
        />
      ),
      responseLanguageOptions: localeOptions,
      submitLabel: nextLabel,
    }),
    [
      currentResponseLanguage,
      defaultModelConfig,
      enableKlavis,
      loading,
      nextLabel,
      sendMessage,
      switchLocale,
      t,
      telemetryHint,
      updateDefaultModel,
      updateGeneralConfig,
    ],
  );
};
