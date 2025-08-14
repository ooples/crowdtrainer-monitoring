'use client';

/**
 * Mode Storage Utility
 * Handles localStorage persistence for dashboard mode preferences
 */

export type DashboardMode = 'simple' | 'advanced' | 'expert';

export interface ModePreferences {
  currentMode: DashboardMode;
  adminOverlay: boolean;
  lastChanged: number;
  modeHistory: Array<{
    mode: DashboardMode;
    timestamp: number;
    source: 'user' | 'keyboard' | 'system';
  }>;
}

const STORAGE_KEY = 'dashboard-mode-preferences';
const DEFAULT_PREFERENCES: ModePreferences = {
  currentMode: 'simple',
  adminOverlay: false,
  lastChanged: Date.now(),
  modeHistory: [],
};

// Cache for faster access
let cachedPreferences: ModePreferences | null = null;

/**
 * Safely access localStorage with error handling
 */
const safeStorageAccess = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('localStorage access failed:', error);
      return null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof window === 'undefined') return false;
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn('localStorage write failed:', error);
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    try {
      if (typeof window === 'undefined') return false;
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn('localStorage remove failed:', error);
      return false;
    }
  }
};

/**
 * Load mode preferences from localStorage
 */
export const loadModePreferences = (): ModePreferences => {
  if (cachedPreferences) {
    return cachedPreferences;
  }

  try {
    const stored = safeStorageAccess.getItem(STORAGE_KEY);
    
    if (!stored) {
      cachedPreferences = { ...DEFAULT_PREFERENCES };
      return cachedPreferences;
    }

    const parsed = JSON.parse(stored);
    
    // Validate the structure and provide defaults
    cachedPreferences = {
      currentMode: isValidMode(parsed.currentMode) ? parsed.currentMode : DEFAULT_PREFERENCES.currentMode,
      adminOverlay: typeof parsed.adminOverlay === 'boolean' ? parsed.adminOverlay : DEFAULT_PREFERENCES.adminOverlay,
      lastChanged: typeof parsed.lastChanged === 'number' ? parsed.lastChanged : Date.now(),
      modeHistory: Array.isArray(parsed.modeHistory) ? parsed.modeHistory.slice(-10) : [], // Keep last 10 entries
    };

    return cachedPreferences;
  } catch (error) {
    console.warn('Error loading mode preferences:', error);
    cachedPreferences = { ...DEFAULT_PREFERENCES };
    return cachedPreferences;
  }
};

/**
 * Save mode preferences to localStorage
 */
export const saveModePreferences = (preferences: ModePreferences): boolean => {
  try {
    // Validate preferences
    const validPreferences: ModePreferences = {
      currentMode: isValidMode(preferences.currentMode) ? preferences.currentMode : 'simple',
      adminOverlay: Boolean(preferences.adminOverlay),
      lastChanged: Date.now(),
      modeHistory: (preferences.modeHistory || []).slice(-10), // Keep only last 10
    };

    const success = safeStorageAccess.setItem(STORAGE_KEY, JSON.stringify(validPreferences));
    
    if (success) {
      cachedPreferences = validPreferences;
    }
    
    return success;
  } catch (error) {
    console.error('Error saving mode preferences:', error);
    return false;
  }
};

/**
 * Update current mode with history tracking
 */
export const updateMode = (
  newMode: DashboardMode,
  source: 'user' | 'keyboard' | 'system' = 'user'
): boolean => {
  const currentPreferences = loadModePreferences();
  
  // Don't save if it's the same mode
  if (currentPreferences.currentMode === newMode) {
    return true;
  }

  const updatedPreferences: ModePreferences = {
    ...currentPreferences,
    currentMode: newMode,
    lastChanged: Date.now(),
    modeHistory: [
      ...currentPreferences.modeHistory.slice(-9), // Keep last 9 to make room for new one
      {
        mode: newMode,
        timestamp: Date.now(),
        source,
      }
    ]
  };

  return saveModePreferences(updatedPreferences);
};

/**
 * Toggle admin overlay
 */
export const toggleAdminOverlay = (): boolean => {
  const currentPreferences = loadModePreferences();
  
  const updatedPreferences: ModePreferences = {
    ...currentPreferences,
    adminOverlay: !currentPreferences.adminOverlay,
    lastChanged: Date.now(),
  };

  return saveModePreferences(updatedPreferences);
};

/**
 * Get current mode
 */
export const getCurrentMode = (): DashboardMode => {
  const preferences = loadModePreferences();
  return preferences.currentMode;
};

/**
 * Get admin overlay state
 */
export const getAdminOverlayState = (): boolean => {
  const preferences = loadModePreferences();
  return preferences.adminOverlay;
};

/**
 * Clear all mode preferences (reset to defaults)
 */
export const clearModePreferences = (): boolean => {
  cachedPreferences = null;
  return safeStorageAccess.removeItem(STORAGE_KEY);
};

/**
 * Get mode statistics
 */
export const getModeStatistics = () => {
  const preferences = loadModePreferences();
  const history = preferences.modeHistory;
  
  if (history.length === 0) {
    return {
      totalChanges: 0,
      mostUsedMode: preferences.currentMode,
      keyboardUsage: 0,
      sessionLength: 0,
    };
  }

  // Count mode usage
  const modeUsage = history.reduce((acc, entry) => {
    acc[entry.mode] = (acc[entry.mode] || 0) + 1;
    return acc;
  }, {} as Record<DashboardMode, number>);

  // Find most used mode
  const mostUsedMode = Object.entries(modeUsage).reduce((a, b) => 
    modeUsage[a[0] as DashboardMode] > modeUsage[b[0] as DashboardMode] ? a : b
  )[0] as DashboardMode;

  // Count keyboard usage
  const keyboardUsage = history.filter(entry => entry.source === 'keyboard').length;

  // Calculate session length
  const firstEntry = history[0];
  const lastEntry = history[history.length - 1];
  const sessionLength = lastEntry.timestamp - firstEntry.timestamp;

  return {
    totalChanges: history.length,
    mostUsedMode,
    keyboardUsage: Math.round((keyboardUsage / history.length) * 100),
    sessionLength,
    modeUsage,
  };
};

/**
 * Export preferences for backup/sharing
 */
export const exportModePreferences = (): string => {
  const preferences = loadModePreferences();
  return JSON.stringify(preferences, null, 2);
};

/**
 * Import preferences from backup
 */
export const importModePreferences = (preferencesJson: string): boolean => {
  try {
    const preferences = JSON.parse(preferencesJson);
    
    // Validate structure
    if (typeof preferences !== 'object' || !isValidMode(preferences.currentMode)) {
      throw new Error('Invalid preferences structure');
    }

    return saveModePreferences(preferences);
  } catch (error) {
    console.error('Error importing mode preferences:', error);
    return false;
  }
};

/**
 * Validate if a mode is valid
 */
function isValidMode(mode: any): mode is DashboardMode {
  return typeof mode === 'string' && ['simple', 'advanced', 'expert'].includes(mode);
}

/**
 * Get next mode in cycle (for keyboard shortcut)
 */
export const getNextMode = (currentMode: DashboardMode): DashboardMode => {
  const modes: DashboardMode[] = ['simple', 'advanced', 'expert'];
  const currentIndex = modes.indexOf(currentMode);
  return modes[(currentIndex + 1) % modes.length];
};

/**
 * Get previous mode in cycle (for keyboard shortcut with shift)
 */
export const getPreviousMode = (currentMode: DashboardMode): DashboardMode => {
  const modes: DashboardMode[] = ['simple', 'advanced', 'expert'];
  const currentIndex = modes.indexOf(currentMode);
  return modes[currentIndex === 0 ? modes.length - 1 : currentIndex - 1];
};

/**
 * Check if mode has changed externally (e.g., in another tab)
 */
export const checkForExternalModeChange = (): { changed: boolean; newMode: DashboardMode } => {
  const storedPreferences = loadModePreferences();
  
  // Force reload from storage to check for external changes
  cachedPreferences = null;
  const freshPreferences = loadModePreferences();
  
  const changed = storedPreferences.currentMode !== freshPreferences.currentMode ||
                 storedPreferences.lastChanged !== freshPreferences.lastChanged;
  
  return {
    changed,
    newMode: freshPreferences.currentMode,
  };
};

// Storage event listener for cross-tab synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      // Clear cache to force reload on next access
      cachedPreferences = null;
      
      // Dispatch custom event for components to react to external changes
      const customEvent = new CustomEvent('mode-preferences-changed', {
        detail: { external: true }
      });
      window.dispatchEvent(customEvent);
    }
  });
}