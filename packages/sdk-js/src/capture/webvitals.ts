import type { Breadcrumb } from '../types';
import { now, isBrowser, hasPerformanceAPI } from '../utils';

/**
 * Web Vitals interface matching the web-vitals library
 */
interface Metric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  entries: PerformanceEntry[];
  id: string;
}

/**
 * Web Vitals capture functionality
 */
export class WebVitalsCapture {
  private isEnabled: boolean = false;
  private listeners: Array<(metric: Metric) => void> = [];
  private observers: Map<string, PerformanceObserver> = new Map();
  private metrics: Map<string, Metric> = new Map();

  constructor() {
    this.handleCLS = this.handleCLS.bind(this);
    this.handleFID = this.handleFID.bind(this);
    this.handleFCP = this.handleFCP.bind(this);
    this.handleLCP = this.handleLCP.bind(this);
    this.handleTTFB = this.handleTTFB.bind(this);
  }

  /** Start capturing Web Vitals */
  start(): void {
    if (!isBrowser() || !hasPerformanceAPI() || this.isEnabled) return;

    this.isEnabled = true;

    // Initialize each Web Vital metric
    this.initCLS();
    this.initFID();
    this.initFCP();
    this.initLCP();
    this.initTTFB();
  }

  /** Stop capturing Web Vitals */
  stop(): void {
    if (!this.isEnabled) return;

    this.isEnabled = false;

    // Disconnect all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }

  /** Add Web Vitals listener */
  addListener(listener: (metric: Metric) => void): void {
    this.listeners.push(listener);
  }

  /** Remove Web Vitals listener */
  removeListener(listener: (metric: Metric) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /** Get all captured metrics */
  getMetrics(): Record<string, Metric> {
    return Object.fromEntries(this.metrics);
  }

  /** Initialize Cumulative Layout Shift (CLS) */
  private initCLS(): void {
    try {
      let clsValue = 0;
      let clsEntries: PerformanceEntry[] = [];

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Only count layout shifts without recent user input
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            clsEntries = clsEntries.concat(entry);
          }
        }

        this.handleCLS(clsValue, clsEntries);
      });

      observer.observe({ type: 'layout-shift', buffered: true });
      this.observers.set('cls', observer);
    } catch {
      // Layout shift API not supported
    }
  }

  /** Initialize First Input Delay (FID) */
  private initFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handleFID((entry as any).processingStart - entry.startTime, [entry]);
        }
      });

      observer.observe({ type: 'first-input', buffered: true });
      this.observers.set('fid', observer);
    } catch {
      // First input API not supported
    }
  }

  /** Initialize First Contentful Paint (FCP) */
  private initFCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.handleFCP(entry.startTime, [entry]);
          }
        }
      });

      observer.observe({ type: 'paint', buffered: true });
      this.observers.set('fcp', observer);
    } catch {
      // Paint API not supported
    }
  }

  /** Initialize Largest Contentful Paint (LCP) */
  private initLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.handleLCP(lastEntry.startTime, entries);
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.set('lcp', observer);
    } catch {
      // LCP API not supported
    }
  }

  /** Initialize Time to First Byte (TTFB) */
  private initTTFB(): void {
    try {
      // TTFB can be calculated from navigation timing
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        const ttfb = navigation.responseStart - navigation.requestStart;
        this.handleTTFB(ttfb, [navigation]);
      }
    } catch {
      // Navigation timing not available
    }
  }

  /** Handle CLS metric */
  private handleCLS(value: number, entries: PerformanceEntry[]): void {
    const metric: Metric = {
      name: 'CLS',
      value,
      rating: value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor',
      delta: value - (this.metrics.get('CLS')?.value || 0),
      entries,
      id: this.generateId(),
    };

    this.metrics.set('CLS', metric);
    this.notifyListeners(metric);
  }

  /** Handle FID metric */
  private handleFID(value: number, entries: PerformanceEntry[]): void {
    const metric: Metric = {
      name: 'FID',
      value,
      rating: value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor',
      delta: value - (this.metrics.get('FID')?.value || 0),
      entries,
      id: this.generateId(),
    };

    this.metrics.set('FID', metric);
    this.notifyListeners(metric);
  }

  /** Handle FCP metric */
  private handleFCP(value: number, entries: PerformanceEntry[]): void {
    const metric: Metric = {
      name: 'FCP',
      value,
      rating: value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor',
      delta: value - (this.metrics.get('FCP')?.value || 0),
      entries,
      id: this.generateId(),
    };

    this.metrics.set('FCP', metric);
    this.notifyListeners(metric);
  }

  /** Handle LCP metric */
  private handleLCP(value: number, entries: PerformanceEntry[]): void {
    const metric: Metric = {
      name: 'LCP',
      value,
      rating: value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor',
      delta: value - (this.metrics.get('LCP')?.value || 0),
      entries,
      id: this.generateId(),
    };

    this.metrics.set('LCP', metric);
    this.notifyListeners(metric);
  }

  /** Handle TTFB metric */
  private handleTTFB(value: number, entries: PerformanceEntry[]): void {
    const metric: Metric = {
      name: 'TTFB',
      value,
      rating: value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor',
      delta: value - (this.metrics.get('TTFB')?.value || 0),
      entries,
      id: this.generateId(),
    };

    this.metrics.set('TTFB', metric);
    this.notifyListeners(metric);
  }

  /** Generate unique ID for metric */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /** Notify all listeners of Web Vital metric */
  private notifyListeners(metric: Metric): void {
    this.listeners.forEach(listener => {
      try {
        listener(metric);
      } catch (err) {
        console.warn('Monitor SDK: Error in Web Vitals listener:', err);
      }
    });
  }

  /** Check if Web Vitals capture is enabled */
  isActive(): boolean {
    return this.isEnabled;
  }

  /** Get Web Vitals summary */
  getSummary(): {
    cls: number | null;
    fid: number | null;
    fcp: number | null;
    lcp: number | null;
    ttfb: number | null;
    overallScore: number;
  } {
    const cls = this.metrics.get('CLS')?.value || null;
    const fid = this.metrics.get('FID')?.value || null;
    const fcp = this.metrics.get('FCP')?.value || null;
    const lcp = this.metrics.get('LCP')?.value || null;
    const ttfb = this.metrics.get('TTFB')?.value || null;

    // Calculate overall score (0-100) based on Web Vitals ratings
    const scores: number[] = [];
    
    if (cls !== null) {
      scores.push(cls <= 0.1 ? 100 : cls <= 0.25 ? 75 : 50);
    }
    if (fid !== null) {
      scores.push(fid <= 100 ? 100 : fid <= 300 ? 75 : 50);
    }
    if (fcp !== null) {
      scores.push(fcp <= 1800 ? 100 : fcp <= 3000 ? 75 : 50);
    }
    if (lcp !== null) {
      scores.push(lcp <= 2500 ? 100 : lcp <= 4000 ? 75 : 50);
    }
    if (ttfb !== null) {
      scores.push(ttfb <= 800 ? 100 : ttfb <= 1800 ? 75 : 50);
    }

    const overallScore = scores.length > 0 
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;

    return { cls, fid, fcp, lcp, ttfb, overallScore };
  }

  /** Generate breadcrumb from Web Vitals metric */
  static toBreadcrumb(metric: Metric): Breadcrumb {
    return {
      timestamp: now(),
      type: 'info',
      message: `${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
      data: {
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
      },
    };
  }
}