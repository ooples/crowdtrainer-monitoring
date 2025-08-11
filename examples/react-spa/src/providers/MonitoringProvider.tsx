import React, { createContext, useContext, useEffect, useState } from 'react';

interface MonitoringEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  metadata?: Record<string, any>;
}

interface MonitoringConfig {
  apiEndpoint: string;
  enableRealTime: boolean;
  enableUserJourney: boolean;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
  userId?: string;
  sessionId: string;
}

interface MonitoringContextType {
  track: (event: MonitoringEvent) => void;
  trackError: (error: Error, context?: Partial<MonitoringEvent>) => void;
  trackPerformance: (metric: PerformanceMetric) => void;
  setUserId: (userId: string) => void;
  config: MonitoringConfig;
  isOnline: boolean;
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

interface MonitoringProviderProps {
  children: React.ReactNode;
  config: MonitoringConfig;
}

export function MonitoringProvider({ children, config }: MonitoringProviderProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [eventQueue, setEventQueue] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState(config.userId);

  useEffect(() => {
    // Setup online/offline detection
    const handleOnline = () => {
      setIsOnline(true);
      if (config.debug) {
        console.log('[Monitoring] Connection restored, flushing queued events');
      }
      flushEventQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (config.debug) {
        console.log('[Monitoring] Connection lost, queuing events');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Setup global error handlers
    if (config.enableErrorTracking) {
      const handleError = (event: ErrorEvent) => {
        trackError(new Error(event.message), {
          category: 'javascript_error',
          action: 'window_error',
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        });
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        trackError(new Error(event.reason?.message || 'Unhandled Promise Rejection'), {
          category: 'promise_rejection',
          action: 'unhandled_rejection',
          metadata: {
            reason: event.reason,
          },
        });
      };

      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [config]);

  // Performance monitoring setup
  useEffect(() => {
    if (config.enablePerformanceTracking) {
      // Track page load performance
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;

        trackPerformance({
          name: 'page_load_time',
          value: loadTime,
          unit: 'ms',
          metadata: {
            dom_ready_time: domReady,
            dns_time: timing.domainLookupEnd - timing.domainLookupStart,
            tcp_time: timing.connectEnd - timing.connectStart,
          },
        });
      }

      // Setup Performance Observer for web vitals
      if ('PerformanceObserver' in window) {
        try {
          // Largest Contentful Paint
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            
            trackPerformance({
              name: 'largest_contentful_paint',
              value: lastEntry.startTime,
              unit: 'ms',
              metadata: {
                element: lastEntry.element?.tagName || 'unknown',
              },
            });
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

          // First Input Delay
          const fidObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              trackPerformance({
                name: 'first_input_delay',
                value: entry.processingStart - entry.startTime,
                unit: 'ms',
                metadata: {
                  input_type: entry.name,
                },
              });
            }
          });
          fidObserver.observe({ entryTypes: ['first-input'] });

          // Cumulative Layout Shift
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            
            trackPerformance({
              name: 'cumulative_layout_shift',
              value: clsValue,
              unit: 'count',
            });
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });

        } catch (error) {
          if (config.debug) {
            console.warn('[Monitoring] Performance Observer not fully supported:', error);
          }
        }
      }
    }
  }, [config.enablePerformanceTracking]);

  const sendEvent = async (eventData: any) => {
    if (!isOnline) {
      setEventQueue(prev => [...prev, eventData]);
      return;
    }

    try {
      const response = await fetch(`${config.apiEndpoint}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (config.debug) {
        console.log('[Monitoring] Event sent successfully:', eventData);
      }
    } catch (error) {
      if (config.debug) {
        console.error('[Monitoring] Failed to send event:', error);
      }
      // Queue the event for retry
      setEventQueue(prev => [...prev, eventData]);
    }
  };

  const flushEventQueue = async () => {
    if (eventQueue.length === 0) return;

    const events = [...eventQueue];
    setEventQueue([]);

    for (const event of events) {
      await sendEvent(event);
    }
  };

  const track = (event: MonitoringEvent) => {
    const eventData = {
      type: 'event',
      category: event.category,
      action: event.action,
      label: event.label,
      value: event.value,
      userId: currentUserId,
      sessionId: config.sessionId,
      metadata: {
        ...event.metadata,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
      environment: config.environment,
    };

    sendEvent(eventData);
  };

  const trackError = (error: Error, context: Partial<MonitoringEvent> = {}) => {
    const errorData = {
      type: 'error',
      category: context.category || 'application_error',
      action: context.action || 'error_occurred',
      label: context.label || error.name,
      userId: currentUserId,
      sessionId: config.sessionId,
      metadata: {
        ...context.metadata,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
      environment: config.environment,
      severity: 'high',
    };

    sendEvent(errorData);
  };

  const trackPerformance = (metric: PerformanceMetric) => {
    const performanceData = {
      type: 'performance',
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      userId: currentUserId,
      sessionId: config.sessionId,
      metadata: {
        ...metric.metadata,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
      environment: config.environment,
    };

    sendEvent(performanceData);
  };

  const setUserId = (userId: string) => {
    setCurrentUserId(userId);
    
    // Track user identification event
    track({
      category: 'user',
      action: 'identified',
      metadata: {
        previous_user_id: currentUserId,
        new_user_id: userId,
      },
    });
  };

  const contextValue: MonitoringContextType = {
    track,
    trackError,
    trackPerformance,
    setUserId,
    config: { ...config, userId: currentUserId },
    isOnline,
  };

  return (
    <MonitoringContext.Provider value={contextValue}>
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  return context;
}