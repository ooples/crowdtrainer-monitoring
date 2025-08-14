# Smart Notification System

A comprehensive notification system for the monitoring dashboard with auto-detection, smart deduplication, and rich UI features.

## Features

### Core Functionality
- **Toast Notifications**: Auto-appearing notifications with different styles for each type
- **Notification Center**: Centralized view of all notifications with history
- **Smart Deduplication**: Prevents spam by detecting and batching similar notifications
- **Auto-dismiss**: Configurable timeouts for different notification types
- **Sound Alerts**: Synthetic audio notifications with 5 different sound types
- **Priority System**: Higher priority notifications are more prominent
- **Persistent Storage**: Saves notifications and settings to localStorage

### Smart Detection
- **Event Monitoring**: Auto-detects new events and creates notifications
- **Alert Processing**: Processes system alerts and creates notifications
- **System Health**: Monitors system health changes
- **Performance Thresholds**: Alerts when metrics exceed thresholds
- **OAuth Health**: Monitors authentication service status
- **Batch Prevention**: Prevents notification spam with intelligent batching

### UI Features
- **Framer Motion Animations**: Smooth animations for all components
- **Responsive Design**: Works on all screen sizes
- **Theme Integration**: Follows the dashboard theme system
- **Accessibility**: ARIA labels and keyboard navigation
- **Real-time Updates**: Live notification count and status

## Quick Start

### Basic Usage

```tsx
import { NotificationSystem } from './components/notifications';

function App() {
  return (
    <NotificationSystem>
      {/* Your app content */}
    </NotificationSystem>
  );
}
```

### With Auto-detection

```tsx
import { NotificationSystem } from './components/notifications';

function MonitoringDashboard({ events, alerts, systemMetrics }) {
  return (
    <NotificationSystem
      events={events}
      alerts={alerts}
      systemMetrics={systemMetrics}
      enableAutoDetection={true}
      toastPosition="top-right"
      maxToasts={5}
    >
      {/* Dashboard content */}
    </NotificationSystem>
  );
}
```

### Manual Notifications

```tsx
import { useNotifications } from './components/notifications';

function MyComponent() {
  const { addNotification } = useNotifications();

  const handleError = () => {
    addNotification({
      title: 'Error Occurred',
      message: 'Something went wrong with the operation.',
      type: 'error',
      source: 'user',
      priority: 4,
      action: {
        label: 'Retry',
        onClick: () => retryOperation(),
      },
    });
  };

  return <button onClick={handleError}>Trigger Error</button>;
}
```

## Components

### NotificationProvider

The main provider that manages notification state and settings.

```tsx
<NotificationProvider
  storageKey="my-notifications"
  defaultSettings={{
    soundEnabled: true,
    showToasts: true,
    maxNotifications: 50,
  }}
>
  {children}
</NotificationProvider>
```

### NotificationSystem

Complete notification system with all features included.

```tsx
<NotificationSystem
  // Data for auto-detection
  events={events}
  alerts={alerts}
  systemMetrics={systemMetrics}
  oauthStatus={oauthStatus}
  
  // UI configuration
  toastPosition="top-right"
  maxToasts={5}
  showBell={true}
  
  // Behavior
  enableAutoDetection={true}
  defaultSettings={customSettings}
/>
```

### ToastContainer

Standalone toast notifications.

```tsx
<ToastContainer
  position="top-right"
  maxToasts={3}
  spacing={12}
/>
```

### NotificationCenter

Notification history and management.

```tsx
const [isOpen, setIsOpen] = useState(false);

<NotificationCenter
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
/>
```

### NotificationBell

Bell icon with unread count badge.

```tsx
<NotificationBell
  className="custom-styles"
  showBadge={true}
  onClick={() => setNotificationCenterOpen(true)}
/>
```

## Hooks

### useNotifications

Main hook for notification management.

```tsx
const {
  notifications,
  unreadCount,
  addNotification,
  removeNotification,
  dismissNotification,
  markAsViewed,
  markAllAsViewed,
  clearAll,
  settings,
  updateSettings,
  playNotificationSound,
} = useNotifications();
```

### useErrorDetection

Auto-detection of errors from monitoring data.

```tsx
const { processEvents, processAlerts } = useErrorDetection();

useEffect(() => {
  processEvents(newEvents);
}, [newEvents]);
```

### useSystemHealthNotifications

System health change notifications.

```tsx
const { checkSystemHealth } = useSystemHealthNotifications();

useEffect(() => {
  checkSystemHealth(currentHealth, metrics);
}, [currentHealth]);
```

### usePerformanceNotifications

Performance threshold monitoring.

```tsx
const { checkPerformanceThresholds } = usePerformanceNotifications();

useEffect(() => {
  checkPerformanceThresholds({
    apiLatency: metrics.latency,
    errorRate: metrics.errorRate,
    cpuUsage: metrics.cpuUsage,
  });
}, [metrics]);
```

## Notification Types

### Type Definitions

```tsx
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'critical' | 'success';
  timestamp: Date;
  duration?: number; // Auto-dismiss timeout (0 = manual)
  action?: {
    label: string;
    onClick: () => void;
  };
  metadata?: Record<string, any>;
  source?: 'event' | 'alert' | 'system' | 'user';
  priority?: number; // 1-5, higher = more important
}
```

### Type Behaviors

- **info**: Blue, 5s auto-dismiss, sine wave sound
- **success**: Green, 3s auto-dismiss, higher pitch sine wave
- **warning**: Yellow, 8s auto-dismiss, triangle wave sound
- **error**: Red, manual dismiss, square wave sound
- **critical**: Purple, manual dismiss, lower pitch square wave

## Settings

### Default Settings

```tsx
const defaultSettings = {
  enabled: true,
  soundEnabled: true,
  soundVolume: 0.3,
  enableForTypes: {
    info: true,
    warning: true,
    error: true,
    critical: true,
    success: true,
  },
  enableForSeverity: {
    info: true,
    warning: true,
    error: true,
    critical: true,
  },
  autoDismissDelay: {
    info: 5000,
    warning: 8000,
    error: 0, // Manual dismiss
    critical: 0, // Manual dismiss
    success: 3000,
  },
  maxNotifications: 50,
  duplicateTimeout: 5000, // 5s to prevent duplicates
  showToasts: true,
  showBadge: true,
  persistHistory: true,
};
```

## Sound System

The notification system includes a built-in Web Audio API sound system that generates synthetic notification sounds:

- **Info**: 440Hz sine wave (musical note A)
- **Success**: 523Hz sine wave (musical note C)
- **Warning**: 349Hz triangle wave (musical note F)
- **Error**: 220Hz square wave (musical note A, lower octave)
- **Critical**: 196Hz square wave (musical note G, lower octave)

Sounds are designed to be:
- Distinguishable from each other
- Not annoying or jarring
- Accessible (different frequencies for different severities)
- Low volume by default

## Auto-detection Features

### Event Processing

```tsx
// Events are automatically processed for notifications
const event = {
  id: 'evt-001',
  severity: 'error', // 'info' | 'warning' | 'error' | 'critical'
  title: 'Database Connection Failed',
  description: 'Unable to connect to primary database',
  // ... other event properties
};

// Automatically creates notification based on severity
```

### Alert Processing

```tsx
// Alerts are automatically processed
const alert = {
  id: 'alert-001',
  type: 'critical', // 'info' | 'warning' | 'error' | 'critical'
  title: 'Service Down',
  message: 'Authentication service is unavailable',
  actionRequired: true,
  // ... other alert properties
};

// Creates notification with action button if actionRequired=true
```

### System Health Monitoring

```tsx
// System health changes trigger notifications
checkSystemHealth('critical', {
  cpuUsage: 95,
  memoryUsage: 90,
  errorRate: 25,
});

// Automatically notifies of health changes:
// healthy → degraded → critical
// And recovery: critical → healthy
```

## Integration Examples

### With Monitoring Dashboard

```tsx
import { NotificationSystem } from './components/notifications';

function MonitoringDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);

  return (
    <NotificationSystem
      systemMetrics={metrics}
      events={events}
      alerts={alerts}
      enableAutoDetection={true}
      defaultSettings={{
        soundEnabled: true,
        showToasts: true,
        maxNotifications: 100,
      }}
    >
      <DashboardContent />
    </NotificationSystem>
  );
}
```

### Custom Integration

```tsx
import { 
  NotificationProvider, 
  useNotifications,
  useErrorDetection,
  useSystemHealthNotifications 
} from './components/notifications';

function CustomApp() {
  const { addNotification } = useNotifications();
  const { processEvents } = useErrorDetection();
  const { checkSystemHealth } = useSystemHealthNotifications();

  // Custom logic for notifications
  const handleCustomEvent = (data) => {
    if (data.critical) {
      addNotification({
        title: 'Critical Issue Detected',
        message: data.message,
        type: 'critical',
        source: 'custom',
        priority: 5,
        action: {
          label: 'View Details',
          onClick: () => showDetails(data),
        },
      });
    }
  };

  return (
    <div>
      {/* Your custom UI */}
    </div>
  );
}
```

## Styling and Customization

The notification system uses Tailwind CSS classes and follows the dashboard theme system. All components are styled with:

- Dark theme optimized colors
- Glass morphism effects
- Smooth animations
- Responsive design
- High contrast for accessibility

### Custom Styles

You can customize appearance by:

1. **Theme Integration**: Uses dashboard theme colors automatically
2. **CSS Classes**: Override with custom Tailwind classes
3. **Settings**: Adjust behavior through settings object
4. **Position**: Configure toast position and spacing

## Performance Considerations

- **Memory Management**: Automatically cleans up old notifications
- **Duplicate Prevention**: 5-second window to prevent duplicate notifications
- **Batching**: Similar notifications are batched to prevent spam
- **Lazy Loading**: Components only render when needed
- **Optimized Animations**: Uses transform instead of layout changes

## Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Web Audio API**: For sound notifications (graceful fallback)
- **LocalStorage**: For persistence (graceful fallback)
- **Framer Motion**: For animations

## Testing

Use the `NotificationExample` component to test all features:

```tsx
import NotificationExample from './components/notifications/NotificationExample';

function TestPage() {
  return <NotificationExample />;
}
```

The example includes:
- Manual notification triggers
- Auto-mode for continuous testing
- Sound testing
- Settings adjustment
- Real-time statistics

## Troubleshooting

### Common Issues

1. **Notifications not showing**: Check if `settings.enabled` is true
2. **No sound**: Verify Web Audio API support and `settings.soundEnabled`
3. **Duplicates**: Adjust `settings.duplicateTimeout`
4. **Performance**: Reduce `settings.maxNotifications`
5. **Storage errors**: Check localStorage availability

### Debug Mode

Enable debug logging:

```tsx
const settings = {
  ...defaultSettings,
  debug: true, // Enable console logging
};
```

## License

This notification system is part of the monitoring dashboard and follows the same license terms.