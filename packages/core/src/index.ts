/**
 * Main entry point for @monitoring-service/core
 * Production-ready monitoring SDK core library
 */

import {
  MonitoringConfig,
  MonitoringSDK,
  BaseEvent,
  UserContext,
  JSONValue,
  MetricType,
  ErrorInfo,
  Logger,
  Plugin
} from './types/index.js';

import { EventTracker, EventTrackerConfig } from './events/EventTracker.js';
import { MetricCollector, MetricCollectorConfig } from './metrics/MetricCollector.js';
import { ErrorCapture, ErrorCaptureConfig } from './errors/ErrorCapture.js';
import { HTTPTransport, HTTPTransportConfig } from './transport/Transport.js';
import { PerformanceMonitor, PerformanceMonitorConfig } from './performance/PerformanceMonitor.js';
import { ContextManager, ContextManagerConfig } from './context/ContextManager.js';
import { QueueManager, QueueManagerConfig } from './queue/QueueManager.js';
import { 
  generateId, 
  getCurrentTimestamp, 
  createLogger, 
  isDevelopment,
  LocalStorageAdapter
} from './utils/index.js';

/**
 * Main MonitoringCore class - the entry point for the SDK
 */
export class MonitoringCore implements MonitoringSDK {
  private config: MonitoringConfig;
  private eventTracker: EventTracker;
  private metricCollector: MetricCollector;
  private errorCapture: ErrorCapture;
  private transport: HTTPTransport;
  private performanceMonitor: PerformanceMonitor;
  private contextManager: ContextManager;
  private queueManager: QueueManager;
  private logger: Logger;
  private isInitialized = false;
  private isDestroyed = false;
  private flushTimer?: NodeJS.Timer;

  constructor(config?: Partial<MonitoringConfig>) {
    // Create logger first
    this.logger = createLogger('MonitoringCore', config?.debug ?? isDevelopment());

    // Initialize with default config
    this.config = {
      endpoint: '',
      apiKey: '',
      environment: 'production',
      version: '1.0.0',
      debug: isDevelopment(),
      maxQueueSize: 100,
      flushInterval: 30000, // 30 seconds
      enableOfflineSupport: true,
      sampleRate: 1.0,
      transport: {
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 10000,
        batchSize: 50
      },
      ...config
    };

    // Initialize components
    this.initializeComponents();
  }

  /**
   * Initialize the SDK
   */
  async init(config: MonitoringConfig): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('MonitoringCore: Already initialized');
      return;
    }

    if (this.isDestroyed) {
      throw new Error('MonitoringCore: Cannot initialize destroyed instance');
    }

    // Update configuration
    this.config = { ...this.config, ...config };
    this.logger = createLogger('MonitoringCore', this.config.debug);

    // Validate required configuration
    this.validateConfig();

    // Re-initialize components with new config
    this.initializeComponents();

    // Set initial context
    if (this.config.userId) {
      this.setUser({ id: this.config.userId });
    }

    if (this.config.sessionId) {
      this.contextManager.setCustom('sessionId', this.config.sessionId);
    }

    // Start automatic flushing
    this.startAutoFlush();

    this.isInitialized = true;
    this.logger.info('MonitoringCore: Initialized successfully', {
      environment: this.config.environment,
      version: this.config.version
    });

    // Track initialization
    this.trackCustom('monitoring_sdk_initialized', {
      version: this.config.version,
      environment: this.config.environment
    });
  }

  /**
   * Track a generic event
   */
  track(event: Omit<BaseEvent, 'id' | 'timestamp'>): void {
    if (!this.isInitialized || this.isDestroyed) {
      this.logger.warn('MonitoringCore: Cannot track event - not initialized or destroyed');
      return;
    }

    this.eventTracker.track(event);
  }

  /**
   * Track page view
   */
  trackPageView(url: string, title?: string): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.eventTracker.trackPageView(url, title);
  }

  /**
   * Track click event
   */
  trackClick(selector?: string, text?: string): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.eventTracker.trackClick(selector, text);
  }

  /**
   * Track custom event
   */
  trackCustom(name: string, properties?: Record<string, JSONValue>): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.eventTracker.trackCustom(name, properties);
  }

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number, type: MetricType = 'gauge'): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.metricCollector.recordMetric(name, value, type);
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.metricCollector.incrementCounter(name, value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.metricCollector.setGauge(name, value);
  }

  /**
   * Start a timer
   */
  startTimer(name: string): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.metricCollector.startTimer(name);
  }

  /**
   * End a timer
   */
  endTimer(name: string): number | null {
    if (!this.isInitialized || this.isDestroyed) {
      return null;
    }

    return this.metricCollector.endTimer(name);
  }

  /**
   * Measure function execution time
   */
  measure<T>(name: string, fn: () => T): T {
    if (!this.isInitialized || this.isDestroyed) {
      return fn();
    }

    return this.metricCollector.measureSync(name, fn);
  }

  /**
   * Measure async function execution time
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.isInitialized || this.isDestroyed) {
      return fn();
    }

    return this.metricCollector.measureAsync(name, fn);
  }

  /**
   * Capture an error
   */
  captureError(error: Error | ErrorInfo): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.errorCapture.captureError(error);
  }

  /**
   * Capture an exception with additional context
   */
  captureException(error: Error, context?: Record<string, JSONValue>): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.errorCapture.captureException(error, { context: { custom: context } });
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.errorCapture.captureMessage(message, {
      severity: level === 'error' ? 'high' : level === 'warning' ? 'medium' : 'low'
    });
  }

  /**
   * Set user context
   */
  setUser(user: UserContext): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.contextManager.setUser(user);
  }

  /**
   * Set custom context
   */
  setContext(key: string, value: JSONValue): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.contextManager.setCustom(key, value);
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, category?: string): void {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.errorCapture.addBreadcrumb(message, category);
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics() {
    if (!this.isInitialized || this.isDestroyed) {
      return null;
    }

    return this.performanceMonitor.getCurrentMetrics();
  }

  /**
   * Flush all queued data
   */
  async flush(): Promise<void> {
    if (!this.isInitialized || this.isDestroyed) {
      return;
    }

    this.logger.debug('MonitoringCore: Flushing data');

    // Collect all data
    const events = this.eventTracker.flush();
    const metrics = this.metricCollector.flush();
    const errors = this.errorCapture.flush();
    const context = this.contextManager.getContext();
    const performanceMetrics = this.performanceMonitor.getCurrentMetrics();

    // Prepare payload
    const payload = {
      timestamp: getCurrentTimestamp(),
      context,
      events,
      metrics,
      errors,
      performance: performanceMetrics,
      sdk: {
        name: '@monitoring-service/core',
        version: '1.0.0'
      }
    };

    // Send data if there's anything to send
    const hasData = events.length > 0 || metrics.length > 0 || errors.length > 0;
    if (hasData) {
      try {
        await this.transport.send(payload);
        this.logger.debug('MonitoringCore: Data flushed successfully', {
          events: events.length,
          metrics: metrics.length,
          errors: errors.length
        });
      } catch (error) {
        this.logger.error('MonitoringCore: Failed to flush data', error);
        throw error;
      }
    }
  }

  /**
   * Get SDK status and statistics
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      destroyed: this.isDestroyed,
      config: {
        environment: this.config.environment,
        version: this.config.version,
        endpoint: this.config.endpoint ? '[CONFIGURED]' : '[NOT CONFIGURED]',
        debug: this.config.debug
      },
      buffers: {
        events: this.eventTracker.getBufferSize(),
        metrics: this.metricCollector.getMetrics().length,
        errors: this.errorCapture.getErrors().length,
        queue: this.queueManager.size()
      },
      context: this.contextManager.getContext()
    };
  }

  /**
   * Destroy the SDK
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.logger.info('MonitoringCore: Destroying');

    // Stop auto flush
    this.stopAutoFlush();

    // Try to flush remaining data
    this.flush().catch(error => {
      this.logger.error('MonitoringCore: Failed to flush on destroy', error);
    });

    // Destroy components
    this.eventTracker.destroy();
    this.metricCollector.destroy();
    this.errorCapture.destroy();
    this.performanceMonitor.destroy();
    this.queueManager.destroy();
    this.transport.destroy();

    this.isDestroyed = true;
    this.isInitialized = false;
    
    this.logger.debug('MonitoringCore: Destroyed');
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (!this.config.endpoint) {
      throw new Error('MonitoringCore: endpoint is required');
    }

    if (!this.config.apiKey) {
      throw new Error('MonitoringCore: apiKey is required');
    }

    if (!this.config.environment) {
      throw new Error('MonitoringCore: environment is required');
    }
  }

  /**
   * Initialize all components
   */
  private initializeComponents(): void {
    // Create shared storage
    const storage = new LocalStorageAdapter();

    // Initialize queue manager
    const queueConfig: QueueManagerConfig = {
      maxSize: this.config.maxQueueSize,
      storage,
      logger: this.logger
    };
    this.queueManager = new QueueManager(queueConfig);

    // Initialize transport
    const transportConfig: HTTPTransportConfig = {
      endpoint: this.config.endpoint,
      apiKey: this.config.apiKey,
      enableOfflineSupport: this.config.enableOfflineSupport,
      storage,
      logger: this.logger,
      ...this.config.transport
    };
    this.transport = new HTTPTransport(transportConfig);

    // Initialize context manager
    const contextConfig: ContextManagerConfig = {
      appName: 'MonitoringSDK',
      appVersion: this.config.version,
      environment: this.config.environment,
      logger: this.logger
    };
    this.contextManager = new ContextManager(contextConfig);

    // Initialize event tracker
    const eventConfig: EventTrackerConfig = {
      maxBufferSize: this.config.maxQueueSize,
      sampleRate: this.config.sampleRate,
      logger: this.logger
    };
    this.eventTracker = new EventTracker(eventConfig);

    // Initialize metric collector
    const metricConfig: MetricCollectorConfig = {
      maxBufferSize: this.config.maxQueueSize,
      sampleRate: this.config.sampleRate,
      logger: this.logger
    };
    this.metricCollector = new MetricCollector(metricConfig);

    // Initialize error capture
    const errorConfig: ErrorCaptureConfig = {
      maxBufferSize: this.config.maxQueueSize,
      sampleRate: this.config.sampleRate,
      logger: this.logger
    };
    this.errorCapture = new ErrorCapture(errorConfig);

    // Initialize performance monitor
    const performanceConfig: PerformanceMonitorConfig = {
      logger: this.logger
    };
    this.performanceMonitor = new PerformanceMonitor(performanceConfig);

    // Set up cross-component integration
    this.setupContextIntegration();
  }

  /**
   * Set up context integration across components
   */
  private setupContextIntegration(): void {
    // Make context available to all components
    const getContextHandler = () => this.contextManager.getContext();

    // Update event tracker context
    this.eventTracker.setContext(getContextHandler());
    
    // Note: In a full implementation, you might want to set up 
    // automatic context synchronization between components
  }

  /**
   * Start automatic flushing
   */
  private startAutoFlush(): void {
    if (this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(error => {
          this.logger.error('MonitoringCore: Auto flush failed', error);
        });
      }, this.config.flushInterval);
    }
  }

  /**
   * Stop automatic flushing
   */
  private stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }
}

// Export all types and classes
export * from './types/index.js';
export * from './events/EventTracker.js';
export * from './metrics/MetricCollector.js';
export * from './errors/ErrorCapture.js';
export * from './transport/Transport.js';
export * from './performance/PerformanceMonitor.js';
export * from './context/ContextManager.js';
export * from './queue/QueueManager.js';
export * from './utils/index.js';

// Default export
export default MonitoringCore;

// Create and export a default instance
export const monitoring = new MonitoringCore();