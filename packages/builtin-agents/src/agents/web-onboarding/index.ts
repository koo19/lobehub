import { WebOnboardingIdentifier } from '@lobechat/builtin-tool-web-onboarding';
import { DEFAULT_PROVIDER } from '@lobechat/business-const';
import { DEFAULT_MODEL } from '@lobechat/const';

import type { BuiltinAgentDefinition } from '../../types';
import { BUILTIN_AGENT_SLUGS } from '../../types';
import { systemRoleTemplate } from './systemRole';

export const WEB_ONBOARDING: BuiltinAgentDefinition = {
  avatar: '/avatars/lobe-ai.png',
  persist: {
    model: DEFAULT_MODEL,
    provider: DEFAULT_PROVIDER,
  },
  runtime: (ctx) => ({
    chatConfig: {
      memory: {
        enabled: false,
      },
      runtimeEnv: {
        runtimeMode: {
          desktop: 'none',
          web: 'none',
        },
      },
      searchMode: 'off',
      skillActivateMode: 'manual',
    },
    plugins: [WebOnboardingIdentifier, ...(ctx.plugins || [])],
    systemRole: systemRoleTemplate,
  }),
  slug: BUILTIN_AGENT_SLUGS.webOnboarding,
};
