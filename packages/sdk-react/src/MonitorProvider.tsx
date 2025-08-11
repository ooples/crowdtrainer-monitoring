import React, { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { MonitorConfig, MonitorInstance, MonitorContextValue, EventMetadata, PerformanceMetric, MonitoringEvent } from './types';

/**
 * Props for the MonitorProvider component
 */
export interface MonitorProviderProps {
  config: MonitorConfig;
  children: ReactNode;
}

/**
 * Monitor context for sharing monitoring instance across components
 */
const MonitorContext = createContext<MonitorContextValue | null>(null);

/**
 * Custom hook to access the monitor context
 */
export const useMonitorContext = (): MonitorContextValue => {
  const context = useContext(MonitorContext);
  if (!context) {
    throw new Error('useMonitorContext must be used within a MonitorProvider');
  }
  return context;
};

/**
 * Create a monitor instance based on configuration
 */
function createMonitorInstance(config: MonitorConfig): MonitorInstance {
  const eventBuffer: MonitoringEvent[] = [];
  const metricBuffer: PerformanceMetric[] = [];
  let flushTimeout: NodeJS.Timeout | null = null;
  
  const environment = config.environment || 
    (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  
  const bufferSize = config.bufferSize || 100;
  const flushInterval = config.flushInterval || 30000; // 30 seconds
  
  // Flush function to send data to the server
  const flush = async (): Promise<void> => {
    if (eventBuffer.length === 0 && metricBuffer.length === 0) {
      return;
    }
    
    if (!config.apiKey || !config.apiEndpoint) {
      if (config.debug) {
        console.warn('[Monitor] No API key or endpoint configured, events will not be sent');
        console.log('[Monitor] Buffered events:', eventBuffer);
        console.log('[Monitor] Buffered metrics:', metricBuffer);
      }
      eventBuffer.length = 0;
      metricBuffer.length = 0;
      return;
    }
    
    try {
      const payload = {
        events: [...eventBuffer],
        metrics: [...metricBuffer],
        timestamp: new Date().toISOString(),
        environment,
        userId: config.userId,
        sessionId: config.sessionId,
        tags: config.customTags
      };
      
      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'X-Monitor-Version': '1.0.0'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send monitoring data: ${response.status} ${response.statusText}`);
      }
      
      if (config.debug) {
        console.log(`[Monitor] Successfully sent ${eventBuffer.length} events and ${metricBuffer.length} metrics`);
      }
      
      // Clear buffers after successful send
      eventBuffer.length = 0;
      metricBuffer.length = 0;
    } catch (error) {
      if (config.debug) {
        console.error('[Monitor] Failed to send monitoring data:', error);
      }
      // Keep data in buffer for retry on next flush
    }
  };
  
  // Auto-flush when buffer is full or on interval
  const scheduleFlush = (): void => {
    if (eventBuffer.length >= bufferSize || metricBuffer.length >= bufferSize) {
      flush();
      return;
    }
    
    if (flushTimeout) {
      clearTimeout(flushTimeout);
    }
    
    flushTimeout = setTimeout(() => {
      flush();
    }, flushInterval);
  };
  
  // Helper to add event to buffer
  const addEvent = (event: Omit<MonitoringEvent, 'id' | 'timestamp' | 'environment'>): void => {
    const fullEvent: MonitoringEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      environment,
      userId: config.userId,
      sessionId: config.sessionId,
      metadata: {
        ...event.metadata,
        ...config.customTags,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined
      }
    };
    
    eventBuffer.push(fullEvent);
    scheduleFlush();
    
    if (config.debug) {
      console.log('[Monitor] Event tracked:', fullEvent);
    }
  };
  
  // Helper to add metric to buffer
  const addMetric = (metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'environment'>): void => {
    const fullMetric: PerformanceMetric = {
      ...metric,
      id: `met_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      environment,
      userId: config.userId,
      sessionId: config.sessionId,
      metadata: {
        ...metric.metadata,
        ...config.customTags,
        url: typeof window !== 'undefined' ? window.location.href : undefined
      }
    };
    
    metricBuffer.push(fullMetric);
    scheduleFlush();
    
    if (config.debug) {
      console.log('[Monitor] Metric tracked:', fullMetric);
    }
  };
  
  // Monitor instance implementation
  const monitor: MonitorInstance = {
    // Event tracking
    trackEvent: (action: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'feature_usage',
        category: 'general',
        action,
        metadata
      });
    },
    
    trackUserEvent: (action: string, category: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'user_journey',
        category,
        action,
        metadata
      });
    },
    
    trackError: (error: Error, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'error',
        category: 'client_error',
        action: 'error_occurred',
        severity: 'high',
        metadata: {
          ...metadata,
          errorMessage: error.message,
          errorStack: error.stack,
          errorName: error.name
        }
      });
    },
    
    // Performance tracking
    trackMetric: (name: string, value: number, unit: PerformanceMetric['unit'] = 'count', metadata: EventMetadata = {}) => {
      addMetric({
        type: 'feature_interaction',
        name,
        value,
        unit,
        metadata
      });
    },
    
    trackRenderTime: (componentName: string, renderTime: number, metadata: EventMetadata = {}) => {
      addMetric({
        type: 'component_render',
        name: `${componentName}_render`,
        value: renderTime,
        unit: 'ms',
        metadata: {
          ...metadata,
          component: componentName,
          renderPhase: 'update'
        }
      });
    },
    
    trackInteractionTime: (action: string, duration: number, metadata: EventMetadata = {}) => {
      addMetric({
        type: 'user_interaction',
        name: `${action}_duration`,
        value: duration,
        unit: 'ms',
        metadata
      });
    },
    
    // OAuth tracking
    trackOAuthAttempt: (provider: 'google' | 'github', metadata: EventMetadata = {}) => {
      addEvent({
        type: 'auth',
        category: 'oauth',
        action: 'attempt',
        metadata: { ...metadata, provider }
      });
    },
    
    trackOAuthSuccess: (provider: 'google' | 'github', userId: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'auth',
        category: 'oauth',
        action: 'success',
        userId,
        metadata: { ...metadata, provider }
      });
    },
    
    trackOAuthError: (provider: 'google' | 'github', error: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'auth',
        category: 'oauth',
        action: 'error',
        severity: 'medium',
        metadata: { ...metadata, provider, errorMessage: error }
      });
    },
    
    // Payment tracking
    trackPaymentAttempt: (amount: number, currency: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'payment',
        category: 'stripe',
        action: 'attempt',
        metadata: { ...metadata, amount, currency }
      });
    },
    
    trackPaymentSuccess: (amount: number, currency: string, paymentId: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'payment',
        category: 'stripe',
        action: 'success',
        metadata: { ...metadata, amount, currency, paymentId }
      });
    },
    
    trackPaymentError: (amount: number, currency: string, error: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'payment',
        category: 'stripe',
        action: 'error',
        severity: 'high',
        metadata: { ...metadata, amount, currency, errorMessage: error }
      });
    },
    
    // Component lifecycle
    trackComponentMount: (componentName: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'component',
        category: 'lifecycle',
        action: 'mount',
        metadata: { ...metadata, component: componentName }
      });
    },
    
    trackComponentUnmount: (componentName: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'component',
        category: 'lifecycle',
        action: 'unmount',
        metadata: { ...metadata, component: componentName }
      });
    },
    
    trackComponentUpdate: (componentName: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'component',
        category: 'lifecycle',
        action: 'update',
        metadata: { ...metadata, component: componentName }
      });
    },
    
    trackComponentError: (componentName: string, error: Error, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'error',
        category: 'component_error',
        action: 'error_boundary_triggered',
        severity: 'high',
        metadata: {
          ...metadata,
          component: componentName,
          errorMessage: error.message,
          errorStack: error.stack
        }
      });
    },
    
    // User journey
    trackPageView: (route: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'user_journey',
        category: 'navigation',
        action: 'page_view',
        metadata: { ...metadata, route }
      });
    },
    
    trackUserAction: (action: string, target: string, metadata: EventMetadata = {}) => {
      addEvent({
        type: 'interaction',
        category: 'user_action',
        action,
        metadata: { ...metadata, targetElement: target }
      });
    },
    
    // Configuration methods
    setUserId: (userId: string) => {
      config.userId = userId;
    },
    
    setSessionId: (sessionId: string) => {
      config.sessionId = sessionId;
    },
    
    addTags: (tags: Record<string, string>) => {
      config.customTags = { ...config.customTags, ...tags };
    },
    
    flush
  };
  
  return monitor;
}

/**
 * MonitorProvider component that provides monitoring context to child components
 */
export const MonitorProvider: React.FC<MonitorProviderProps> = ({ config, children }) => {
  const monitor = useMemo(() => createMonitorInstance(config), [config]);
  
  const contextValue = useMemo((): MonitorContextValue => ({
    monitor,
    config,
    isEnabled: !!(config.apiKey || config.debug)
  }), [monitor, config]);
  
  // Auto-track page views if enabled
  useEffect(() => {
    if (config.enableAutoTracking && typeof window !== 'undefined') {
      monitor.trackPageView(window.location.pathname);
      
      // Track navigation changes
      const handleRouteChange = () => {
        monitor.trackPageView(window.location.pathname);
      };
      
      // Listen to browser navigation
      window.addEventListener('popstate', handleRouteChange);
      
      return () => {
        window.removeEventListener('popstate', handleRouteChange);
      };
    }
  }, [config.enableAutoTracking, monitor]);
  
  // Flush on unmount
  useEffect(() => {
    return () => {
      monitor.flush();
    };
  }, [monitor]);
  
  if (config.debug) {
    console.log('[Monitor] Provider initialized with config:', config);
  }
  
  return (
    <MonitorContext.Provider value={contextValue}>
      {children}
    </MonitorContext.Provider>
  );
};

export type { MonitorConfig, MonitorContextValue };