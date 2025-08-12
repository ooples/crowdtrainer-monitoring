# App Monitor - Installation Guide

**App Monitor** is a standalone, zero-dependency monitoring solution for any web application. It provides real-time analytics, error tracking, and performance monitoring with a beautiful dashboard.

## 📋 Prerequisites

- Node.js 16+ installed
- A web application to monitor (React, Next.js, Vue, Angular, or vanilla JS)

## 🚀 Installation Steps

### Step 1: Initialize App Monitor in Your Project

Navigate to your application's root directory and run:

```bash
npx @app-monitor/core init
```

This command will:
- ✅ Create a `.monitoring/` directory for data storage
- ✅ Generate `monitoring.config.js` with a unique API key
- ✅ Install the monitoring SDK at `lib/monitoring.js`
- ✅ Set up everything automatically - no manual configuration needed!

### Step 2: Start the Monitoring Services

```bash
npx @app-monitor/core start
```

This starts:
- 🔧 **API Server** on `http://localhost:4000` - Receives and stores monitoring data
- 📊 **Dashboard** on `http://localhost:4001` - View your analytics in real-time

> **Note:** To run services in the background (daemon mode), use:
> ```bash
> npx @app-monitor/core start --daemon
> ```

### Step 3: Integrate the SDK

Add monitoring to your application:

#### For React/Next.js:

```jsx
// In your main App component or _app.js
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const monitoring = require('./lib/monitoring');
    
    // Track page views
    monitoring.trackPageView(window.location.pathname);
    
    // Identify logged-in users (optional)
    if (currentUser) {
      monitoring.setUser({
        id: currentUser.id,
        email: currentUser.email
      });
    }
  }, []);

  return <YourApp />;
}
```

#### For Vanilla JavaScript:

```html
<!-- Add to your main HTML file -->
<script>
  const monitoring = require('./lib/monitoring');
  
  // Track page view
  monitoring.trackPageView(window.location.pathname);
  
  // Track custom events
  monitoring.trackEvent('button_click', {
    button: 'signup',
    page: 'homepage'
  });
</script>
```

### Step 4: View Your Dashboard

Open your browser and navigate to:

**http://localhost:4001**

You'll see:
- 📈 Real-time event stream
- 🔴 Error tracking with stack traces
- 📊 User analytics and metrics
- ⚡ Performance monitoring

## 🎯 Quick Test

To verify everything is working:

1. Create a test page in your app:

```javascript
// test-monitoring.js
const monitoring = require('./lib/monitoring');

// Send test event
monitoring.trackEvent('test_event', {
  message: 'App Monitor is working!',
  timestamp: Date.now()
});

// Send test error
try {
  throw new Error('Test error - ignore this');
} catch (error) {
  monitoring.captureError(error, {
    intentional: true
  });
}

console.log('Test events sent! Check dashboard at http://localhost:4001');
```

2. Run the test and check your dashboard for the events

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npx @app-monitor/core init` | Initialize monitoring in your project |
| `npx @app-monitor/core start` | Start monitoring services |
| `npx @app-monitor/core start --daemon` | Start in background mode |
| `npx @app-monitor/core stop` | Stop all monitoring services |
| `npx @app-monitor/core status` | Check service status |

## 📦 What Gets Installed

```
your-project/
├── .monitoring/           # Data storage (auto-created)
│   ├── events.json       # Event data
│   ├── errors.json       # Error logs
│   └── metrics.json      # Performance metrics
├── lib/
│   └── monitoring.js     # SDK integration file
└── monitoring.config.js  # Configuration (auto-generated)
```

## ⚙️ Configuration

The `monitoring.config.js` file is automatically generated with sensible defaults:

```javascript
module.exports = {
  // Unique API key for your app
  apiKey: 'am_xxxxxxxxxxxxx',
  
  // Service endpoints (default: localhost)
  apiUrl: 'http://localhost:4000',
  dashboardUrl: 'http://localhost:4001',
  
  // Feature toggles
  features: {
    errorTracking: true,
    performanceMonitoring: true,
    userAnalytics: true,
    customEvents: true,
    realtimeAlerts: true
  }
};
```

## 🔌 SDK API Reference

### Core Methods

```javascript
const monitoring = require('./lib/monitoring');

// Track custom events
monitoring.trackEvent('event_name', {
  property1: 'value1',
  property2: 'value2'
});

// Capture errors
monitoring.captureError(error, {
  userId: 'user123',
  context: 'checkout_flow'
});

// Track page views
monitoring.trackPageView('/page-path', {
  referrer: document.referrer
});

// Identify users
monitoring.setUser({
  id: 'user123',
  email: 'user@example.com',
  plan: 'premium'
});
```

## 🚫 Zero External Dependencies

Unlike other monitoring solutions, App Monitor requires:

- ❌ **No PostgreSQL** - Uses lightweight JSON storage
- ❌ **No Redis** - Built-in caching
- ❌ **No Docker** - Pure Node.js
- ❌ **No Complex Setup** - Works out of the box
- ✅ **Just Node.js** - That's it!

## 📊 Dashboard Features

The dashboard (http://localhost:4001) provides:

- **Real-time Statistics** - Live counters for events, errors, and users
- **Event Stream** - See events as they happen
- **Error Tracking** - Detailed error messages with stack traces
- **User Analytics** - Track unique users and sessions
- **Auto-refresh** - Updates every 5 seconds
- **Health Monitoring** - Service status indicators

## 🔒 Security & Privacy

- All data is stored locally in your project
- No external services or cloud dependencies
- Unique API keys per installation
- Localhost-only by default (configure for production use)

## 🐛 Troubleshooting

### Services won't start
```bash
# Check if ports are already in use
npx @app-monitor/core status

# Stop any running services
npx @app-monitor/core stop

# Restart
npx @app-monitor/core start
```

### Dashboard not loading
- Ensure services are running: `npx @app-monitor/core status`
- Check if port 4001 is available
- Try accessing directly: http://localhost:4001

### Events not appearing
- Verify API server is running on port 4000
- Check your `monitoring.config.js` has correct `apiUrl`
- Look for errors in browser console

## 📈 Production Deployment

For production environments:

1. Update `monitoring.config.js` with production URLs
2. Use a process manager like PM2:
   ```bash
   pm2 start "npx @app-monitor/core start" --name app-monitor
   ```
3. Configure your firewall to allow dashboard access
4. Set up SSL/TLS for secure data transmission

## 💡 Best Practices

1. **User Identification** - Always call `setUser()` for logged-in users
2. **Error Context** - Include relevant context when capturing errors
3. **Event Naming** - Use consistent, descriptive event names
4. **Performance** - The SDK batches events automatically (every 5 seconds)
5. **Privacy** - Don't track sensitive user data

## 🤝 Support

- **Documentation**: Full API docs included in the package
- **Issues**: Report bugs via GitHub Issues
- **Updates**: Check for updates with `npm update @app-monitor/core`

---

## 🎉 Success!

If you can see your events in the dashboard, you're all set! App Monitor is now tracking your application's performance, errors, and user interactions.

**Dashboard URL**: http://localhost:4001

Happy monitoring! 🚀