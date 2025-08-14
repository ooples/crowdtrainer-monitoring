// App Monitor SDK - Auto-configured
const config = require('../monitoring.config.js');

class MonitoringSDK {
  constructor() {
    this.config = config;
    this.queue = [];
    this.initialized = false;
    this.init();
  }

  init() {
    if (typeof window !== 'undefined') {
      // Browser environment
      window.addEventListener('error', (e) => this.captureError(e.error));
      window.addEventListener('unhandledrejection', (e) => this.captureError(e.reason));
    } else if (typeof process !== 'undefined') {
      // Node.js environment
      process.on('uncaughtException', (error) => this.captureError(error));
      process.on('unhandledRejection', (error) => this.captureError(error));
    }
    
    this.initialized = true;
    this.startBatchSending();
  }

  startBatchSending() {
    setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, 5000);
  }

  async flush() {
    const events = [...this.queue];
    this.queue = [];
    
    try {
      await fetch(`${this.config.apiUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({ events })
      });
    } catch (error) {
      console.error('Failed to send monitoring events:', error);
      this.queue.unshift(...events);
    }
  }

  trackEvent(name, properties = {}) {
    this.queue.push({
      type: 'event',
      name,
      properties,
      timestamp: Date.now()
    });
  }

  captureError(error, context = {}) {
    this.queue.push({
      type: 'error',
      message: error?.message || String(error),
      stack: error?.stack,
      context,
      timestamp: Date.now()
    });
    this.flush(); // Send errors immediately
  }

  trackPageView(path, properties = {}) {
    this.trackEvent('page_view', { path, ...properties });
  }

  setUser(user) {
    this.user = user;
    this.trackEvent('identify', { user });
  }
}

module.exports = new MonitoringSDK();
