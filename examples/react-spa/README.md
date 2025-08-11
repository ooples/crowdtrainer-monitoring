# React SPA Monitoring Integration Example

This example demonstrates a comprehensive monitoring integration for React Single Page Applications, showcasing real-world patterns for tracking user behavior, performance metrics, and errors.

## Features

- **🎯 User Journey Tracking**: Complete navigation flow tracking with session management
- **⚡ Performance Monitoring**: Core Web Vitals (LCP, FID, CLS) and custom metrics
- **🚨 Error Tracking**: JavaScript errors, promise rejections, and React component errors
- **📊 Real-time Analytics**: Live event tracking with offline support
- **🔄 Offline Resilience**: Event queuing when offline with automatic retry
- **📱 Form Analytics**: Comprehensive form interaction and conversion tracking
- **🎨 Interactive Dashboard**: Real-time monitoring dashboard with live metrics

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```env
REACT_APP_MONITORING_ENDPOINT=http://localhost:3001/api/monitoring
```

### 3. Start the Development Server

```bash
npm start
# or
yarn start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture Overview

### Context Providers

The monitoring system uses React Context for state management:

```tsx
// App.tsx
<MonitoringProvider config={monitoringConfig}>
  <UserJourneyProvider>
    <YourApp />
  </UserJourneyProvider>
</MonitoringProvider>
```

### Monitoring Provider

Handles core monitoring functionality:
- Event tracking and batching
- Error reporting
- Performance metrics collection
- Offline/online state management

```tsx
const { track, trackError, trackPerformance } = useMonitoring();
```

### User Journey Provider

Tracks user navigation and behavior:
- Page view tracking
- Session duration
- User interaction patterns
- Conversion funnel analysis

```tsx
const { trackUserInteraction, getSessionDuration } = useUserJourney();
```

## Integration Patterns

### 1. Page View Tracking

Automatic page view tracking with React Router:

```tsx
// UserJourneyProvider.tsx
useEffect(() => {
  trackPageView({
    referrer: document.referrer,
    search: location.search,
    hash: location.hash,
  });
}, [location.pathname]);
```

### 2. User Interaction Tracking

Track any user interaction:

```tsx
const handleButtonClick = () => {
  trackUserInteraction('button_click', {
    button_type: 'cta',
    location: 'header',
  });
  
  track({
    category: 'conversion',
    action: 'cta_click',
    label: 'get_started',
  });
};
```

### 3. API Call Monitoring

Track API performance and errors:

```tsx
const makeApiCall = async () => {
  const startTime = performance.now();
  
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    
    trackPerformance({
      name: 'api_call',
      value: performance.now() - startTime,
      unit: 'ms',
      metadata: {
        endpoint: '/api/data',
        success: true,
      },
    });
    
  } catch (error) {
    trackError(error, {
      category: 'api',
      action: 'fetch_error',
      metadata: {
        endpoint: '/api/data',
        duration: performance.now() - startTime,
      },
    });
  }
};
```

### 4. Form Analytics

Comprehensive form tracking:

```tsx
// Track form field interactions
const handleInputChange = (field) => (e) => {
  trackUserInteraction('form_field_interaction', {
    field,
    form: 'contact_form',
    value_length: e.target.value.length,
  });
};

// Track form submission
const handleSubmit = async (e) => {
  e.preventDefault();
  
  track({
    category: 'conversion',
    action: 'form_submitted',
    label: 'contact_form',
    metadata: {
      completion_rate: calculateCompletionRate(),
    },
  });
};
```

### 5. Performance Monitoring

Automatic Core Web Vitals tracking:

```tsx
// MonitoringProvider.tsx
useEffect(() => {
  if ('PerformanceObserver' in window) {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      trackPerformance({
        name: 'largest_contentful_paint',
        value: lastEntry.startTime,
        unit: 'ms',
      });
    });
    
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  }
}, []);
```

### 6. Error Boundaries

React Error Boundary integration:

```tsx
class ErrorBoundary extends Component {
  componentDidCatch(error, errorInfo) {
    // Report to monitoring system
    this.reportErrorToMonitoring(error, errorInfo);
  }
  
  reportErrorToMonitoring = async (error, errorInfo) => {
    const errorData = {
      type: 'error',
      category: 'react_error',
      action: 'component_error',
      metadata: {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
      },
    };
    
    await fetch('/api/monitoring/events', {
      method: 'POST',
      body: JSON.stringify(errorData),
    });
  };
}
```

## Event Types and Schema

### Event Structure

```tsx
interface MonitoringEvent {
  category: string;          // Event category
  action: string;           // Event action
  label?: string;           // Event label
  value?: number;           // Numeric value
  metadata?: Record<string, any>; // Additional context
}
```

### Performance Metrics

```tsx
interface PerformanceMetric {
  name: string;             // Metric name
  value: number;           // Metric value
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  metadata?: Record<string, any>; // Additional context
}
```

### Common Event Categories

- `user_journey`: Page views, navigation
- `user_interaction`: Clicks, form interactions
- `performance`: Timing metrics, Core Web Vitals
- `error`: JavaScript errors, API failures
- `conversion`: Form submissions, CTA clicks
- `feature_usage`: Feature adoption, usage patterns

## Configuration Options

### Monitoring Configuration

```tsx
const monitoringConfig = {
  apiEndpoint: string;              // Monitoring API endpoint
  enableRealTime: boolean;          // Enable real-time updates
  enableUserJourney: boolean;       // Track user journey
  enablePerformanceTracking: boolean; // Track performance metrics
  enableErrorTracking: boolean;     // Track errors
  environment: 'development' | 'staging' | 'production';
  debug: boolean;                   // Enable debug logging
  sessionId: string;               // Unique session identifier
};
```

### Performance Thresholds

```tsx
export const performanceThresholds = {
  pageLoadTime: 3000,        // 3 seconds
  firstInputDelay: 100,      // 100ms
  largestContentfulPaint: 2500, // 2.5 seconds
  cumulativeLayoutShift: 0.1,   // 0.1 CLS score
  apiResponseTime: 1000,     // 1 second
};
```

## What Gets Tracked

### Automatic Tracking

- **Page Views**: Route changes, referrers, search parameters
- **Performance**: Core Web Vitals, page load times, API response times
- **Errors**: JavaScript errors, unhandled promise rejections, React errors
- **User Activity**: Scroll, clicks, form interactions (throttled)
- **Session Data**: Duration, page count, journey funnel

### Manual Tracking

- **Business Events**: Conversions, feature usage, custom metrics
- **User Interactions**: Button clicks, form submissions, CTA interactions
- **Custom Performance**: Feature-specific timing, custom calculations
- **Error Context**: Additional context for errors and failures

## Offline Support

The monitoring system includes robust offline support:

```tsx
// Automatic event queuing when offline
useEffect(() => {
  const handleOnline = () => {
    setIsOnline(true);
    flushEventQueue(); // Send queued events
  };
  
  const handleOffline = () => {
    setIsOnline(false);
    // Events automatically queued
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}, []);
```

## Best Practices

### 1. Event Naming Conventions

Use consistent naming patterns:
- Categories: `user_journey`, `performance`, `error`, `conversion`
- Actions: `page_view`, `button_click`, `form_submit`, `api_call`
- Labels: Specific identifiers like page names, button types, etc.

### 2. Performance Considerations

```tsx
// Throttle high-frequency events
const throttledTrackActivity = throttle(trackActivity, 10000);

// Sample performance metrics in production
const shouldSample = Math.random() < performanceSampleRate;
if (shouldSample) {
  trackPerformance(metric);
}
```

### 3. Error Context

Always include relevant context with errors:

```tsx
trackError(error, {
  category: 'api',
  action: 'fetch_failed',
  metadata: {
    endpoint: '/api/users',
    method: 'GET',
    status: response?.status,
    userId: currentUser?.id,
  },
});
```

### 4. Privacy Considerations

```tsx
// Sanitize sensitive data
const sanitizedMetadata = {
  ...metadata,
  email: metadata.email ? '[REDACTED]' : undefined,
  password: undefined, // Never track passwords
};
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage

# Type checking
npm run type-check

# Linting
npm run lint
```

## Production Deployment

### 1. Environment Variables

```env
REACT_APP_MONITORING_ENDPOINT=https://api.yourdomain.com/monitoring
NODE_ENV=production
```

### 2. Build Optimization

```bash
# Build for production
npm run build

# Analyze bundle size
npm install --save-dev webpack-bundle-analyzer
npm run build && npx webpack-bundle-analyzer build/static/js/*.js
```

### 3. Content Security Policy

Add CSP headers for monitoring endpoints:

```
Content-Security-Policy: connect-src 'self' https://api.yourdomain.com/monitoring
```

## Monitoring Dashboard

The example includes a real-time dashboard at `/dashboard` showing:

- **Session Statistics**: Duration, pages visited, events tracked
- **User Journey**: Timeline of page visits with durations
- **Page Funnel**: Visual representation of user flow
- **Real-time Status**: Connection status and event queue

## Integration with External Services

### Sending to External Analytics

```tsx
// Send to multiple services
const track = (event) => {
  // Send to your monitoring API
  sendToMonitoringAPI(event);
  
  // Also send to Google Analytics
  if (window.gtag) {
    window.gtag('event', event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
    });
  }
  
  // Or Mixpanel
  if (window.mixpanel) {
    window.mixpanel.track(event.action, event.metadata);
  }
};
```

## Troubleshooting

### Common Issues

1. **Events not appearing**: Check network tab for failed API requests
2. **Performance metrics missing**: Verify browser support for Performance Observer
3. **High event volume**: Implement sampling and throttling
4. **Offline events lost**: Ensure proper event queuing implementation

### Debug Mode

Enable debug mode in development:

```tsx
const monitoringConfig = {
  debug: process.env.NODE_ENV === 'development',
  // ... other config
};
```

This logs all events to the browser console for debugging.

## Next Steps

- Set up monitoring API backend
- Configure alerting and notifications
- Implement custom business metrics
- Set up automated reports
- Integrate with external monitoring services
- Add A/B testing integration
- Implement user segmentation
- Set up conversion funnel analysis