import { TRPCError } from '@trpc/server';
import debug from 'debug';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { marketSDK, marketUserInfo, serverDatabase } from '@/libs/trpc/lambda/middleware';

const log = debug('lambda-router:market:socialProfile');

const MARKET_BASE_URL = process.env.MARKET_BASE_URL || 'https://market.lobehub.com';

// Authenticated procedure for social profile operations
const socialProfileAuthProcedure = authedProcedure
  .use(serverDatabase)
  .use(marketUserInfo)
  .use(marketSDK);

export interface ClaimableResource {
  description?: string;
  id: string;
  identifier: string;
  name: string;
  type: 'mcp' | 'skill';
}

export interface ClaimableResources {
  mcps: ClaimableResource[];
  skills: ClaimableResource[];
}

export const socialProfileRouter = router({
  /**
   * Claim resources (MCPs and/or Skills)
   */
  claimResources: socialProfileAuthProcedure
    .input(
      z.object({
        mcpIds: z.array(z.string()).optional(),
        skillIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      log('claimResources input: %O', input);

      try {
        const headers = ctx.marketSDK.headers as Record<string, string>;

        const response = await fetch(`${MARKET_BASE_URL}/api/v1/user/claims`, {
          body: JSON.stringify({
            mcpIds: input.mcpIds || [],
            skillIds: input.skillIds || [],
          }),
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `Failed to claim resources: ${response.status}`);
        }

        const data = await response.json();
        return {
          claimed: data.claimed || [],
          success: true,
        };
      } catch (error) {
        log('Error claiming resources: %O', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to claim resources',
        });
      }
    }),

  /**
   * Scan for claimable resources (MCPs and Skills)
   */
  scanClaimableResources: socialProfileAuthProcedure.query(async ({ ctx }) => {
    log('scanClaimableResources');

    try {
      const headers = ctx.marketSDK.headers as Record<string, string>;

      const response = await fetch(`${MARKET_BASE_URL}/api/v1/user/claims/scan`, {
        headers,
        method: 'GET',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to scan claimable resources: ${response.status}`);
      }

      const data = await response.json();
      return {
        mcps: (data.mcps || []) as ClaimableResource[],
        skills: (data.skills || []) as ClaimableResource[],
      };
    } catch (error) {
      log('Error scanning claimable resources: %O', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to scan claimable resources',
      });
    }
  }),
});

export type SocialProfileRouter = typeof socialProfileRouter;
