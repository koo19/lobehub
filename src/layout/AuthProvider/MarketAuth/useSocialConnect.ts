'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { lambdaClient } from '@/libs/trpc/client';

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 15_000;

export type SocialProvider = 'github' | 'twitter';

export interface SocialProfile {
  avatarUrl?: string;
  connectedAt: string;
  id: string;
  profileUrl: string;
  provider: SocialProvider;
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

interface UseSocialConnectOptions {
  onClaimableResourcesFound?: (resources: ClaimableResources) => void;
  onConnectSuccess?: (profile: SocialProfile) => void;
  onDisconnectSuccess?: () => void;
  provider: SocialProvider;
}

export const useSocialConnect = ({
  provider,
  onConnectSuccess,
  onDisconnectSuccess,
  onClaimableResourcesFound,
}: UseSocialConnectOptions) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const oauthWindowRef = useRef<Window | null>(null);
  const windowCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (windowCheckIntervalRef.current) {
      clearInterval(windowCheckIntervalRef.current);
      windowCheckIntervalRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    oauthWindowRef.current = null;
    setIsWaitingAuth(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Fetch current profile status
  const fetchProfile = useCallback(async () => {
    try {
      const result = await lambdaClient.market.socialProfile.getSocialProfile.query({ provider });
      setProfile(result.profile);
      return result.profile;
    } catch (err) {
      console.error('[SocialConnect] Failed to fetch profile:', err);
      return null;
    }
  }, [provider]);

  // Check for claimable resources
  const checkClaimableResources = useCallback(async () => {
    try {
      const result = await lambdaClient.market.socialProfile.scanClaimableResources.query();
      if (result.mcps.length > 0 || result.skills.length > 0) {
        onClaimableResourcesFound?.(result);
      }
      return result;
    } catch (err) {
      console.error('[SocialConnect] Failed to scan claimable resources:', err);
      return { mcps: [], skills: [] };
    }
  }, [onClaimableResourcesFound]);

  // Handle successful OAuth completion
  const handleOAuthSuccess = useCallback(async () => {
    cleanup();
    const newProfile = await fetchProfile();
    if (newProfile) {
      onConnectSuccess?.(newProfile);
      // Check for claimable resources after successful connection
      await checkClaimableResources();
    }
  }, [cleanup, fetchProfile, onConnectSuccess, checkClaimableResources]);

  // Listen for OAuth success message from popup window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'SOCIAL_PROFILE_AUTH_SUCCESS' && event.data?.provider === provider) {
        await handleOAuthSuccess();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [provider, handleOAuthSuccess]);

  // Fallback polling when window.closed is not accessible (COOP)
  const startFallbackPolling = useCallback(() => {
    if (pollIntervalRef.current) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const newProfile = await fetchProfile();
        if (newProfile) {
          cleanup();
          onConnectSuccess?.(newProfile);
          await checkClaimableResources();
        }
      } catch (err) {
        console.error('[SocialConnect] Polling check failed:', err);
      }
    }, POLL_INTERVAL_MS);

    pollTimeoutRef.current = setTimeout(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsWaitingAuth(false);
    }, POLL_TIMEOUT_MS);
  }, [fetchProfile, cleanup, onConnectSuccess, checkClaimableResources]);

  // Monitor OAuth window close
  const startWindowMonitor = useCallback(
    (oauthWindow: Window) => {
      windowCheckIntervalRef.current = setInterval(async () => {
        try {
          if (oauthWindow.closed) {
            if (windowCheckIntervalRef.current) {
              clearInterval(windowCheckIntervalRef.current);
              windowCheckIntervalRef.current = null;
            }
            oauthWindowRef.current = null;
            // Check if OAuth was successful
            const newProfile = await fetchProfile();
            if (newProfile) {
              cleanup();
              onConnectSuccess?.(newProfile);
              await checkClaimableResources();
            } else {
              setIsWaitingAuth(false);
            }
          }
        } catch {
          // COOP headers prevent access to window.closed
          if (windowCheckIntervalRef.current) {
            clearInterval(windowCheckIntervalRef.current);
            windowCheckIntervalRef.current = null;
          }
          startFallbackPolling();
        }
      }, 500);
    },
    [fetchProfile, cleanup, onConnectSuccess, checkClaimableResources, startFallbackPolling],
  );

  // Open OAuth popup window
  const openOAuthWindow = useCallback(
    (oauthUrl: string) => {
      cleanup();
      setIsWaitingAuth(true);
      setError(null);

      const oauthWindow = window.open(oauthUrl, '_blank', 'width=600,height=700');
      if (oauthWindow) {
        oauthWindowRef.current = oauthWindow;
        startWindowMonitor(oauthWindow);
      } else {
        // Popup blocked, fall back to polling
        startFallbackPolling();
      }
    },
    [cleanup, startWindowMonitor, startFallbackPolling],
  );

  // Connect handler
  const connect = useCallback(async () => {
    if (profile) return; // Already connected

    setIsConnecting(true);
    setError(null);

    try {
      const redirectUri = `${window.location.origin}/oauth/callback/social?provider=${encodeURIComponent(provider)}`;
      const result = await lambdaClient.market.socialProfile.getAuthorizeUrl.query({
        provider,
        redirectUri,
      });

      if (result.authorizeUrl) {
        openOAuthWindow(result.authorizeUrl);
      } else {
        throw new Error('No authorize URL returned');
      }
    } catch (err) {
      console.error('[SocialConnect] Failed to get authorize URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }, [provider, profile, openOAuthWindow]);

  // Disconnect handler
  const disconnect = useCallback(async () => {
    if (!profile) return;

    setIsDisconnecting(true);
    setError(null);

    try {
      await lambdaClient.market.socialProfile.disconnectSocialProfile.mutate({ id: profile.id });
      setProfile(null);
      onDisconnectSuccess?.();
    } catch (err) {
      console.error('[SocialConnect] Failed to disconnect:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  }, [profile, onDisconnectSuccess]);

  return {
    connect,
    disconnect,
    error,
    fetchProfile,
    isConnected: !!profile,
    isConnecting: isConnecting || isWaitingAuth,
    isDisconnecting,
    profile,
  };
};

export default useSocialConnect;
