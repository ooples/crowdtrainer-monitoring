import type { PerformanceMetrics, Breadcrumb } from '../types';
import { now, isBrowser, hasPerformanceAPI, throttle } from '../utils';

/**
 * Performance capture functionality
 */
export class PerformanceCapture {
  private isEnabled: boolean = false;
  private listeners: Array<(metrics: PerformanceMetrics) => void> = [];
  private observer?: PerformanceObserver;
  private longTaskObserver?: PerformanceObserver;
  private navigationEntry?: PerformanceNavigationTiming;
  private resourceEntries: PerformanceResourceTiming[] = [];

  constructor() {
    this.handlePerformanceEntry = this.handlePerformanceEntry.bind(this);
    this.handleLongTask = throttle(this.handleLongTask.bind(this), 1000);
  }

  /** Start capturing performance metrics */
  start(): void {
    if (!isBrowser() || !hasPerformanceAPI() || this.isEnabled) return;

    this.isEnabled = true;

    // Capture existing navigation timing
    this.captureNavigationTiming();

    // Set up performance observer for various entry types
    this.setupPerformanceObserver();

    // Set up long task observer
    this.setupLongTaskObserver();

    // Capture initial resource timings
    this.captureResourceTimings();
  }

  /** Stop capturing performance metrics */
  stop(): void {
    if (!this.isEnabled) return;

    this.isEnabled = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }

    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = undefined;
    }
  }

  /** Add performance listener */
  addListener(listener: (metrics: PerformanceMetrics) => void): void {
    this.listeners.push(listener);
  }

  /** Remove performance listener */
  removeListener(listener: (metrics: PerformanceMetrics) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /** Get current performance metrics */
  getMetrics(): PerformanceMetrics {
    return {
      navigation: this.navigationEntry,
      resources: [...this.resourceEntries],
    };
  }

  /** Manually capture current performance state */
  captureNow(): void {
    const metrics = this.getMetrics();
    this.notifyListeners(metrics);
  }

  /** Setup performance observer */
  private setupPerformanceObserver(): void {
    try {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(this.handlePerformanceEntry);
      });

      // Observe different entry types
      const entryTypes = [
        'navigation',
        'resource',
        'paint',
        'largest-contentful-paint',
        'first-input',
        'layout-shift',
      ];

      entryTypes.forEach(type => {
        try {
          this.observer!.observe({ type, buffered: true });
        } catch {
          // Entry type not supported, continue with others
        }
      });
    } catch (error) {
      console.warn('Monitor SDK: Performance observer setup failed:', error);
    }
  }

  /** Setup long task observer */
  private setupLongTaskObserver(): void {
    try {
      this.longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(this.handleLongTask);
      });

      this.longTaskObserver.observe({ type: 'longtask', buffered: false });
    } catch {
      // Long task API not supported
    }
  }

  /** Handle performance entries */
  private handlePerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'navigation':
        this.navigationEntry = entry as PerformanceNavigationTiming;
        break;
      
      case 'resource':
        const resourceEntry = entry as PerformanceResourceTiming;
        this.resourceEntries.push(resourceEntry);
        // Keep only last 100 resource entries to prevent memory issues
        if (this.resourceEntries.length > 100) {
          this.resourceEntries = this.resourceEntries.slice(-100);
        }
        break;
      
      case 'paint':
      case 'largest-contentful-paint':
      case 'first-input':
      case 'layout-shift':
        // These are handled by Web Vitals capture
        break;
    }
  }

  /** Handle long tasks */
  private handleLongTask(entry: PerformanceEntry): void {
    // Long task detected (>50ms)
    const metrics: PerformanceMetrics = {
      resources: [{
        name: 'long-task',
        entryType: 'longtask',
        startTime: entry.startTime,
        duration: entry.duration,
      } as any],
    };

    this.notifyListeners(metrics);
  }

  /** Capture navigation timing */
  private captureNavigationTiming(): void {
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.navigationEntry = navigation;
      }
    } catch {
      // Navigation timing not available
    }
  }

  /** Capture resource timings */
  private captureResourceTimings(): void {
    try {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      this.resourceEntries = resources.slice(-100); // Keep last 100
    } catch {
      // Resource timing not available
    }
  }

  /** Notify all listeners of performance metrics */
  private notifyListeners(metrics: PerformanceMetrics): void {
    this.listeners.forEach(listener => {
      try {
        listener(metrics);
      } catch (err) {
        console.warn('Monitor SDK: Error in performance listener:', err);
      }
    });
  }

  /** Check if performance capture is enabled */
  isActive(): boolean {
    return this.isEnabled;
  }

  /** Calculate page load time */
  getPageLoadTime(): number | null {
    if (!this.navigationEntry) return null;
    return this.navigationEntry.loadEventEnd - this.navigationEntry.navigationStart;
  }

  /** Calculate time to first byte */
  getTTFB(): number | null {
    if (!this.navigationEntry) return null;
    return this.navigationEntry.responseStart - this.navigationEntry.requestStart;
  }

  /** Calculate DOM content loaded time */
  getDOMContentLoadedTime(): number | null {
    if (!this.navigationEntry) return null;
    return this.navigationEntry.domContentLoadedEventEnd - this.navigationEntry.navigationStart;
  }

  /** Get slow resources (>1s load time) */
  getSlowResources(): PerformanceResourceTiming[] {
    return this.resourceEntries.filter(resource => resource.duration > 1000);
  }

  /** Generate breadcrumb from performance metrics */
  static toBreadcrumb(metrics: PerformanceMetrics): Breadcrumb {
    const data: Record<string, any> = {};

    if (metrics.navigation) {
      data.loadTime = metrics.navigation.loadEventEnd - metrics.navigation.navigationStart;
      data.ttfb = metrics.navigation.responseStart - metrics.navigation.requestStart;
    }

    if (metrics.resources && metrics.resources.length > 0) {
      data.resourceCount = metrics.resources.length;
      data.slowResources = metrics.resources.filter(r => r.duration > 1000).length;
    }

    return {
      timestamp: now(),
      type: 'info',
      message: 'Performance metrics captured',
      data,
    };
  }
}