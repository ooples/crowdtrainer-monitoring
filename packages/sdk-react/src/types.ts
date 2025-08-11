import { ReactNode } from 'react';

/**
 * Base monitoring event structure
 */
export interface MonitoringEvent {
  id?: string;
  type: 'auth' | 'payment' | 'ai_training' | 'user_journey' | 'api' | 'database' | 'feature_usage' | 'error' | 'component' | 'interaction';
  category: string;
  action: string;
  userId?: string;
  sessionId?: string;
  metadata: EventMetadata;
  timestamp: Date;
  environment: 'development' | 'staging' | 'production';
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Performance metric structure
 */
export interface PerformanceMetric {
  id?: string;
  type: 'api_response_time' | 'database_query' | 'page_load' | 'feature_interaction' | 'component_render' | 'user_interaction';
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  userId?: string;
  sessionId?: string;
  metadata: EventMetadata;
  timestamp: Date;
  environment: 'development' | 'staging' | 'production';
}

/**
 * Event metadata for flexible data storage
 */
export interface EventMetadata extends Record<string, any> {
  // Common React-specific fields
  component?: string;
  props?: Record<string, any>;
  route?: string;
  userAgent?: string;
  
  // Performance-specific fields
  renderTime?: number;
  componentStack?: string;
  
  // Error-specific fields
  errorMessage?: string;
  errorStack?: string;
  errorBoundary?: string;
  
  // User interaction fields
  interactionType?: 'click' | 'hover' | 'focus' | 'scroll' | 'input' | 'submit';
  targetElement?: string;
  coordinates?: { x: number; y: number };
}

/**
 * Configuration for the monitoring provider
 */
export interface MonitorConfig {
  apiKey?: string;
  environment?: 'development' | 'staging' | 'production';
  apiEndpoint?: string;
  enableAutoTracking?: boolean;
  enablePerformanceTracking?: boolean;
  enableErrorTracking?: boolean;
  enableComponentTracking?: boolean;
  enableUserInteractionTracking?: boolean;
  bufferSize?: number;
  flushInterval?: number;
  userId?: string;
  sessionId?: string;
  debug?: boolean;
  excludeComponents?: string[];
  excludeRoutes?: string[];
  customTags?: Record<string, string>;
}

/**
 * Monitor instance interface
 */
export interface MonitorInstance {
  // Event tracking
  trackEvent: (action: string, metadata?: EventMetadata) => void;
  trackUserEvent: (action: string, category: string, metadata?: EventMetadata) => void;
  trackError: (error: Error, metadata?: EventMetadata) => void;
  
  // Performance tracking
  trackMetric: (name: string, value: number, unit?: PerformanceMetric['unit'], metadata?: EventMetadata) => void;
  trackRenderTime: (componentName: string, renderTime: number, metadata?: EventMetadata) => void;
  trackInteractionTime: (action: string, duration: number, metadata?: EventMetadata) => void;
  
  // OAuth and authentication
  trackOAuthAttempt: (provider: 'google' | 'github', metadata?: EventMetadata) => void;
  trackOAuthSuccess: (provider: 'google' | 'github', userId: string, metadata?: EventMetadata) => void;
  trackOAuthError: (provider: 'google' | 'github', error: string, metadata?: EventMetadata) => void;
  
  // Payment tracking
  trackPaymentAttempt: (amount: number, currency: string, metadata?: EventMetadata) => void;
  trackPaymentSuccess: (amount: number, currency: string, paymentId: string, metadata?: EventMetadata) => void;
  trackPaymentError: (amount: number, currency: string, error: string, metadata?: EventMetadata) => void;
  
  // Component lifecycle
  trackComponentMount: (componentName: string, metadata?: EventMetadata) => void;
  trackComponentUnmount: (componentName: string, metadata?: EventMetadata) => void;
  trackComponentUpdate: (componentName: string, metadata?: EventMetadata) => void;
  trackComponentError: (componentName: string, error: Error, metadata?: EventMetadata) => void;
  
  // User journey
  trackPageView: (route: string, metadata?: EventMetadata) => void;
  trackUserAction: (action: string, target: string, metadata?: EventMetadata) => void;
  
  // Configuration
  setUserId: (userId: string) => void;
  setSessionId: (sessionId: string) => void;
  addTags: (tags: Record<string, string>) => void;
  flush: () => Promise<void>;
}

/**
 * Hook return type for monitoring
 */
export interface MonitoringHook {
  monitor: MonitorInstance;
  isEnabled: boolean;
  config: MonitorConfig;
}

/**
 * Component render performance metric
 */
export interface ComponentRenderMetric extends PerformanceMetric {
  type: 'component_render';
  metadata: EventMetadata & {
    component: string;
    renderPhase: 'mount' | 'update' | 'unmount';
    propsChanged?: boolean;
    stateChanged?: boolean;
    childCount?: number;
  };
}

/**
 * User interaction event
 */
export interface UserInteractionEvent extends MonitoringEvent {
  type: 'interaction';
  metadata: EventMetadata & {
    interactionType: 'click' | 'hover' | 'focus' | 'scroll' | 'input' | 'submit';
    targetElement: string;
    coordinates?: { x: number; y: number };
    modifierKeys?: string[];
    duration?: number;
  };
}

/**
 * Error boundary state
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: {
    componentStack: string;
  };
  errorId?: string;
}

/**
 * Router integration types
 */
export interface RouteChangeEvent {
  from: string;
  to: string;
  duration?: number;
  metadata?: EventMetadata;
}

/**
 * Performance observer entry types for React
 */
export interface ReactPerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  detail?: any;
}

/**
 * Context value for the monitoring provider
 */
export interface MonitorContextValue {
  monitor: MonitorInstance;
  config: MonitorConfig;
  isEnabled: boolean;
}

/**
 * Component props with monitoring
 */
export interface WithMonitoringProps {
  __monitoring?: {
    componentName?: string;
    trackRenders?: boolean;
    trackInteractions?: boolean;
    customMetadata?: EventMetadata;
  };
  children?: ReactNode;
}