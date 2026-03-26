import { describe, expect, it } from 'vitest';

import {
  createWebOnboardingToolResult,
  formatWebOnboardingStateMessage,
} from './webOnboardingToolResult';

describe('web onboarding tool result helpers', () => {
  it('keeps tool action content message-first', () => {
    const result = createWebOnboardingToolResult({
      content: 'Saved interests and response language.',
      savedFields: ['interests', 'responseLanguage'],
      success: true,
    });

    expect(result.content).toBe('Saved interests and response language.');
    expect(result.state).toEqual({
      isError: false,
      savedFields: ['interests', 'responseLanguage'],
      success: true,
    });
    expect(result.content.trim().startsWith('{')).toBe(false);
  });

  it('formats onboarding state as a plain-language summary', () => {
    const message = formatWebOnboardingStateMessage({
      finished: false,
      missingStructuredFields: ['interests'],
      phase: 'discovery',
      topicId: 'topic-1',
      version: 1,
    });

    expect(message).toContain('Structured fields still needed: interests.');
    expect(message).toContain('Phase: Discovery');
  });
});
