# React Native Mobile App Monitoring Integration Example

This example demonstrates comprehensive monitoring integration for React Native mobile applications, including crash reporting, performance monitoring, user journey tracking, and offline support.

## Features

- **📱 Mobile-First Monitoring**: Optimized for mobile app environments
- **💥 Crash Reporting**: Comprehensive error tracking and crash reporting
- **⚡ Performance Monitoring**: Memory usage, battery level, and custom metrics
- **🗺️ User Journey Tracking**: Screen navigation and user flow analysis
- **📡 Offline Support**: Event queuing and sync when connectivity returns
- **🔋 Battery Optimization**: Efficient event batching and smart flushing
- **📊 Device Analytics**: Device info, OS version, and hardware metrics
- **🌐 Network Monitoring**: Connection status and type tracking
- **🎯 Custom Events**: Business metric tracking and user interaction analytics

## Prerequisites

- React Native development environment set up
- Node.js 16+
- iOS: Xcode 12+
- Android: Android Studio with API level 21+

## Installation

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. iOS Setup

```bash
cd ios && pod install && cd ..
```

### 3. Android Setup

No additional setup required for basic functionality.

## Running the App

### Development

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Production Build

```bash
# Android
npm run build:android

# iOS
npm run build:ios
```

## Configuration

### Environment Variables

Create `.env` file:

```env
MONITORING_ENDPOINT=https://your-api.com/monitoring
ENVIRONMENT=development
DEBUG_MONITORING=true
```

### Monitoring Configuration

```typescript
// src/config/monitoring.ts
export const monitoringConfig = {
  apiEndpoint: process.env.MONITORING_ENDPOINT || 'http://localhost:3001/api/monitoring',
  enableRealTime: true,
  enableCrashReporting: true,
  enablePerformanceTracking: true,
  enableUserJourney: true,
  environment: process.env.ENVIRONMENT || 'development',
  debug: process.env.DEBUG_MONITORING === 'true',
  bufferSize: 20,
  flushInterval: 30000, // 30 seconds
};
```

## Usage Examples

### Basic Event Tracking

```typescript
import { useMonitoring } from './providers/MonitoringProvider';

function MyComponent() {
  const { track } = useMonitoring();

  const handleButtonPress = () => {
    track({
      category: 'user_interaction',
      action: 'button_press',
      label: 'purchase_button',
      metadata: {
        screen: 'product_details',
        product_id: 'prod_123',
      },
    });
  };

  return (
    <TouchableOpacity onPress={handleButtonPress}>
      <Text>Buy Now</Text>
    </TouchableOpacity>
  );
}
```

### Screen Tracking with Navigation

```typescript
import { useNavigation } from '@react-navigation/native';
import { useMonitoring } from './providers/MonitoringProvider';

function HomeScreen() {
  const navigation = useNavigation();
  const { trackScreenView } = useMonitoring();

  useEffect(() => {
    // Track screen view
    trackScreenView('home_screen', {
      referrer: 'app_launch',
      timestamp: Date.now(),
    });

    // Track when user leaves screen
    return () => {
      trackScreenView('home_screen_exit');
    };
  }, []);

  const navigateToProduct = (productId: string) => {
    track({
      category: 'navigation',
      action: 'product_view',
      label: productId,
      metadata: {
        from_screen: 'home',
        product_id: productId,
      },
    });

    navigation.navigate('Product', { id: productId });
  };

  return (
    <View>
      {/* Your screen content */}
    </View>
  );
}
```

### Performance Monitoring

```typescript
import { useMonitoring } from './providers/MonitoringProvider';

function DataLoader() {
  const { trackPerformance } = useMonitoring();

  const loadData = async () => {
    const startTime = Date.now();

    try {
      const data = await fetchDataFromAPI();
      const duration = Date.now() - startTime;

      // Track successful API call
      trackPerformance({
        name: 'api_call_duration',
        value: duration,
        unit: 'ms',
        metadata: {
          endpoint: '/api/products',
          success: true,
          data_size: data.length,
        },
      });

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Track failed API call
      trackError(error, {
        category: 'api_error',
        action: 'fetch_failed',
        metadata: {
          endpoint: '/api/products',
          duration,
        },
      });

      throw error;
    }
  };

  return (
    // Your component JSX
  );
}
```

### Error Tracking

```typescript
import { useMonitoring } from './providers/MonitoringProvider';

function PaymentScreen() {
  const { trackError } = useMonitoring();

  const processPayment = async (paymentData) => {
    try {
      const result = await submitPayment(paymentData);
      return result;
    } catch (error) {
      // Track payment error with context
      trackError(error, {
        category: 'payment_error',
        action: 'payment_failed',
        severity: 'high',
        metadata: {
          payment_amount: paymentData.amount,
          payment_method: paymentData.method,
          user_id: paymentData.userId,
          error_code: error.code,
        },
      });

      // Re-throw for UI handling
      throw error;
    }
  };
}
```

### Custom Business Metrics

```typescript
import { useMonitoring } from './providers/MonitoringProvider';

function ShoppingCart() {
  const { track } = useMonitoring();

  const addToCart = (product) => {
    // Add to cart logic...

    // Track business metric
    track({
      category: 'ecommerce',
      action: 'add_to_cart',
      value: product.price,
      metadata: {
        product_id: product.id,
        product_category: product.category,
        cart_size: cartItems.length + 1,
        user_segment: 'premium',
      },
    });
  };

  const purchaseComplete = (orderData) => {
    // Track conversion
    track({
      category: 'conversion',
      action: 'purchase_completed',
      value: orderData.total,
      metadata: {
        order_id: orderData.id,
        items_count: orderData.items.length,
        payment_method: orderData.paymentMethod,
        discount_applied: orderData.discount > 0,
      },
    });
  };
}
```

## Advanced Features

### Offline Event Queuing

```typescript
// Events are automatically queued when offline
const { track, isOnline } = useMonitoring();

// Track events normally - they'll be queued if offline
track({
  category: 'user_action',
  action: 'offline_interaction',
  metadata: {
    is_online: isOnline,
    queued_at: Date.now(),
  },
});
```

### Session Information

```typescript
const { getSessionInfo } = useMonitoring();

const sessionInfo = getSessionInfo();
console.log(sessionInfo);
// {
//   sessionId: 'rn_1634567890123_abc123',
//   userId: 'user_456',
//   appVersion: '1.0.0',
//   deviceInfo: {
//     platform: 'ios',
//     model: 'iPhone 13',
//     systemVersion: '15.0',
//     // ... more device info
//   },
//   sessionStartTime: 1634567890123,
//   screenViews: [...]
// }
```

### Device Analytics

```typescript
// Device information is automatically collected
const deviceInfo = {
  platform: 'ios',
  platform_version: '15.0',
  brand: 'Apple',
  model: 'iPhone 13 Pro',
  system_version: '15.0',
  device_id: 'unique_device_id',
  is_tablet: false,
  memory: {
    total: 6442450944,
    used: 2147483648,
    available: 4294967296,
  },
};
```

## Error Boundary Integration

```typescript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useMonitoring } from '../providers/MonitoringProvider';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track React Native error
    const { trackError } = this.props;
    
    trackError(error, {
      category: 'react_native_error',
      action: 'component_error',
      severity: 'critical',
      metadata: {
        component_stack: errorInfo.componentStack,
        error_boundary: 'global',
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 20 }}>
            Oops! Something went wrong.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{ backgroundColor: '#2563eb', padding: 15, borderRadius: 8 }}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
```

## Performance Optimization

### Smart Event Batching

```typescript
// Events are automatically batched and flushed based on:
// - Buffer size (default: 20 events)
// - Time interval (default: 30 seconds)
// - App state changes (background/foreground)
// - Network connectivity changes

const optimizedConfig = {
  bufferSize: 50,        // Batch more events for better performance
  flushInterval: 60000,  // Flush every minute in production
  enablePerformanceTracking: true,
  debug: false,          // Disable debug logging in production
};
```

### Memory Management

```typescript
// Automatic memory usage tracking
useEffect(() => {
  const interval = setInterval(async () => {
    const memoryUsage = await DeviceInfo.getUsedMemory();
    
    trackPerformance({
      name: 'memory_usage',
      value: memoryUsage / (1024 * 1024), // Convert to MB
      unit: 'bytes',
      metadata: {
        threshold_exceeded: memoryUsage > (512 * 1024 * 1024), // 512MB
      },
    });
  }, 30000);

  return () => clearInterval(interval);
}, []);
```

## Platform-Specific Features

### iOS-Specific Monitoring

```typescript
import { Platform } from 'react-native';

if (Platform.OS === 'ios') {
  // iOS-specific tracking
  track({
    category: 'platform_specific',
    action: 'ios_feature_used',
    metadata: {
      ios_version: Platform.Version,
      feature: 'biometric_auth',
    },
  });
}
```

### Android-Specific Monitoring

```typescript
if (Platform.OS === 'android') {
  // Android-specific tracking
  track({
    category: 'platform_specific',
    action: 'android_feature_used',
    metadata: {
      android_version: Platform.Version,
      feature: 'background_sync',
    },
  });
}
```

## Testing

### Unit Tests

```bash
npm test
```

### Example Test

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { MonitoringProvider } from './providers/MonitoringProvider';
import MyComponent from './MyComponent';

const mockConfig = {
  apiEndpoint: 'http://test-api.com',
  debug: true,
  // ... other config
};

test('should track button press events', () => {
  const { getByText } = render(
    <MonitoringProvider config={mockConfig}>
      <MyComponent />
    </MonitoringProvider>
  );

  const button = getByText('Buy Now');
  fireEvent.press(button);

  // Verify tracking was called
  // (You would mock the tracking function in real tests)
});
```

## Deployment

### Production Configuration

```typescript
const productionConfig = {
  apiEndpoint: 'https://analytics.yourapp.com/monitoring',
  environment: 'production',
  debug: false,
  bufferSize: 100,
  flushInterval: 120000, // 2 minutes
  enableRealTime: false, // Disable for better battery life
};
```

### App Store Considerations

1. **Privacy Policy**: Update to mention analytics collection
2. **User Consent**: Implement opt-in/opt-out functionality
3. **Data Minimization**: Only collect necessary data
4. **Crash Reports**: Handle sensitive information in stack traces

### Privacy Implementation

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const checkUserConsent = async () => {
  const consent = await AsyncStorage.getItem('analytics_consent');
  return consent === 'granted';
};

const requestConsent = async () => {
  // Show consent dialog
  const userConsent = await showConsentDialog();
  
  await AsyncStorage.setItem(
    'analytics_consent', 
    userConsent ? 'granted' : 'denied'
  );
  
  return userConsent;
};

// Initialize monitoring only with consent
if (await checkUserConsent()) {
  initializeMonitoring(config);
}
```

## Troubleshooting

### Common Issues

1. **Events not sending**: Check network connectivity and API endpoint
2. **High memory usage**: Reduce buffer size and flush interval
3. **Battery drain**: Disable real-time features in production
4. **Crashes on older devices**: Add proper error boundaries

### Debug Mode

Enable debug logging:

```typescript
const debugConfig = {
  ...config,
  debug: true,
};

// This will log all monitoring events to console
```

### Performance Issues

Monitor your monitoring:

```typescript
// Track monitoring system performance
trackPerformance({
  name: 'monitoring_overhead',
  value: monitoringProcessingTime,
  unit: 'ms',
  metadata: {
    events_processed: eventCount,
    queue_size: queueSize,
  },
});
```

## Best Practices

### 1. Event Naming Conventions

```typescript
// Use consistent naming patterns
track({
  category: 'ecommerce',        // Domain/feature area
  action: 'add_to_cart',        // User action
  label: 'product_123',         // Specific identifier
  value: 29.99,                 // Numeric value when relevant
});
```

### 2. Metadata Guidelines

```typescript
// Include relevant context, avoid sensitive data
metadata: {
  screen: 'product_details',
  user_segment: 'premium',
  experiment_variant: 'variant_a',
  // Don't include: passwords, tokens, PII
}
```

### 3. Error Context

```typescript
// Provide actionable error context
trackError(error, {
  category: 'payment_processing',
  action: 'stripe_payment_failed',
  metadata: {
    payment_amount: 99.99,
    payment_method: 'credit_card',
    retry_attempt: 2,
    error_code: error.code,
    // Include steps to reproduce if possible
  },
});
```

### 4. Performance Monitoring

```typescript
// Monitor critical user journeys
const trackUserJourney = async () => {
  const startTime = Date.now();
  
  try {
    await completeOnboarding();
    
    trackPerformance({
      name: 'onboarding_duration',
      value: Date.now() - startTime,
      unit: 'ms',
      metadata: {
        steps_completed: 5,
        success: true,
      },
    });
  } catch (error) {
    trackError(error, {
      category: 'onboarding',
      action: 'onboarding_failed',
    });
  }
};
```

## Next Steps

1. **Set up monitoring dashboard** for real-time analytics
2. **Configure alerts** for critical errors and performance issues
3. **Implement A/B testing** integration
4. **Add custom business metrics** for your specific use case
5. **Set up automated reports** and insights
6. **Integrate with crash reporting services** (Crashlytics, Bugsnag)
7. **Implement user segmentation** and cohort analysis