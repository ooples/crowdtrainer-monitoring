import type { 
  MonitorConfig, 
  MonitorEvent, 
  UserContext, 
  SessionContext, 
  Breadcrumb,
  ErrorCaptureData,
  NetworkCaptureData,
  PerformanceMetrics,
  TransportOptions
} from './types';

import { ErrorCapture as ErrorCaptureClass } from './capture/errors';
import { NetworkCapture as NetworkCaptureClass } from './capture/network';
import { PerformanceCapture } from './capture/performance';
import { WebVitalsCapture } from './capture/webvitals';
import { FetchTransport } from './transport/fetch';
import { BeaconTransport } from './transport/beacon';
import { LocalStorage } from './storage/localStorage';
import { generateUUID, now, isBrowser, debounce } from './utils';

/**
 * Main Monitor class for the monitoring SDK
 */
export class Monitor {
  private config: Required<MonitorConfig>;
  private storage: LocalStorage;
  private transport: FetchTransport;
  private beaconTransport: BeaconTransport;
  private errorCapture: ErrorCaptureClass;
  private networkCapture: NetworkCaptureClass;
  private performanceCapture: PerformanceCapture;
  private webVitalsCapture: WebVitalsCapture;
  
  private user?: UserContext;
  private session: SessionContext;
  private breadcrumbs: Breadcrumb[] = [];
  private context: Record<string, any> = {};
  private eventQueue: MonitorEvent[] = [];
  private isInitialized: boolean = false;

  // Debounced functions
  private debouncedFlush: () => void;

  constructor(config: MonitorConfig) {
    // Merge with defaults
    this.config = {
      projectId: config.projectId,
      apiUrl: config.apiUrl || 'https://api.monitoring-service.com',
      environment: config.environment || 'production',
      autoCapture: {
        errors: true,
        performance: true,
        network: true,
        webVitals: true,
        ...config.autoCapture,
      },
      sampleRate: config.sampleRate ?? 1.0,
      maxBreadcrumbs: config.maxBreadcrumbs || 50,
      enableOfflineQueue: config.enableOfflineQueue ?? true,
      debug: config.debug ?? false,
    };

    // Initialize storage
    this.storage = new LocalStorage(`monitor_${this.config.projectId}_`);

    // Initialize transport
    const transportOptions: TransportOptions = {
      timeout: 5000,
      retries: 3,
      useBeacon: false,
    };
    
    this.transport = new FetchTransport(
      this.config.apiUrl,
      this.config.projectId,
      transportOptions
    );

    this.beaconTransport = new BeaconTransport(
      this.config.apiUrl,
      this.config.projectId
    );

    // Initialize capture modules
    this.errorCapture = new ErrorCaptureClass();
    this.networkCapture = new NetworkCaptureClass();
    this.performanceCapture = new PerformanceCapture();
    this.webVitalsCapture = new WebVitalsCapture();

    // Initialize session
    this.session = this.initializeSession();

    // Setup debounced flush
    this.debouncedFlush = debounce(() => this.flush(), 5000);

    // Load persisted data
    this.loadPersistedData();

    // Start capturing if in browser
    if (isBrowser()) {
      this.start();
    }
  }

  /** Initialize monitoring */
  start(): void {
    if (this.isInitialized || !isBrowser()) return;

    this.isInitialized = true;
    this.log('Monitor SDK starting...');

    // Start auto-capture modules
    if (this.config.autoCapture.errors) {
      this.startErrorCapture();
    }

    if (this.config.autoCapture.network) {
      this.startNetworkCapture();
    }

    if (this.config.autoCapture.performance) {
      this.startPerformanceCapture();
    }

    if (this.config.autoCapture.webVitals) {
      this.startWebVitalsCapture();
    }

    // Setup page unload handler for offline queue
    this.setupPageUnloadHandler();

    // Add initial breadcrumb
    this.addBreadcrumb({
      timestamp: now(),
      type: 'info',
      message: 'Monitor SDK initialized',
      data: {
        projectId: this.config.projectId,
        environment: this.config.environment,
      },
    });

    // Track page view
    this.trackPageView();

    this.log('Monitor SDK started successfully');
  }

  /** Stop monitoring */
  stop(): void {
    if (!this.isInitialized) return;

    this.log('Monitor SDK stopping...');

    // Flush pending events
    this.flush();

    // Stop capture modules
    this.errorCapture.stop();
    this.networkCapture.stop();
    this.performanceCapture.stop();
    this.webVitalsCapture.stop();

    this.isInitialized = false;
    this.log('Monitor SDK stopped');
  }

  /** Set user context */
  setUser(user: UserContext): void {
    this.user = { ...user };
    this.persistUserContext();
    
    this.addBreadcrumb({
      timestamp: now(),
      type: 'user',
      message: 'User identified',
      data: { id: user.id, email: user.email },
    });

    this.log('User context updated', user);
  }

  /** Clear user context */
  clearUser(): void {
    delete this.user;
    this.storage.remove('user');
    
    this.addBreadcrumb({
      timestamp: now(),
      type: 'user',
      message: 'User cleared',
    });

    this.log('User context cleared');
  }

  /** Set custom context */
  setContext(key: string, value: any): void {
    this.context[key] = value;
    this.persistContext();
    this.log(`Context updated: ${key}`, value);
  }

  /** Clear custom context */
  clearContext(key?: string): void {
    if (key) {
      delete this.context[key];
    } else {
      this.context = {};
    }
    this.persistContext();
    this.log(`Context cleared${key ? `: ${key}` : ''}`);
  }

  /** Add breadcrumb */
  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);
    
    // Keep only the most recent breadcrumbs
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.config.maxBreadcrumbs);
    }
    
    this.log('Breadcrumb added', breadcrumb);
  }

  /** Track custom event */
  track(eventName: string, data?: Record<string, any>): void {
    const event: MonitorEvent = {
      type: 'custom',
      timestamp: now(),
      data: {
        name: eventName,
        ...data,
      },
      user: this.user,
      session: this.session,
      context: this.context,
      breadcrumbs: [...this.breadcrumbs],
    };

    this.queueEvent(event);
    this.log('Custom event tracked', event);
  }

  /** Track page view */
  trackPageView(url?: string, title?: string): void {
    if (!isBrowser()) return;

    const pageUrl = url || window.location.href;
    const pageTitle = title || document.title;

    // Update session page views
    this.session.pageViews++;
    this.session.duration = now() - this.session.startTime;
    this.persistSession();

    const event: MonitorEvent = {
      type: 'pageview',
      timestamp: now(),
      data: {
        url: pageUrl,
        title: pageTitle,
        referrer: document.referrer,
      },
      user: this.user,
      session: this.session,
      context: this.context,
      breadcrumbs: [...this.breadcrumbs],
    };

    this.queueEvent(event);

    this.addBreadcrumb({
      timestamp: now(),
      type: 'navigation',
      message: `Page view: ${pageTitle}`,
      data: { url: pageUrl },
    });

    this.log('Page view tracked', event);
  }

  /** Track user interaction */
  trackInteraction(element: string, action: string, data?: Record<string, any>): void {
    const event: MonitorEvent = {
      type: 'interaction',
      timestamp: now(),
      data: {
        element,
        action,
        ...data,
      },
      user: this.user,
      session: this.session,
      context: this.context,
      breadcrumbs: [...this.breadcrumbs],
    };

    this.queueEvent(event);

    this.addBreadcrumb({
      timestamp: now(),
      type: 'user',
      message: `${action} on ${element}`,
      data: { element, action },
    });

    this.log('Interaction tracked', event);
  }

  /** Flush pending events */
  async flush(): Promise<boolean> {
    if (this.eventQueue.length === 0) return true;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    this.log(`Flushing ${events.length} events`);

    // Apply sampling
    const sampledEvents = this.applySampling(events);
    
    if (sampledEvents.length === 0) {
      this.log('All events filtered out by sampling');
      return true;
    }

    // Try to send events
    const success = await this.transport.sendBatch(sampledEvents);

    if (!success && this.config.enableOfflineQueue) {
      // Store in offline queue
      this.storeOfflineEvents(sampledEvents);
      this.log('Events stored in offline queue');
    }

    return success;
  }

  /** Get current session */
  getSession(): SessionContext {
    return { ...this.session };
  }

  /** Get current user */
  getUser(): UserContext | undefined {
    return this.user ? { ...this.user } : undefined;
  }

  /** Get current context */
  getContext(): Record<string, any> {
    return { ...this.context };
  }

  /** Get breadcrumbs */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /** Check if monitoring is active */
  isActive(): boolean {
    return this.isInitialized;
  }

  /** Initialize session */
  private initializeSession(): SessionContext {
    const stored = this.storage.get<SessionContext>('session');
    
    if (stored && (now() - stored.startTime) < 30 * 60 * 1000) {
      // Session is less than 30 minutes old, continue it
      return stored;
    }

    // Create new session
    const session: SessionContext = {
      id: generateUUID(),
      startTime: now(),
      pageViews: 0,
      duration: 0,
    };

    this.persistSession();
    return session;
  }

  /** Start error capture */
  private startErrorCapture(): void {
    this.errorCapture.addListener((error: ErrorCaptureData) => {
      const event: MonitorEvent = {
        type: 'error',
        timestamp: error.timestamp,
        data: error,
        user: this.user,
        session: this.session,
        context: this.context,
        breadcrumbs: [...this.breadcrumbs],
      };

      this.queueEvent(event);
      this.addBreadcrumb(ErrorCaptureClass.toBreadcrumb(error));
    });

    this.errorCapture.start();
  }

  /** Start network capture */
  private startNetworkCapture(): void {
    this.networkCapture.addListener((request: NetworkCaptureData) => {
      // Filter out monitoring API requests
      if (!this.networkCapture.shouldCapture(request.url)) return;

      const event: MonitorEvent = {
        type: 'performance',
        timestamp: request.timestamp,
        data: {
          type: 'network',
          ...request,
        },
        user: this.user,
        session: this.session,
        context: this.context,
        breadcrumbs: [...this.breadcrumbs],
      };

      this.queueEvent(event);
      this.addBreadcrumb(NetworkCaptureClass.toBreadcrumb(request));
    });

    this.networkCapture.start();
  }

  /** Start performance capture */
  private startPerformanceCapture(): void {
    this.performanceCapture.addListener((metrics: PerformanceMetrics) => {
      const event: MonitorEvent = {
        type: 'performance',
        timestamp: now(),
        data: {
          type: 'timing',
          ...metrics,
        },
        user: this.user,
        session: this.session,
        context: this.context,
        breadcrumbs: [...this.breadcrumbs],
      };

      this.queueEvent(event);
      this.addBreadcrumb(PerformanceCapture.toBreadcrumb(metrics));
    });

    this.performanceCapture.start();
  }

  /** Start Web Vitals capture */
  private startWebVitalsCapture(): void {
    this.webVitalsCapture.addListener((metric) => {
      const event: MonitorEvent = {
        type: 'performance',
        timestamp: now(),
        data: {
          type: 'web-vital',
          metric: metric.name,
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
        },
        user: this.user,
        session: this.session,
        context: this.context,
        breadcrumbs: [...this.breadcrumbs],
      };

      this.queueEvent(event);
      this.addBreadcrumb(WebVitalsCapture.toBreadcrumb(metric));
    });

    this.webVitalsCapture.start();
  }

  /** Queue event for sending */
  private queueEvent(event: MonitorEvent): void {
    this.eventQueue.push(event);
    
    // Auto-flush if queue is getting large
    if (this.eventQueue.length >= 50) {
      this.flush();
    } else {
      this.debouncedFlush();
    }
  }

  /** Apply sampling to events */
  private applySampling(events: MonitorEvent[]): MonitorEvent[] {
    if (this.config.sampleRate >= 1.0) return events;
    if (this.config.sampleRate <= 0) return [];

    return events.filter(() => Math.random() < this.config.sampleRate);
  }

  /** Setup page unload handler */
  private setupPageUnloadHandler(): void {
    if (!isBrowser()) return;

    this.beaconTransport.setupPageUnloadHandler(() => {
      const events = [...this.eventQueue];
      this.eventQueue = [];
      return events;
    });
  }

  /** Store events in offline queue */
  private storeOfflineEvents(events: MonitorEvent[]): void {
    const offlineQueue = this.storage.get<MonitorEvent[]>('offline_queue') || [];
    offlineQueue.push(...events);
    
    // Keep only last 1000 events to prevent storage bloat
    const trimmedQueue = offlineQueue.slice(-1000);
    this.storage.set('offline_queue', trimmedQueue);
  }

  /** Process offline queue */
  private async processOfflineQueue(): Promise<void> {
    const offlineQueue = this.storage.get<MonitorEvent[]>('offline_queue');
    if (!offlineQueue || offlineQueue.length === 0) return;

    this.log(`Processing ${offlineQueue.length} offline events`);

    const success = await this.transport.sendBatch(offlineQueue);
    if (success) {
      this.storage.remove('offline_queue');
      this.log('Offline queue processed successfully');
    }
  }

  /** Load persisted data */
  private loadPersistedData(): void {
    // Load user context
    const storedUser = this.storage.get<UserContext>('user');
    if (storedUser) {
      this.user = storedUser;
    }

    // Load custom context
    const storedContext = this.storage.get<Record<string, any>>('context');
    if (storedContext) {
      this.context = storedContext;
    }

    // Process offline queue when online
    if (isBrowser() && navigator.onLine) {
      setTimeout(() => this.processOfflineQueue(), 1000);
    }
  }

  /** Persist user context */
  private persistUserContext(): void {
    if (this.user) {
      this.storage.set('user', this.user);
    }
  }

  /** Persist custom context */
  private persistContext(): void {
    this.storage.set('context', this.context);
  }

  /** Persist session */
  private persistSession(): void {
    this.storage.set('session', this.session);
  }

  /** Debug logging */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[Monitor SDK] ${message}`, data);
    }
  }
}