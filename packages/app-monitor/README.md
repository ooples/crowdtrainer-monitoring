# App Monitor

A complete, self-contained monitoring solution for web applications. Zero external dependencies - just install and run!

## ✨ Features

- 📊 **Real-time Dashboard** - Beautiful web interface for monitoring
- 🚀 **Zero Dependencies** - No PostgreSQL, Redis, or Docker required
- 📦 **Single Command Setup** - Initialize and start with one command
- 🔄 **Automatic SDK Integration** - Drops right into your project
- 💾 **Built-in Storage** - Uses lightweight JSON storage
- 🎯 **Event Tracking** - Custom events, errors, and metrics
- 👤 **User Analytics** - Track user sessions and behaviors
- ⚡ **Performance Monitoring** - Page load times and API latency

## 🚀 Quick Start

### 1. Install in Your Project

Navigate to your project directory and run:

```bash
npx @app-monitor/core init
```

This will:
- Create `.monitoring/` directory for data storage
- Generate `monitoring.config.js` with your unique API key
- Install the SDK at `lib/monitoring.js`

### 2. Start the Monitoring Service

```bash
npx @app-monitor/core start
```

This starts:
- **API Server** on http://localhost:4000
- **Dashboard** on http://localhost:4001

That's it! No database setup, no Docker, no complex configuration.

### 3. Use the SDK in Your App

```javascript
// Import the SDK
const monitoring = require('./lib/monitoring');

// Track events
monitoring.trackEvent('user_signup', { 
  plan: 'premium' 
});

// Track errors
monitoring.captureError(error, {
  userId: user.id
});

// Track page views
monitoring.trackPageView('/dashboard');

// Identify users
monitoring.setUser({
  id: 'user123',
  email: 'user@example.com'
});
```

## 📝 React/Next.js Integration

```jsx
import { useEffect } from 'react';

export default function MyApp() {
  useEffect(() => {
    const monitoring = require('./lib/monitoring');
    
    // Track page view
    monitoring.trackPageView(window.location.pathname);
    
    // Set user if logged in
    if (user) {
      monitoring.setUser({
        id: user.id,
        email: user.email
      });
    }
  }, []);
  
  return <div>Your App</div>;
}
```

## 🛠️ Commands

```bash
# Initialize monitoring in your project
npx @app-monitor/core init

# Start monitoring services
npx @app-monitor/core start

# Start in background (daemon mode)
npx @app-monitor/core start --daemon

# Stop all monitoring services
npx @app-monitor/core stop

# Check service status
npx @app-monitor/core status
```

## 📊 Dashboard Features

Visit http://localhost:4001 to see:

- **Real-time Statistics** - Events, errors, metrics, and user counts
- **Recent Events** - Live stream of all tracked events
- **Error Tracking** - Detailed error messages with stack traces
- **Auto-refresh** - Updates every 5 seconds
- **Health Status** - Service availability indicator

## 🔧 Configuration

Edit `monitoring.config.js` in your project root:

```javascript
module.exports = {
  // Your unique API key (auto-generated)
  apiKey: 'ctm_xxxxxxxxxxxxx',
  
  // Service endpoints
  apiUrl: 'http://localhost:4000',
  dashboardUrl: 'http://localhost:4001',
  
  // Feature flags
  features: {
    errorTracking: true,
    performanceMonitoring: true,
    userAnalytics: true,
    customEvents: true,
    realtimeAlerts: true
  }
};
```

## 📁 Project Structure

After installation, you'll have:

```
your-project/
├── .monitoring/          # Data storage
│   ├── events.json      # Event data
│   ├── errors.json      # Error logs
│   └── metrics.json     # Performance metrics
├── lib/
│   └── monitoring.js    # SDK integration
└── monitoring.config.js # Configuration
```

## 🎯 SDK Methods

| Method | Description | Example |
|--------|-------------|---------|
| `trackEvent(name, properties)` | Track custom events | `trackEvent('purchase', { amount: 99.99 })` |
| `captureError(error, context)` | Log errors | `captureError(err, { userId: '123' })` |
| `trackPageView(path, properties)` | Track page views | `trackPageView('/products')` |
| `setUser(user)` | Identify user | `setUser({ id: '123', email: 'user@example.com' })` |

## 🚫 No External Dependencies

Unlike traditional monitoring solutions, this service requires:
- ❌ No PostgreSQL
- ❌ No Redis  
- ❌ No Docker
- ❌ No complex setup
- ✅ Just Node.js!

## 💡 How It Works

1. **Lightweight Storage** - Uses JSON files for data persistence
2. **Automatic Batching** - SDK batches events and sends every 5 seconds
3. **Error Recovery** - Failed requests are automatically retried
4. **Real-time Updates** - Dashboard polls for new data every 5 seconds

## 🔒 Security

- Unique API keys per installation
- Local-only by default (localhost)
- No external data transmission
- All data stored in your project directory

## 📈 Performance

- Minimal overhead (~5ms per event)
- Async event tracking (non-blocking)
- Automatic event batching
- Stores last 1000 events per type

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/crowdtrainer/monitoring/issues)
- **Docs**: [Full Documentation](https://docs.crowdtrainer.ai/monitoring)

## 📄 License

MIT © CrowdTrainer

---

**Made with ❤️ by the CrowdTrainer team**