# Next.js Monitoring Integration Example

This example demonstrates how to integrate CrowdTrainer's monitoring system with a Next.js application, including SSR monitoring, API middleware, error tracking, and performance monitoring.

## Features

- **Automatic Error Tracking**: Captures JavaScript errors, unhandled promise rejections, and React component errors
- **Performance Monitoring**: Tracks page load times, API response times, and user interactions
- **API Monitoring**: Wraps API routes with monitoring middleware for automatic tracking
- **User Journey Tracking**: Records user interactions and navigation patterns
- **Real-time Updates**: Optional WebSocket support for live monitoring data
- **Server-Side Rendering Support**: Works with both SSR and client-side rendering

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Environment Configuration

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_MONITORING_ENDPOINT=http://localhost:3001/api/monitoring
NODE_ENV=development
```

### 3. Start the Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Integration Guide

### Basic Setup

1. **Wrap your app with MonitoringProvider**:

```tsx
// src/app/layout.tsx
import { MonitoringProvider } from '../components/MonitoringProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <MonitoringProvider
          config={{
            apiEndpoint: process.env.NEXT_PUBLIC_MONITORING_ENDPOINT,
            enableRealTime: true,
            enableUserJourney: true,
            enablePerformanceTracking: true,
            environment: process.env.NODE_ENV,
            debug: process.env.NODE_ENV === 'development',
          }}
        >
          {children}
        </MonitoringProvider>
      </body>
    </html>
  );
}
```

2. **Add Error Boundary**:

```tsx
// src/components/ErrorBoundary.tsx
import ErrorBoundary from '../components/ErrorBoundary';

function MyApp({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
```

### Using the Monitoring Hook

```tsx
'use client';

import { useMonitoring } from '@crowdtrainer/monitoring-react';

export default function MyComponent() {
  const { track, trackError, trackPerformance } = useMonitoring();

  const handleButtonClick = () => {
    // Track user interaction
    track({
      category: 'user_interaction',
      action: 'button_click',
      label: 'subscribe_button',
      metadata: {
        page: 'homepage',
        timestamp: new Date().toISOString(),
      },
    });
  };

  const handleApiCall = async () => {
    const startTime = performance.now();
    
    try {
      const response = await fetch('/api/data');
      const data = await response.json();
      
      // Track successful API call
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
      // Track API error
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

  return (
    <div>
      <button onClick={handleButtonClick}>Track Click</button>
      <button onClick={handleApiCall}>Make API Call</button>
    </div>
  );
}
```

### API Route Monitoring

Wrap your API routes with monitoring middleware:

```tsx
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withMonitoring } from '@crowdtrainer/monitoring-core';

async function handler(request: NextRequest) {
  // Your API logic here
  return NextResponse.json({ success: true });
}

export const GET = withMonitoring(handler, {
  name: 'get-users',
  trackPerformance: true,
  trackErrors: true,
  metadata: {
    endpoint: '/api/users',
    method: 'GET',
  },
});
```

## Configuration Options

### MonitoringProvider Config

```tsx
interface MonitoringConfig {
  apiEndpoint: string;           // Monitoring API endpoint
  enableRealTime: boolean;       // Enable real-time updates
  enableUserJourney: boolean;    // Track user journey
  enablePerformanceTracking: boolean; // Track performance metrics
  environment: 'development' | 'staging' | 'production';
  debug: boolean;                // Enable debug logging
}
```

### withMonitoring Options

```tsx
interface MonitoringOptions {
  name: string;                  // Identifier for the API route
  trackPerformance: boolean;     // Track response times
  trackErrors: boolean;          // Track errors
  metadata?: Record<string, any>; // Additional context
}
```

## What Gets Tracked

### Automatic Tracking

- **JavaScript Errors**: Unhandled errors and exceptions
- **Promise Rejections**: Unhandled promise rejections
- **Page Load Times**: Navigation timing metrics
- **API Performance**: Response times for wrapped routes
- **Component Errors**: React Error Boundary catches

### Manual Tracking

- **User Interactions**: Button clicks, form submissions
- **Custom Events**: Business-specific events
- **Performance Metrics**: Custom timing measurements
- **Feature Usage**: Track specific feature adoption

## Best Practices

1. **Environment-Specific Configuration**:
   ```tsx
   const config = {
     apiEndpoint: process.env.NODE_ENV === 'production' 
       ? 'https://api.crowdtrainer.com/monitoring'
       : 'http://localhost:3001/api/monitoring',
     debug: process.env.NODE_ENV === 'development',
   };
   ```

2. **Error Context**:
   ```tsx
   trackError(error, {
     category: 'payment',
     action: 'stripe_payment_failed',
     severity: 'high',
     metadata: {
       userId: user.id,
       amount: paymentAmount,
       paymentMethod: 'card',
     },
   });
   ```

3. **Performance Thresholds**:
   ```tsx
   const duration = performance.now() - startTime;
   
   trackPerformance({
     name: 'database_query',
     value: duration,
     unit: 'ms',
     metadata: {
       query: 'getUserByID',
       slow: duration > 1000, // Flag slow queries
     },
   });
   ```

## Testing

Run the test commands to verify monitoring integration:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build test
npm run build
```

## Production Deployment

1. Set production environment variables
2. Configure monitoring endpoint
3. Set up error alerting
4. Configure performance thresholds
5. Test monitoring dashboard

## Troubleshooting

### Common Issues

1. **Monitoring events not appearing**: Check network tab for failed requests to monitoring API
2. **Performance metrics missing**: Ensure `enablePerformanceTracking` is true
3. **Errors not tracked**: Verify Error Boundary is wrapping components
4. **API monitoring not working**: Check that routes are wrapped with `withMonitoring`

### Debug Mode

Enable debug mode in development:

```tsx
<MonitoringProvider
  config={{
    debug: true, // Enables console logging
    // ... other config
  }}
>
```

This will log all monitoring events to the browser console for debugging.

## Next Steps

- Set up monitoring dashboard
- Configure alerts and notifications
- Implement custom business metrics
- Set up automated reports
- Integrate with external monitoring services