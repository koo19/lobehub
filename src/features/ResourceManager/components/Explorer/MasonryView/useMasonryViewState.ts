import { useEffect, useMemo, useState } from 'react';

import type { ViewMode } from '@/routes/(main)/resource/features/store/initialState';

interface UseMasonryViewStateOptions {
  dataLength: number;
  isLoading: boolean;
  isNavigating: boolean;
  isValidating: boolean;
  viewMode: ViewMode;
}

export const useMasonryViewState = ({
  dataLength,
  isLoading,
  isNavigating,
  isValidating,
  viewMode,
}: UseMasonryViewStateOptions) => {
  const [isTransitioning, setIsTransitioning] = useState(viewMode === 'masonry');
  const [isMasonryReady, setIsMasonryReady] = useState(false);

  useEffect(() => {
    if (viewMode !== 'masonry') {
      setIsTransitioning(false);
      setIsMasonryReady(false);
      return;
    }

    setIsTransitioning(true);
    setIsMasonryReady(false);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'masonry' || !isTransitioning) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 100);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [dataLength, isTransitioning, viewMode]);

  useEffect(() => {
    if (viewMode !== 'masonry' || isLoading || isValidating || isNavigating || isTransitioning) {
      return;
    }

    const timer = setTimeout(() => {
      setIsMasonryReady(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [isLoading, isNavigating, isTransitioning, isValidating, viewMode]);

  const showSkeleton = useMemo(
    () =>
      (isLoading && dataLength === 0) ||
      (isNavigating && isValidating) ||
      isTransitioning ||
      !isMasonryReady,
    [dataLength, isLoading, isMasonryReady, isNavigating, isTransitioning, isValidating],
  );

  return {
    isMasonryReady,
    showSkeleton,
  };
};
