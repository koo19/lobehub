import { useCallback, useMemo } from 'react';

import { useEventCallback } from '@/hooks/useEventCallback';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { getExplorerSelectAllUiState } from '@/routes/(main)/resource/features/store/selectors';
import { useFileStore } from '@/store/file';

interface ExplorerSelectionOptions {
  data: Array<{ id: string }>;
  hasMore: boolean;
}

export const useExplorerSelectionSummary = ({ data, hasMore }: ExplorerSelectionOptions) => {
  const [selectAllState, selectedFileIds] = useResourceManagerStore((s) => [
    s.selectAllState,
    s.selectedFileIds,
  ]);
  const total = useFileStore((s) => s.total);

  const uiState = useMemo(
    () =>
      getExplorerSelectAllUiState({
        data,
        hasMore,
        selectAllState,
        selectedIds: selectedFileIds,
      }),
    [data, hasMore, selectAllState, selectedFileIds],
  );

  return {
    ...uiState,
    selectAllState,
    selectedFileIds,
    total,
  };
};

export const useExplorerSelectionActions = (data: Array<{ id: string }>) => {
  const [
    clearSelectAllState,
    selectAllLoadedResources,
    selectAllResources,
    setSelectedFileIds,
    selectedFileIds,
    selectAllState,
  ] = useResourceManagerStore((s) => [
    s.clearSelectAllState,
    s.selectAllLoadedResources,
    s.selectAllResources,
    s.setSelectedFileIds,
    s.selectedFileIds,
    s.selectAllState,
  ]);

  const handleSelectAll = useEventCallback(() => {
    const store = useResourceManagerStore.getState();
    const allLoadedSelected =
      data.length > 0 && data.every((item) => store.selectedFileIds.includes(item.id));

    if (store.selectAllState === 'all' || allLoadedSelected) {
      setSelectedFileIds([]);
      clearSelectAllState();
      return;
    }

    selectAllLoadedResources(data.map((item) => item.id));
  });

  const handleSelectAllResources = useCallback(() => {
    selectAllResources();
  }, [selectAllResources]);

  const toggleItemSelection = useCallback(
    (id: string, checked: boolean) => {
      clearSelectAllState();

      const currentSelected = useResourceManagerStore.getState().selectedFileIds;
      if (checked) {
        if (currentSelected.includes(id)) return;
        setSelectedFileIds([...currentSelected, id]);
        return;
      }

      setSelectedFileIds(currentSelected.filter((item) => item !== id));
    },
    [clearSelectAllState, setSelectedFileIds],
  );

  return {
    clearSelectAllState,
    handleSelectAll,
    handleSelectAllResources,
    selectAllState,
    selectedFileIds,
    setSelectedFileIds,
    toggleItemSelection,
  };
};
