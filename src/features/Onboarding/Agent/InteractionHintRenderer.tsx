'use client';

import type {
  UserAgentOnboardingDraft,
  UserAgentOnboardingInteractionAction,
  UserAgentOnboardingInteractionField,
  UserAgentOnboardingInteractionHint,
  UserAgentOnboardingNode,
  UserAgentOnboardingUpdate,
} from '@lobechat/types';
import { Button, Flexbox, Input, Select, Text } from '@lobehub/ui';
import { Input as AntdInput } from 'antd';
import { type ChangeEvent, memo, useEffect, useMemo, useState } from 'react';
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
import { isDev } from '@/utils/env';

import { ONBOARDING_PRODUCTION_DEFAULT_MODEL } from '../../../const/onboarding';

type FormValue = string | string[];

interface InteractionHintRendererProps {
  interactionHints: UserAgentOnboardingInteractionHint[];
  onDismissNode?: (node: UserAgentOnboardingNode) => void;
  onSubmitUpdates?: (updates: UserAgentOnboardingUpdate[]) => Promise<void>;
}

const getActionMessage = (
  action: UserAgentOnboardingInteractionAction,
  hint: UserAgentOnboardingInteractionHint,
) => {
  if (action.payload?.kind === 'message') {
    return action.payload.message || action.label || undefined;
  }

  if (hint.submitMode === 'message' && action.label) {
    return action.label;
  }

  return undefined;
};

const buildPatchFromFields = (
  node: UserAgentOnboardingNode,
  values: Record<string, FormValue>,
): UserAgentOnboardingDraft | undefined => {
  switch (node) {
    case 'agentIdentity': {
      return {
        agentIdentity: {
          emoji: String(values.emoji || ''),
          name: String(values.name || ''),
          nature: String(values.nature || ''),
          vibe: String(values.vibe || ''),
        },
      };
    }
    case 'userIdentity': {
      return {
        userIdentity: {
          domainExpertise: String(values.domainExpertise || ''),
          name: String(values.name || ''),
          professionalRole: String(values.professionalRole || ''),
          summary: String(values.summary || ''),
        },
      };
    }
    case 'workStyle': {
      return {
        workStyle: {
          communicationStyle: String(values.communicationStyle || ''),
          decisionMaking: String(values.decisionMaking || ''),
          socialMode: String(values.socialMode || ''),
          summary: String(values.summary || ''),
          thinkingPreferences: String(values.thinkingPreferences || ''),
          workStyle: String(values.workStyle || ''),
        },
      };
    }
    case 'workContext': {
      return {
        workContext: {
          activeProjects: Array.isArray(values.activeProjects) ? values.activeProjects : undefined,
          currentFocus: String(values.currentFocus || ''),
          interests: Array.isArray(values.interests) ? values.interests : undefined,
          summary: String(values.summary || ''),
          thisQuarter: String(values.thisQuarter || ''),
          thisWeek: String(values.thisWeek || ''),
          tools: Array.isArray(values.tools) ? values.tools : undefined,
        },
      };
    }
    case 'painPoints': {
      return {
        painPoints: {
          blockedBy: Array.isArray(values.blockedBy) ? values.blockedBy : undefined,
          frustrations: Array.isArray(values.frustrations) ? values.frustrations : undefined,
          noTimeFor: Array.isArray(values.noTimeFor) ? values.noTimeFor : undefined,
          summary: String(values.summary || ''),
        },
      };
    }
    case 'responseLanguage': {
      return {
        responseLanguage: String(values.responseLanguage || ''),
      };
    }
    case 'proSettings': {
      return undefined;
    }
    case 'summary': {
      return undefined;
    }
  }
};

const renderFieldControl = (
  field: UserAgentOnboardingInteractionField,
  value: FormValue,
  onChange: (nextValue: FormValue) => void,
) => {
  switch (field.kind) {
    case 'emoji': {
      return (
        <EmojiPicker
          value={typeof value === 'string' ? value || undefined : undefined}
          onChange={(emoji) => onChange(emoji || '')}
        />
      );
    }
    case 'multiselect': {
      return (
        <Select
          mode={'multiple'}
          options={field.options}
          placeholder={field.placeholder}
          value={Array.isArray(value) ? value : []}
          onChange={(nextValue) => onChange(nextValue)}
        />
      );
    }
    case 'select': {
      return (
        <Select
          options={field.options}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : undefined}
          onChange={(nextValue) => onChange(nextValue)}
        />
      );
    }
    case 'textarea': {
      return (
        <AntdInput.TextArea
          placeholder={field.placeholder}
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        />
      );
    }
    case 'text': {
      return (
        <Input
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }
  }
};

const HintHeader = memo<Pick<UserAgentOnboardingInteractionHint, 'description' | 'title'>>(
  ({ description, title }) => {
    if (!title && !description) return null;

    return (
      <Flexbox gap={4}>
        {title && <Text weight={'bold'}>{title}</Text>}
        {description && <Text type={'secondary'}>{description}</Text>}
      </Flexbox>
    );
  },
);

HintHeader.displayName = 'HintHeader';

const HintButtonGroup = memo<{
  hint: UserAgentOnboardingInteractionHint;
  loading: boolean;
  onAction: (
    action: UserAgentOnboardingInteractionAction,
    hint: UserAgentOnboardingInteractionHint,
  ) => Promise<void>;
}>(({ hint, loading, onAction }) => (
  <Flexbox gap={12}>
    <HintHeader description={hint.description} title={hint.title} />
    <Flexbox horizontal gap={8} wrap={'wrap'}>
      {(hint.actions || []).map((action) => (
        <Button
          danger={action.style === 'danger'}
          disabled={loading}
          key={action.id}
          type={action.style === 'primary' ? 'primary' : 'default'}
          onClick={() => void onAction(action, hint)}
        >
          {action.label}
        </Button>
      ))}
    </Flexbox>
  </Flexbox>
));

HintButtonGroup.displayName = 'HintButtonGroup';

const HintForm = memo<{
  hint: UserAgentOnboardingInteractionHint;
  loading: boolean;
  onDismissNode?: (node: UserAgentOnboardingNode) => void;
  onSubmitUpdates?: (updates: UserAgentOnboardingUpdate[]) => Promise<void>;
}>(({ hint, loading, onDismissNode, onSubmitUpdates }) => {
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        (hint.fields || []).map((field) => [
          field.key,
          field.value ?? (field.kind === 'multiselect' ? [] : ''),
        ]),
      ) as Record<string, FormValue>,
    [hint.fields],
  );
  const [values, setValues] = useState<Record<string, FormValue>>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const handleSubmit = async () => {
    const patch = buildPatchFromFields(hint.node, values);

    if (!patch) return;

    if (hint.submitMode === 'tool' && onSubmitUpdates) {
      await onSubmitUpdates([{ node: hint.node, patch }]);
      onDismissNode?.(hint.node);
      return;
    }

    await sendMessage({
      message: JSON.stringify({ node: hint.node, patch }),
    });
    onDismissNode?.(hint.node);
  };

  return (
    <Flexbox gap={12}>
      <HintHeader description={hint.description} title={hint.title} />
      {(hint.fields || []).map((field) => (
        <Flexbox gap={6} key={field.key}>
          <Text type={'secondary'}>{field.label}</Text>
          {renderFieldControl(field, values[field.key] ?? '', (nextValue) =>
            setValues((state) => ({ ...state, [field.key]: nextValue })),
          )}
        </Flexbox>
      ))}
      <Button disabled={loading} type={'primary'} onClick={() => void handleSubmit()}>
        Submit
      </Button>
    </Flexbox>
  );
});

HintForm.displayName = 'HintForm';

const HintSelect = memo<{
  hint: UserAgentOnboardingInteractionHint;
  loading: boolean;
  onDismissNode?: (node: UserAgentOnboardingNode) => void;
  onSubmitUpdates?: (updates: UserAgentOnboardingUpdate[]) => Promise<void>;
}>(({ hint, loading, onDismissNode, onSubmitUpdates }) => {
  const { t } = useTranslation('onboarding');
  const switchLocale = useGlobalStore((s) => s.switchLocale);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const currentResponseLanguage = useUserStore(
    userGeneralSettingsSelectors.currentResponseLanguage,
  );
  const updateGeneralConfig = useUserStore((s) => s.updateGeneralConfig);
  const field = hint.fields?.[0];
  const initialValue = (typeof field?.value === 'string' && field.value) || currentResponseLanguage;
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const options =
    field?.options || (hint.metadata?.optionsSource === 'clientLocaleOptions' ? localeOptions : []);

  const handleSubmit = async () => {
    if (hint.submitMode === 'tool' && onSubmitUpdates) {
      await onSubmitUpdates([
        {
          node: hint.node,
          patch: {
            responseLanguage: value,
          },
        },
      ]);
      onDismissNode?.(hint.node);
      return;
    }

    await sendMessage({
      message: `Set my default response language to ${value || 'auto'}.`,
    });
    onDismissNode?.(hint.node);
  };

  return (
    <Flexbox gap={12}>
      <HintHeader description={hint.description} title={hint.title} />
      <Select
        options={options}
        size={'large'}
        style={{ width: '100%' }}
        value={value}
        onChange={(nextValue) => {
          switchLocale(nextValue);
          setValue(nextValue);
          void updateGeneralConfig({ responseLanguage: nextValue });
        }}
      />
      <Button disabled={loading} type={'primary'} onClick={() => void handleSubmit()}>
        {t('next')}
      </Button>
    </Flexbox>
  );
});

HintSelect.displayName = 'HintSelect';

const HintInfo = memo<{
  hint: UserAgentOnboardingInteractionHint;
  loading: boolean;
  onDismissNode?: (node: UserAgentOnboardingNode) => void;
}>(({ hint, loading, onDismissNode }) => {
  const { t } = useTranslation('onboarding');
  const enableKlavis = useServerConfigStore(serverConfigSelectors.enableKlavis);
  const defaultAgentConfig = useUserStore(
    (s) => settingsSelectors.currentSettings(s).defaultAgent?.config,
  );
  const updateDefaultModel = useUserStore((s) => s.updateDefaultModel);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const modelConfig = isDev ? defaultAgentConfig : ONBOARDING_PRODUCTION_DEFAULT_MODEL;

  if (hint.metadata?.recommendedSurface !== 'modelPicker') {
    return (
      <Flexbox gap={8}>
        <HintHeader description={hint.description} title={hint.title} />
      </Flexbox>
    );
  }

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
    onDismissNode?.(hint.node);
  };

  return (
    <Flexbox gap={16}>
      <HintHeader description={hint.description} title={hint.title} />
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
      <Button disabled={loading} type={'primary'} onClick={() => void handleContinue()}>
        {t('next')}
      </Button>
    </Flexbox>
  );
});

HintInfo.displayName = 'HintInfo';

const HintComposerPrefill = memo<{ hint: UserAgentOnboardingInteractionHint }>(({ hint }) => (
  <Flexbox gap={8}>
    <HintHeader description={hint.description} title={hint.title} />
  </Flexbox>
));

HintComposerPrefill.displayName = 'HintComposerPrefill';

const InteractionHintRenderer = memo<InteractionHintRendererProps>(
  ({ interactionHints, onDismissNode, onSubmitUpdates }) => {
    const loading = useConversationStore(messageStateSelectors.isInputLoading);
    const sendMessage = useConversationStore((s) => s.sendMessage);

    const handleAction = async (
      action: UserAgentOnboardingInteractionAction,
      hint: UserAgentOnboardingInteractionHint,
    ) => {
      if (action.payload?.kind === 'patch' && action.payload.patch && onSubmitUpdates) {
        await onSubmitUpdates([
          {
            node: action.payload.targetNode || hint.node,
            patch: action.payload.patch,
          },
        ]);
        onDismissNode?.(hint.node);
        return;
      }

      const message = getActionMessage(action, hint);

      if (message) {
        await sendMessage({ message });
        onDismissNode?.(hint.node);
      }
    };

    return (
      <Flexbox gap={16}>
        {interactionHints.map((hint) => {
          switch (hint.kind) {
            case 'button_group': {
              return (
                <HintButtonGroup
                  hint={hint}
                  key={hint.id}
                  loading={loading}
                  onAction={handleAction}
                />
              );
            }
            case 'form': {
              return (
                <HintForm
                  hint={hint}
                  key={hint.id}
                  loading={loading}
                  onDismissNode={onDismissNode}
                  onSubmitUpdates={onSubmitUpdates}
                />
              );
            }
            case 'select': {
              return (
                <HintSelect
                  hint={hint}
                  key={hint.id}
                  loading={loading}
                  onDismissNode={onDismissNode}
                  onSubmitUpdates={onSubmitUpdates}
                />
              );
            }
            case 'info': {
              return (
                <HintInfo
                  hint={hint}
                  key={hint.id}
                  loading={loading}
                  onDismissNode={onDismissNode}
                />
              );
            }
            case 'composer_prefill': {
              return <HintComposerPrefill hint={hint} key={hint.id} />;
            }
          }
        })}
      </Flexbox>
    );
  },
);

InteractionHintRenderer.displayName = 'InteractionHintRenderer';

export default InteractionHintRenderer;
