import { useCallback, useEffect, useRef } from 'react';
import { useMonitorContext } from '../MonitorProvider';
import { EventMetadata, MonitoringHook } from '../types';

/**
 * Main hook for accessing monitoring functionality
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { monitor, isEnabled } = useMonitor();
 *   
 *   const handleClick = () => {
 *     monitor.trackEvent('button_click', { component: 'MyComponent' });
 *   };
 *   
 *   return <button onClick={handleClick}>Click me</button>;
 * }
 * ```
 */
export const useMonitor = (): MonitoringHook => {
  const context = useMonitorContext();
  
  return {
    monitor: context.monitor,
    isEnabled: context.isEnabled,
    config: context.config
  };
};

/**
 * Hook for tracking component lifecycle events automatically
 * 
 * @param componentName - Name of the component
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useMonitorLifecycle('MyComponent', {
 *     trackMounts: true,
 *     trackUpdates: false,
 *     metadata: { version: '1.0' }
 *   });
 *   
 *   return <div>Component content</div>;
 * }
 * ```
 */
export const useMonitorLifecycle = (
  componentName: string,
  options: {
    trackMounts?: boolean;
    trackUpdates?: boolean;
    trackUnmounts?: boolean;
    metadata?: EventMetadata;
  } = {}
) => {
  const { monitor, isEnabled } = useMonitor();
  const {
    trackMounts = true,
    trackUpdates = false,
    trackUnmounts = true,
    metadata = {}
  } = options;
  
  const renderCount = useRef(0);
  const mountTime = useRef<number>(0);
  
  // Track component mount
  useEffect(() => {
    if (!isEnabled || !trackMounts) return;
    
    mountTime.current = performance.now();
    monitor.trackComponentMount(componentName, {
      ...metadata,
      mountTimestamp: new Date().toISOString()
    });
    
    // Track component unmount
    return () => {
      if (trackUnmounts) {
        const lifespan = performance.now() - mountTime.current;
        monitor.trackComponentUnmount(componentName, {
          ...metadata,
          lifespan: Math.round(lifespan),
          renderCount: renderCount.current
        });
      }
    };
  }, [isEnabled, componentName, trackMounts, trackUnmounts, metadata, monitor]);
  
  // Track component updates
  useEffect(() => {
    if (!isEnabled || !trackUpdates) return;
    
    renderCount.current += 1;
    
    // Skip tracking the initial render (already tracked as mount)
    if (renderCount.current > 1) {
      monitor.trackComponentUpdate(componentName, {
        ...metadata,
        renderCount: renderCount.current,
        updateTimestamp: new Date().toISOString()
      });
    }
  });
  
  return {
    renderCount: renderCount.current,
    trackUpdate: useCallback((updateMetadata?: EventMetadata) => {
      if (isEnabled) {
        monitor.trackComponentUpdate(componentName, {
          ...metadata,
          ...updateMetadata,
          manualUpdate: true
        });
      }
    }, [isEnabled, monitor, componentName, metadata])
  };
};

/**
 * Hook for tracking render performance
 * 
 * @param componentName - Name of the component
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { startRender, endRender } = useMonitorRenderPerformance('MyComponent');
 *   
 *   useLayoutEffect(() => {
 *     startRender();
 *     // Expensive operations...
 *     endRender();
 *   });
 *   
 *   return <div>Component content</div>;
 * }
 * ```
 */
export const useMonitorRenderPerformance = (
  componentName: string,
  options: {
    threshold?: number; // Only track if render time exceeds threshold (ms)
    metadata?: EventMetadata;
    enabled?: boolean;
  } = {}
) => {
  const { monitor, isEnabled } = useMonitor();
  const { threshold = 0, metadata = {}, enabled = true } = options;
  
  const startTime = useRef<number>(0);
  const renderPhase = useRef<'mount' | 'update'>('mount');
  
  const startRender = useCallback((phase: 'mount' | 'update' = 'update') => {
    if (isEnabled && enabled) {
      startTime.current = performance.now();
      renderPhase.current = phase;
    }
  }, [isEnabled, enabled]);
  
  const endRender = useCallback((endMetadata?: EventMetadata) => {
    if (!isEnabled || !enabled || startTime.current === 0) return;
    
    const renderTime = performance.now() - startTime.current;
    
    // Only track if render time exceeds threshold
    if (renderTime >= threshold) {
      monitor.trackRenderTime(componentName, renderTime, {
        ...metadata,
        ...endMetadata,
        renderPhase: renderPhase.current,
        threshold
      });
    }
    
    startTime.current = 0;
  }, [isEnabled, enabled, monitor, componentName, threshold, metadata]);
  
  // Auto-track using useEffect (less precise but easier to use)
  const autoTrack = useCallback((phase: 'mount' | 'update' = 'update') => {
    const start = performance.now();
    
    // Use a microtask to measure after render completes
    Promise.resolve().then(() => {
      const end = performance.now();
      const renderTime = end - start;
      
      if (isEnabled && enabled && renderTime >= threshold) {
        monitor.trackRenderTime(componentName, renderTime, {
          ...metadata,
          renderPhase: phase,
          autoTracked: true
        });
      }
    });
  }, [isEnabled, enabled, monitor, componentName, threshold, metadata]);
  
  return {
    startRender,
    endRender,
    autoTrack
  };
};

/**
 * Hook for tracking user interactions with debouncing
 * 
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function MyButton() {
 *   const trackInteraction = useMonitorInteractions({
 *     debounceMs: 500,
 *     metadata: { component: 'MyButton' }
 *   });
 *   
 *   return (
 *     <button onClick={trackInteraction('click', { target: 'submit_button' })}>
 *       Submit
 *     </button>
 *   );
 * }
 * ```
 */
export const useMonitorInteractions = (options: {
  debounceMs?: number;
  metadata?: EventMetadata;
  enabled?: boolean;
} = {}) => {
  const { monitor, isEnabled } = useMonitor();
  const { debounceMs = 0, metadata = {}, enabled = true } = options;
  
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const trackInteraction = useCallback((
    action: string,
    interactionMetadata?: EventMetadata
  ) => {
    return (event?: React.SyntheticEvent) => {
      if (!isEnabled || !enabled) return;
      
      const key = `${action}_${JSON.stringify(interactionMetadata)}`;
      
      // Clear existing timer for this interaction
      const existingTimer = debounceTimers.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set up new timer
      const timer = setTimeout(() => {
        let eventMetadata = { ...metadata, ...interactionMetadata };
        
        // Extract event information if available
        if (event) {
          eventMetadata = {
            ...eventMetadata,
            targetTagName: event.currentTarget?.tagName,
            targetType: (event.currentTarget as HTMLInputElement)?.type,
            targetId: (event.currentTarget as HTMLElement)?.id,
            targetClassName: (event.currentTarget as HTMLElement)?.className
          };
          
          // Add mouse event data if available
          if ('clientX' in event && 'clientY' in event) {
            eventMetadata.coordinates = {
              x: (event as React.MouseEvent).clientX,
              y: (event as React.MouseEvent).clientY
            };
          }
        }
        
        monitor.trackUserAction(action, eventMetadata.targetTagName || 'unknown', eventMetadata);
        debounceTimers.current.delete(key);
      }, debounceMs);
      
      debounceTimers.current.set(key, timer);
    };
  }, [isEnabled, enabled, monitor, debounceMs, metadata]);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(timer => clearTimeout(timer));
      debounceTimers.current.clear();
    };
  }, []);
  
  return trackInteraction;
};

/**
 * Hook for tracking custom business events
 * 
 * @param category - Event category
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function PurchaseFlow() {
 *   const trackPurchase = useMonitorBusinessEvents('purchase');
 *   
 *   const handlePurchase = async () => {
 *     trackPurchase('attempt', { amount: 99.99, currency: 'USD' });
 *     try {
 *       await processPurchase();
 *       trackPurchase('success', { paymentId: 'pay_123' });
 *     } catch (error) {
 *       trackPurchase('error', { error: error.message });
 *     }
 *   };
 *   
 *   return <button onClick={handlePurchase}>Purchase</button>;
 * }
 * ```
 */
export const useMonitorBusinessEvents = (
  category: string,
  options: {
    metadata?: EventMetadata;
    enabled?: boolean;
  } = {}
) => {
  const { monitor, isEnabled } = useMonitor();
  const { metadata = {}, enabled = true } = options;
  
  const trackEvent = useCallback((
    action: string,
    eventMetadata?: EventMetadata
  ) => {
    if (isEnabled && enabled) {
      monitor.trackUserEvent(action, category, {
        ...metadata,
        ...eventMetadata,
        timestamp: new Date().toISOString()
      });
    }
  }, [isEnabled, enabled, monitor, category, metadata]);
  
  return trackEvent;
};