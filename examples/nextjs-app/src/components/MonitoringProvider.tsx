'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';

interface MonitoringConfig {
  apiEndpoint: string;
  enableRealTime: boolean;
  enableUserJourney: boolean;
  enablePerformanceTracking: boolean;
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
}

interface MonitoringContextType {
  config: MonitoringConfig;
  isInitialized: boolean;
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

interface MonitoringProviderProps {
  children: ReactNode;
  config: MonitoringConfig;
}

export function MonitoringProvider({ children, config }: MonitoringProviderProps) {
  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    // Initialize monitoring system
    const initializeMonitoring = async () => {
      try {
        if (config.debug) {
          console.log('[Monitoring] Initializing with config:', config);
        }

        // Set up global error handlers
        const handleError = (event: ErrorEvent) => {
          const error = {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
            timestamp: new Date().toISOString(),
          };

          if (config.debug) {
            console.error('[Monitoring] JavaScript Error:', error);
          }

          // Send to monitoring API
          fetch(`${config.apiEndpoint}/events`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'error',
              category: 'javascript',
              action: 'unhandled_error',
              metadata: error,
              environment: config.environment,
              severity: 'high',
            }),
          }).catch(err => {
            console.error('[Monitoring] Failed to send error event:', err);
          });
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
          const error = {
            reason: event.reason,
            timestamp: new Date().toISOString(),
          };

          if (config.debug) {
            console.error('[Monitoring] Unhandled Promise Rejection:', error);
          }

          fetch(`${config.apiEndpoint}/events`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'error',
              category: 'promise',
              action: 'unhandled_rejection',
              metadata: error,
              environment: config.environment,
              severity: 'high',
            }),
          }).catch(err => {
            console.error('[Monitoring] Failed to send rejection event:', err);
          });
        };

        // Add event listeners
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // Track page performance if enabled
        if (config.enablePerformanceTracking && typeof window !== 'undefined' && window.performance) {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            
            entries.forEach((entry) => {
              if (entry.entryType === 'navigation') {
                const navEntry = entry as PerformanceNavigationTiming;
                
                fetch(`${config.apiEndpoint}/performance`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    type: 'page_load',
                    name: 'navigation_timing',
                    value: navEntry.loadEventEnd - navEntry.loadEventStart,
                    unit: 'ms',
                    metadata: {
                      domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
                      firstContentfulPaint: navEntry.domContentLoadedEventEnd - navEntry.fetchStart,
                      path: window.location.pathname,
                    },
                    environment: config.environment,
                  }),
                }).catch(err => {
                  if (config.debug) {
                    console.error('[Monitoring] Failed to send performance event:', err);
                  }
                });
              }
            });
          });

          observer.observe({ entryTypes: ['navigation', 'measure'] });

          // Cleanup function
          return () => {
            observer.disconnect();
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
          };
        }

        setIsInitialized(true);

        if (config.debug) {
          console.log('[Monitoring] Initialization completed');
        }

      } catch (error) {
        console.error('[Monitoring] Failed to initialize:', error);
      }
    };

    initializeMonitoring();
  }, [config]);

  const contextValue: MonitoringContextType = {
    config,
    isInitialized,
  };

  return (
    <MonitoringContext.Provider value={contextValue}>
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoringContext() {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoringContext must be used within a MonitoringProvider');
  }
  return context;
}