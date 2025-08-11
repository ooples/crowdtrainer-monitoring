# @monitoring-service/core

Core monitoring SDK package providing event tracking, metric collection, error capturing, and performance monitoring capabilities.

## Features

- **Event Tracking**: Track page views, clicks, form submissions, and custom events
- **Metric Collection**: Record counters, gauges, histograms, and timers with automatic performance metrics
- **Error Capture**: Automatic error catching with stack traces, breadcrumbs, and context
- **Performance Monitoring**: Core Web Vitals, navigation timing, and custom performance marks
- **Transport Layer**: Reliable data transmission with retry logic and offline support
- **Context Management**: User, device, and application context tracking
- **Queue Management**: Offline support with intelligent queuing and prioritization
- **Framework Agnostic**: Works in any JavaScript environment (browser, Node.js, React Native)

## Installation

```bash
npm install @monitoring-service/core
```

## Quick Start

```typescript
import { MonitoringCore } from '@monitoring-service/core';

// Initialize the SDK
const monitoring = new MonitoringCore();

await monitoring.init({
  endpoint: 'https://api.your-monitoring-service.com/events',
  apiKey: 'your-api-key',
  environment: 'production',
  version: '1.0.0'
});

// Track events
monitoring.trackPageView('/dashboard', 'Dashboard');
monitoring.trackCustom('user_signup', { plan: 'premium' });

// Record metrics
monitoring.recordMetric('page_load_time', 1250, 'timer');
monitoring.incrementCounter('api_calls');

// Capture errors
monitoring.captureError(new Error('Something went wrong'));

// Set user context
monitoring.setUser({
  id: 'user123',
  email: 'user@example.com'
});
```

## Core Components

### Event Tracking

```typescript
import { EventTracker } from '@monitoring-service/core';

const tracker = new EventTracker({
  autoTrackPageViews: true,
  autoTrackClicks: true,
  maxBufferSize: 100
});

// Manual tracking
tracker.trackCustom('button_click', { button_id: 'signup' });
tracker.trackPageView('/home', 'Homepage');
```

### Metric Collection

```typescript
import { MetricCollector } from '@monitoring-service/core';

const metrics = new MetricCollector({
  autoCollectPerformance: true,
  autoCollectWebVitals: true
});

// Record different metric types
metrics.incrementCounter('page_views');
metrics.setGauge('active_users', 150);
metrics.recordHistogram('response_time', 245);

// Time operations
metrics.startTimer('api_call');
// ... perform operation
metrics.endTimer('api_call');

// Measure functions
const result = metrics.measureSync('process_data', () => {
  return processData();
});
```

### Error Capture

```typescript
import { ErrorCapture } from '@monitoring-service/core';

const errors = new ErrorCapture({
  autoCapture: true,
  captureUnhandledRejections: true
});

// Manual error capture
errors.captureException(error, {
  severity: 'high',
  context: { userId: '123' }
});

// Add debugging context
errors.addBreadcrumb('User clicked submit button', 'ui');
errors.addBreadcrumb('Validation passed', 'validation');
```

### Transport Layer

```typescript
import { HTTPTransport } from '@monitoring-service/core';

const transport = new HTTPTransport({
  endpoint: 'https://api.example.com/events',
  apiKey: 'your-key',
  maxRetries: 3,
  enableOfflineSupport: true
});

// Send data
await transport.send({
  event: 'user_action',
  timestamp: Date.now()
});

// Batch sending
await transport.sendBatch([event1, event2, event3]);
```

### Performance Monitoring

```typescript
import { PerformanceMonitor } from '@monitoring-service/core';

const perf = new PerformanceMonitor({
  trackWebVitals: true,
  trackNavigation: true,
  trackResources: true
});

// Custom performance marks
perf.mark('operation_start');
// ... perform operation
perf.measure('operation_duration', 'operation_start');

// Time functions
const result = await perf.timeAsync('api_call', async () => {
  return await fetchData();
});

// Get current metrics
const vitals = perf.getWebVitals();
const metrics = perf.getCurrentMetrics();
```

### Context Management

```typescript
import { ContextManager } from '@monitoring-service/core';

const context = new ContextManager({
  autoDetectDevice: true,
  autoDetectApp: true
});

// Set user context
context.setUser({
  id: 'user123',
  email: 'user@example.com',
  segment: 'premium'
});

// Add custom context
context.setCustom('feature_flags', {
  newUI: true,
  betaFeatures: false
});

// Get context for different scopes
const userContext = context.getContextForScope('user');
const fullContext = context.getContext();
```

## Configuration

### MonitoringConfig

```typescript
interface MonitoringConfig {
  // Required
  endpoint: string;           // API endpoint URL
  apiKey: string;            // API authentication key
  environment: string;       // Environment (dev, staging, prod)
  
  // Optional
  version?: string;          // Application version
  userId?: string;           // Initial user ID
  sessionId?: string;        // Session identifier
  debug?: boolean;           // Enable debug logging
  maxQueueSize?: number;     // Max events in buffer (default: 100)
  flushInterval?: number;    // Auto-flush interval in ms (default: 30000)
  enableOfflineSupport?: boolean; // Enable offline queuing (default: true)
  sampleRate?: number;       // Sampling rate 0-1 (default: 1.0)
  
  // Transport configuration
  transport?: {
    maxRetries?: number;     // Max retry attempts (default: 3)
    retryDelay?: number;     // Retry delay in ms (default: 1000)
    timeout?: number;        // Request timeout in ms (default: 10000)
    batchSize?: number;      // Batch size for sending (default: 50)
  }
}
```

## TypeScript Support

This package is written in TypeScript and provides complete type definitions. All interfaces and types are exported for use in your applications:

```typescript
import { 
  BaseEvent, 
  Metric, 
  ErrorInfo,
  Context,
  MonitoringSDK 
} from '@monitoring-service/core';
```

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Node.js Support

- Node.js 16+

## Performance Considerations

- Automatic sampling to reduce overhead
- Efficient batching and queuing
- Minimal bundle size impact
- Lazy loading of optional features
- Memory-efficient data structures

## Security

- No sensitive data collection by default
- Configurable data sanitization
- Secure transport with retry logic
- Client-side data validation

## License

MIT

## Contributing

See the main repository for contribution guidelines.