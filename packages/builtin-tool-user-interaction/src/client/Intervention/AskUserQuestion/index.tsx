'use client';

import type { BuiltinInterventionProps } from '@lobechat/types';
import { memo } from 'react';

import type { AskUserQuestionArgs } from '../../../types';

const AskUserQuestionIntervention = memo<BuiltinInterventionProps<AskUserQuestionArgs>>(
  ({ args }) => {
    const { question } = args;

    return (
      <div>
        <p>{question.prompt}</p>
        {question.description && (
          <p style={{ color: 'var(--lobe-text-secondary)', fontSize: 13 }}>
            {question.description}
          </p>
        )}
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
      </div>
    );
  },
);

AskUserQuestionIntervention.displayName = 'AskUserQuestionIntervention';

export default AskUserQuestionIntervention;
