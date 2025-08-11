# @monitoring-service/sdk-js

JavaScript/TypeScript SDK for the monitoring service with automatic error capture, performance monitoring, and custom event tracking.

## Features

- 🚀 **Auto-capture**: Errors, performance metrics, network requests, and Web Vitals
- 📊 **Manual tracking**: Custom events, user interactions, and page views
- 👤 **User identification**: Associate events with user context
- 🔄 **Session tracking**: Automatic session management
- 📈 **Web Vitals**: Core Web Vitals collection (CLS, FID, FCP, LCP, TTFB)
- 🍞 **Breadcrumbs**: Automatic breadcrumb trail for debugging
- 🎯 **Custom context**: Add custom metadata to all events
- 📱 **Offline support**: Queue events when offline, send when reconnected
- 🪶 **Lightweight**: <10KB gzipped, non-blocking initialization

## Installation

### NPM Package

```bash
npm install @monitoring-service/sdk-js
```

```typescript
import { Monitor } from '@monitoring-service/sdk-js';

const monitor = new Monitor({
  projectId: 'your-project-id',
  apiUrl: 'https://api.monitoring-service.com',
  environment: 'production',
});
```

### CDN Script Tag

```html
<!-- Latest version -->
<script src="https://cdn.monitoring-service.com/sdk-js@latest/index.umd.min.js"></script>

<!-- Specific version -->
<script src="https://cdn.monitoring-service.com/sdk-js@1.0.0/index.umd.min.js"></script>

<script>
  const monitor = new MonitoringSDK.Monitor({
    projectId: 'your-project-id',
    environment: 'production',
  });
</script>
```

## Quick Start

```typescript
// Initialize the monitor
const monitor = new Monitor({
  projectId: 'your-project-id',
  apiUrl: 'https://api.monitoring-service.com',
  environment: 'production',
  autoCapture: {
    errors: true,
    performance: true,
    network: true,
    webVitals: true,
  },
  sampleRate: 1.0, // Sample 100% of events
  debug: false, // Set to true for development
});

// Set user context
monitor.setUser({
  id: 'user-123',
  email: 'user@example.com',
  name: 'John Doe',
});

// Add custom context
monitor.setContext('theme', 'dark');
monitor.setContext('feature_flag_x', true);

// Track custom events
monitor.track('button_click', {
  button_id: 'submit',
  page: '/checkout',
});

// Track page views
monitor.trackPageView('/checkout', 'Checkout Page');

// Track user interactions
monitor.trackInteraction('form', 'submit', {
  form_id: 'checkout_form',
  items_count: 3,
});

// Add custom breadcrumbs
monitor.addBreadcrumb({
  timestamp: Date.now(),
  type: 'info',
  message: 'User started checkout process',
  data: { cart_value: 99.99 },
});
```

## Configuration

```typescript
interface MonitorConfig {
  /** Project ID for monitoring service */
  projectId: string;
  /** API endpoint URL (optional) */
  apiUrl?: string;
  /** Environment name (optional) */
  environment?: string;
  /** Auto-capture settings (optional) */
  autoCapture?: {
    errors?: boolean;        // Default: true
    performance?: boolean;   // Default: true
    network?: boolean;       // Default: true
    webVitals?: boolean;     // Default: true
  };
  /** Sample rate for events 0-1 (optional) */
  sampleRate?: number;       // Default: 1.0
  /** Max breadcrumbs to keep (optional) */
  maxBreadcrumbs?: number;   // Default: 50
  /** Enable offline queue (optional) */
  enableOfflineQueue?: boolean; // Default: true
  /** Debug mode (optional) */
  debug?: boolean;           // Default: false
}
```

## API Reference

### Monitor Class

#### Methods

- `start()`: Start monitoring (called automatically)
- `stop()`: Stop monitoring
- `setUser(user)`: Set user context
- `clearUser()`: Clear user context
- `setContext(key, value)`: Set custom context
- `clearContext(key?)`: Clear custom context
- `addBreadcrumb(breadcrumb)`: Add breadcrumb
- `track(name, data?)`: Track custom event
- `trackPageView(url?, title?)`: Track page view
- `trackInteraction(element, action, data?)`: Track interaction
- `flush()`: Flush pending events
- `getSession()`: Get current session
- `getUser()`: Get current user
- `getContext()`: Get custom context
- `getBreadcrumbs()`: Get breadcrumbs
- `isActive()`: Check if monitoring is active

### Auto-Capture Features

#### Error Capture
Automatically captures:
- JavaScript errors (`window.onerror`)
- Unhandled promise rejections
- Resource loading errors

#### Performance Capture
Automatically captures:
- Navigation timing
- Resource timing
- Long tasks (>50ms)
- Performance marks and measures

#### Network Capture
Automatically captures:
- Fetch API requests
- XMLHttpRequest requests
- Request/response sizes
- Response times and status codes

#### Web Vitals Capture
Automatically captures:
- **CLS** (Cumulative Layout Shift)
- **FID** (First Input Delay)
- **FCP** (First Contentful Paint)
- **LCP** (Largest Contentful Paint)
- **TTFB** (Time to First Byte)

## Advanced Usage

### Manual Error Capture

```typescript
try {
  // Some risky code
} catch (error) {
  monitor.errorCapture.captureError(error, {
    context: 'payment_processing',
    user_action: 'submit_payment',
  });
}
```

### Custom Transport

```typescript
import { FetchTransport } from '@monitoring-service/sdk-js';

const customTransport = new FetchTransport(
  'https://custom-api.com',
  'project-id',
  {
    timeout: 10000,
    retries: 5,
    useBeacon: true,
  }
);
```

### Storage Management

```typescript
import { LocalStorage } from '@monitoring-service/sdk-js';

const storage = new LocalStorage('custom_prefix_');
storage.set('key', { data: 'value' });
const data = storage.get('key');
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions.

```typescript
import type { 
  MonitorConfig, 
  UserContext, 
  Breadcrumb 
} from '@monitoring-service/sdk-js';
```

## Performance

- **Bundle size**: <10KB gzipped
- **Initialization**: Non-blocking, async
- **Memory usage**: <1MB typical
- **Network**: Batched requests, automatic retry
- **Storage**: Efficient localStorage usage

## Privacy & Security

- No sensitive data captured by default
- User data encryption in transit
- GDPR compliant
- Configurable data retention
- Opt-out mechanisms

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: https://docs.monitoring-service.com/sdk-js
- Issues: https://github.com/monitoring-service/sdk-js/issues
- Support: support@monitoring-service.com