'use client';

import {
  QuestionRenderer as BuiltinAgentQuestionRenderer,
  type QuestionRendererProps as BuiltinAgentQuestionRendererProps,
} from '@lobechat/builtin-agent-onboarding/client';
import type { UserAgentOnboardingNode, UserAgentOnboardingQuestion } from '@lobechat/types';
import { memo, useMemo } from 'react';
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

interface QuestionRendererProps {
  currentQuestion: UserAgentOnboardingQuestion;
  onDismissNode?: (node: UserAgentOnboardingNode) => void;
}

const QuestionRenderer = memo<QuestionRendererProps>(({ currentQuestion, onDismissNode }) => {
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
  const resolvedQuestion = useMemo<UserAgentOnboardingQuestion>(() => {
    if (
      currentQuestion.mode !== 'button_group' ||
      (currentQuestion.choices && currentQuestion.choices.length > 0)
    ) {
      return currentQuestion;
    }

    return {
      ...currentQuestion,
      description: currentQuestion.description ?? t('agent.telemetryHint'),
      fields: [
        {
          key: 'answer',
          kind: 'text',
          label: t('agent.telemetryHint'),
          placeholder: t('agent.telemetryHint'),
        },
      ],
      mode: 'form',
    };
  }, [currentQuestion, t]);

  const props: BuiltinAgentQuestionRendererProps = {
    currentQuestion: resolvedQuestion,
    currentResponseLanguage,
    defaultModelConfig,
    enableKlavis,
    fixedModelLabel: t('proSettings.model.fixed', {
      model: ONBOARDING_PRODUCTION_DEFAULT_MODEL.model,
      provider: ONBOARDING_PRODUCTION_DEFAULT_MODEL.provider,
    }),
    isDev,
    loading,
    nextLabel: t('next'),
    onBeforeInfoContinue: async () => {
      if (!isDev) {
        await updateDefaultModel(
          ONBOARDING_PRODUCTION_DEFAULT_MODEL.model,
          ONBOARDING_PRODUCTION_DEFAULT_MODEL.provider,
        );
      }
    },
    onChangeDefaultModel: (model, provider) => {
      void updateDefaultModel(model, provider);
    },
    onChangeResponseLanguage: (value) => {
      switchLocale(value as LocaleMode);
      void updateGeneralConfig({ responseLanguage: value });
    },
    onDismissNode,
    onSendMessage: async (message) => {
      await sendMessage({ message });
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
    submitLabel: t('next'),
  };

  return <BuiltinAgentQuestionRenderer {...props} />;
});

QuestionRenderer.displayName = 'QuestionRenderer';

export default QuestionRenderer;
