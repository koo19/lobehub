'use client';

import type {
  UserAgentOnboardingNode,
  UserAgentOnboardingQuestion,
  UserAgentOnboardingQuestionChoice,
  UserAgentOnboardingQuestionField,
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

interface QuestionRendererProps {
  currentQuestion: UserAgentOnboardingQuestion;
  onDismissNode?: (node: UserAgentOnboardingNode) => void;
}

const getChoiceMessage = (choice: UserAgentOnboardingQuestionChoice) => {
  if (choice.payload?.kind === 'message') {
    return choice.payload.message || choice.label || undefined;
  }

  if (choice.label) {
    return choice.label;
  }

  return undefined;
};

const resolveFieldAnswer = (
  field: UserAgentOnboardingQuestionField,
  value: FormValue | undefined,
) => {
  if (Array.isArray(value)) {
    const optionLabels = value
      .map((item) => field.options?.find((option) => option.value === item)?.label || item)
      .filter(Boolean);

    return optionLabels.length > 0 ? optionLabels.join(', ') : undefined;
  }

  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) return undefined;

  return (
    field.options?.find((option) => option.value === normalizedValue)?.label || normalizedValue
  );
};

const buildQuestionAnswerMessage = (
  fields: UserAgentOnboardingQuestionField[] | undefined,
  values: Record<string, FormValue>,
) => {
  const lines =
    fields
      ?.map((field) => {
        const answer = resolveFieldAnswer(field, values[field.key]);

        if (!answer) return undefined;

        return `Q: ${field.label}\nA: ${answer}`;
      })
      .filter((line): line is string => Boolean(line)) || [];

  return lines.length > 0 ? lines.join('\n\n') : undefined;
};

const renderFieldControl = (
  field: UserAgentOnboardingQuestionField,
  value: FormValue,
  onChange: (nextValue: FormValue) => void,
  onSubmit?: () => void,
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
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;

            event.preventDefault();
            onSubmit?.();
          }}
        />
      );
    }
  }
};

const QuestionHeader = memo<Pick<UserAgentOnboardingQuestion, 'description' | 'prompt'>>(
  ({ description, prompt }) => {
    if (!prompt && !description) return null;

    return (
      <Flexbox gap={4}>
        {prompt && <Text weight={'bold'}>{prompt}</Text>}
        {description && <Text type={'secondary'}>{description}</Text>}
      </Flexbox>
    );
  },
);

QuestionHeader.displayName = 'QuestionHeader';

const QuestionChoices = memo<{
  loading: boolean;
  onChoose: (choice: UserAgentOnboardingQuestionChoice) => Promise<void>;
  question: UserAgentOnboardingQuestion;
}>(({ loading, onChoose, question }) => (
  <Flexbox gap={12}>
    <QuestionHeader description={question.description} prompt={question.prompt} />
    <Flexbox horizontal gap={8} wrap={'wrap'}>
      {(question.choices || []).map((choice) => (
        <Button
          danger={choice.style === 'danger'}
          disabled={loading}
          key={choice.id}
          type={choice.style === 'primary' ? 'primary' : 'default'}
          onClick={() => void onChoose(choice)}
        >
          {choice.label}
        </Button>
      ))}
    </Flexbox>
  </Flexbox>
));

QuestionChoices.displayName = 'QuestionChoices';

const QuestionForm = memo<{
  loading: boolean;
  onDismissNode?: (node: UserAgentOnboardingNode) => void;
  question: UserAgentOnboardingQuestion;
}>(({ loading, onDismissNode, question }) => {
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        (question.fields || []).map((field) => [
          field.key,
          field.value ?? (field.kind === 'multiselect' ? [] : ''),
        ]),
      ) as Record<string, FormValue>,
    [question.fields],
  );
  const [values, setValues] = useState<Record<string, FormValue>>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const handleSubmit = async () => {
    const message = buildQuestionAnswerMessage(question.fields, values);

    if (!message) return;

    await sendMessage({
      message,
    });
    onDismissNode?.(question.node);
  };

  return (
    <Flexbox gap={12}>
      <QuestionHeader description={question.description} prompt={question.prompt} />
      {(question.fields || []).map((field) => (
        <Flexbox gap={6} key={field.key}>
          <Text type={'secondary'}>{field.label}</Text>
          {renderFieldControl(
            field,
            values[field.key] ?? '',
            (nextValue) => setValues((state) => ({ ...state, [field.key]: nextValue })),
            () => void handleSubmit(),
          )}
        </Flexbox>
      ))}
      <Button disabled={loading} type={'primary'} onClick={() => void handleSubmit()}>
        Submit
      </Button>
    </Flexbox>
  );
});

QuestionForm.displayName = 'QuestionForm';

const QuestionSelect = memo<{
  loading: boolean;
  onDismissNode?: (node: UserAgentOnboardingNode) => void;
  question: UserAgentOnboardingQuestion;
}>(({ loading, onDismissNode, question }) => {
  const { t } = useTranslation('onboarding');
  const switchLocale = useGlobalStore((s) => s.switchLocale);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const currentResponseLanguage = useUserStore(
    userGeneralSettingsSelectors.currentResponseLanguage,
  );
  const updateGeneralConfig = useUserStore((s) => s.updateGeneralConfig);
  const field = question.fields?.[0];
  const initialValue = (typeof field?.value === 'string' && field.value) || currentResponseLanguage;
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const options =
    field?.options ||
    (question.metadata?.optionsSource === 'clientLocaleOptions' ? localeOptions : []);

  const handleSubmit = async () => {
    const message = buildQuestionAnswerMessage(field ? [{ ...field, options }] : undefined, {
      [field?.key || 'responseLanguage']: value,
    });

    if (!message) return;

    await sendMessage({
      message,
    });
    onDismissNode?.(question.node);
  };

  return (
    <Flexbox gap={12}>
      <QuestionHeader description={question.description} prompt={question.prompt} />
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

QuestionSelect.displayName = 'QuestionSelect';

const QuestionInfo = memo<{
  loading: boolean;
  onDismissNode?: (node: UserAgentOnboardingNode) => void;
  question: UserAgentOnboardingQuestion;
}>(({ loading, onDismissNode, question }) => {
  const { t } = useTranslation('onboarding');
  const enableKlavis = useServerConfigStore(serverConfigSelectors.enableKlavis);
  const defaultAgentConfig = useUserStore(
    (s) => settingsSelectors.currentSettings(s).defaultAgent?.config,
  );
  const updateDefaultModel = useUserStore((s) => s.updateDefaultModel);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const modelConfig = isDev ? defaultAgentConfig : ONBOARDING_PRODUCTION_DEFAULT_MODEL;

  if (question.metadata?.recommendedSurface !== 'modelPicker') {
    return (
      <Flexbox gap={8}>
        <QuestionHeader description={question.description} prompt={question.prompt} />
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
    onDismissNode?.(question.node);
  };

  return (
    <Flexbox gap={16}>
      <QuestionHeader description={question.description} prompt={question.prompt} />
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

QuestionInfo.displayName = 'QuestionInfo';

const QuestionComposerPrefill = memo<{ question: UserAgentOnboardingQuestion }>(({ question }) => (
  <Flexbox gap={8}>
    <QuestionHeader description={question.description} prompt={question.prompt} />
  </Flexbox>
));

QuestionComposerPrefill.displayName = 'QuestionComposerPrefill';

const QuestionRenderer = memo<QuestionRendererProps>(({ currentQuestion, onDismissNode }) => {
  const loading = useConversationStore(messageStateSelectors.isInputLoading);
  const sendMessage = useConversationStore((s) => s.sendMessage);

  const handleChoice = async (choice: UserAgentOnboardingQuestionChoice) => {
    const message = getChoiceMessage(choice);

    if (message) {
      await sendMessage({ message });
      onDismissNode?.(currentQuestion.node);
    }
  };

  return (
    <Flexbox gap={16}>
      {currentQuestion.mode === 'button_group' && (
        <QuestionChoices loading={loading} question={currentQuestion} onChoose={handleChoice} />
      )}
      {currentQuestion.mode === 'form' && (
        <QuestionForm loading={loading} question={currentQuestion} onDismissNode={onDismissNode} />
      )}
      {currentQuestion.mode === 'select' && (
        <QuestionSelect
          loading={loading}
          question={currentQuestion}
          onDismissNode={onDismissNode}
        />
      )}
      {currentQuestion.mode === 'info' && (
        <QuestionInfo loading={loading} question={currentQuestion} onDismissNode={onDismissNode} />
      )}
      {currentQuestion.mode === 'composer_prefill' && (
        <QuestionComposerPrefill question={currentQuestion} />
      )}
    </Flexbox>
  );
});

QuestionRenderer.displayName = 'QuestionRenderer';

export default QuestionRenderer;
