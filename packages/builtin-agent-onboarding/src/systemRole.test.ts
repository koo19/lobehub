import { describe, expect, it } from 'vitest';

import { createSystemRole } from './systemRole';
import { toolSystemPrompt } from './toolSystemRole';

describe('onboarding prompts', () => {
  it('removes step-machine guidance from the system role', () => {
    const systemRole = createSystemRole('en-US');

    expect(systemRole).not.toContain('activeNode is the only step you may act on');
    expect(systemRole).toContain(
      'Use saveUserQuestion only for fullName, interests, and responseLanguage.',
    );
    expect(systemRole).toContain('Document tools are the only markdown persistence path.');
    expect(systemRole).not.toContain('completeCurrentStep');
  });

  it('describes document-first persistence in the tool prompt', () => {
    expect(toolSystemPrompt).not.toContain('completeCurrentStep');
    expect(toolSystemPrompt).not.toContain('returnToOnboarding');
    expect(toolSystemPrompt).toContain(
      'Use saveUserQuestion only for fullName, interests, and responseLanguage.',
    );
    expect(toolSystemPrompt).toContain('Document tools are the only markdown persistence path.');
  });
});
