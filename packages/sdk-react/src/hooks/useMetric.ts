import { useCallback, useRef, useEffect, useState } from 'react';
import { useMonitor } from './useMonitor';
import { PerformanceMetric, EventMetadata } from '../types';

/**
 * Options for metric tracking
 */
interface MetricOptions {
  unit?: PerformanceMetric['unit'];
  metadata?: EventMetadata;
  enabled?: boolean;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  bufferSize?: number;
  flushInterval?: number;
}

/**
 * Hook for tracking custom metrics with aggregation and buffering
 * 
 * @param metricName - Name of the metric
 * @param defaultOptions - Default options for the metric
 * 
 * @example
 * ```tsx
 * function DataVisualization() {
 *   const trackMetric = useMetric('chart_render_time', {
 *     unit: 'ms',
 *     metadata: { component: 'DataVisualization' }
 *   });
 *   
 *   const renderChart = async () => {
 *     const startTime = performance.now();
 *     await processChartData();
 *     const renderTime = performance.now() - startTime;
 *     trackMetric(renderTime);
 *   };
 *   
 *   return <div>Chart content</div>;
 * }
 * ```
 */
export const useMetric = (metricName: string, defaultOptions: MetricOptions = {}) => {
  const { monitor, isEnabled } = useMonitor();
  
  const trackMetric = useCallback((
    value: number,
    options?: MetricOptions
  ) => {
    if (!isEnabled) return;
    
    const finalOptions = { ...defaultOptions, ...options };
    const {
      unit = 'count',
      metadata = {},
      enabled = true
    } = finalOptions;
    
    if (!enabled) return;
    
    monitor.trackMetric(metricName, value, unit, {
      ...metadata,
      metricTimestamp: new Date().toISOString()
    });
  }, [monitor, isEnabled, metricName, defaultOptions]);
  
  return trackMetric;
};

/**
 * Hook for tracking performance metrics with timing utilities
 * 
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function AsyncComponent() {
 *   const { startTimer, endTimer, recordDuration } = usePerformanceMetric();
 *   
 *   const loadData = async () => {
 *     const timerId = startTimer('api_call');
 *     try {
 *       const data = await fetchData();
 *       endTimer(timerId, { success: true });
 *     } catch (error) {
 *       endTimer(timerId, { success: false, error: error.message });
 *     }
 *   };
 *   
 *   return <div>Component content</div>;
 * }
 * ```
 */
export const usePerformanceMetric = (options: {
  autoTrack?: boolean;
  metadata?: EventMetadata;
  enabled?: boolean;
} = {}) => {
  const { monitor, isEnabled } = useMonitor();
  const timers = useRef<Map<string, number>>(new Map());
  const {
    autoTrack: _autoTrack = false,
    metadata = {},
    enabled = true
  } = options;
  
  const startTimer = useCallback((name: string): string => {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    timers.current.set(timerId, performance.now());
    return timerId;
  }, []);
  
  const endTimer = useCallback((timerId: string, endMetadata?: EventMetadata) => {
    if (!isEnabled || !enabled) return;
    
    const startTime = timers.current.get(timerId);
    if (startTime === undefined) {
      console.warn(`[Monitor] Timer not found: ${timerId}`);
      return;
    }
    
    const duration = performance.now() - startTime;
    const metricName = timerId.split('_')[0];
    
    monitor.trackMetric(`${metricName}_duration`, duration, 'ms', {
      ...metadata,
      ...endMetadata,
      timerId,
      startTime,
      endTime: performance.now()
    });
    
    timers.current.delete(timerId);
    return duration;
  }, [monitor, isEnabled, enabled, metadata]);
  
  const recordDuration = useCallback((
    name: string,
    duration: number,
    durationMetadata?: EventMetadata
  ) => {
    if (!isEnabled || !enabled) return;
    
    monitor.trackMetric(`${name}_duration`, duration, 'ms', {
      ...metadata,
      ...durationMetadata,
      recorded: true
    });
  }, [monitor, isEnabled, enabled, metadata]);
  
  const measureAsync = useCallback(async <T>(
    name: string,
    asyncFunction: () => Promise<T>,
    measureMetadata?: EventMetadata
  ): Promise<T> => {
    const timerId = startTimer(name);
    try {
      const result = await asyncFunction();
      endTimer(timerId, { ...measureMetadata, success: true });
      return result;
    } catch (error) {
      endTimer(timerId, { 
        ...measureMetadata, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }, [startTimer, endTimer]);
  
  const measureSync = useCallback(<T>(
    name: string,
    syncFunction: () => T,
    measureMetadata?: EventMetadata
  ): T => {
    const startTime = performance.now();
    try {
      const result = syncFunction();
      const duration = performance.now() - startTime;
      
      if (isEnabled && enabled) {
        monitor.trackMetric(`${name}_duration`, duration, 'ms', {
          ...metadata,
          ...measureMetadata,
          success: true
        });
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      if (isEnabled && enabled) {
        monitor.trackMetric(`${name}_duration`, duration, 'ms', {
          ...metadata,
          ...measureMetadata,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      throw error;
    }
  }, [monitor, isEnabled, enabled, metadata]);
  
  return {
    startTimer,
    endTimer,
    recordDuration,
    measureAsync,
    measureSync
  };
};

/**
 * Hook for tracking resource usage metrics (memory, network, etc.)
 * 
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function ResourceMonitor() {
 *   const { 
 *     trackMemoryUsage, 
 *     trackNetworkTiming, 
 *     trackBundleSize 
 *   } = useResourceMetrics({
 *     trackInterval: 30000, // 30 seconds
 *     enabled: true
 *   });
 *   
 *   useEffect(() => {
 *     const interval = setInterval(() => {
 *       trackMemoryUsage();
 *     }, 30000);
 *     
 *     return () => clearInterval(interval);
 *   }, [trackMemoryUsage]);
 *   
 *   return null; // Invisible monitoring component
 * }
 * ```
 */
export const useResourceMetrics = (options: {
  trackInterval?: number;
  enabled?: boolean;
  metadata?: EventMetadata;
} = {}) => {
  const { monitor, isEnabled } = useMonitor();
  const {
    trackInterval: _trackInterval = 60000, // 1 minute
    enabled = true,
    metadata = {}
  } = options;
  
  const trackMemoryUsage = useCallback(() => {
    if (!isEnabled || !enabled) return;
    
    // @ts-ignore - performance.memory is not in all browsers
    const memoryInfo = (performance as any).memory;
    if (memoryInfo) {
      monitor.trackMetric('memory_used', memoryInfo.usedJSHeapSize, 'bytes', {
        ...metadata,
        totalJSHeapSize: memoryInfo.totalJSHeapSize,
        jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
        memoryPressure: memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit
      });
    }
  }, [monitor, isEnabled, enabled, metadata]);
  
  const trackNetworkTiming = useCallback((resourceUrl?: string) => {
    if (!isEnabled || !enabled || typeof performance === 'undefined') return;
    
    const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const resourceEntries = resourceUrl ? 
      performance.getEntriesByName(resourceUrl) as PerformanceResourceTiming[] :
      performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    // Track navigation timing
    if (navigationEntries.length > 0) {
      const nav = navigationEntries[0];
      monitor.trackMetric('page_load_time', nav.loadEventEnd - nav.loadEventStart, 'ms', {
        ...metadata,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
        dnsLookup: nav.domainLookupEnd - nav.domainLookupStart,
        tcpConnect: nav.connectEnd - nav.connectStart,
        serverResponse: nav.responseEnd - nav.requestStart
      });
    }
    
    // Track resource timing
    resourceEntries.forEach(resource => {
      if (resource.duration > 0) {
        monitor.trackMetric('resource_load_time', resource.duration, 'ms', {
          ...metadata,
          resourceName: resource.name,
          resourceType: (resource as PerformanceResourceTiming).initiatorType,
          transferSize: (resource as PerformanceResourceTiming).transferSize,
          encodedBodySize: (resource as PerformanceResourceTiming).encodedBodySize
        });
      }
    });
  }, [monitor, isEnabled, enabled, metadata]);
  
  const trackBundleSize = useCallback(() => {
    if (!isEnabled || !enabled || typeof performance === 'undefined') return;
    
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let totalJSSize = 0;
    let totalCSSSize = 0;
    
    resources.forEach(resource => {
      if (resource.name.includes('.js') || resource.name.includes('javascript')) {
        totalJSSize += resource.transferSize || 0;
      } else if (resource.name.includes('.css') || resource.name.includes('stylesheet')) {
        totalCSSSize += resource.transferSize || 0;
      }
    });
    
    if (totalJSSize > 0) {
      monitor.trackMetric('bundle_size_js', totalJSSize, 'bytes', {
        ...metadata,
        bundleType: 'javascript'
      });
    }
    
    if (totalCSSSize > 0) {
      monitor.trackMetric('bundle_size_css', totalCSSSize, 'bytes', {
        ...metadata,
        bundleType: 'css'
      });
    }
  }, [monitor, isEnabled, enabled, metadata]);
  
  return {
    trackMemoryUsage,
    trackNetworkTiming,
    trackBundleSize
  };
};

/**
 * Hook for tracking aggregated metrics over time
 * 
 * @param metricName - Name of the metric
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function SearchResults() {
 *   const addValue = useAggregatedMetric('search_results_count', {
 *     aggregationType: 'avg',
 *     windowSize: 10,
 *     reportInterval: 30000
 *   });
 *   
 *   useEffect(() => {
 *     // Add search result counts over time
 *     addValue(results.length);
 *   }, [results, addValue]);
 *   
 *   return <div>Search results</div>;
 * }
 * ```
 */
export const useAggregatedMetric = (metricName: string, options: {
  aggregationType?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  windowSize?: number;
  reportInterval?: number;
  metadata?: EventMetadata;
  enabled?: boolean;
} = {}) => {
  const { monitor, isEnabled } = useMonitor();
  const {
    aggregationType = 'avg',
    windowSize = 10,
    reportInterval = 60000, // 1 minute
    metadata = {},
    enabled = true
  } = options;
  
  const values = useRef<number[]>([]);
  const [currentAggregate, setCurrentAggregate] = useState<number>(0);
  
  const calculateAggregate = useCallback((vals: number[]): number => {
    if (vals.length === 0) return 0;
    
    switch (aggregationType) {
      case 'sum':
        return vals.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return vals.reduce((sum, val) => sum + val, 0) / vals.length;
      case 'min':
        return Math.min(...vals);
      case 'max':
        return Math.max(...vals);
      case 'count':
        return vals.length;
      default:
        return 0;
    }
  }, [aggregationType]);
  
  const reportAggregate = useCallback(() => {
    if (!isEnabled || !enabled || values.current.length === 0) return;
    
    const aggregate = calculateAggregate(values.current);
    
    monitor.trackMetric(`${metricName}_${aggregationType}`, aggregate, 'count', {
      ...metadata,
      aggregationType,
      windowSize: values.current.length,
      reportedValues: values.current.length
    });
    
    setCurrentAggregate(aggregate);
    
    // Clear values after reporting
    values.current = [];
  }, [monitor, isEnabled, enabled, metricName, aggregationType, calculateAggregate, metadata]);
  
  const addValue = useCallback((value: number) => {
    if (!enabled) return;
    
    values.current.push(value);
    
    // Maintain window size
    if (values.current.length > windowSize) {
      values.current = values.current.slice(-windowSize);
    }
    
    // Update current aggregate for real-time access
    setCurrentAggregate(calculateAggregate(values.current));
  }, [enabled, windowSize, calculateAggregate]);
  
  // Set up automatic reporting
  useEffect(() => {
    if (!reportInterval) return;
    
    const interval = setInterval(reportAggregate, reportInterval);
    return () => clearInterval(interval);
  }, [reportAggregate, reportInterval]);
  
  return {
    addValue,
    currentAggregate,
    reportNow: reportAggregate
  };
};