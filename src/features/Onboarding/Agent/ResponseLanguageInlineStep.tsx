'use client';

import type { UserAgentOnboardingQuestion } from '@lobechat/types';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

import { useQuestionRendererRuntime } from './questionRendererRuntime';
import QuestionRendererView from './QuestionRendererView';

const ResponseLanguageInlineStep = memo(() => {
  const { t } = useTranslation('onboarding');
  const runtime = useQuestionRendererRuntime();
  const currentResponseLanguage = useUserStore(
    userGeneralSettingsSelectors.currentResponseLanguage,
  );

  const currentQuestion = useMemo<UserAgentOnboardingQuestion>(
    () => ({
      description: t('responseLanguage.desc'),
      fields: [
        {
          key: 'responseLanguage',
          kind: 'select',
          label: t('agent.stage.responseLanguage'),
          value: currentResponseLanguage,
        },
      ],
      id: 'builtin-response-language',
      mode: 'select',
      node: 'responseLanguage',
      prompt: t('responseLanguage.title'),
      submitMode: 'message',
    }),
    [currentResponseLanguage, t],
  );

  return <QuestionRendererView currentQuestion={currentQuestion} {...runtime} />;
});

ResponseLanguageInlineStep.displayName = 'ResponseLanguageInlineStep';

export default ResponseLanguageInlineStep;
