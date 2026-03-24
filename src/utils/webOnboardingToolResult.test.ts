import { describe, expect, it } from 'vitest';

import { createWebOnboardingToolResult } from './webOnboardingToolResult';

describe('createWebOnboardingToolResult', () => {
  it('wraps failed onboarding actions into structured tool output', () => {
    const result = createWebOnboardingToolResult({
      content: 'Agent identity is incomplete.',
      error: {
        message: 'Agent identity is incomplete.',
        type: 'INVALID_PATCH',
      },
      success: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toEqual({
      body: {
        content: 'Agent identity is incomplete.',
        error: {
          message: 'Agent identity is incomplete.',
          type: 'INVALID_PATCH',
        },
        success: false,
      },
      message: 'Agent identity is incomplete.',
      type: 'INVALID_PATCH',
    });
    expect(result.state).toEqual({
      data: {
        content: 'Agent identity is incomplete.',
        error: {
          message: 'Agent identity is incomplete.',
          type: 'INVALID_PATCH',
        },
        success: false,
      },
      error: {
        message: 'Agent identity is incomplete.',
        type: 'INVALID_PATCH',
      },
      isError: true,
      success: false,
    });
    expect(JSON.parse(result.content!)).toEqual(result.state);
  });
});
