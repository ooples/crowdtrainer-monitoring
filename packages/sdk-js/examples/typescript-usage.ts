/**
 * TypeScript usage example for @monitoring-service/sdk-js
 */

import { 
  Monitor,
  type MonitorConfig,
  type UserContext,
  type Breadcrumb,
} from '@monitoring-service/sdk-js';

// Configuration with full type safety
const config: MonitorConfig = {
  projectId: 'my-typescript-project',
  apiUrl: 'https://api.monitoring-service.com',
  environment: 'production',
  autoCapture: {
    errors: true,
    performance: true,
    network: true,
    webVitals: true,
  },
  sampleRate: 0.8, // 80% sampling
  maxBreadcrumbs: 100,
  enableOfflineQueue: true,
  debug: process.env.NODE_ENV === 'development',
};

// Initialize monitor
const monitor = new Monitor(config);

// Type-safe user context
const user: UserContext = {
  id: 'user-123',
  email: 'user@example.com',
  name: 'John Doe',
  properties: {
    plan: 'premium',
    signupDate: '2023-01-01',
    preferences: {
      theme: 'dark',
      notifications: true,
    },
  },
};

monitor.setUser(user);

// Type-safe custom context
interface AppContext {
  version: string;
  feature_flags: {
    newDashboard: boolean;
    betaFeatures: boolean;
  };
  performance: {
    renderMode: 'ssr' | 'csr';
    cacheEnabled: boolean;
  };
}

const appContext: AppContext = {
  version: '2.1.0',
  feature_flags: {
    newDashboard: true,
    betaFeatures: false,
  },
  performance: {
    renderMode: 'ssr',
    cacheEnabled: true,
  },
};

// Set context with type safety
Object.entries(appContext).forEach(([key, value]) => {
  monitor.setContext(key, value);
});

// Type-safe custom events
interface CustomEvents {
  button_click: {
    button_id: string;
    page: string;
    section?: string;
  };
  form_submit: {
    form_id: string;
    fields_count: number;
    validation_errors?: string[];
  };
  purchase_complete: {
    order_id: string;
    amount: number;
    currency: string;
    items: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>;
  };
  feature_used: {
    feature_name: string;
    user_tier: 'free' | 'premium' | 'enterprise';
    usage_count: number;
  };
}

// Helper function for type-safe event tracking
function trackEvent<K extends keyof CustomEvents>(
  eventName: K,
  data: CustomEvents[K]
): void {
  monitor.track(eventName, data);
}

// Usage examples
trackEvent('button_click', {
  button_id: 'submit-payment',
  page: '/checkout',
  section: 'payment-form',
});

trackEvent('form_submit', {
  form_id: 'user-registration',
  fields_count: 8,
  validation_errors: ['email_invalid', 'password_too_short'],
});

trackEvent('purchase_complete', {
  order_id: 'order-12345',
  amount: 99.99,
  currency: 'USD',
  items: [
    {
      id: 'item-1',
      name: 'Premium Plan',
      price: 99.99,
      quantity: 1,
    },
  ],
});

// Type-safe breadcrumbs
const breadcrumb: Breadcrumb = {
  timestamp: Date.now(),
  type: 'user',
  message: 'User navigated to dashboard',
  data: {
    previous_page: '/profile',
    load_time: 1250,
    cache_hit: true,
  },
};

monitor.addBreadcrumb(breadcrumb);

// Error handling with context
async function handleApiCall<T>(
  apiCall: () => Promise<T>,
  context: {
    endpoint: string;
    method: string;
    user_id?: string;
  }
): Promise<T> {
  try {
    monitor.addBreadcrumb({
      timestamp: Date.now(),
      type: 'http',
      message: `API call: ${context.method} ${context.endpoint}`,
      data: context,
    });

    const result = await apiCall();

    monitor.addBreadcrumb({
      timestamp: Date.now(),
      type: 'http',
      message: `API call successful: ${context.method} ${context.endpoint}`,
      data: { ...context, success: true },
    });

    return result;
  } catch (error) {
    monitor.addBreadcrumb({
      timestamp: Date.now(),
      type: 'error',
      message: `API call failed: ${context.method} ${context.endpoint}`,
      data: { 
        ...context, 
        error: error instanceof Error ? error.message : String(error),
      },
    });

    // Re-throw to maintain error handling flow
    throw error;
  }
}

// Usage with proper error handling
async function fetchUserData(userId: string): Promise<void> {
  try {
    const userData = await handleApiCall(
      () => fetch(`/api/users/${userId}`).then(r => r.json()),
      {
        endpoint: `/api/users/${userId}`,
        method: 'GET',
        user_id: userId,
      }
    );

    trackEvent('feature_used', {
      feature_name: 'user_data_fetch',
      user_tier: userData.tier,
      usage_count: userData.api_calls_count + 1,
    });
  } catch (error) {
    console.error('Failed to fetch user data:', error);
  }
}

// React component integration example
interface MonitoringProps {
  children: React.ReactNode;
}

// This would be in a React component file
/*
import React, { useEffect } from 'react';

const MonitoringProvider: React.FC<MonitoringProps> = ({ children }) => {
  useEffect(() => {
    // Track component mount
    monitor.addBreadcrumb({
      timestamp: Date.now(),
      type: 'info',
      message: 'React app mounted',
      data: {
        component: 'MonitoringProvider',
        children_count: React.Children.count(children),
      },
    });

    // Track page visibility changes
    const handleVisibilityChange = () => {
      trackEvent('feature_used', {
        feature_name: 'page_visibility_change',
        user_tier: 'premium', // Get from user context
        usage_count: 1,
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      monitor.addBreadcrumb({
        timestamp: Date.now(),
        type: 'info',
        message: 'React app unmounting',
        data: { component: 'MonitoringProvider' },
      });
    };
  }, [children]);

  return <>{children}</>;
};
*/

// Advanced usage: Custom transport configuration
import { FetchTransport } from '@monitoring-service/sdk-js';

const customTransport = new FetchTransport(
  'https://custom-api.example.com',
  'my-project-id',
  {
    timeout: 10000,
    retries: 5,
    useBeacon: true,
  }
);

// Monitoring service integration
class MonitoringService {
  private monitor: Monitor;

  constructor(config: MonitorConfig) {
    this.monitor = new Monitor(config);
  }

  // Wrapper methods with additional business logic
  public identifyUser(user: UserContext): void {
    this.monitor.setUser(user);
    
    // Additional business logic
    this.trackEvent('user_identified', {
      user_id: user.id || 'anonymous',
      has_email: !!user.email,
      has_name: !!user.name,
      properties_count: user.properties ? Object.keys(user.properties).length : 0,
    });
  }

  public trackPageView(url: string, title: string): void {
    this.monitor.trackPageView(url, title);
    
    // Additional analytics
    if (url.includes('/checkout')) {
      this.trackEvent('feature_used', {
        feature_name: 'checkout_page_view',
        user_tier: 'premium', // Get from context
        usage_count: 1,
      });
    }
  }

  private trackEvent<K extends keyof CustomEvents>(
    eventName: K,
    data: CustomEvents[K]
  ): void {
    this.monitor.track(eventName, data);
  }

  public async flush(): Promise<boolean> {
    return this.monitor.flush();
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService(config);

// Export for React Context or DI container
export { Monitor, type MonitorConfig, type UserContext };

// Example usage in application
export function initializeMonitoring(): void {
  // Set initial context
  monitoringService.identifyUser({
    id: 'current-user-id',
    email: 'user@example.com',
    name: 'Current User',
  });

  // Track application start
  monitor.track('app_initialized', {
    version: appContext.version,
    environment: config.environment || 'unknown',
    timestamp: new Date().toISOString(),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  });

  console.log('Monitoring initialized successfully');
}