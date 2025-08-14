'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DashboardMode,
  ModePreferences,
  loadModePreferences,
  updateMode,
  toggleAdminOverlay,
  getCurrentMode,
  getAdminOverlayState,
  clearModePreferences,
  getModeStatistics,
  getNextMode,
  getPreviousMode,
  checkForExternalModeChange,
} from '@/lib/mode-storage';

/**
 * Mode configuration for each dashboard mode
 */
export interface ModeConfig {
  name: string;
  description: string;
  features: string[];
  complexity: 'low' | 'medium' | 'high';
  color: string;
  icon: string;
  components: {
    showAdvancedMetrics: boolean;
    showExpertTools: boolean;
    showDebuggingPanel: boolean;
    showRawData: boolean;
    enableCustomizations: boolean;
    showTechnicalDetails: boolean;
    enableExperimentalFeatures: boolean;
    simplifyUI: boolean;
  };
}

/**
 * Mode configurations for each dashboard mode
 */
export const MODE_CONFIGS: Record<DashboardMode, ModeConfig> = {
  simple: {
    name: 'Simple',
    description: 'Clean, essential monitoring with key metrics only',
    features: [
      'Key performance indicators',
      'Basic alerts',
      'Essential charts',
      'Simplified navigation',
      'Mobile-friendly interface'
    ],
    complexity: 'low',
    color: '#10b981', // green-500
    icon: '🟢',
    components: {
      showAdvancedMetrics: false,
      showExpertTools: false,
      showDebuggingPanel: false,
      showRawData: false,
      enableCustomizations: false,
      showTechnicalDetails: false,
      enableExperimentalFeatures: false,
      simplifyUI: true,
    }
  },
  advanced: {
    name: 'Advanced',
    description: 'Comprehensive monitoring with detailed insights',
    features: [
      'All simple mode features',
      'Advanced analytics',
      'Custom dashboards',
      'Detailed alerts',
      'Performance profiling',
      'Data export capabilities'
    ],
    complexity: 'medium',
    color: '#3b82f6', // blue-500
    icon: '🔵',
    components: {
      showAdvancedMetrics: true,
      showExpertTools: false,
      showDebuggingPanel: false,
      showRawData: false,
      enableCustomizations: true,
      showTechnicalDetails: false,
      enableExperimentalFeatures: false,
      simplifyUI: false,
    }
  },
  expert: {
    name: 'Expert',
    description: 'Full-featured monitoring with debugging tools',
    features: [
      'All advanced mode features',
      'Raw data access',
      'Debugging panel',
      'Technical metrics',
      'System internals',
      'Experimental features',
      'Custom queries',
      'API access tools'
    ],
    complexity: 'high',
    color: '#8b5cf6', // purple-500
    icon: '🟣',
    components: {
      showAdvancedMetrics: true,
      showExpertTools: true,
      showDebuggingPanel: true,
      showRawData: true,
      enableCustomizations: true,
      showTechnicalDetails: true,
      enableExperimentalFeatures: true,
      simplifyUI: false,
    }
  }
};

/**
 * Mode change event detail
 */
export interface ModeChangeEvent {
  previousMode: DashboardMode;
  newMode: DashboardMode;
  source: 'user' | 'keyboard' | 'system';
  timestamp: number;
}

/**
 * useMode Hook Interface
 */
export interface UseModeReturn {
  // Current state
  currentMode: DashboardMode;
  adminOverlay: boolean;
  isLoading: boolean;
  
  // Mode configuration
  config: ModeConfig;
  allConfigs: Record<DashboardMode, ModeConfig>;
  
  // Mode actions
  setMode: (mode: DashboardMode, source?: 'user' | 'keyboard' | 'system') => Promise<boolean>;
  cycleMode: (reverse?: boolean) => Promise<boolean>;
  toggleAdmin: () => Promise<boolean>;
  resetToDefault: () => Promise<boolean>;
  
  // Utilities
  isMode: (mode: DashboardMode) => boolean;
  isSimpleMode: boolean;
  isAdvancedMode: boolean;
  isExpertMode: boolean;
  canAccess: (feature: keyof ModeConfig['components']) => boolean;
  
  // Statistics
  statistics: ReturnType<typeof getModeStatistics>;
  
  // Event handlers
  onModeChange: (callback: (event: ModeChangeEvent) => void) => () => void;
  
  // Storage management
  exportPreferences: () => string;
  importPreferences: (data: string) => boolean;
}

/**
 * Custom hook for managing dashboard modes
 */
export const useMode = (): UseModeReturn => {
  const [currentMode, setCurrentMode] = useState<DashboardMode>('simple');
  const [adminOverlay, setAdminOverlay] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statistics, setStatistics] = useState(() => getModeStatistics());
  
  const modeChangeCallbacks = useRef<Set<(event: ModeChangeEvent) => void>>(new Set());
  const initializationPromise = useRef<Promise<void> | null>(null);
  const externalChangeCheckInterval = useRef<NodeJS.Timeout>();
  
  /**
   * Initialize mode from storage
   */
  const initializeMode = useCallback(async (): Promise<void> => {
    if (initializationPromise.current) {
      return initializationPromise.current;
    }

    initializationPromise.current = new Promise((resolve) => {
      try {
        // Small delay to ensure we're in browser environment
        setTimeout(() => {
          const preferences = loadModePreferences();
          setCurrentMode(preferences.currentMode);
          setAdminOverlay(preferences.adminOverlay);
          setStatistics(getModeStatistics());
          setIsLoading(false);
          resolve();
        }, 0);
      } catch (error) {
        console.error('Error initializing mode:', error);
        setCurrentMode('simple');
        setAdminOverlay(false);
        setIsLoading(false);
        resolve();
      }
    });

    return initializationPromise.current;
  }, []);

  /**
   * Handle external mode changes (from other tabs)
   */
  const handleExternalModeChange = useCallback(() => {
    const { changed, newMode } = checkForExternalModeChange();
    if (changed) {
      const previousMode = currentMode;
      setCurrentMode(newMode);
      setStatistics(getModeStatistics());
      
      // Trigger callbacks
      const event: ModeChangeEvent = {
        previousMode,
        newMode,
        source: 'system',
        timestamp: Date.now(),
      };
      
      modeChangeCallbacks.current.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in mode change callback:', error);
        }
      });
    }
  }, [currentMode]);

  /**
   * Set mode with validation and callbacks
   */
  const setMode = useCallback(async (
    mode: DashboardMode,
    source: 'user' | 'keyboard' | 'system' = 'user'
  ): Promise<boolean> => {
    if (mode === currentMode) return true;
    
    try {
      const success = updateMode(mode, source);
      
      if (success) {
        const previousMode = currentMode;
        setCurrentMode(mode);
        setStatistics(getModeStatistics());
        
        // Trigger callbacks
        const event: ModeChangeEvent = {
          previousMode,
          newMode: mode,
          source,
          timestamp: Date.now(),
        };
        
        modeChangeCallbacks.current.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('Error in mode change callback:', error);
          }
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error setting mode:', error);
      return false;
    }
  }, [currentMode]);

  /**
   * Cycle through modes
   */
  const cycleMode = useCallback(async (reverse: boolean = false): Promise<boolean> => {
    const nextMode = reverse ? getPreviousMode(currentMode) : getNextMode(currentMode);
    return setMode(nextMode, 'keyboard');
  }, [currentMode, setMode]);

  /**
   * Toggle admin overlay
   */
  const toggleAdmin = useCallback(async (): Promise<boolean> => {
    try {
      const success = toggleAdminOverlay();
      
      if (success) {
        setAdminOverlay(!adminOverlay);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error toggling admin overlay:', error);
      return false;
    }
  }, [adminOverlay]);

  /**
   * Reset to default preferences
   */
  const resetToDefault = useCallback(async (): Promise<boolean> => {
    try {
      const success = clearModePreferences();
      
      if (success) {
        setCurrentMode('simple');
        setAdminOverlay(false);
        setStatistics(getModeStatistics());
        
        // Trigger callbacks
        const event: ModeChangeEvent = {
          previousMode: currentMode,
          newMode: 'simple',
          source: 'system',
          timestamp: Date.now(),
        };
        
        modeChangeCallbacks.current.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('Error in mode change callback:', error);
          }
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error resetting mode preferences:', error);
      return false;
    }
  }, [currentMode]);

  /**
   * Check if current mode matches
   */
  const isMode = useCallback((mode: DashboardMode): boolean => {
    return currentMode === mode;
  }, [currentMode]);

  /**
   * Check if user can access a feature based on current mode
   */
  const canAccess = useCallback((feature: keyof ModeConfig['components']): boolean => {
    return MODE_CONFIGS[currentMode].components[feature];
  }, [currentMode]);

  /**
   * Add mode change callback
   */
  const onModeChange = useCallback((callback: (event: ModeChangeEvent) => void): (() => void) => {
    modeChangeCallbacks.current.add(callback);
    
    // Return cleanup function
    return () => {
      modeChangeCallbacks.current.delete(callback);
    };
  }, []);

  /**
   * Export preferences as JSON string
   */
  const exportPreferences = useCallback((): string => {
    const preferences = loadModePreferences();
    return JSON.stringify(preferences, null, 2);
  }, []);

  /**
   * Import preferences from JSON string
   */
  const importPreferences = useCallback((data: string): boolean => {
    try {
      const preferences = JSON.parse(data) as ModePreferences;
      
      // Validate structure
      if (!preferences.currentMode || !['simple', 'advanced', 'expert'].includes(preferences.currentMode)) {
        return false;
      }
      
      setCurrentMode(preferences.currentMode);
      setAdminOverlay(preferences.adminOverlay || false);
      setStatistics(getModeStatistics());
      
      return true;
    } catch (error) {
      console.error('Error importing preferences:', error);
      return false;
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeMode();
  }, [initializeMode]);

  // Listen for external changes
  useEffect(() => {
    const handleStorageChange = () => {
      handleExternalModeChange();
    };

    window.addEventListener('mode-preferences-changed', handleStorageChange);
    
    // Also periodically check for external changes
    externalChangeCheckInterval.current = setInterval(() => {
      handleExternalModeChange();
    }, 5000); // Check every 5 seconds

    return () => {
      window.removeEventListener('mode-preferences-changed', handleStorageChange);
      if (externalChangeCheckInterval.current) {
        clearInterval(externalChangeCheckInterval.current);
      }
    };
  }, [handleExternalModeChange]);

  // Get current mode configuration
  const config = MODE_CONFIGS[currentMode];

  return {
    // Current state
    currentMode,
    adminOverlay,
    isLoading,
    
    // Mode configuration
    config,
    allConfigs: MODE_CONFIGS,
    
    // Mode actions
    setMode,
    cycleMode,
    toggleAdmin,
    resetToDefault,
    
    // Utilities
    isMode,
    isSimpleMode: currentMode === 'simple',
    isAdvancedMode: currentMode === 'advanced',
    isExpertMode: currentMode === 'expert',
    canAccess,
    
    // Statistics
    statistics,
    
    // Event handlers
    onModeChange,
    
    // Storage management
    exportPreferences,
    importPreferences,
  };
};

export default useMode;