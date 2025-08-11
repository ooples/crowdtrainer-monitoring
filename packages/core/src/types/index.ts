/**
 * Core type definitions for the monitoring SDK
 */

// Base types
export type Timestamp = number;
export type UUID = string;
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

// Configuration types
export interface MonitoringConfig {
  /** API endpoint for sending data */
  endpoint: string;
  /** API key for authentication */
  apiKey: string;
  /** Environment (development, staging, production) */
  environment: string;
  /** Application version */
  version?: string;
  /** User ID for tracking */
  userId?: string;
  /** Session ID for tracking */
  sessionId?: string;
  /** Enable debug mode */
  debug?: boolean;
  /** Maximum events in queue before sending */
  maxQueueSize?: number;
  /** Flush interval in milliseconds */
  flushInterval?: number;
  /** Enable offline support */
  enableOfflineSupport?: boolean;
  /** Transport options */
  transport?: TransportConfig;
  /** Sampling rate (0-1) */
  sampleRate?: number;
}

export interface TransportConfig {
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Batch size for sending events */
  batchSize?: number;
}

// Context types
export interface Context {
  /** User context */
  user?: UserContext;
  /** Device context */
  device?: DeviceContext;
  /** Application context */
  app?: AppContext;
  /** Custom context data */
  custom?: Record<string, JSONValue>;
}

export interface UserContext {
  id: string;
  email?: string;
  username?: string;
  segment?: string;
  properties?: Record<string, JSONValue>;
}

export interface DeviceContext {
  platform?: string;
  os?: string;
  osVersion?: string;
  model?: string;
  manufacturer?: string;
  screenResolution?: string;
  viewport?: { width: number; height: number };
  userAgent?: string;
  timezone?: string;
  locale?: string;
}

export interface AppContext {
  name: string;
  version: string;
  build?: string;
  environment: string;
  releaseStage?: string;
}

// Event types
export interface BaseEvent {
  /** Unique event identifier */
  id: UUID;
  /** Event timestamp */
  timestamp: Timestamp;
  /** Event type */
  type: EventType;
  /** Event category */
  category?: string;
  /** Event context */
  context?: Context;
  /** Custom metadata */
  metadata?: Record<string, JSONValue>;
}

export type EventType = 
  | 'page_view' 
  | 'click' 
  | 'form_submit' 
  | 'error' 
  | 'performance' 
  | 'custom';

export interface PageViewEvent extends BaseEvent {
  type: 'page_view';
  /** Page URL */
  url: string;
  /** Page title */
  title?: string;
  /** Referrer URL */
  referrer?: string;
  /** Page load time */
  loadTime?: number;
}

export interface ClickEvent extends BaseEvent {
  type: 'click';
  /** Element selector */
  selector?: string;
  /** Element text content */
  text?: string;
  /** Click coordinates */
  coordinates?: { x: number; y: number };
}

export interface FormSubmitEvent extends BaseEvent {
  type: 'form_submit';
  /** Form selector */
  selector?: string;
  /** Form field count */
  fieldCount?: number;
  /** Validation errors */
  errors?: string[];
}

export interface CustomEvent extends BaseEvent {
  type: 'custom';
  /** Event name */
  name: string;
  /** Event properties */
  properties?: Record<string, JSONValue>;
}

// Metric types
export interface Metric {
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Metric unit */
  unit?: string;
  /** Metric tags */
  tags?: Record<string, string>;
  /** Metric timestamp */
  timestamp: Timestamp;
  /** Metric type */
  type: MetricType;
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

export interface CounterMetric extends Metric {
  type: 'counter';
}

export interface GaugeMetric extends Metric {
  type: 'gauge';
}

export interface HistogramMetric extends Metric {
  type: 'histogram';
  /** Histogram buckets */
  buckets?: number[];
}

export interface TimerMetric extends Metric {
  type: 'timer';
  /** Duration in milliseconds */
  duration: number;
}

// Performance types
export interface PerformanceMetrics {
  /** Navigation timing */
  navigation?: NavigationTiming;
  /** Paint timing */
  paint?: PaintTiming;
  /** Core Web Vitals */
  vitals?: WebVitals;
  /** Resource timing */
  resources?: ResourceTiming[];
}

export interface NavigationTiming {
  /** DNS lookup time */
  dnsLookup: number;
  /** TCP connection time */
  tcpConnection: number;
  /** TLS handshake time */
  tlsHandshake?: number;
  /** Request time */
  request: number;
  /** Response time */
  response: number;
  /** DOM processing time */
  domProcessing: number;
  /** Load event time */
  loadEvent: number;
}

export interface PaintTiming {
  /** First paint */
  firstPaint?: number;
  /** First contentful paint */
  firstContentfulPaint?: number;
  /** Largest contentful paint */
  largestContentfulPaint?: number;
}

export interface WebVitals {
  /** First Input Delay */
  fid?: number;
  /** Largest Contentful Paint */
  lcp?: number;
  /** Cumulative Layout Shift */
  cls?: number;
  /** First Contentful Paint */
  fcp?: number;
  /** Time to First Byte */
  ttfb?: number;
}

export interface ResourceTiming {
  /** Resource name */
  name: string;
  /** Resource type */
  type: string;
  /** Resource size */
  size: number;
  /** Resource duration */
  duration: number;
}

// Error types
export interface ErrorInfo {
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Error name/type */
  name?: string;
  /** Source file */
  filename?: string;
  /** Line number */
  lineno?: number;
  /** Column number */
  colno?: number;
  /** Error severity */
  severity?: ErrorSeverity;
  /** Error category */
  category?: ErrorCategory;
  /** Additional error data */
  data?: Record<string, JSONValue>;
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'javascript' | 'network' | 'security' | 'performance' | 'user' | 'system';

// Transport types
export interface TransportResponse {
  /** Response status */
  status: 'success' | 'error' | 'retry';
  /** Error message if failed */
  message?: string;
  /** Response data */
  data?: JSONValue;
}

export interface QueueItem {
  /** Item ID */
  id: UUID;
  /** Item data */
  data: JSONValue;
  /** Retry count */
  retryCount: number;
  /** Created timestamp */
  createdAt: Timestamp;
  /** Priority (lower = higher priority) */
  priority?: number;
}

// Plugin types
export interface Plugin {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Initialize plugin */
  init(config: MonitoringConfig): void;
  /** Plugin event handlers */
  handlers?: {
    onEvent?: (event: BaseEvent) => BaseEvent | null;
    onMetric?: (metric: Metric) => Metric | null;
    onError?: (error: ErrorInfo) => ErrorInfo | null;
    onBeforeSend?: (data: JSONValue) => JSONValue | null;
    onAfterSend?: (response: TransportResponse) => void;
  };
}

// Utility types
export interface Logger {
  debug(message: string, ...args: JSONValue[]): void;
  info(message: string, ...args: JSONValue[]): void;
  warn(message: string, ...args: JSONValue[]): void;
  error(message: string, ...args: JSONValue[]): void;
}

export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

// SDK interfaces
export interface MonitoringSDK {
  /** Initialize SDK */
  init(config: MonitoringConfig): Promise<void>;
  /** Track event */
  track(event: Omit<BaseEvent, 'id' | 'timestamp'>): void;
  /** Track page view */
  trackPageView(url: string, title?: string): void;
  /** Track click */
  trackClick(selector?: string, text?: string): void;
  /** Track custom event */
  trackCustom(name: string, properties?: Record<string, JSONValue>): void;
  /** Record metric */
  recordMetric(name: string, value: number, type?: MetricType): void;
  /** Capture error */
  captureError(error: Error | ErrorInfo): void;
  /** Set user context */
  setUser(user: UserContext): void;
  /** Set custom context */
  setContext(key: string, value: JSONValue): void;
  /** Flush queue */
  flush(): Promise<void>;
  /** Destroy SDK */
  destroy(): void;
}