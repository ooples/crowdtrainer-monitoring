'use client';

import React, { useEffect, useCallback } from 'react';
import { useModeContext } from './ModeProvider';
import { KeyboardManager } from '@/components/shortcuts/KeyboardManager';

/**
 * Mode Keyboard Integration Component
 * Connects the mode system with keyboard shortcuts
 * This component should be used alongside KeyboardManager to enable mode shortcuts
 */

interface ModeKeyboardIntegrationProps {
  onModeChange?: (mode: string) => void;
  onAdminToggle?: (enabled: boolean) => void;
  enableNotifications?: boolean;
}

export const ModeKeyboardIntegration: React.FC<ModeKeyboardIntegrationProps> = ({
  onModeChange,
  onAdminToggle,
  enableNotifications = true,
}) => {
  const {
    currentMode,
    adminOverlay,
    setMode,
    cycleMode,
    toggleAdmin,
    config,
  } = useModeContext();

  /**
   * Handle mode cycling (Ctrl+M)
   */
  const handleCycleMode = useCallback(async () => {
    const success = await cycleMode(false);
    if (success && enableNotifications) {
      onModeChange?.(currentMode);
    }
  }, [cycleMode, currentMode, onModeChange, enableNotifications]);

  /**
   * Handle reverse mode cycling (Ctrl+Shift+M)
   */
  const handleCycleModeReverse = useCallback(async () => {
    const success = await cycleMode(true);
    if (success && enableNotifications) {
      onModeChange?.(currentMode);
    }
  }, [cycleMode, currentMode, onModeChange, enableNotifications]);

  /**
   * Handle admin overlay toggle (Ctrl+Shift+A)
   */
  const handleToggleAdmin = useCallback(async () => {
    const success = await toggleAdmin();
    if (success && enableNotifications) {
      onAdminToggle?.(!adminOverlay);
    }
  }, [toggleAdmin, adminOverlay, onAdminToggle, enableNotifications]);

  /**
   * Handle direct mode switches
   */
  const handleSetSimpleMode = useCallback(async () => {
    const success = await setMode('simple', 'keyboard');
    if (success && enableNotifications) {
      onModeChange?.('simple');
    }
  }, [setMode, onModeChange, enableNotifications]);

  const handleSetAdvancedMode = useCallback(async () => {
    const success = await setMode('advanced', 'keyboard');
    if (success && enableNotifications) {
      onModeChange?.('advanced');
    }
  }, [setMode, onModeChange, enableNotifications]);

  const handleSetExpertMode = useCallback(async () => {
    const success = await setMode('expert', 'keyboard');
    if (success && enableNotifications) {
      onModeChange?.('expert');
    }
  }, [setMode, onModeChange, enableNotifications]);

  /**
   * General shortcut handler for KeyboardManager
   */
  const handleShortcut = useCallback((shortcutId: string) => {
    switch (shortcutId) {
      case 'cycle-mode':
        handleCycleMode();
        break;
      case 'cycle-mode-reverse':
        handleCycleModeReverse();
        break;
      case 'toggle-admin-overlay':
        handleToggleAdmin();
        break;
      case 'set-simple-mode':
        handleSetSimpleMode();
        break;
      case 'set-advanced-mode':
        handleSetAdvancedMode();
        break;
      case 'set-expert-mode':
        handleSetExpertMode();
        break;
      default:
        break;
    }
  }, [
    handleCycleMode,
    handleCycleModeReverse,
    handleToggleAdmin,
    handleSetSimpleMode,
    handleSetAdvancedMode,
    handleSetExpertMode,
  ]);

  /**
   * Mode-specific keyboard handlers for KeyboardManager
   */
  const keyboardHandlers = {
    cycleMode: handleCycleMode,
    cycleModeReverse: handleCycleModeReverse,
    toggleAdminOverlay: handleToggleAdmin,
    setSimpleMode: handleSetSimpleMode,
    setAdvancedMode: handleSetAdvancedMode,
    setExpertMode: handleSetExpertMode,
  };

  return (
    <KeyboardManager
      onShortcut={handleShortcut}
      handlers={keyboardHandlers}
      showStats={config.components.showTechnicalDetails}
      showVisualFeedback={true}
      className="mode-keyboard-integration"
    />
  );
};

/**
 * Hook to get mode-aware keyboard handlers
 * Use this if you want to create your own keyboard integration
 */
export const useModeKeyboardHandlers = () => {
  const {
    currentMode,
    adminOverlay,
    setMode,
    cycleMode,
    toggleAdmin,
  } = useModeContext();

  return {
    handlers: {
      cycleMode: () => cycleMode(false),
      cycleModeReverse: () => cycleMode(true),
      toggleAdminOverlay: () => toggleAdmin(),
      setSimpleMode: () => setMode('simple', 'keyboard'),
      setAdvancedMode: () => setMode('advanced', 'keyboard'),
      setExpertMode: () => setMode('expert', 'keyboard'),
    },
    currentMode,
    adminOverlay,
  };
};

/**
 * Mode Status Indicator
 * Shows current mode and keyboard shortcuts in a subtle way
 */
export const ModeStatusIndicator: React.FC<{ 
  showShortcuts?: boolean;
  className?: string;
}> = ({ 
  showShortcuts = true,
  className = '' 
}) => {
  const { currentMode, config, adminOverlay } = useModeContext();

  return (
    <div className={`mode-status-indicator ${className}`}>
      <div className="flex items-center gap-2 px-3 py-1 bg-black/20 border border-white/10 rounded-full backdrop-blur-sm">
        <div 
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: config.color }}
        />
        <span className="text-xs font-medium text-white capitalize">
          {currentMode}
        </span>
        {adminOverlay && (
          <div className="w-1 h-1 bg-yellow-400 rounded-full" />
        )}
        {showShortcuts && (
          <span className="text-xs text-gray-400 ml-1">
            Ctrl+M
          </span>
        )}
      </div>
    </div>
  );
};

export default ModeKeyboardIntegration;