import type { UserAgentOnboarding } from '@lobechat/types';

import { SOUL_DOCUMENT } from '@/database/models/agentDocuments/templates/claw/soul';

interface AgentIdentityInput {
  emoji: string;
  name: string;
  nature: string;
  vibe: string;
}

const appendSection = (sections: string[], title: string, content?: string) => {
  if (!content) return;

  sections.push(`## ${title}\n\n${content}`);
};

const buildIdentityCoreSection = (identity: AgentIdentityInput): string => {
  const lines = [
    '## Identity Core',
    '',
    `- **Name:** ${identity.name}`,
    `- **Avatar:** ${identity.emoji}`,
    `- **Creature:** ${identity.nature}`,
    `- **Vibe:** ${identity.vibe}`,
  ];

  return lines.join('\n');
};

export const buildSoulDocument = (
  state: Pick<UserAgentOnboarding, 'agentIdentity' | 'profile' | 'version'>,
): string => {
  const profile = state.profile;
  const identity = state.agentIdentity;

  if (!profile && !identity) return SOUL_DOCUMENT.content;

  const sections: string[] = [];

  if (identity?.name) {
    sections.push(buildIdentityCoreSection(identity));
  }

  appendSection(sections, 'About My Human', profile?.identity?.summary);
  appendSection(sections, 'How We Work Together', profile?.workStyle?.summary);

  if (profile?.workContext?.summary) {
    const listItems: string[] = [];

    if (profile.workContext.activeProjects?.length) {
      listItems.push(`- **Active Projects:** ${profile.workContext.activeProjects.join(', ')}`);
    }

    if (profile.workContext.interests?.length) {
      listItems.push(`- **Interests:** ${profile.workContext.interests.join(', ')}`);
    }

    if (profile.workContext.tools?.length) {
      listItems.push(`- **Tools:** ${profile.workContext.tools.join(', ')}`);
    }

    sections.push(
      [
        '## Current Context',
        '',
        profile.workContext.summary,
        ...(listItems.length > 0 ? ['', ...listItems] : []),
      ].join('\n'),
    );
  }

  appendSection(sections, 'Where I Can Help Most', profile?.painPoints?.summary);

  if (sections.length === 0) return SOUL_DOCUMENT.content;

  return [SOUL_DOCUMENT.content, '---', sections.join('\n\n')].join('\n\n');
};
