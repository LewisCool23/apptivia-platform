import { useState } from 'react';

/**
 * Custom hook for managing common page state (panels, modals, etc.)
 * Reduces duplication across all pages
 */
export function usePageState() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const toggleFilters = () => setFiltersOpen(prev => !prev);
  const toggleConfigPanel = () => setConfigPanelOpen(prev => !prev);
  const toggleConfigModal = () => setShowConfigModal(prev => !prev);

  return {
    // Filter panel state
    filtersOpen,
    setFiltersOpen,
    toggleFilters,
    
    // Config panel state
    configPanelOpen,
    setConfigPanelOpen,
    toggleConfigPanel,
    
    // Config modal state
    showConfigModal,
    setShowConfigModal,
    toggleConfigModal,
    
    // Refresh state
    refreshTrigger,
    isRefreshing,
    handleRefresh,
  };
}
