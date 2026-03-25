'use client';

import type { BuiltinInterventionProps } from '@lobechat/types';
import { Flexbox, Text } from '@lobehub/ui';
import { Button, Input, Select } from 'antd';
import { memo, useCallback, useState } from 'react';

import type { AskUserQuestionArgs, InteractionField } from '../../../types';

const FieldInput = memo<{
  field: InteractionField;
  onChange: (key: string, value: string | string[]) => void;
  value?: string | string[];
}>(({ field, value, onChange }) => {
  switch (field.kind) {
    case 'textarea': {
      return (
        <Input.TextArea
          autoSize={{ maxRows: 6, minRows: 2 }}
          placeholder={field.placeholder}
          value={value as string}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
    }
    case 'select': {
      return (
        <Select
          options={field.options?.map((o) => ({ label: o.label, value: o.value }))}
          placeholder={field.placeholder}
          style={{ width: '100%' }}
          value={value as string}
          onChange={(v) => onChange(field.key, v)}
        />
      );
    }
    case 'multiselect': {
      return (
        <Select
          mode="multiple"
          options={field.options?.map((o) => ({ label: o.label, value: o.value }))}
          placeholder={field.placeholder}
          style={{ width: '100%' }}
          value={value as string[]}
          onChange={(v) => onChange(field.key, v)}
        />
      );
    }
    default: {
      return (
        <Input
          placeholder={field.placeholder}
          value={value as string}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
    }
  }
});

const AskUserQuestionIntervention = memo<BuiltinInterventionProps<AskUserQuestionArgs>>(
  ({ args, interactionMode, onInteractionAction }) => {
    const { question } = args;
    const isCustom = interactionMode === 'custom';

    const initialValues: Record<string, string | string[]> = {};
    if (question.fields) {
      for (const field of question.fields) {
        if (field.value !== undefined) initialValues[field.key] = field.value;
      }
    }

    const [formData, setFormData] = useState<Record<string, string | string[]>>(initialValues);
    const [submitting, setSubmitting] = useState(false);

    const handleFieldChange = useCallback((key: string, value: string | string[]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSubmit = useCallback(async () => {
      if (!onInteractionAction) return;
      setSubmitting(true);
      try {
        await onInteractionAction({ payload: formData, type: 'submit' });
      } finally {
        setSubmitting(false);
      }
    }, [formData, onInteractionAction]);

    const handleSkip = useCallback(async () => {
      if (!onInteractionAction) return;
      await onInteractionAction({ type: 'skip' });
    }, [onInteractionAction]);

    const isSubmitDisabled = question.fields?.some((f) => f.required && !formData[f.key]) ?? false;

    if (!isCustom) {
      return (
        <Flexbox gap={8}>
          <Text>{question.prompt}</Text>
          {question.fields && question.fields.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {question.fields.map((field) => (
                <li key={field.key}>
                  {field.label}
                  {field.required && ' *'}
                </li>
              ))}
            </ul>
          )}
        </Flexbox>
      );
    }

    return (
      <Flexbox gap={12}>
        <Text style={{ fontWeight: 500 }}>{question.prompt}</Text>
        {question.description && (
          <Text style={{ fontSize: 13 }} type="secondary">
            {question.description}
          </Text>
        )}
        {question.fields && question.fields.length > 0 && (
          <Flexbox gap={8}>
            {question.fields.map((field) => (
              <Flexbox gap={4} key={field.key}>
                <Text style={{ fontSize: 13 }}>
                  {field.label}
                  {field.required && <span style={{ color: 'red' }}> *</span>}
                </Text>
                <FieldInput
                  field={field}
                  value={formData[field.key]}
                  onChange={handleFieldChange}
                />
              </Flexbox>
            ))}
          </Flexbox>
        )}
        <Flexbox horizontal gap={8} justify="flex-end">
          <Button onClick={handleSkip}>Skip</Button>
          <Button
            disabled={isSubmitDisabled}
            loading={submitting}
            type="primary"
            onClick={handleSubmit}
          >
            Submit
          </Button>
        </Flexbox>
      </Flexbox>
    );
  },
);

AskUserQuestionIntervention.displayName = 'AskUserQuestionIntervention';

export default AskUserQuestionIntervention;
