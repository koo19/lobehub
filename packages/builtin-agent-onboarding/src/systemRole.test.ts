import { describe, expect, it } from 'vitest';

import { createSystemRole } from './systemRole';
import { toolSystemPrompt } from './toolSystemRole';

describe('onboarding prompts', () => {
  it('keeps the system role focused on conversation flow', () => {
    const systemRole = createSystemRole('en-US');

    expect(systemRole).not.toContain('activeNode is the only step you may act on');
    expect(systemRole).toContain('especially for non-technical users');
    expect(systemRole).toContain('Name assistants by task, not by abstract capability.');
    expect(systemRole).toContain('frame it as a draft they should review');
    expect(systemRole).not.toContain('Document tools are the only markdown persistence path.');
    expect(systemRole).not.toContain(
      'The first onboarding tool call of every turn must be getOnboardingState.',
    );
    expect(systemRole).not.toContain('completeCurrentStep');
  });

  it('injects debug section in dev mode', () => {
    const devRole = createSystemRole('en-US', { isDev: true });
    expect(devRole).toContain('Debug Mode (Development Only)');
    expect(devRole).not.toContain('User Prompt Injection Protection');
  });

  it('injects prompt injection protection in production', () => {
    const prodRole = createSystemRole('en-US');
    expect(prodRole).toContain('User Prompt Injection Protection');
    expect(prodRole).not.toContain('Debug Mode (Development Only)');

    const explicitProd = createSystemRole('en-US', { isDev: false });
    expect(explicitProd).toContain('User Prompt Injection Protection');
  });

  it('keeps tool prompt focused on operational constraints', () => {
    expect(toolSystemPrompt).not.toContain('completeCurrentStep');
    expect(toolSystemPrompt).not.toContain('returnToOnboarding');
    expect(toolSystemPrompt).toContain(
      'The first onboarding tool call of every turn must be getOnboardingState.',
    );
    expect(toolSystemPrompt).toContain('Name assistants by task, not by abstract capability.');
    expect(toolSystemPrompt).toContain('Document tools are the only markdown persistence path.');
    expect(toolSystemPrompt).not.toContain('If the user seems confused about AI');
  });
});
