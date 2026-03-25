import { describe, expect, it } from 'vitest';

import { buildSoulDocument } from './documentHelpers';

describe('buildSoulDocument', () => {
  it('should return base SOUL content when no profile or identity exists', () => {
    const result = buildSoulDocument({ version: 1 });

    expect(result).toContain('# SOUL.md - Who You Are');
    expect(result).toContain('## Core Truths');
    expect(result).not.toContain('## Identity Core');
    expect(result).not.toContain('## About My Human');
  });

  it('should include Identity Core section from agentIdentity', () => {
    const result = buildSoulDocument({
      agentIdentity: {
        emoji: '🦊',
        name: 'Fox',
        nature: 'familiar',
        vibe: 'warm',
      },
      version: 1,
    });

    expect(result).toContain('## Identity Core');
    expect(result).toContain('- **Name:** Fox');
    expect(result).toContain('- **Avatar:** 🦊');
    expect(result).toContain('- **Creature:** familiar');
    expect(result).toContain('- **Vibe:** warm');
  });

  it('should append identity summary when present', () => {
    const result = buildSoulDocument({
      profile: {
        identity: { summary: 'A software engineer who loves Rust.' },
      },
      version: 1,
    });

    expect(result).toContain('## About My Human');
    expect(result).toContain('A software engineer who loves Rust.');
  });

  it('should append all profile sections progressively', () => {
    const result = buildSoulDocument({
      agentIdentity: {
        emoji: '🦊',
        name: 'Fox',
        nature: 'familiar',
        vibe: 'warm',
      },
      profile: {
        identity: { summary: 'Engineer' },
        painPoints: { summary: 'Too many meetings' },
        workContext: {
          activeProjects: ['ProjectA', 'ProjectB'],
          interests: ['AI'],
          summary: 'Working on chat app',
          tools: ['VS Code'],
        },
        workStyle: { summary: 'Direct and concise' },
      },
      version: 1,
    });

    expect(result).toContain('## Identity Core');
    expect(result).toContain('## About My Human');
    expect(result).toContain('## How We Work Together');
    expect(result).toContain('## Current Context');
    expect(result).toContain('- **Active Projects:** ProjectA, ProjectB');
    expect(result).toContain('- **Interests:** AI');
    expect(result).toContain('- **Tools:** VS Code');
    expect(result).toContain('## Where I Can Help Most');
  });

  it('should omit sections with empty summaries', () => {
    const result = buildSoulDocument({
      profile: {
        identity: { summary: '' },
        workStyle: { summary: 'Direct' },
      },
      version: 1,
    });

    expect(result).not.toContain('## About My Human');
    expect(result).toContain('## How We Work Together');
  });

  it('should skip Identity Core when agentIdentity has no name', () => {
    const result = buildSoulDocument({
      agentIdentity: {
        emoji: '🤖',
        name: '',
        nature: '',
        vibe: '',
      },
      profile: {
        identity: { summary: 'Engineer' },
      },
      version: 1,
    });

    expect(result).not.toContain('## Identity Core');
    expect(result).toContain('## About My Human');
  });
});
