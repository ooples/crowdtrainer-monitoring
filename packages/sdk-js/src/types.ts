export interface MonitorConfig {
  /** Project ID for monitoring service */
  projectId: string;
  /** API endpoint URL */
  apiUrl?: string;
  /** Environment name (development, staging, production) */
  environment?: string;
  /** Enable/disable auto error capture */
  autoCapture?: {
    errors?: boolean;
    performance?: boolean;
    network?: boolean;
    webVitals?: boolean;
  };
  /** Sample rate for performance monitoring (0-1) */
  sampleRate?: number;
  /** Maximum number of breadcrumbs to keep */
  maxBreadcrumbs?: number;
  /** Enable offline queue */
  enableOfflineQueue?: boolean;
  /** Debug mode */
  debug?: boolean;
}

export interface MonitorEvent {
  /** Event type */
  type: 'error' | 'performance' | 'custom' | 'pageview' | 'interaction';
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data: Record<string, any>;
  /** User context */
  user?: UserContext | undefined;
  /** Session context */
  session?: SessionContext | undefined;
  /** Custom context */
  context?: Record<string, any> | undefined;
  /** Breadcrumbs leading to this event */
  breadcrumbs?: Breadcrumb[] | undefined;
}

export interface UserContext {
  /** Unique user identifier */
  id?: string;
  /** User email */
  email?: string;
  /** User name */
  name?: string;
  /** Additional user properties */
  properties?: Record<string, any>;
}

export interface SessionContext {
  /** Session ID */
  id: string;
  /** Session start time */
  startTime: number;
  /** Page views in session */
  pageViews: number;
  /** Session duration */
  duration: number;
}

export interface Breadcrumb {
  /** Breadcrumb timestamp */
  timestamp: number;
  /** Breadcrumb type */
  type: 'navigation' | 'user' | 'http' | 'error' | 'info';
  /** Breadcrumb message */
  message: string;
  /** Additional data */
  data?: Record<string, any>;
}

export interface PerformanceMetrics {
  /** Navigation timing */
  navigation?: PerformanceNavigationTiming;
  /** Web Vitals */
  webVitals?: {
    CLS?: number;
    FID?: number;
    FCP?: number;
    LCP?: number;
    TTFB?: number;
  };
  /** Resource timing */
  resources?: PerformanceResourceTiming[];
}

export interface NetworkCaptureData {
  /** Request URL */
  url: string;
  /** HTTP method */
  method: string;
  /** Status code */
  status: number;
  /** Response time in ms */
  duration: number;
  /** Request size in bytes */
  requestSize?: number | undefined;
  /** Response size in bytes */
  responseSize?: number | undefined;
  /** Timestamp */
  timestamp: number;
}

export interface ErrorCaptureData {
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string | undefined;
  /** Error type */
  type: string;
  /** Source file */
  filename?: string | undefined;
  /** Line number */
  lineno?: number | undefined;
  /** Column number */
  colno?: number | undefined;
  /** Timestamp */
  timestamp: number;
}

export interface TransportOptions {
  /** Request timeout in ms */
  timeout?: number;
  /** Retry attempts */
  retries?: number;
  /** Use beacon API for page unload */
  useBeacon?: boolean;
}