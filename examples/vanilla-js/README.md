# Vanilla JavaScript Monitoring Integration Example

This example demonstrates how to integrate CrowdTrainer's monitoring system with any website using pure vanilla JavaScript - no frameworks or dependencies required.

## Features

- **🚀 Zero Dependencies**: Pure vanilla JavaScript implementation
- **📱 Cross-Platform**: Works on all modern browsers and devices
- **⚡ Performance Monitoring**: Core Web Vitals, page load times, and custom metrics
- **🎯 User Tracking**: Complete user journey and interaction tracking
- **🚨 Error Monitoring**: Comprehensive error tracking and reporting
- **💾 Offline Support**: Event queuing and retry mechanisms
- **📊 Real-time Dashboard**: Live analytics and statistics
- **🔧 Easy Integration**: Simple CDN-style integration

## Quick Start

### Method 1: Local Development

1. **Clone and Navigate**:
   ```bash
   cd monitoring-service/examples/vanilla-js
   ```

2. **Install Development Dependencies** (optional):
   ```bash
   npm install
   ```

3. **Start Local Server**:
   ```bash
   # Using Python (most common)
   python -m http.server 3000
   # or Python 3
   python3 -m http.server 3000
   
   # Or using npm script
   npm run serve
   ```

4. **Open in Browser**:
   ```
   http://localhost:3000
   ```

### Method 2: CDN Integration

Add to any existing website:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Website</title>
</head>
<body>
  <!-- Your existing content -->
  
  <!-- Add monitoring at the end of body -->
  <script src="js/monitoring.js"></script>
  <script>
    // Initialize monitoring
    CrowdTrainerMonitoring.init({
      apiEndpoint: 'https://your-api.com/monitoring',
      enableAutoTracking: true,
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      environment: 'production',
      debug: false,
    });
  </script>
</body>
</html>
```

## Configuration Options

### Basic Configuration

```javascript
CrowdTrainerMonitoring.init({
  apiEndpoint: 'http://localhost:3001/api/monitoring',  // Required
  enableAutoTracking: true,         // Auto-track clicks, forms, scroll
  enablePerformanceTracking: true,  // Track Core Web Vitals
  enableErrorTracking: true,        // Track JavaScript errors
  enableUserJourney: true,          // Track navigation
  environment: 'development',       // Environment identifier
  debug: true,                      // Enable console logging
  bufferSize: 10,                   // Events to buffer before sending
  flushInterval: 5000,              // Auto-flush interval (ms)
  retryAttempts: 3,                 // Retry failed requests
  retryDelay: 1000,                 // Delay between retries (ms)
});
```

### Advanced Configuration

```javascript
// Custom configuration for production
CrowdTrainerMonitoring.init({
  apiEndpoint: 'https://analytics.yoursite.com/api/monitoring',
  environment: 'production',
  debug: false,
  bufferSize: 50,          // Larger buffer for production
  flushInterval: 30000,    // Less frequent flushing
  enableAutoTracking: {    // Granular control
    clicks: true,
    forms: true,
    scroll: false,         // Disable scroll tracking
  },
});
```

## API Reference

### Core Methods

#### `CrowdTrainerMonitoring.init(config)`

Initialize the monitoring system with configuration options.

```javascript
CrowdTrainerMonitoring.init({
  apiEndpoint: 'https://api.example.com/monitoring',
  debug: true,
});
```

#### `CrowdTrainerMonitoring.track(event)`

Track custom events:

```javascript
CrowdTrainerMonitoring.track({
  category: 'user_interaction',
  action: 'button_click',
  label: 'subscribe_button',
  value: 1,
  metadata: {
    page: 'homepage',
    user_type: 'visitor',
  },
});
```

#### `CrowdTrainerMonitoring.trackPerformance(metric)`

Track custom performance metrics:

```javascript
CrowdTrainerMonitoring.trackPerformance({
  name: 'api_call_duration',
  value: 245,
  unit: 'ms',
  metadata: {
    endpoint: '/api/users',
    success: true,
  },
});
```

#### `CrowdTrainerMonitoring.trackError(error, context)`

Track errors with context:

```javascript
try {
  // Your code
} catch (error) {
  CrowdTrainerMonitoring.trackError(error, {
    category: 'api_error',
    action: 'fetch_failed',
    metadata: {
      endpoint: '/api/data',
      user_id: 'user123',
    },
  });
}
```

### Utility Methods

#### `CrowdTrainerMonitoring.getStats()`

Get current session statistics:

```javascript
const stats = CrowdTrainerMonitoring.getStats();
console.log(stats);
// {
//   sessionDuration: 125000,
//   events: 42,
//   pageViews: 5,
//   errors: 0,
//   bufferSize: 3,
//   isOnline: true,
//   userJourney: [...],
// }
```

#### `CrowdTrainerMonitoring.exportData()`

Export session data as JSON file:

```javascript
// Triggers download of session data
CrowdTrainerMonitoring.exportData();
```

#### `CrowdTrainerMonitoring.flush()`

Manually flush buffered events:

```javascript
// Send all buffered events immediately
CrowdTrainerMonitoring.flush();
```

## Event Types and Examples

### User Interactions

```javascript
// Button clicks
CrowdTrainerMonitoring.track({
  category: 'user_interaction',
  action: 'button_click',
  label: 'cta_subscribe',
  metadata: {
    button_text: 'Subscribe Now',
    page_section: 'hero',
  },
});

// Form submissions
CrowdTrainerMonitoring.track({
  category: 'form_submission',
  action: 'contact_form_submitted',
  metadata: {
    form_fields: ['name', 'email', 'message'],
    completion_rate: 100,
  },
});

// Navigation
CrowdTrainerMonitoring.track({
  category: 'navigation',
  action: 'page_change',
  label: '/about',
  metadata: {
    from_page: '/home',
    navigation_type: 'menu_click',
  },
});
```

### Performance Metrics

```javascript
// Page load time
CrowdTrainerMonitoring.trackPerformance({
  name: 'page_load_time',
  value: 1850,
  unit: 'ms',
  metadata: {
    page: '/dashboard',
    cache_hit: false,
  },
});

// API response time
CrowdTrainerMonitoring.trackPerformance({
  name: 'api_response_time',
  value: 320,
  unit: 'ms',
  metadata: {
    endpoint: '/api/users',
    method: 'GET',
    status: 200,
  },
});

// Custom timing
const startTime = performance.now();
// ... your operation
const duration = performance.now() - startTime;

CrowdTrainerMonitoring.trackPerformance({
  name: 'custom_operation',
  value: duration,
  unit: 'ms',
  metadata: {
    operation_type: 'data_processing',
  },
});
```

### Error Tracking

```javascript
// JavaScript errors (automatic)
window.addEventListener('error', (event) => {
  // Automatically tracked by monitoring system
});

// Custom error tracking
try {
  riskyOperation();
} catch (error) {
  CrowdTrainerMonitoring.trackError(error, {
    category: 'business_logic',
    action: 'calculation_failed',
    severity: 'high',
    metadata: {
      user_input: userInput,
      calculation_type: 'premium',
    },
  });
}

// API errors
fetch('/api/data')
  .catch(error => {
    CrowdTrainerMonitoring.trackError(error, {
      category: 'network_error',
      action: 'api_request_failed',
      metadata: {
        endpoint: '/api/data',
        retry_count: 0,
      },
    });
  });
```

### Business Metrics

```javascript
// Conversions
CrowdTrainerMonitoring.track({
  category: 'conversion',
  action: 'purchase_completed',
  value: 99.99,
  metadata: {
    product_id: 'prod_123',
    payment_method: 'credit_card',
    currency: 'USD',
  },
});

// Feature usage
CrowdTrainerMonitoring.track({
  category: 'feature_usage',
  action: 'search_performed',
  metadata: {
    query_length: searchQuery.length,
    results_count: resultsCount,
    search_category: 'products',
  },
});

// User engagement
CrowdTrainerMonitoring.track({
  category: 'user_engagement',
  action: 'content_shared',
  label: 'blog_post_123',
  metadata: {
    share_platform: 'twitter',
    content_type: 'blog_post',
  },
});
```

## Automatic Tracking

The monitoring system automatically tracks various user interactions and browser events when `enableAutoTracking` is enabled:

### Automatically Tracked Events

- **Clicks**: All button and link clicks
- **Form Interactions**: Focus, blur, input, and submission events
- **Scroll Depth**: Progressive scroll depth tracking
- **Page Visibility**: Tab switching and window focus changes
- **Navigation**: Hash changes and route transitions
- **Errors**: JavaScript errors and unhandled promise rejections
- **Performance**: Core Web Vitals (LCP, FID, CLS)

### Disabling Automatic Tracking

```javascript
// Disable all automatic tracking
CrowdTrainerMonitoring.init({
  enableAutoTracking: false,
  // ... other config
});

// Or disable specific types
CrowdTrainerMonitoring.init({
  enableAutoTracking: {
    clicks: true,
    forms: true,
    scroll: false,      // Disable scroll tracking
    visibility: false,  // Disable visibility tracking
  },
});
```

## Performance Considerations

### Sampling

For high-traffic websites, implement sampling to reduce data volume:

```javascript
// Sample 10% of sessions
const shouldTrack = Math.random() < 0.1;

if (shouldTrack) {
  CrowdTrainerMonitoring.init({
    // ... config
  });
}

// Or sample specific events
function trackSampledEvent(event) {
  if (Math.random() < 0.1) { // 10% sample rate
    CrowdTrainerMonitoring.track(event);
  }
}
```

### Buffering and Batching

Configure buffering for optimal performance:

```javascript
CrowdTrainerMonitoring.init({
  bufferSize: 20,       // Buffer up to 20 events
  flushInterval: 10000, // Flush every 10 seconds
  // Events are also flushed on page unload
});
```

### Throttling High-Frequency Events

```javascript
// Throttle scroll events
let lastScrollTrack = 0;
window.addEventListener('scroll', () => {
  const now = Date.now();
  if (now - lastScrollTrack > 1000) { // Max once per second
    CrowdTrainerMonitoring.track({
      category: 'user_engagement',
      action: 'scroll',
      value: window.scrollY,
    });
    lastScrollTrack = now;
  }
});
```

## Privacy and Data Protection

### Data Sanitization

Always sanitize sensitive data:

```javascript
// Don't track sensitive information
CrowdTrainerMonitoring.track({
  category: 'form_submission',
  action: 'login_attempted',
  metadata: {
    username_length: username.length, // Length instead of actual value
    has_special_chars: /[!@#$%^&*]/.test(password),
    // Never track actual passwords or sensitive data
  },
});
```

### User Consent

Implement proper consent management:

```javascript
// Check for user consent before initializing
if (hasUserConsent()) {
  CrowdTrainerMonitoring.init({
    // ... config
  });
}

function hasUserConsent() {
  return localStorage.getItem('analytics_consent') === 'true';
}
```

### GDPR Compliance

```javascript
// Allow users to opt out
function optOutOfTracking() {
  localStorage.setItem('tracking_opt_out', 'true');
  // Clear any stored user data
  localStorage.removeItem('crowdtrainer_user_id');
}

// Check opt-out status before tracking
function isOptedOut() {
  return localStorage.getItem('tracking_opt_out') === 'true';
}

if (!isOptedOut()) {
  CrowdTrainerMonitoring.init({
    // ... config
  });
}
```

## Event Listeners and Custom Events

### Listen for Monitoring Events

```javascript
// Listen for tracking events
window.addEventListener('crowdtrainer:eventTracked', (event) => {
  console.log('Event tracked:', event.detail);
});

window.addEventListener('crowdtrainer:performanceTracked', (event) => {
  console.log('Performance metric:', event.detail);
});

window.addEventListener('crowdtrainer:errorTracked', (event) => {
  console.log('Error tracked:', event.detail);
});
```

### Integration with Other Analytics

```javascript
// Send events to multiple analytics services
window.addEventListener('crowdtrainer:eventTracked', (event) => {
  const data = event.detail;
  
  // Also send to Google Analytics
  if (typeof gtag !== 'undefined') {
    gtag('event', data.action, {
      event_category: data.category,
      event_label: data.label,
      value: data.value,
    });
  }
  
  // Or Mixpanel
  if (typeof mixpanel !== 'undefined') {
    mixpanel.track(data.action, data.metadata);
  }
});
```

## Offline Support

The monitoring system includes robust offline support:

### Automatic Event Queuing

```javascript
// Events are automatically queued when offline
window.addEventListener('offline', () => {
  console.log('Gone offline - events will be queued');
});

window.addEventListener('online', () => {
  console.log('Back online - queued events will be sent');
});
```

### Checking Queue Status

```javascript
const stats = CrowdTrainerMonitoring.getStats();
console.log(`${stats.bufferSize} events queued`);
```

## Testing and Debugging

### Debug Mode

Enable debug mode to see all tracking activity:

```javascript
CrowdTrainerMonitoring.init({
  debug: true, // Logs all events to console
  // ... other config
});
```

### Manual Testing

```javascript
// Test error tracking
CrowdTrainerMonitoring.trackError(new Error('Test error'), {
  category: 'test',
  action: 'manual_test',
});

// Test custom events
CrowdTrainerMonitoring.track({
  category: 'test',
  action: 'manual_event',
  label: 'debugging',
});

// Check statistics
console.log(CrowdTrainerMonitoring.getStats());
```

### Performance Testing

```javascript
// Test performance tracking
const start = performance.now();
setTimeout(() => {
  CrowdTrainerMonitoring.trackPerformance({
    name: 'test_operation',
    value: performance.now() - start,
    unit: 'ms',
  });
}, 1000);
```

## Production Deployment

### Minification and CDN

For production, minify the monitoring script and serve from CDN:

```html
<script src="https://cdn.yoursite.com/monitoring.min.js"></script>
<script>
  CrowdTrainerMonitoring.init({
    apiEndpoint: 'https://analytics.yoursite.com/monitoring',
    environment: 'production',
    debug: false,
    bufferSize: 50,
    flushInterval: 30000,
  });
</script>
```

### Content Security Policy

Add CSP headers for monitoring endpoints:

```
Content-Security-Policy: 
  connect-src 'self' https://analytics.yoursite.com;
  script-src 'self' https://cdn.yoursite.com;
```

### Error Monitoring

Set up alerts for monitoring system errors:

```javascript
CrowdTrainerMonitoring.init({
  // ... config
});

// Monitor the monitoring system itself
window.addEventListener('error', (event) => {
  if (event.filename?.includes('monitoring.js')) {
    // Alert DevOps team about monitoring system issues
    fetch('/api/alerts/monitoring-error', {
      method: 'POST',
      body: JSON.stringify({
        error: event.message,
        filename: event.filename,
        timestamp: new Date().toISOString(),
      }),
    });
  }
});
```

## Browser Support

### Supported Browsers

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11+
- ✅ Edge 79+
- ✅ iOS Safari 11+
- ✅ Android Chrome 60+

### Feature Detection

```javascript
// Check for required features
function isSupported() {
  return (
    typeof fetch !== 'undefined' &&
    typeof Promise !== 'undefined' &&
    typeof localStorage !== 'undefined'
  );
}

if (isSupported()) {
  CrowdTrainerMonitoring.init({
    // ... config
  });
} else {
  console.warn('Monitoring not supported in this browser');
}
```

### Polyfills

For older browser support, include polyfills:

```html
<!-- Load polyfills for older browsers -->
<script src="https://polyfill.io/v3/polyfill.min.js?features=fetch,Promise,Object.assign"></script>
<script src="js/monitoring.js"></script>
```

## Troubleshooting

### Common Issues

1. **Events not appearing in dashboard**
   - Check network tab for failed API requests
   - Verify `apiEndpoint` configuration
   - Ensure CORS is configured on server

2. **High memory usage**
   - Reduce `bufferSize`
   - Increase `flushInterval`
   - Implement event sampling

3. **Offline events not syncing**
   - Check online/offline event listeners
   - Verify localStorage availability
   - Test network connectivity

4. **Performance impact**
   - Enable event throttling
   - Reduce automatic tracking
   - Use sampling for high-traffic sites

### Debug Checklist

```javascript
// Debugging checklist
console.log('Monitoring initialized:', CrowdTrainerMonitoring.instance);
console.log('Current stats:', CrowdTrainerMonitoring.getStats());
console.log('Online status:', navigator.onLine);
console.log('API endpoint:', CrowdTrainerMonitoring.instance.config.apiEndpoint);
```

## Next Steps

1. **Set up monitoring backend** to receive and process events
2. **Configure dashboards** for real-time analytics
3. **Implement alerts** for critical errors and performance issues
4. **Add A/B testing** integration
5. **Set up automated reports**
6. **Implement user segmentation**
7. **Add conversion funnel analysis**