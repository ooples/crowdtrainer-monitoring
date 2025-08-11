# @monitoring-service/sdk-react

React SDK for CrowdTrainer monitoring service with hooks, components, and integrations.

## Features

- 🎣 **React Hooks** - Modern hooks-based API
- 🛡️ **Error Boundaries** - Automatic error tracking and recovery
- ⚡ **Performance Monitoring** - Web Vitals and custom metrics
- 🎯 **HOC Support** - Higher-order components for easy integration
- 🧭 **Router Integration** - Automatic route tracking for React Router
- 📊 **Real-time Analytics** - Track user interactions and business events
- 🔧 **TypeScript** - Full TypeScript support with detailed types
- ⚛️ **React 16.8+** - Compatible with React 16.8+ and React 18

## Installation

```bash
npm install @monitoring-service/sdk-react
# or
yarn add @monitoring-service/sdk-react
```

## Quick Start

### 1. Set up the Provider

Wrap your app with the `MonitorProvider`:

```tsx
import { MonitorProvider } from '@monitoring-service/sdk-react';

function App() {
  return (
    <MonitorProvider
      config={{
        apiKey: 'your-api-key',
        environment: 'production',
        apiEndpoint: 'https://api.your-monitoring-service.com/events',
        enableAutoTracking: true,
        enablePerformanceTracking: true,
        enableErrorTracking: true,
      }}
    >
      <YourApp />
    </MonitorProvider>
  );
}
```

### 2. Add Error Boundaries

Wrap critical components with error boundaries:

```tsx
import { ErrorBoundary } from '@monitoring-service/sdk-react';

function CriticalFeature() {
  return (
    <ErrorBoundary
      level="component"
      fallback={(error, errorInfo, retry) => (
        <div>
          <h3>Something went wrong</h3>
          <button onClick={retry}>Try Again</button>
        </div>
      )}
    >
      <SomeComponentThatMightFail />
    </ErrorBoundary>
  );
}
```

### 3. Use Hooks for Tracking

```tsx
import { useMonitor, useTrackEvent, usePerformance } from '@monitoring-service/sdk-react';

function MyComponent() {
  const { monitor } = useMonitor();
  const trackEvent = useTrackEvent();
  const { trackCustomMetric } = usePerformance();
  
  const handleClick = () => {
    trackEvent('button_click', { component: 'MyComponent' });
  };
  
  const handleDataLoad = async () => {
    const startTime = performance.now();
    await loadData();
    const loadTime = performance.now() - startTime;
    trackCustomMetric('data_load_time', loadTime);
  };
  
  return (
    <div>
      <button onClick={handleClick}>Track Click</button>
      <button onClick={handleDataLoad}>Load Data</button>
    </div>
  );
}
```

## API Reference

### MonitorProvider

The main provider component that sets up monitoring context.

```tsx
<MonitorProvider config={monitorConfig}>
  <App />
</MonitorProvider>
```

**Props:**
- `config: MonitorConfig` - Configuration object for the monitoring service

**MonitorConfig:**
```typescript
interface MonitorConfig {
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
```

### Hooks

#### useMonitor

Main hook for accessing the monitoring instance:

```tsx
const { monitor, isEnabled, config } = useMonitor();

// Track events
monitor.trackEvent('user_action', { action: 'click' });
monitor.trackError(new Error('Something went wrong'));
monitor.trackMetric('response_time', 250, 'ms');

// OAuth tracking
monitor.trackOAuthAttempt('google');
monitor.trackOAuthSuccess('google', 'user123');

// Payment tracking
monitor.trackPaymentAttempt(99.99, 'USD');
monitor.trackPaymentSuccess(99.99, 'USD', 'payment_123');
```

#### useTrackEvent

Hook for event tracking with advanced options:

```tsx
const trackEvent = useTrackEvent({
  debounceMs: 300,
  metadata: { component: 'SearchBox' }
});

// Usage
const handleSearch = (query: string) => {
  trackEvent('search_performed', { 
    query, 
    queryLength: query.length 
  });
};
```

#### useMetric

Hook for tracking custom metrics:

```tsx
const trackMetric = useMetric('api_call_duration', {
  unit: 'ms',
  metadata: { endpoint: '/api/users' }
});

// Usage
const fetchUsers = async () => {
  const start = performance.now();
  await api.getUsers();
  trackMetric(performance.now() - start);
};
```

#### usePerformance

Hook for Web Vitals and performance tracking:

```tsx
const {
  webVitals,
  trackCustomMetric,
  measureRenderTime,
  performanceScore
} = usePerformance({
  trackWebVitals: true,
  reportInterval: 30000
});

// Track custom performance metric
trackCustomMetric('chart_render_time', 150);

// Measure render time
const endRender = measureRenderTime('ExpensiveChart');
// ... after render completes
endRender({ chartType: 'line', dataPoints: 1000 });
```

### Components

#### ErrorBoundary

React error boundary with automatic error tracking:

```tsx
<ErrorBoundary
  level="component"
  fallback={(error, errorInfo, retry) => (
    <CustomErrorUI error={error} onRetry={retry} />
  )}
  onError={(error, errorInfo) => {
    console.error('Component error:', error);
  }}
  resetOnPropsChange={true}
  isolate={false}
>
  <YourComponent />
</ErrorBoundary>
```

### Higher-Order Components

#### withMonitoring

HOC that adds comprehensive monitoring to any component:

```tsx
const MonitoredButton = withMonitoring(Button, {
  componentName: 'PrimaryButton',
  trackLifecycle: true,
  trackInteractions: true,
  trackPerformance: true,
  renderTimeThreshold: 16, // 60fps threshold
  metadata: { importance: 'high' }
});

// Usage
<MonitoredButton onClick={handleClick}>
  Click me
</MonitoredButton>
```

### Router Integration

#### ReactRouterIntegration

Automatic route tracking for React Router:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ReactRouterIntegration } from '@monitoring-service/sdk-react';

function App() {
  return (
    <BrowserRouter>
      <ReactRouterIntegration
        trackPageViews={true}
        trackNavigationTiming={true}
        trackUserJourney={true}
        excludeRoutes={['/admin', '/internal']}
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## Advanced Usage

### Form Tracking

Track form interactions and submissions:

```tsx
import { useTrackForm } from '@monitoring-service/sdk-react';

function ContactForm() {
  const {
    trackFieldFocus,
    trackFieldChange,
    trackFormSubmit,
    trackValidationError
  } = useTrackForm('contact_form', {
    trackAllFields: true,
    trackValidation: true
  });

  return (
    <form onSubmit={trackFormSubmit({ formType: 'contact' })}>
      <input
        name="email"
        onFocus={trackFieldFocus('email')}
        onChange={trackFieldChange('email')}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Performance Metrics

Track detailed performance metrics:

```tsx
import { usePerformanceMetric, useAggregatedMetric } from '@monitoring-service/sdk-react';

function DataProcessor() {
  const { measureAsync } = usePerformanceMetric();
  const addProcessingTime = useAggregatedMetric('processing_time', {
    aggregationType: 'avg',
    windowSize: 10,
    reportInterval: 60000
  });

  const processData = useCallback(async (data) => {
    const result = await measureAsync('data_processing', async () => {
      // Process data
      const processed = await heavyProcessing(data);
      addProcessingTime(processed.duration);
      return processed.result;
    });
    
    return result;
  }, [measureAsync, addProcessingTime]);

  return <div>Data processor</div>;
}
```

### Business Event Tracking

Track business-specific events:

```tsx
import { useMonitorBusinessEvents } from '@monitoring-service/sdk-react';

function EcommerceCheckout() {
  const trackPurchase = useMonitorBusinessEvents('purchase', {
    metadata: { flow: 'checkout' }
  });

  const handlePurchase = async (orderData) => {
    trackPurchase('attempt', {
      amount: orderData.total,
      currency: orderData.currency,
      items: orderData.items.length
    });

    try {
      const result = await processPurchase(orderData);
      
      trackPurchase('success', {
        orderId: result.orderId,
        paymentMethod: result.paymentMethod,
        processingTime: result.processingTime
      });
    } catch (error) {
      trackPurchase('error', {
        errorType: error.type,
        errorMessage: error.message
      });
    }
  };

  return <CheckoutForm onSubmit={handlePurchase} />;
}
```

## Configuration Examples

### Development Configuration

```tsx
const developmentConfig: MonitorConfig = {
  environment: 'development',
  debug: true,
  enableAutoTracking: false,
  enablePerformanceTracking: true,
  bufferSize: 10,
  flushInterval: 5000
};
```

### Production Configuration

```tsx
const productionConfig: MonitorConfig = {
  apiKey: process.env.REACT_APP_MONITORING_API_KEY,
  environment: 'production',
  apiEndpoint: 'https://api.monitoring.example.com/events',
  enableAutoTracking: true,
  enablePerformanceTracking: true,
  enableErrorTracking: true,
  bufferSize: 100,
  flushInterval: 30000,
  excludeRoutes: ['/admin', '/internal'],
  customTags: {
    version: process.env.REACT_APP_VERSION,
    deployment: process.env.REACT_APP_DEPLOYMENT_ID
  }
};
```

## TypeScript Support

The SDK is written in TypeScript and provides comprehensive type definitions:

```tsx
import type {
  MonitorConfig,
  MonitoringEvent,
  PerformanceMetric,
  EventMetadata,
  MonitorInstance
} from '@monitoring-service/sdk-react';

// Type-safe configuration
const config: MonitorConfig = {
  apiKey: 'key',
  environment: 'production' // Type-checked
};

// Type-safe event metadata
const eventMetadata: EventMetadata = {
  component: 'UserProfile',
  action: 'update',
  userId: 'user123'
};
```

## Browser Compatibility

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+

## Performance Considerations

- Events are buffered and sent in batches
- Automatic cleanup of event listeners
- Minimal runtime overhead
- Tree-shakable for optimal bundle size
- Optional features can be disabled

## Contributing

See the main repository for contribution guidelines.

## License

MIT