import React, { ComponentType, useEffect, useRef, forwardRef } from 'react';
import { useMonitor, useMonitorLifecycle } from '../hooks/useMonitor';
import { usePerformanceMetric } from '../hooks/useMetric';
import { EventMetadata, WithMonitoringProps } from '../types';

/**
 * Configuration options for the withMonitoring HOC
 */
export interface WithMonitoringOptions {
  // Component identification
  componentName?: string;
  displayName?: string;
  
  // Tracking options
  trackLifecycle?: boolean;
  trackRenders?: boolean;
  trackErrors?: boolean;
  trackInteractions?: boolean;
  trackProps?: boolean;
  trackPerformance?: boolean;
  
  // Performance thresholds
  renderTimeThreshold?: number; // ms
  updateCountThreshold?: number;
  
  // Metadata
  metadata?: EventMetadata;
  
  // Filtering
  excludeProps?: string[];
  includeProps?: string[];
  
  // Error handling
  isolateErrors?: boolean;
  
  // Debugging
  debug?: boolean;
}

/**
 * Default options for the withMonitoring HOC
 */
const DEFAULT_OPTIONS: WithMonitoringOptions = {
  trackLifecycle: true,
  trackRenders: false,
  trackErrors: true,
  trackInteractions: false,
  trackProps: false,
  trackPerformance: false,
  renderTimeThreshold: 16, // 60fps threshold
  updateCountThreshold: 100,
  isolateErrors: false,
  debug: false
};

/**
 * Higher-order component that adds monitoring capabilities to any React component
 * 
 * @param WrappedComponent - The component to wrap with monitoring
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * const MonitoredButton = withMonitoring(Button, {
 *   componentName: 'ActionButton',
 *   trackInteractions: true,
 *   trackPerformance: true,
 *   metadata: { category: 'ui', importance: 'high' }
 * });
 * 
 * // Usage
 * <MonitoredButton onClick={handleClick}>
 *   Click me
 * </MonitoredButton>
 * ```
 */
export function withMonitoring<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithMonitoringOptions = {}
): ComponentType<P & WithMonitoringProps> {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const {
    componentName: optionsComponentName,
    displayName,
    trackLifecycle,
    trackRenders,
    trackErrors,
    trackInteractions,
    trackProps,
    trackPerformance,
    renderTimeThreshold,
    updateCountThreshold,
    metadata = {},
    excludeProps = [],
    includeProps = [],
    isolateErrors,
    debug
  } = finalOptions;
  
  // Determine component name
  const componentName = optionsComponentName || 
    WrappedComponent.displayName || 
    WrappedComponent.name || 
    'Anonymous';
  
  const WithMonitoringComponent = forwardRef<any, P & WithMonitoringProps>((props, ref) => {
    const { __monitoring, ...restProps } = props;
    const monitoringConfig = { ...finalOptions, ...(__monitoring || {}) };
    
    const { monitor, isEnabled } = useMonitor();
    const renderCount = useRef(0);
    const lastProps = useRef<any>({});
    const errorCount = useRef(0);
    const performanceIssues = useRef(0);
    
    // Lifecycle tracking
    const { trackUpdate: _trackUpdate } = useMonitorLifecycle(componentName, {
      trackMounts: trackLifecycle,
      trackUpdates: trackRenders,
      trackUnmounts: trackLifecycle,
      metadata: { ...metadata, ...monitoringConfig.customMetadata, hoc: true }
    });
    
    // Performance tracking
    const { measureAsync: _measureAsync, measureSync: _measureSync, recordDuration } = usePerformanceMetric({
      metadata: { ...metadata, component: componentName },
      enabled: trackPerformance
    });
    
    // Track renders and performance
    useEffect(() => {
      if (!isEnabled) return () => {
        // No cleanup needed if monitoring is disabled
      };
      
      const renderStartTime = performance.now();
      renderCount.current++;
      
      // Track render performance
      if (trackPerformance || trackRenders) {
        Promise.resolve().then(() => {
          const renderTime = performance.now() - renderStartTime;
          
          if (renderTime > (renderTimeThreshold || 16)) {
            recordDuration('slow_render', renderTime, {
              component: componentName,
              renderCount: renderCount.current,
              threshold: renderTimeThreshold,
              isSlowRender: true
            });
            
            performanceIssues.current++;
            
            if (debug) {
              console.warn(
                `[Monitor] Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms ` +
                `(threshold: ${renderTimeThreshold}ms)`
              );
            }
          }
          
          // Track excessive re-renders
          if (renderCount.current > (updateCountThreshold || 100)) {
            monitor.trackEvent('excessive_rerenders', {
              ...metadata,
              component: componentName,
              renderCount: renderCount.current,
              threshold: updateCountThreshold,
              performanceIssues: performanceIssues.current
            });
            
            if (debug) {
              console.warn(
                `[Monitor] Excessive re-renders in ${componentName}: ${renderCount.current} renders`
              );
            }
          }
        });
      }
      
      // Track prop changes
      if (trackProps) {
        const currentProps = restProps as any;
        const propsToCheck = includeProps.length > 0 ? 
          includeProps : 
          Object.keys(currentProps).filter(key => !excludeProps.includes(key));
        
        propsToCheck.forEach(propName => {
          const oldValue = lastProps.current[propName];
          const newValue = currentProps[propName];
          
          if (oldValue !== newValue && renderCount.current > 1) { // Skip initial render
            monitor.trackEvent('prop_change', {
              ...metadata,
              component: componentName,
              propName,
              hasOldValue: oldValue !== undefined,
              hasNewValue: newValue !== undefined,
              valueType: typeof newValue,
              renderCount: renderCount.current
            });
            
            if (debug) {
              console.log(`[Monitor] Prop change in ${componentName}.${propName}:`, {
                old: oldValue,
                new: newValue
              });
            }
          }
        });
        
        lastProps.current = { ...currentProps };
      }
      
      // Return empty cleanup function
      return () => {};
    });
    
    // Error boundary functionality (if trackErrors is enabled)
    useEffect(() => {
      if (!trackErrors || !isEnabled) return () => {
        // No cleanup needed if error tracking is disabled
      };
      
      const handleError = (error: ErrorEvent) => {
        errorCount.current++;
        
        monitor.trackError(new Error(error.message), {
          ...metadata,
          component: componentName,
          errorCount: errorCount.current,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno,
          fromHOC: true
        });
        
        if (debug) {
          console.error(`[Monitor] Error caught in ${componentName}:`, error);
        }
      };
      
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        errorCount.current++;
        
        monitor.trackError(
          new Error(event.reason?.message || 'Unhandled Promise Rejection'),
          {
            ...metadata,
            component: componentName,
            errorCount: errorCount.current,
            reason: event.reason,
            fromHOC: true,
            isPromiseRejection: true
          }
        );
        
        if (debug) {
          console.error(`[Monitor] Unhandled rejection in ${componentName}:`, event.reason);
        }
      };
      
      // Only add global listeners if this is a top-level component
      if (componentName.includes('App') || componentName.includes('Root')) {
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        
        return () => {
          window.removeEventListener('error', handleError);
          window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
      }
      
      // Return empty cleanup function if no global listeners were added
      return () => {};
    }, [trackErrors, isEnabled, monitor, componentName, metadata, debug]);
    
    // Wrap event handlers to track interactions
    const wrapEventHandlers = (componentProps: any): any => {
      if (!trackInteractions || !isEnabled) {
        return componentProps;
      }
      
      const wrappedProps = { ...componentProps };
      const eventHandlers = ['onClick', 'onSubmit', 'onChange', 'onFocus', 'onBlur'];
      
      eventHandlers.forEach(handlerName => {
        const originalHandler = componentProps[handlerName];
        if (typeof originalHandler === 'function') {
          wrappedProps[handlerName] = (...args: any[]) => {
            // Map handler names to interaction types
            const interactionTypeMap: Record<string, 'click' | 'hover' | 'focus' | 'scroll' | 'input' | 'submit'> = {
              onClick: 'click',
              onSubmit: 'submit',
              onChange: 'input',
              onFocus: 'focus',
              onBlur: 'focus'
            };
            
            const interactionType = interactionTypeMap[handlerName] || 'click';
            
            // Track interaction
            monitor.trackEvent('component_interaction', {
              ...metadata,
              component: componentName,
              interactionType,
              timestamp: new Date().toISOString(),
              renderCount: renderCount.current
            });
            
            if (debug) {
              console.log(`[Monitor] Interaction in ${componentName}: ${handlerName}`);
            }
            
            // Call original handler
            return originalHandler(...args);
          };
        }
      });
      
      return wrappedProps;
    };
    
    // Render the wrapped component
    try {
      const wrappedProps = wrapEventHandlers(restProps);
      const startTime = performance.now();
      
      const result = <WrappedComponent {...(wrappedProps as P)} ref={ref} />;
      
      if (trackPerformance) {
        const renderTime = performance.now() - startTime;
        if (renderTime > 0.1) { // Only track renders that take more than 0.1ms
          recordDuration('component_render', renderTime, {
            component: componentName,
            renderCount: renderCount.current
          });
        }
      }
      
      return result;
    } catch (error) {
      errorCount.current++;
      
      if (isEnabled && trackErrors) {
        monitor.trackComponentError(componentName, error as Error, {
          ...metadata,
          errorCount: errorCount.current,
          renderCount: renderCount.current,
          fromHOC: true
        });
      }
      
      if (debug) {
        console.error(`[Monitor] Render error in ${componentName}:`, error);
      }
      
      // Re-throw error unless isolation is enabled
      if (!isolateErrors) {
        throw error;
      }
      
      // Return error fallback
      return (
        <div style={{ 
          padding: '10px', 
          border: '1px solid red', 
          borderRadius: '4px',
          backgroundColor: '#fee'
        }}>
          <strong>Error in {componentName}</strong>
          <br />
          <small>{(error as Error).message}</small>
        </div>
      );
    }
  });
  
  // Set display name
  WithMonitoringComponent.displayName = 
    displayName || `withMonitoring(${componentName})`;
  
  return WithMonitoringComponent as unknown as ComponentType<P & WithMonitoringProps>;
}

/**
 * Factory function to create a pre-configured withMonitoring HOC
 * 
 * @param defaultOptions - Default options to apply to all components
 * 
 * @example
 * ```tsx
 * const withBusinessMonitoring = createMonitoringHOC({
 *   trackLifecycle: true,
 *   trackPerformance: true,
 *   metadata: { team: 'business', priority: 'high' }
 * });
 * 
 * const MonitoredComponent = withBusinessMonitoring(MyComponent, {
 *   componentName: 'CriticalBusinessComponent'
 * });
 * ```
 */
export const createMonitoringHOC = (defaultOptions: WithMonitoringOptions) => {
  return <P extends object>(
    WrappedComponent: ComponentType<P>,
    componentOptions: WithMonitoringOptions = {}
  ) => {
    const mergedOptions = { ...defaultOptions, ...componentOptions };
    return withMonitoring(WrappedComponent, mergedOptions);
  };
};

/**
 * Utility function to create monitoring-enabled versions of common components
 * 
 * @param components - Object with component definitions
 * @param options - Monitoring options
 * 
 * @example
 * ```tsx
 * const MonitoredComponents = createMonitoredComponents({
 *   Button: ({ onClick, children, ...props }) => (
 *     <button onClick={onClick} {...props}>{children}</button>
 *   ),
 *   Input: ({ onChange, ...props }) => (
 *     <input onChange={onChange} {...props} />
 *   )
 * }, {
 *   trackInteractions: true,
 *   trackPerformance: true
 * });
 * 
 * // Usage
 * <MonitoredComponents.Button onClick={handleClick}>
 *   Click me
 * </MonitoredComponents.Button>
 * ```
 */
export const createMonitoredComponents = <T extends Record<string, ComponentType<any>>>(
  components: T,
  options: WithMonitoringOptions = {}
): { [K in keyof T]: ComponentType<React.ComponentProps<T[K]> & WithMonitoringProps> } => {
  const monitoredComponents = {} as any;
  
  Object.keys(components).forEach(componentName => {
    const Component = components[componentName];
    monitoredComponents[componentName] = withMonitoring(Component, {
      ...options,
      componentName
    });
  });
  
  return monitoredComponents;
};