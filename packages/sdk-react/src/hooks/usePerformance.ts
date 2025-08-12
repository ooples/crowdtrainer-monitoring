import { useCallback, useEffect, useRef, useState } from 'react';
import { useMonitor } from './useMonitor';
import { EventMetadata } from '../types';

/**
 * Web Vitals thresholds (based on Google's recommendations)
 */
const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 },   // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  TTFB: { good: 800, needsImprovement: 1800 }  // Time to First Byte
};

/**
 * Performance metric data structure
 */
interface PerformanceData {
  LCP?: number;
  FID?: number;
  CLS?: number;
  FCP?: number;
  TTFB?: number;
  customMetrics: Record<string, number>;
}

/**
 * Hook for tracking Web Vitals and custom performance metrics
 * 
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function App() {
 *   const {
 *     webVitals,
 *     trackCustomMetric,
 *     measureRenderTime,
 *     trackResourceTiming
 *   } = usePerformance({
 *     trackWebVitals: true,
 *     reportInterval: 30000
 *   });
 *   
 *   useEffect(() => {
 *     // Track custom metrics
 *     const startTime = performance.now();
 *     // ... do work
 *     const endTime = performance.now();
 *     trackCustomMetric('app_initialization', endTime - startTime);
 *   }, [trackCustomMetric]);
 *   
 *   return <div>App content</div>;
 * }
 * ```
 */
export const usePerformance = (options: {
  trackWebVitals?: boolean;
  trackResourceTiming?: boolean;
  reportInterval?: number;
  thresholds?: Partial<typeof WEB_VITALS_THRESHOLDS>;
  metadata?: EventMetadata;
  enabled?: boolean;
} = {}) => {
  const { monitor, isEnabled } = useMonitor();
  const {
    trackWebVitals = true,
    trackResourceTiming = false,
    reportInterval = 30000, // 30 seconds
    thresholds = WEB_VITALS_THRESHOLDS,
    metadata = {},
    enabled = true
  } = options;
  
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    customMetrics: {}
  });
  
  const observersRef = useRef<PerformanceObserver[]>([]);
  const reportedMetrics = useRef<Set<string>>(new Set());
  
  // Helper to get performance rating
  const getPerformanceRating = useCallback((
    metricName: keyof typeof WEB_VITALS_THRESHOLDS,
    value: number
  ): 'good' | 'needs-improvement' | 'poor' => {
    const threshold = thresholds[metricName];
    if (!threshold) return 'good';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
  }, [thresholds]);
  
  // Track Web Vitals metrics
  const setupWebVitalsTracking = useCallback(() => {
    if (!trackWebVitals || !isEnabled || !enabled || typeof PerformanceObserver === 'undefined') {
      return () => {
        // No cleanup needed if tracking is disabled
      };
    }
    
    // Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
        
        if (lastEntry) {
          const lcp = lastEntry.renderTime || lastEntry.loadTime || 0;
          
          setPerformanceData(prev => ({ ...prev, LCP: lcp }));
          
          if (!reportedMetrics.current.has('LCP')) {
            monitor.trackMetric('web_vitals_lcp', lcp, 'ms', {
              ...metadata,
              rating: getPerformanceRating('LCP', lcp),
              entryType: lastEntry.entryType,
              elementSelector: (lastEntry as any).element?.tagName
            });
            reportedMetrics.current.add('LCP');
          }
        }
      });
      
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      observersRef.current.push(lcpObserver);
    } catch (e) {
      console.warn('[Monitor] LCP observer not supported');
    }
    
    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as PerformanceEntry & { processingStart?: number };
          const fid = (fidEntry.processingStart || 0) - entry.startTime;
          
          setPerformanceData(prev => ({ ...prev, FID: fid }));
          
          if (!reportedMetrics.current.has('FID')) {
            monitor.trackMetric('web_vitals_fid', fid, 'ms', {
              ...metadata,
              rating: getPerformanceRating('FID', fid),
              eventType: (entry as any).name
            });
            reportedMetrics.current.add('FID');
          }
        });
      });
      
      fidObserver.observe({ entryTypes: ['first-input'] });
      observersRef.current.push(fidObserver);
    } catch (e) {
      console.warn('[Monitor] FID observer not supported');
    }
    
    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        });
        
        setPerformanceData(prev => ({ ...prev, CLS: clsValue }));
      });
      
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      observersRef.current.push(clsObserver);
      
      // Report CLS periodically since it's cumulative
      const clsReportInterval = setInterval(() => {
        if (clsValue > 0) {
          monitor.trackMetric('web_vitals_cls', clsValue, 'count', {
            ...metadata,
            rating: getPerformanceRating('CLS', clsValue),
            isCumulative: true
          });
        }
      }, reportInterval);
      
      return () => clearInterval(clsReportInterval);
    } catch (e) {
      console.warn('[Monitor] CLS observer not supported');
    }
    
    // First Contentful Paint (FCP) and Time to First Byte (TTFB)
    try {
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const navEntry = entry as PerformanceNavigationTiming;
          
          // FCP
          const fcp = navEntry.responseStart - navEntry.fetchStart;
          setPerformanceData(prev => ({ ...prev, FCP: fcp }));
          
          if (!reportedMetrics.current.has('FCP')) {
            monitor.trackMetric('web_vitals_fcp', fcp, 'ms', {
              ...metadata,
              rating: getPerformanceRating('FCP', fcp)
            });
            reportedMetrics.current.add('FCP');
          }
          
          // TTFB
          const ttfb = navEntry.responseStart - navEntry.requestStart;
          setPerformanceData(prev => ({ ...prev, TTFB: ttfb }));
          
          if (!reportedMetrics.current.has('TTFB')) {
            monitor.trackMetric('web_vitals_ttfb', ttfb, 'ms', {
              ...metadata,
              rating: getPerformanceRating('TTFB', ttfb)
            });
            reportedMetrics.current.add('TTFB');
          }
        });
      });
      
      navigationObserver.observe({ entryTypes: ['navigation'] });
      observersRef.current.push(navigationObserver);
    } catch (e) {
      console.warn('[Monitor] Navigation observer not supported');
    }
    
    // Return cleanup function for all observers set up
    return () => {
      // Cleanup will be handled by the main useEffect cleanup
    };
    
  }, [trackWebVitals, isEnabled, enabled, monitor, metadata, getPerformanceRating, reportInterval]);
  
  // Track resource timing
  const setupResourceTimingTracking = useCallback(() => {
    if (!trackResourceTiming || !isEnabled || !enabled || typeof PerformanceObserver === 'undefined') {
      return;
    }
    
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const resource = entry as PerformanceResourceTiming;
          
          if (resource.duration > 0) {
            monitor.trackMetric('resource_timing', resource.duration, 'ms', {
              ...metadata,
              resourceName: resource.name,
              resourceType: resource.initiatorType,
              transferSize: resource.transferSize,
              encodedBodySize: resource.encodedBodySize,
              decodedBodySize: resource.decodedBodySize,
              protocol: resource.nextHopProtocol
            });
          }
        });
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
      observersRef.current.push(resourceObserver);
    } catch (e) {
      console.warn('[Monitor] Resource timing observer not supported');
    }
  }, [trackResourceTiming, isEnabled, enabled, monitor, metadata]);
  
  // Set up observers
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];
    
    const webVitalsCleanup = setupWebVitalsTracking();
    if (webVitalsCleanup) cleanupFunctions.push(webVitalsCleanup);
    
    setupResourceTimingTracking();
    
    return () => {
      // Cleanup observers
      observersRef.current.forEach(observer => observer.disconnect());
      observersRef.current = [];
      
      // Cleanup intervals
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [setupWebVitalsTracking, setupResourceTimingTracking]);
  
  // Track custom performance metrics
  const trackCustomMetric = useCallback((
    name: string,
    value: number,
    customMetadata?: EventMetadata
  ) => {
    if (!isEnabled || !enabled) return;
    
    setPerformanceData(prev => ({
      ...prev,
      customMetrics: { ...prev.customMetrics, [name]: value }
    }));
    
    monitor.trackMetric(`custom_${name}`, value, 'ms', {
      ...metadata,
      ...customMetadata,
      isCustomMetric: true
    });
  }, [isEnabled, enabled, monitor, metadata]);
  
  // Measure render time for components
  const measureRenderTime = useCallback((componentName: string) => {
    if (!isEnabled || !enabled) return () => {};
    
    const startTime = performance.now();
    
    return (renderMetadata?: EventMetadata) => {
      const renderTime = performance.now() - startTime;
      
      monitor.trackRenderTime(componentName, renderTime, {
        ...metadata,
        ...renderMetadata,
        measurementMethod: 'manual'
      });
    };
  }, [isEnabled, enabled, monitor, metadata]);
  
  // Track memory usage
  const trackMemoryUsage = useCallback(() => {
    if (!isEnabled || !enabled) return;
    
    // @ts-ignore - performance.memory is not standard
    const memoryInfo = (performance as any).memory;
    if (memoryInfo) {
      const usedMemory = memoryInfo.usedJSHeapSize;
      const totalMemory = memoryInfo.totalJSHeapSize;
      const memoryLimit = memoryInfo.jsHeapSizeLimit;
      
      monitor.trackMetric('memory_usage', usedMemory, 'bytes', {
        ...metadata,
        totalMemory,
        memoryLimit,
        memoryUtilization: usedMemory / totalMemory,
        memoryPressure: usedMemory / memoryLimit
      });
    }
  }, [isEnabled, enabled, monitor, metadata]);
  
  // Get performance score based on Web Vitals
  const getPerformanceScore = useCallback((): number => {
    const metrics = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'] as const;
    let totalScore = 0;
    let validMetrics = 0;
    
    metrics.forEach((metric) => {
      const value = performanceData[metric];
      if (value !== undefined) {
        const rating = getPerformanceRating(metric, value);
        const score = rating === 'good' ? 100 : rating === 'needs-improvement' ? 50 : 0;
        totalScore += score;
        validMetrics++;
      }
    });
    
    return validMetrics > 0 ? Math.round(totalScore / validMetrics) : 0;
  }, [performanceData, getPerformanceRating]);
  
  return {
    webVitals: {
      LCP: performanceData.LCP,
      FID: performanceData.FID,
      CLS: performanceData.CLS,
      FCP: performanceData.FCP,
      TTFB: performanceData.TTFB
    },
    customMetrics: performanceData.customMetrics,
    trackCustomMetric,
    measureRenderTime,
    trackMemoryUsage,
    performanceScore: getPerformanceScore(),
    getPerformanceRating
  };
};

/**
 * Hook for tracking React-specific performance metrics
 * 
 * @param componentName - Name of the component
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function MyComponent({ data }) {
 *   const { trackRerender, trackPropChange } = useReactPerformance('MyComponent');
 *   
 *   useEffect(() => {
 *     trackPropChange('data', data);
 *   }, [data, trackPropChange]);
 *   
 *   return <div>Component content</div>;
 * }
 * ```
 */
export const useReactPerformance = (componentName: string, options: {
  trackRerenders?: boolean;
  trackPropChanges?: boolean;
  trackStateChanges?: boolean;
  metadata?: EventMetadata;
  enabled?: boolean;
} = {}) => {
  const { monitor, isEnabled } = useMonitor();
  const {
    trackRerenders = true,
    trackPropChanges = true,
    trackStateChanges = true,
    metadata = {},
    enabled = true
  } = options;
  
  const renderCount = useRef(0);
  const lastProps = useRef<any>({});
  const lastState = useRef<any>({});
  const mountTime = useRef<number>(performance.now());
  
  const trackRerender = useCallback((reason?: string, rerenderMetadata?: EventMetadata) => {
    if (!isEnabled || !enabled || !trackRerenders) return;
    
    renderCount.current++;
    const timeSinceMount = performance.now() - mountTime.current;
    
    monitor.trackMetric('component_rerender', renderCount.current, 'count', {
      ...metadata,
      ...rerenderMetadata,
      component: componentName,
      reason,
      timeSinceMount,
      renderCount: renderCount.current
    });
  }, [isEnabled, enabled, trackRerenders, monitor, metadata, componentName]);
  
  const trackPropChange = useCallback((propName: string, newValue: any) => {
    if (!isEnabled || !enabled || !trackPropChanges) return;
    
    const oldValue = lastProps.current[propName];
    const hasChanged = oldValue !== newValue;
    
    if (hasChanged) {
      monitor.trackEvent('prop_change', {
        ...metadata,
        component: componentName,
        propName,
        hasValue: newValue !== undefined,
        valueType: typeof newValue,
        renderCount: renderCount.current
      });
    }
    
    lastProps.current[propName] = newValue;
  }, [isEnabled, enabled, trackPropChanges, monitor, metadata, componentName]);
  
  const trackStateChange = useCallback((stateName: string, newValue: any) => {
    if (!isEnabled || !enabled || !trackStateChanges) return;
    
    const oldValue = lastState.current[stateName];
    const hasChanged = oldValue !== newValue;
    
    if (hasChanged) {
      monitor.trackEvent('state_change', {
        ...metadata,
        component: componentName,
        stateName,
        hasValue: newValue !== undefined,
        valueType: typeof newValue,
        renderCount: renderCount.current
      });
    }
    
    lastState.current[stateName] = newValue;
  }, [isEnabled, enabled, trackStateChanges, monitor, metadata, componentName]);
  
  // Auto-track rerenders
  useEffect(() => {
    if (renderCount.current > 0) { // Skip initial mount
      trackRerender('useEffect_dependency_change');
    }
  });
  
  return {
    trackRerender,
    trackPropChange,
    trackStateChange,
    renderCount: renderCount.current
  };
};