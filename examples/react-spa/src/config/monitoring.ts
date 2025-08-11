// Generate a unique session ID
const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Get environment from various sources
const getEnvironment = (): 'development' | 'staging' | 'production' => {
  if (process.env.NODE_ENV === 'production') {
    if (window.location.hostname.includes('staging')) {
      return 'staging';
    }
    return 'production';
  }
  return 'development';
};

// Monitoring configuration
export const monitoringConfig = {
  apiEndpoint: process.env.REACT_APP_MONITORING_ENDPOINT || 'http://localhost:3001/api/monitoring',
  enableRealTime: true,
  enableUserJourney: true,
  enablePerformanceTracking: true,
  enableErrorTracking: true,
  environment: getEnvironment(),
  debug: process.env.NODE_ENV === 'development',
  sessionId: generateSessionId(),
  // userId will be set dynamically when user logs in
};

// Performance thresholds for alerts
export const performanceThresholds = {
  pageLoadTime: 3000,        // 3 seconds
  firstInputDelay: 100,      // 100ms
  largestContentfulPaint: 2500, // 2.5 seconds
  cumulativeLayoutShift: 0.1,   // 0.1 CLS score
  apiResponseTime: 1000,     // 1 second
};

// Error severity levels
export const errorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium', 
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

// Event categories for consistent tracking
export const eventCategories = {
  USER_JOURNEY: 'user_journey',
  USER_INTERACTION: 'user_interaction',
  PERFORMANCE: 'performance',
  ERROR: 'error',
  FEATURE_USAGE: 'feature_usage',
  BUSINESS_METRIC: 'business_metric',
} as const;

// Common event actions
export const eventActions = {
  // User Journey
  PAGE_VIEW: 'page_view',
  PAGE_EXIT: 'page_exit',
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  
  // User Interactions
  CLICK: 'click',
  FORM_SUBMIT: 'form_submit',
  SEARCH: 'search',
  SCROLL: 'scroll',
  
  // Performance
  PAGE_LOAD: 'page_load',
  API_CALL: 'api_call',
  RESOURCE_LOAD: 'resource_load',
  
  // Errors
  JAVASCRIPT_ERROR: 'javascript_error',
  API_ERROR: 'api_error',
  NETWORK_ERROR: 'network_error',
  
  // Features
  FEATURE_USED: 'feature_used',
  FEATURE_ENABLED: 'feature_enabled',
  FEATURE_DISABLED: 'feature_disabled',
} as const;

// Sample rate for performance monitoring (0-1)
export const performanceSampleRate = process.env.NODE_ENV === 'production' ? 0.1 : 1.0;