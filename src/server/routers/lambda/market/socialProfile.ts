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

// Schema definitions
const providerSchema = z.enum(['github', 'twitter']);

export interface SocialProfile {
  avatarUrl?: string;
  connectedAt: string;
  id: string;
  profileUrl: string;
  provider: 'github' | 'twitter';
  username: string;
}

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
   * Disconnect a social profile
   */
  disconnectSocialProfile: socialProfileAuthProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      log('disconnectSocialProfile input: %O', input);

      try {
        const headers = ctx.marketSDK.headers as Record<string, string>;

        const response = await fetch(`${MARKET_BASE_URL}/api/v1/user/social-profiles/${input.id}`, {
          headers,
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(
            error.message || `Failed to disconnect social profile: ${response.status}`,
          );
        }

        return { success: true };
      } catch (error) {
        log('Error disconnecting social profile: %O', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to disconnect social profile',
        });
      }
    }),

  /**
   * Get OAuth authorize URL for a social provider
   * Used to initiate the OAuth flow
   */
  getAuthorizeUrl: socialProfileAuthProcedure
    .input(
      z.object({
        provider: providerSchema,
        redirectUri: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      log('getAuthorizeUrl input: %O', input);

      try {
        const url = new URL(`${MARKET_BASE_URL}/api/connect/${input.provider}/authorize`);
        if (input.redirectUri) {
          url.searchParams.set('redirect_uri', input.redirectUri);
        }

        const headers = ctx.marketSDK.headers as Record<string, string>;

        const response = await fetch(url.toString(), {
          headers,
          method: 'GET',
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `Failed to get authorize URL: ${response.status}`);
        }

        const data = await response.json();
        return {
          authorizeUrl: data.authorize_url || data.authorizeUrl,
          code: data.code,
          expiresIn: data.expires_in || data.expiresIn,
        };
      } catch (error) {
        log('Error getting authorize URL: %O', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get authorize URL',
        });
      }
    }),

  /**
   * Get a specific social profile by provider
   */
  getSocialProfile: socialProfileAuthProcedure
    .input(z.object({ provider: providerSchema }))
    .query(async ({ input, ctx }) => {
      log('getSocialProfile input: %O', input);

      try {
        const headers = ctx.marketSDK.headers as Record<string, string>;

        const response = await fetch(
          `${MARKET_BASE_URL}/api/v1/user/social-profiles/${input.provider}`,
          {
            headers,
            method: 'GET',
          },
        );

        if (!response.ok) {
          if (response.status === 404) {
            return { profile: null };
          }
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `Failed to get social profile: ${response.status}`);
        }

        const data = await response.json();
        return {
          profile: data as SocialProfile | null,
        };
      } catch (error) {
        log('Error getting social profile: %O', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get social profile',
        });
      }
    }),

  /**
   * List all connected social profiles for the current user
   */
  listSocialProfiles: socialProfileAuthProcedure.query(async ({ ctx }) => {
    log('listSocialProfiles');

    try {
      const headers = ctx.marketSDK.headers as Record<string, string>;

      const response = await fetch(`${MARKET_BASE_URL}/api/v1/user/social-profiles`, {
        headers,
        method: 'GET',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to list social profiles: ${response.status}`);
      }

      const data = await response.json();
      return {
        profiles: (data.profiles || data || []) as SocialProfile[],
      };
    } catch (error) {
      log('Error listing social profiles: %O', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to list social profiles',
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
