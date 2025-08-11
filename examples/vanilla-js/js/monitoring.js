/**
 * CrowdTrainer Monitoring Library - Vanilla JavaScript
 * Lightweight monitoring solution for any website
 */

(function(global) {
  'use strict';

  // Monitoring configuration
  const DEFAULT_CONFIG = {
    apiEndpoint: 'http://localhost:3001/api/monitoring',
    enableAutoTracking: true,
    enablePerformanceTracking: true,
    enableErrorTracking: true,
    enableUserJourney: true,
    environment: 'development',
    debug: false,
    bufferSize: 10,
    flushInterval: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
  };

  // Generate unique session ID
  function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
  }

  // Generate unique user ID (stored in localStorage)
  function generateUserId() {
    let userId = localStorage.getItem('crowdtrainer_user_id');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('crowdtrainer_user_id', userId);
    }
    return userId;
  }

  // Main monitoring class
  class CrowdTrainerMonitoring {
    constructor() {
      this.config = { ...DEFAULT_CONFIG };
      this.sessionId = generateSessionId();
      this.userId = generateUserId();
      this.eventBuffer = [];
      this.isOnline = navigator.onLine;
      this.sessionStart = Date.now();
      this.pageLoadStart = Date.now();
      this.eventCounts = {
        events: 0,
        errors: 0,
        pageViews: 0,
        interactions: 0,
      };
      this.userJourney = [];
      this.initialized = false;

      // Bind methods
      this.handleError = this.handleError.bind(this);
      this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
      this.handleOnline = this.handleOnline.bind(this);
      this.handleOffline = this.handleOffline.bind(this);
      this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    }

    /**
     * Initialize monitoring system
     * @param {Object} userConfig - User configuration options
     */
    init(userConfig = {}) {
      this.config = { ...this.config, ...userConfig };
      
      if (this.config.debug) {
        console.log('[CrowdTrainer] Initializing monitoring...', this.config);
      }

      this.setupEventListeners();
      this.setupPerformanceTracking();
      this.startFlushInterval();
      this.trackPageLoad();
      
      this.initialized = true;
      
      if (this.config.debug) {
        console.log('[CrowdTrainer] Monitoring initialized');
      }

      // Track initialization
      this.track({
        category: 'monitoring',
        action: 'initialized',
        metadata: {
          config: this.config,
          userAgent: navigator.userAgent,
        },
      });

      return this;
    }

    /**
     * Set up global event listeners
     */
    setupEventListeners() {
      if (this.config.enableErrorTracking) {
        window.addEventListener('error', this.handleError);
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
      }

      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      window.addEventListener('beforeunload', this.handleBeforeUnload);

      if (this.config.enableAutoTracking) {
        this.setupAutoTracking();
      }
    }

    /**
     * Set up automatic event tracking
     */
    setupAutoTracking() {
      // Track clicks
      document.addEventListener('click', (event) => {
        const element = event.target;
        const tagName = element.tagName.toLowerCase();
        const elementId = element.id;
        const elementClass = element.className;
        
        this.track({
          category: 'user_interaction',
          action: 'click',
          label: tagName,
          metadata: {
            element_id: elementId,
            element_class: elementClass,
            element_text: element.textContent?.substring(0, 100),
            x: event.clientX,
            y: event.clientY,
          },
        });
      });

      // Track form submissions
      document.addEventListener('submit', (event) => {
        const form = event.target;
        const formId = form.id || 'unknown';
        const formData = new FormData(form);
        const formFields = Array.from(formData.keys());

        this.track({
          category: 'user_interaction',
          action: 'form_submit',
          label: formId,
          metadata: {
            form_id: formId,
            form_fields: formFields,
            field_count: formFields.length,
          },
        });
      });

      // Track scroll depth (throttled)
      let maxScrollDepth = 0;
      const trackScroll = this.throttle(() => {
        const scrollDepth = Math.round(
          (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );
        
        if (scrollDepth > maxScrollDepth) {
          maxScrollDepth = scrollDepth;
          
          this.track({
            category: 'user_engagement',
            action: 'scroll_depth',
            value: scrollDepth,
            metadata: {
              scroll_position: window.scrollY,
              page_height: document.documentElement.scrollHeight,
            },
          });
        }
      }, 1000);

      window.addEventListener('scroll', trackScroll);

      // Track page visibility changes
      document.addEventListener('visibilitychange', () => {
        this.track({
          category: 'user_engagement',
          action: document.hidden ? 'page_hidden' : 'page_visible',
          metadata: {
            visibility_state: document.visibilityState,
          },
        });
      });
    }

    /**
     * Set up performance tracking
     */
    setupPerformanceTracking() {
      if (!this.config.enablePerformanceTracking) return;

      // Track page load performance
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.trackPagePerformance();
        }, 100);
      });

      // Track Core Web Vitals if supported
      if ('PerformanceObserver' in window) {
        try {
          // Largest Contentful Paint
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            
            this.trackPerformance({
              name: 'largest_contentful_paint',
              value: lastEntry.startTime,
              unit: 'ms',
            });
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

          // First Input Delay
          const fidObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              this.trackPerformance({
                name: 'first_input_delay',
                value: entry.processingStart - entry.startTime,
                unit: 'ms',
              });
            }
          });
          fidObserver.observe({ entryTypes: ['first-input'] });

          // Cumulative Layout Shift
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            
            this.trackPerformance({
              name: 'cumulative_layout_shift',
              value: clsValue,
              unit: 'count',
            });
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });

        } catch (error) {
          if (this.config.debug) {
            console.warn('[CrowdTrainer] Performance Observer not fully supported:', error);
          }
        }
      }
    }

    /**
     * Track page load performance
     */
    trackPagePerformance() {
      if (!window.performance || !window.performance.timing) return;

      const timing = window.performance.timing;
      const navigation = window.performance.getEntriesByType('navigation')[0];

      // Basic timing metrics
      const metrics = {
        page_load_time: timing.loadEventEnd - timing.navigationStart,
        dom_content_loaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        first_paint: this.getFirstPaint(),
        dns_lookup_time: timing.domainLookupEnd - timing.domainLookupStart,
        tcp_connection_time: timing.connectEnd - timing.connectStart,
        server_response_time: timing.responseEnd - timing.requestStart,
      };

      // Track each metric
      Object.entries(metrics).forEach(([name, value]) => {
        if (value > 0) {
          this.trackPerformance({
            name,
            value,
            unit: 'ms',
          });
        }
      });

      // Track navigation type
      this.track({
        category: 'performance',
        action: 'page_load',
        value: metrics.page_load_time,
        metadata: {
          navigation_type: navigation?.type || 'unknown',
          metrics,
        },
      });
    }

    /**
     * Get First Paint timing
     */
    getFirstPaint() {
      if (!window.performance || !window.performance.getEntriesByType) return 0;
      
      const paintEntries = window.performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
      return firstPaint ? firstPaint.startTime : 0;
    }

    /**
     * Track page load event
     */
    trackPageLoad() {
      this.eventCounts.pageViews++;
      
      const pageData = {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        timestamp: Date.now(),
      };

      this.userJourney.push(pageData);

      this.track({
        category: 'user_journey',
        action: 'page_view',
        label: window.location.pathname,
        metadata: {
          ...pageData,
          journey_step: this.userJourney.length,
          session_duration: this.getSessionDuration(),
        },
      });
    }

    /**
     * Track custom event
     * @param {Object} event - Event data
     */
    track(event) {
      if (!this.initialized && event.category !== 'monitoring') {
        if (this.config.debug) {
          console.warn('[CrowdTrainer] Monitoring not initialized, skipping event:', event);
        }
        return;
      }

      const eventData = {
        type: 'event',
        category: event.category,
        action: event.action,
        label: event.label || null,
        value: event.value || null,
        userId: this.userId,
        sessionId: this.sessionId,
        metadata: {
          ...event.metadata,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        },
        environment: this.config.environment,
      };

      this.eventCounts.events++;
      this.addToBuffer(eventData);

      if (this.config.debug) {
        console.log('[CrowdTrainer] Event tracked:', eventData);
      }

      // Trigger custom event for listeners
      this.dispatchCustomEvent('eventTracked', eventData);
    }

    /**
     * Track performance metric
     * @param {Object} metric - Performance metric data
     */
    trackPerformance(metric) {
      const performanceData = {
        type: 'performance',
        name: metric.name,
        value: metric.value,
        unit: metric.unit || 'ms',
        userId: this.userId,
        sessionId: this.sessionId,
        metadata: {
          ...metric.metadata,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        },
        environment: this.config.environment,
      };

      this.addToBuffer(performanceData);

      if (this.config.debug) {
        console.log('[CrowdTrainer] Performance metric tracked:', performanceData);
      }

      this.dispatchCustomEvent('performanceTracked', performanceData);
    }

    /**
     * Track error
     * @param {Error} error - Error object
     * @param {Object} context - Additional context
     */
    trackError(error, context = {}) {
      this.eventCounts.errors++;

      const errorData = {
        type: 'error',
        category: context.category || 'javascript_error',
        action: context.action || 'error_occurred',
        label: context.label || error.name,
        userId: this.userId,
        sessionId: this.sessionId,
        metadata: {
          ...context.metadata,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          url: window.location.href,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        },
        environment: this.config.environment,
        severity: context.severity || 'medium',
      };

      this.addToBuffer(errorData);

      if (this.config.debug) {
        console.log('[CrowdTrainer] Error tracked:', errorData);
      }

      this.dispatchCustomEvent('errorTracked', errorData);
    }

    /**
     * Add data to buffer
     * @param {Object} data - Data to buffer
     */
    addToBuffer(data) {
      this.eventBuffer.push(data);

      if (this.eventBuffer.length >= this.config.bufferSize) {
        this.flush();
      }
    }

    /**
     * Flush buffered events to server
     */
    async flush() {
      if (this.eventBuffer.length === 0) return;

      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      try {
        await this.sendEvents(events);
        
        if (this.config.debug) {
          console.log(`[CrowdTrainer] Flushed ${events.length} events`);
        }
      } catch (error) {
        // Re-add events to buffer on failure
        this.eventBuffer.unshift(...events);
        
        if (this.config.debug) {
          console.error('[CrowdTrainer] Failed to flush events:', error);
        }
      }
    }

    /**
     * Send events to server
     * @param {Array} events - Events to send
     */
    async sendEvents(events) {
      if (!this.isOnline) {
        throw new Error('Offline - events will be retried when online');
      }

      let lastError;
      
      for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
        try {
          const response = await fetch(`${this.config.apiEndpoint}/events`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ events }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return await response.json();
          
        } catch (error) {
          lastError = error;
          
          if (attempt < this.config.retryAttempts - 1) {
            await this.delay(this.config.retryDelay * Math.pow(2, attempt));
          }
        }
      }

      throw lastError;
    }

    /**
     * Start automatic buffer flushing
     */
    startFlushInterval() {
      setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }

    /**
     * Get session duration in milliseconds
     */
    getSessionDuration() {
      return Date.now() - this.sessionStart;
    }

    /**
     * Get current statistics
     */
    getStats() {
      return {
        sessionDuration: this.getSessionDuration(),
        sessionId: this.sessionId,
        userId: this.userId,
        ...this.eventCounts,
        bufferSize: this.eventBuffer.length,
        userJourney: this.userJourney,
        isOnline: this.isOnline,
      };
    }

    /**
     * Export session data
     */
    exportData() {
      const data = {
        session: {
          id: this.sessionId,
          userId: this.userId,
          startTime: this.sessionStart,
          duration: this.getSessionDuration(),
        },
        stats: this.getStats(),
        journey: this.userJourney,
        config: this.config,
        timestamp: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crowdtrainer-session-${this.sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.track({
        category: 'feature_usage',
        action: 'data_exported',
        metadata: {
          export_size: data.stats.events,
        },
      });
    }

    /**
     * Clear current session
     */
    clearSession() {
      this.eventCounts = {
        events: 0,
        errors: 0,
        pageViews: 0,
        interactions: 0,
      };
      this.userJourney = [];
      this.eventBuffer = [];
      this.sessionId = generateSessionId();
      this.sessionStart = Date.now();

      this.track({
        category: 'session',
        action: 'session_cleared',
      });
    }

    // Event handlers
    handleError(event) {
      this.trackError(new Error(event.message), {
        category: 'javascript_error',
        action: 'window_error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    }

    handleUnhandledRejection(event) {
      this.trackError(new Error(event.reason?.message || 'Unhandled Promise Rejection'), {
        category: 'promise_rejection',
        action: 'unhandled_rejection',
        metadata: {
          reason: event.reason,
        },
      });
    }

    handleOnline() {
      this.isOnline = true;
      
      this.track({
        category: 'connectivity',
        action: 'online',
      });

      // Flush any queued events
      this.flush();
    }

    handleOffline() {
      this.isOnline = false;
      
      this.track({
        category: 'connectivity',
        action: 'offline',
      });
    }

    handleBeforeUnload() {
      // Send any remaining events using sendBeacon if available
      if (this.eventBuffer.length > 0 && navigator.sendBeacon) {
        const data = JSON.stringify({ events: this.eventBuffer });
        navigator.sendBeacon(`${this.config.apiEndpoint}/beacon`, data);
      }

      // Track session end
      this.track({
        category: 'session',
        action: 'session_end',
        metadata: {
          session_duration: this.getSessionDuration(),
          total_events: this.eventCounts.events,
          pages_visited: this.eventCounts.pageViews,
        },
      });
    }

    // Utility methods
    throttle(func, limit) {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    dispatchCustomEvent(name, data) {
      if (typeof window.CustomEvent !== 'function') return;
      
      const event = new CustomEvent(`crowdtrainer:${name}`, {
        detail: data,
      });
      
      window.dispatchEvent(event);
    }
  }

  // Create global instance
  const monitoring = new CrowdTrainerMonitoring();

  // Expose to global scope
  global.CrowdTrainerMonitoring = {
    init: (config) => monitoring.init(config),
    track: (event) => monitoring.track(event),
    trackPerformance: (metric) => monitoring.trackPerformance(metric),
    trackError: (error, context) => monitoring.trackError(error, context),
    getStats: () => monitoring.getStats(),
    exportData: () => monitoring.exportData(),
    clearSession: () => monitoring.clearSession(),
    flush: () => monitoring.flush(),
    instance: monitoring,
  };

  // Auto-initialize if config is found in global scope
  if (global.CrowdTrainerConfig) {
    monitoring.init(global.CrowdTrainerConfig);
  }

})(window);