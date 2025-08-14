'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, Settings } from 'lucide-react';
import { useMode, UseModeReturn, ModeChangeEvent } from '@/hooks/useMode';
import { DashboardMode } from '@/lib/mode-storage';
import { GlassCard } from '@/components/ui/glass-card';

/**
 * Mode Context Interface
 */
interface ModeContextType extends UseModeReturn {
  // Additional context-specific methods
  showModeChangeNotification: (mode: DashboardMode, source?: string) => void;
}

/**
 * Mode Provider Props
 */
interface ModeProviderProps {
  children: React.ReactNode;
  showNotifications?: boolean;
  enableKeyboardShortcuts?: boolean;
  enableCrossTtabSync?: boolean;
  className?: string;
}

/**
 * Notification interface
 */
interface ModeNotification {
  id: string;
  mode: DashboardMode;
  source: string;
  timestamp: number;
  duration: number;
}

// Create the context with undefined default
const ModeContext = createContext<ModeContextType | undefined>(undefined);

/**
 * Mode Provider Component
 * Provides mode management context to all child components
 */
export const ModeProvider: React.FC<ModeProviderProps> = ({
  children,
  showNotifications = true,
  enableKeyboardShortcuts = true,
  enableCrossTtabSync = true,
  className = '',
}) => {
  const mode = useMode();
  const [notifications, setNotifications] = useState<ModeNotification[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Show mode change notification
   */
  const showModeChangeNotification = useCallback((
    changedMode: DashboardMode,
    source: string = 'user'
  ) => {
    if (!showNotifications) return;

    const notification: ModeNotification = {
      id: `mode-${changedMode}-${Date.now()}`,
      mode: changedMode,
      source,
      timestamp: Date.now(),
      duration: 3000,
    };

    setNotifications(prev => [...prev, notification]);

    // Auto-remove notification after duration
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, notification.duration);
  }, [showNotifications]);

  /**
   * Handle mode change events
   */
  const handleModeChange = useCallback((event: ModeChangeEvent) => {
    const sourceLabels = {
      user: 'manually',
      keyboard: 'via keyboard shortcut',
      system: 'automatically',
    };

    showModeChangeNotification(
      event.newMode,
      sourceLabels[event.source] || event.source
    );

    // Custom event for other components to listen to
    const customEvent = new CustomEvent('dashboard-mode-changed', {
      detail: {
        previousMode: event.previousMode,
        newMode: event.newMode,
        source: event.source,
        timestamp: event.timestamp,
      }
    });
    
    window.dispatchEvent(customEvent);
  }, [showModeChangeNotification]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyboardShortcuts = useCallback((event: KeyboardEvent) => {
    if (!enableKeyboardShortcuts || mode.isLoading) return;

    // Ctrl+M or Cmd+M to cycle modes
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
      event.preventDefault();
      event.stopPropagation();
      
      // Shift + Ctrl+M to reverse cycle
      mode.cycleMode(event.shiftKey);
    }

    // Ctrl+Shift+A or Cmd+Shift+A to toggle admin overlay
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      event.stopPropagation();
      mode.toggleAdmin();
    }
  }, [enableKeyboardShortcuts, mode]);

  /**
   * Handle focus management for accessibility
   */
  const handleFocusManagement = useCallback(() => {
    if (mode.isLoading) return;

    // Announce mode changes for screen readers
    const announcement = `Dashboard mode changed to ${mode.config.name}. ${mode.config.description}`;
    
    // Create temporary element for screen reader announcement
    const announcement_element = document.createElement('div');
    announcement_element.setAttribute('aria-live', 'polite');
    announcement_element.setAttribute('aria-atomic', 'true');
    announcement_element.setAttribute('class', 'sr-only');
    announcement_element.textContent = announcement;
    
    document.body.appendChild(announcement_element);
    
    // Remove after screen readers have had time to announce
    setTimeout(() => {
      document.body.removeChild(announcement_element);
    }, 1000);
  }, [mode.config.name, mode.config.description, mode.isLoading]);

  // Initialize mode change listener
  useEffect(() => {
    if (!mode.isLoading && !isInitialized) {
      setIsInitialized(true);
      
      // Register mode change callback
      const cleanup = mode.onModeChange(handleModeChange);
      
      return cleanup;
    }
  }, [mode.isLoading, mode.onModeChange, handleModeChange, isInitialized]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (enableKeyboardShortcuts && !mode.isLoading) {
      document.addEventListener('keydown', handleKeyboardShortcuts, true);
      
      return () => {
        document.removeEventListener('keydown', handleKeyboardShortcuts, true);
      };
    }
  }, [enableKeyboardShortcuts, handleKeyboardShortcuts, mode.isLoading]);

  // Handle accessibility announcements
  useEffect(() => {
    if (isInitialized) {
      handleFocusManagement();
    }
  }, [mode.currentMode, handleFocusManagement, isInitialized]);

  // Get notification icon based on mode
  const getNotificationIcon = (notificationMode: DashboardMode) => {
    switch (notificationMode) {
      case 'simple':
        return CheckCircle;
      case 'advanced':
        return Info;
      case 'expert':
        return Settings;
      default:
        return AlertCircle;
    }
  };

  // Get notification color based on mode
  const getNotificationColor = (notificationMode: DashboardMode) => {
    switch (notificationMode) {
      case 'simple':
        return 'text-green-400';
      case 'advanced':
        return 'text-blue-400';
      case 'expert':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  // Context value with additional methods
  const contextValue: ModeContextType = {
    ...mode,
    showModeChangeNotification,
  };

  return (
    <ModeContext.Provider value={contextValue}>
      <div className={`mode-provider ${className}`} data-mode={mode.currentMode}>
        {/* Main content */}
        <div className="mode-content">
          {children}
        </div>

        {/* Mode change notifications */}
        <AnimatePresence>
          {notifications.map((notification) => {
            const Icon = getNotificationIcon(notification.mode);
            const colorClass = getNotificationColor(notification.mode);
            
            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, scale: 0.8, x: 100 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 100 }}
                className="fixed top-4 right-4 z-50 pointer-events-none"
                style={{ marginTop: `${notifications.indexOf(notification) * 80}px` }}
              >
                <GlassCard className="p-4 min-w-[300px]">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${colorClass}`} />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-white">
                        Mode Changed
                      </h4>
                      <p className="text-xs text-gray-300">
                        Switched to <span className="capitalize font-medium">{notification.mode}</span> mode {notification.source}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Loading overlay */}
        <AnimatePresence>
          {mode.isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
            >
              <GlassCard className="p-6">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"
                  />
                  <span className="text-white font-medium">Loading dashboard mode...</span>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Admin overlay indicator */}
        <AnimatePresence>
          {mode.adminOverlay && !mode.isLoading && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-0 left-0 right-0 z-40 bg-yellow-500/90 backdrop-blur-sm"
            >
              <div className="px-4 py-2 text-center">
                <div className="flex items-center justify-center gap-2 text-black font-medium">
                  <Settings className="w-4 h-4" />
                  <span>Admin Mode Active</span>
                  <span className="text-xs opacity-75">
                    Press Ctrl+Shift+A to exit
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Screen reader announcements */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {!mode.isLoading && (
            `Dashboard is in ${mode.config.name} mode. ${mode.config.description} Press Ctrl+M to cycle modes.`
          )}
        </div>
      </div>
    </ModeContext.Provider>
  );
};

/**
 * Hook to use mode context
 * Provides mode management functionality to components
 */
export const useModeContext = (): ModeContextType => {
  const context = useContext(ModeContext);
  
  if (context === undefined) {
    throw new Error('useModeContext must be used within a ModeProvider');
  }
  
  return context;
};

/**
 * Higher-order component to provide mode context
 */
export const withModeProvider = <P extends object>(
  Component: React.ComponentType<P>,
  providerProps?: Omit<ModeProviderProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ModeProvider {...providerProps}>
      <Component {...props} />
    </ModeProvider>
  );
  
  WrappedComponent.displayName = `withModeProvider(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

/**
 * Mode-aware component wrapper
 * Conditionally renders children based on current mode
 */
interface ModeGuardProps {
  children: React.ReactNode;
  modes?: DashboardMode[];
  requiredFeatures?: Array<keyof import('@/hooks/useMode').ModeConfig['components']>;
  fallback?: React.ReactNode;
  className?: string;
}

export const ModeGuard: React.FC<ModeGuardProps> = ({
  children,
  modes = [],
  requiredFeatures = [],
  fallback = null,
  className = '',
}) => {
  const { currentMode, canAccess } = useModeContext();
  
  // Check if current mode is allowed
  const modeAllowed = modes.length === 0 || modes.includes(currentMode);
  
  // Check if all required features are available
  const featuresAvailable = requiredFeatures.length === 0 || 
    requiredFeatures.every(feature => canAccess(feature));
  
  const shouldRender = modeAllowed && featuresAvailable;
  
  if (!shouldRender) {
    return <div className={className}>{fallback}</div>;
  }
  
  return <div className={className}>{children}</div>;
};

export default ModeProvider;