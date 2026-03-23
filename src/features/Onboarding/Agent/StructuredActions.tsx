'use client';

import { Button, Flexbox, Select, Text } from '@lobehub/ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ONBOARDING_PRODUCTION_DEFAULT_MODEL } from '@/const/onboarding';
import { useConversationStore } from '@/features/Conversation';
import { messageStateSelectors } from '@/features/Conversation/store';
import ModelSelect from '@/features/ModelSelect';
import { localeOptions, normalizeLocale } from '@/locales/resources';
import KlavisServerList from '@/routes/onboarding/components/KlavisServerList';
import { useGlobalStore } from '@/store/global';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';
import { isDev } from '@/utils/env';

const ResponseLanguageActions = memo(() => {
  const { t } = useTranslation('onboarding');
  const switchLocale = useGlobalStore((s) => s.switchLocale);
  const responseLanguage = useUserStore(
    (s) => settingsSelectors.currentSettings(s).general?.responseLanguage,
  );
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const loading = useConversationStore(messageStateSelectors.isInputLoading);
  const [value, setValue] = useState(() => responseLanguage || normalizeLocale(navigator.language));

  return (
    <Flexbox gap={12}>
      <Select
        options={localeOptions}
        size={'large'}
        style={{ width: '100%' }}
        value={value}
        onChange={(nextValue) => {
          switchLocale(nextValue);
          setValue(nextValue);
        }}
      />
      <Button
        disabled={loading}
        type={'primary'}
        onClick={() =>
          sendMessage({
            message: `Set my default response language to ${value || 'auto'}.`,
          })
        }
      >
        {t('next')}
      </Button>
    </Flexbox>
  );
});

ResponseLanguageActions.displayName = 'ResponseLanguageActions';

const ProSettingsActions = memo(() => {
  const { t } = useTranslation('onboarding');
  const enableKlavis = useServerConfigStore(serverConfigSelectors.enableKlavis);
  const defaultAgentConfig = useUserStore(
    (s) => settingsSelectors.currentSettings(s).defaultAgent?.config,
  );
  const updateDefaultModel = useUserStore((s) => s.updateDefaultModel);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const loading = useConversationStore(messageStateSelectors.isInputLoading);
  const modelConfig = isDev ? defaultAgentConfig : ONBOARDING_PRODUCTION_DEFAULT_MODEL;

  const handleContinue = async () => {
    if (!isDev) {
      await updateDefaultModel(
        ONBOARDING_PRODUCTION_DEFAULT_MODEL.model,
        ONBOARDING_PRODUCTION_DEFAULT_MODEL.provider,
      );
    }

    await sendMessage({
      message:
        modelConfig?.model && modelConfig.provider
          ? `I am done with advanced setup. Keep my default model as ${modelConfig.provider}/${modelConfig.model}.`
          : 'I am done with advanced setup.',
    });
  };

  return (
    <Flexbox gap={16}>
      {isDev ? (
        <ModelSelect
          showAbility={false}
          size={'large'}
          style={{ width: '100%' }}
          value={defaultAgentConfig}
          onChange={({ model, provider }) => {
            updateDefaultModel(model, provider);
          }}
        />
      ) : (
        <Text type={'secondary'}>
          {t('proSettings.model.fixed', {
            model: ONBOARDING_PRODUCTION_DEFAULT_MODEL.model,
            provider: ONBOARDING_PRODUCTION_DEFAULT_MODEL.provider,
          })}
        </Text>
      )}
      {enableKlavis && <KlavisServerList />}
      <Button disabled={loading} type={'primary'} onClick={handleContinue}>
        {t('next')}
      </Button>
    </Flexbox>
  );
});

ProSettingsActions.displayName = 'ProSettingsActions';

const SummaryActions = memo(() => {
  const { t } = useTranslation('onboarding');
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const loading = useConversationStore(messageStateSelectors.isInputLoading);

  return (
    <Flexbox gap={12}>
      <Text type={'secondary'}>{t('agent.summaryHint')}</Text>
      <Button
        disabled={loading}
        type={'primary'}
        onClick={() => sendMessage({ message: 'Looks good. Finish onboarding.' })}
      >
        {t('finish')}
      </Button>
    </Flexbox>
  );
});

SummaryActions.displayName = 'SummaryActions';

interface StructuredActionsProps {
  currentNode?: string;
}

const StructuredActions = memo<StructuredActionsProps>(({ currentNode }) => {
  switch (currentNode) {
    case 'responseLanguage': {
      return <ResponseLanguageActions />;
    }
    case 'proSettings': {
      return <ProSettingsActions />;
    }
    case 'summary': {
      return <SummaryActions />;
    }
    default: {
      return null;
    }
  }
});

StructuredActions.displayName = 'StructuredActions';

export default StructuredActions;
