/**
 * Performance monitoring system for the monitoring SDK
 */

import { 
  PerformanceMetrics, 
  WebVitals, 
  NavigationTiming, 
  PaintTiming, 
  ResourceTiming,
  Logger,
  Timestamp
} from '../types/index.js';
import { getCurrentTimestamp } from '../utils/index.js';

export interface PerformanceMonitorConfig {
  /** Enable automatic performance tracking */
  autoTrack?: boolean;
  /** Track Core Web Vitals */
  trackWebVitals?: boolean;
  /** Track navigation timing */
  trackNavigation?: boolean;
  /** Track paint timing */
  trackPaint?: boolean;
  /** Track resource timing */
  trackResources?: boolean;
  /** Track long tasks */
  trackLongTasks?: boolean;
  /** Track first input delay */
  trackFID?: boolean;
  /** Track layout shifts */
  trackCLS?: boolean;
  /** Maximum number of resources to track */
  maxResources?: number;
  /** Logger instance */
  logger?: Logger;
}

export interface PerformanceEntry {
  /** Performance metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Metric unit */
  unit: string;
  /** Timestamp when metric was recorded */
  timestamp: Timestamp;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private config: Required<PerformanceMonitorConfig>;
  private observers: PerformanceObserver[] = [];
  private webVitals: Partial<WebVitals> = {};
  private performanceEntries: PerformanceEntry[] = [];
  private isDestroyed = false;

  constructor(config: PerformanceMonitorConfig = {}) {
    this.config = {
      autoTrack: config.autoTrack ?? true,
      trackWebVitals: config.trackWebVitals ?? true,
      trackNavigation: config.trackNavigation ?? true,
      trackPaint: config.trackPaint ?? true,
      trackResources: config.trackResources ?? true,
      trackLongTasks: config.trackLongTasks ?? true,
      trackFID: config.trackFID ?? true,
      trackCLS: config.trackCLS ?? true,
      maxResources: config.maxResources ?? 100,
      logger: config.logger ?? console
    };

    if (this.config.autoTrack) {
      this.startTracking();
    }
  }

  /**
   * Start performance tracking
   */
  startTracking(): void {
    if (this.isDestroyed || typeof window === 'undefined') {
      return;
    }

    this.config.logger.debug('PerformanceMonitor: Starting performance tracking');

    if (this.config.trackNavigation) {
      this.trackNavigationTiming();
    }

    if (this.config.trackPaint) {
      this.trackPaintTiming();
    }

    if (this.config.trackWebVitals) {
      this.trackWebVitalMetrics();
    }

    if (this.config.trackResources) {
      this.trackResourceTiming();
    }

    if (this.config.trackLongTasks) {
      this.trackLongTaskTiming();
    }
  }

  /**
   * Stop performance tracking
   */
  stopTracking(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.config.logger.debug('PerformanceMonitor: Stopped performance tracking');
  }

  /**
   * Get current Web Vitals
   */
  getWebVitals(): WebVitals {
    return { ...this.webVitals };
  }

  /**
   * Get all recorded performance entries
   */
  getPerformanceEntries(): PerformanceEntry[] {
    return [...this.performanceEntries];
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return {
      navigation: this.getNavigationTiming(),
      paint: this.getPaintTiming(),
      vitals: this.getWebVitals(),
      resources: this.getResourceTiming()
    };
  }

  /**
   * Mark a custom performance entry
   */
  mark(name: string, metadata?: Record<string, any>): void {
    if (this.isDestroyed) {
      return;
    }

    const startTime = performance.now();
    
    const entry: PerformanceEntry = {
      name,
      value: startTime,
      unit: 'ms',
      timestamp: getCurrentTimestamp(),
      metadata
    };

    this.performanceEntries.push(entry);
    this.config.logger.debug('PerformanceMonitor: Custom mark recorded', entry);

    // Use Performance API if available
    if (performance.mark) {
      performance.mark(name);
    }
  }

  /**
   * Measure time between two marks or from a mark to now
   */
  measure(name: string, startMark?: string, endMark?: string): number | null {
    if (this.isDestroyed) {
      return null;
    }

    try {
      let duration: number;

      if (performance.measure && startMark) {
        const measureName = `${name}_measure`;
        performance.measure(measureName, startMark, endMark);
        
        const entries = performance.getEntriesByName(measureName, 'measure');
        if (entries.length > 0) {
          duration = entries[entries.length - 1].duration;
        } else {
          return null;
        }
      } else {
        // Fallback: find marks in our entries
        const startEntry = this.performanceEntries.find(entry => entry.name === startMark);
        const endEntry = endMark ? 
          this.performanceEntries.find(entry => entry.name === endMark) :
          { value: performance.now() };

        if (!startEntry || !endEntry) {
          return null;
        }

        duration = endEntry.value - startEntry.value;
      }

      const entry: PerformanceEntry = {
        name: `${name}_duration`,
        value: duration,
        unit: 'ms',
        timestamp: getCurrentTimestamp()
      };

      this.performanceEntries.push(entry);
      this.config.logger.debug('PerformanceMonitor: Measure recorded', entry);

      return duration;
    } catch (error) {
      this.config.logger.error('PerformanceMonitor: Failed to measure', error);
      return null;
    }
  }

  /**
   * Time a function execution
   */
  time<T>(name: string, fn: () => T): T {
    const start = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - start;

      const entry: PerformanceEntry = {
        name: `${name}_execution`,
        value: duration,
        unit: 'ms',
        timestamp: getCurrentTimestamp()
      };

      this.performanceEntries.push(entry);
      this.config.logger.debug('PerformanceMonitor: Function timing recorded', entry);

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      const entry: PerformanceEntry = {
        name: `${name}_execution_error`,
        value: duration,
        unit: 'ms',
        timestamp: getCurrentTimestamp(),
        metadata: { error: error instanceof Error ? error.message : String(error) }
      };

      this.performanceEntries.push(entry);
      throw error;
    }
  }

  /**
   * Time an async function execution
   */
  async timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;

      const entry: PerformanceEntry = {
        name: `${name}_async_execution`,
        value: duration,
        unit: 'ms',
        timestamp: getCurrentTimestamp()
      };

      this.performanceEntries.push(entry);
      this.config.logger.debug('PerformanceMonitor: Async function timing recorded', entry);

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      const entry: PerformanceEntry = {
        name: `${name}_async_execution_error`,
        value: duration,
        unit: 'ms',
        timestamp: getCurrentTimestamp(),
        metadata: { error: error instanceof Error ? error.message : String(error) }
      };

      this.performanceEntries.push(entry);
      throw error;
    }
  }

  /**
   * Clear all recorded entries
   */
  clear(): void {
    this.performanceEntries = [];
    this.webVitals = {};
    this.config.logger.debug('PerformanceMonitor: Cleared all entries');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    const wasAutoTrack = this.config.autoTrack;
    this.config = { ...this.config, ...config };

    if (config.autoTrack !== undefined && config.autoTrack !== wasAutoTrack) {
      if (wasAutoTrack) {
        this.stopTracking();
      }
      if (this.config.autoTrack) {
        this.startTracking();
      }
    }
  }

  /**
   * Destroy performance monitor
   */
  destroy(): void {
    this.stopTracking();
    this.performanceEntries = [];
    this.webVitals = {};
    this.isDestroyed = true;
    this.config.logger.debug('PerformanceMonitor: Destroyed');
  }

  /**
   * Track navigation timing
   */
  private trackNavigationTiming(): void {
    if (!window.performance?.getEntriesByType) {
      return;
    }

    // Wait for navigation to complete
    if (document.readyState === 'loading') {
      window.addEventListener('load', () => this.recordNavigationTiming());
    } else {
      setTimeout(() => this.recordNavigationTiming(), 0);
    }
  }

  /**
   * Record navigation timing metrics
   */
  private recordNavigationTiming(): void {
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entries.length === 0) {
      return;
    }

    const entry = entries[0];
    const metrics = [
      { name: 'navigation_dns_lookup', value: entry.domainLookupEnd - entry.domainLookupStart },
      { name: 'navigation_tcp_connection', value: entry.connectEnd - entry.connectStart },
      { name: 'navigation_request', value: entry.responseStart - entry.requestStart },
      { name: 'navigation_response', value: entry.responseEnd - entry.responseStart },
      { name: 'navigation_dom_processing', value: entry.domContentLoadedEventEnd - entry.responseEnd },
      { name: 'navigation_load_event', value: entry.loadEventEnd - entry.loadEventStart },
      { name: 'navigation_total', value: entry.loadEventEnd - entry.navigationStart }
    ];

    if (entry.secureConnectionStart > 0) {
      metrics.push({ 
        name: 'navigation_tls_handshake', 
        value: entry.connectEnd - entry.secureConnectionStart 
      });
    }

    metrics.forEach(metric => {
      if (metric.value > 0) {
        this.performanceEntries.push({
          name: metric.name,
          value: metric.value,
          unit: 'ms',
          timestamp: getCurrentTimestamp()
        });
      }
    });

    this.config.logger.debug('PerformanceMonitor: Navigation timing recorded', metrics);
  }

  /**
   * Track paint timing
   */
  private trackPaintTiming(): void {
    if (!window.PerformanceObserver) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const metricName = entry.name.replace(/-/g, '_');
          
          this.performanceEntries.push({
            name: `paint_${metricName}`,
            value: entry.startTime,
            unit: 'ms',
            timestamp: getCurrentTimestamp()
          });

          // Update Web Vitals
          if (entry.name === 'first-contentful-paint') {
            this.webVitals.fcp = entry.startTime;
          }
        }
      });

      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch (error) {
      this.config.logger.error('PerformanceMonitor: Failed to setup paint timing', error);
    }
  }

  /**
   * Track Web Vitals metrics
   */
  private trackWebVitalMetrics(): void {
    if (!window.PerformanceObserver) {
      return;
    }

    // Track LCP
    this.trackLCP();
    
    // Track FID
    if (this.config.trackFID) {
      this.trackFID();
    }

    // Track CLS
    if (this.config.trackCLS) {
      this.trackCLS();
    }

    // Track TTFB
    this.trackTTFB();
  }

  /**
   * Track Largest Contentful Paint
   */
  private trackLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        this.webVitals.lcp = lastEntry.startTime;
        
        this.performanceEntries.push({
          name: 'web_vitals_lcp',
          value: lastEntry.startTime,
          unit: 'ms',
          timestamp: getCurrentTimestamp()
        });
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch (error) {
      this.config.logger.error('PerformanceMonitor: Failed to setup LCP tracking', error);
    }
  }

  /**
   * Track First Input Delay
   */
  private trackFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;
          
          this.webVitals.fid = fid;
          
          this.performanceEntries.push({
            name: 'web_vitals_fid',
            value: fid,
            unit: 'ms',
            timestamp: getCurrentTimestamp()
          });
        }
      });

      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch (error) {
      this.config.logger.error('PerformanceMonitor: Failed to setup FID tracking', error);
    }
  }

  /**
   * Track Cumulative Layout Shift
   */
  private trackCLS(): void {
    try {
      let clsValue = 0;
      
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as any;
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
          }
        }
        
        this.webVitals.cls = clsValue;
        
        this.performanceEntries.push({
          name: 'web_vitals_cls',
          value: clsValue,
          unit: 'score',
          timestamp: getCurrentTimestamp()
        });
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch (error) {
      this.config.logger.error('PerformanceMonitor: Failed to setup CLS tracking', error);
    }
  }

  /**
   * Track Time to First Byte
   */
  private trackTTFB(): void {
    const navTiming = this.getNavigationTiming();
    if (navTiming) {
      const ttfb = navTiming.request + navTiming.response;
      this.webVitals.ttfb = ttfb;
      
      this.performanceEntries.push({
        name: 'web_vitals_ttfb',
        value: ttfb,
        unit: 'ms',
        timestamp: getCurrentTimestamp()
      });
    }
  }

  /**
   * Track resource timing
   */
  private trackResourceTiming(): void {
    if (!window.PerformanceObserver) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resource = entry as PerformanceResourceTiming;
          
          this.performanceEntries.push({
            name: `resource_${resource.initiatorType}_duration`,
            value: resource.duration,
            unit: 'ms',
            timestamp: getCurrentTimestamp(),
            metadata: {
              name: resource.name,
              size: resource.transferSize,
              type: resource.initiatorType
            }
          });

          // Limit resource entries
          if (this.performanceEntries.length > this.config.maxResources) {
            break;
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
      this.observers.push(observer);
    } catch (error) {
      this.config.logger.error('PerformanceMonitor: Failed to setup resource timing', error);
    }
  }

  /**
   * Track long tasks
   */
  private trackLongTaskTiming(): void {
    if (!window.PerformanceObserver) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.performanceEntries.push({
            name: 'long_task_duration',
            value: entry.duration,
            unit: 'ms',
            timestamp: getCurrentTimestamp(),
            metadata: {
              startTime: entry.startTime
            }
          });
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
      this.observers.push(observer);
    } catch (error) {
      this.config.logger.error('PerformanceMonitor: Failed to setup long task timing', error);
    }
  }

  /**
   * Get navigation timing
   */
  private getNavigationTiming(): NavigationTiming | undefined {
    if (!window.performance?.getEntriesByType) {
      return undefined;
    }

    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entries.length === 0) {
      return undefined;
    }

    const entry = entries[0];
    return {
      dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
      tcpConnection: entry.connectEnd - entry.connectStart,
      tlsHandshake: entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : undefined,
      request: entry.responseStart - entry.requestStart,
      response: entry.responseEnd - entry.responseStart,
      domProcessing: entry.domContentLoadedEventEnd - entry.responseEnd,
      loadEvent: entry.loadEventEnd - entry.loadEventStart
    };
  }

  /**
   * Get paint timing
   */
  private getPaintTiming(): PaintTiming | undefined {
    if (!window.performance?.getEntriesByType) {
      return undefined;
    }

    const paintEntries = performance.getEntriesByType('paint');
    const result: PaintTiming = {};

    for (const entry of paintEntries) {
      switch (entry.name) {
        case 'first-paint':
          result.firstPaint = entry.startTime;
          break;
        case 'first-contentful-paint':
          result.firstContentfulPaint = entry.startTime;
          break;
      }
    }

    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      result.largestContentfulPaint = lcpEntries[lcpEntries.length - 1].startTime;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Get resource timing
   */
  private getResourceTiming(): ResourceTiming[] {
    if (!window.performance?.getEntriesByType) {
      return [];
    }

    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return resourceEntries.slice(0, this.config.maxResources).map(entry => ({
      name: entry.name,
      type: entry.initiatorType,
      size: entry.transferSize || 0,
      duration: entry.duration
    }));
  }
}